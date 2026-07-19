import { parseDataType } from "./schema-export";
import { getCostPreset } from "./cost-presets";

export interface CostEstimateColumn {
  dataType: string;
}

export interface CostEstimateTable {
  name: string;
  columns: CostEstimateColumn[];
}

export interface CostEstimateInputParams {
  presetId: string;
  monthlyActiveUsers: number;
  avgRequestsPerUser: number;
  assumedRowsPerTable: number;
  manualFileStorageGb: number;
  egressGbPerMonth: number;
}

export interface TableStorageBreakdown {
  name: string;
  columnCount: number;
  rowSizeBytes: number;
  estimatedGb: number;
}

export interface CostBreakdown {
  base: number;
  computeOverage: number;
  storageOverage: number;
  egressOverage: number;
}

export interface CostEstimateResult {
  derivedStorageGb: number;
  totalStorageGb: number;
  perTableBreakdown: TableStorageBreakdown[];
  totalCostUsd: number;
  breakdown: CostBreakdown;
  flags: string[];
}

// Flat per-row overhead for InnoDB row header + null-bitmap, and a flat
// multiplier standing in for the clustered PK index + typical secondary
// indexes on FK/unique columns. Both are deliberately simple constants, not
// computed per-column — this whole feature is a rough planning estimate,
// not a byte-accurate storage engine simulation (see the "not a bill"
// framing in the cost panel copy).
const ROW_OVERHEAD_BYTES = 20;
const INDEX_OVERHEAD_MULTIPLIER = 1.2;
const UNRECOGNIZED_TYPE_BYTES = 16;
const DEFAULT_VARCHAR_LENGTH = 191; // matches Prisma's own MySQL default when a length isn't given

const FLAT_TYPE_BYTES: Record<string, number> = {
  tinyint: 1,
  boolean: 1,
  bool: 1,
  smallint: 2,
  mediumint: 3,
  int: 4,
  integer: 4,
  bigint: 8,
  float: 4,
  double: 8,
  date: 3,
  time: 3,
  datetime: 8,
  timestamp: 8,
  json: 200,
  tinytext: 100,
  text: 500,
  mediumtext: 2000,
  longtext: 5000,
  tinyblob: 100,
  blob: 500,
  binary: 500,
  varbinary: 500,
  mediumblob: 2000,
  longblob: 5000,
  enum: 2,
  uuid: 36,
};

// SQL-type-string -> average-bytes-per-row estimate. Same "reviewable
// scaffold, not a lossless parser" philosophy as schema-export.ts's
// mapSqlType — anything unrecognized falls back to a flat 16 bytes rather
// than throwing, since a bad guess here only skews an already-approximate
// number, it never breaks the calculation.
export function estimateColumnBytes(dataType: string): number {
  const { base, args } = parseDataType(dataType);

  if (base === "varchar" || base === "char") {
    const length = Number(args[0]) || DEFAULT_VARCHAR_LENGTH;
    // ~50% fill assumption + a length-prefix allowance — an assumption,
    // not a measurement of real data.
    return length * 0.5 + 2;
  }
  if (base === "decimal" || base === "numeric") {
    const precision = Number(args[0]) || 10;
    return Math.ceil(precision / 2) + 1;
  }

  return FLAT_TYPE_BYTES[base] ?? UNRECOGNIZED_TYPE_BYTES;
}

function estimateRowBytes(columns: CostEstimateColumn[]): number {
  return columns.reduce((sum, col) => sum + estimateColumnBytes(col.dataType), 0) + ROW_OVERHEAD_BYTES;
}

const BYTES_PER_GB = 1024 ** 3;

function buildPerTableBreakdown(tables: CostEstimateTable[], assumedRowsPerTable: number): TableStorageBreakdown[] {
  return tables.map((table) => {
    const rowSizeBytes = estimateRowBytes(table.columns);
    const tableBytes = rowSizeBytes * assumedRowsPerTable * INDEX_OVERHEAD_MULTIPLIER;
    return {
      name: table.name,
      columnCount: table.columns.length,
      rowSizeBytes,
      estimatedGb: tableBytes / BYTES_PER_GB,
    };
  });
}

const SINGLE_TABLE_DOMINANCE_RATIO = 0.5;
const STORAGE_INSTANCE_COMFORT_GB = 8;
const HIGH_REQUESTS_PER_USER_THRESHOLD = 500;
const HIGH_EGRESS_PER_USER_GB_THRESHOLD = 0.5;

// Plain threshold checks on already-computed numbers — no new numeric
// claims, just qualitative "watch out for this" flags. Deliberately not
// framed as errors: these are heuristic nudges, not diagnoses.
function computeBottleneckFlags(
  perTableBreakdown: TableStorageBreakdown[],
  totalStorageGb: number,
  input: CostEstimateInputParams,
): string[] {
  const flags: string[] = [];

  if (perTableBreakdown.length > 0 && totalStorageGb > 0) {
    const dominant = perTableBreakdown.reduce((max, t) => (t.estimatedGb > max.estimatedGb ? t : max));
    const share = dominant.estimatedGb / totalStorageGb;
    if (share > SINGLE_TABLE_DOMINANCE_RATIO) {
      flags.push(
        `Tahmini olarak \`${dominant.name}\` tablosu toplam depolamanızın yaklaşık %${Math.round(share * 100)}'ini oluşturuyor — büyüdükçe arşivleme ya da parçalama (partitioning) düşünebilirsiniz.`,
      );
    }
  }

  if (totalStorageGb > STORAGE_INSTANCE_COMFORT_GB) {
    flags.push(
      `Toplam tahmini depolama (~${totalStorageGb.toFixed(1)} GB), tipik tek-instance yönetilen veritabanlarının rahat sınırına yaklaşıyor.`,
    );
  }

  if (input.avgRequestsPerUser > HIGH_REQUESTS_PER_USER_THRESHOLD) {
    flags.push(
      `Kullanıcı başına aylık istek sayısı (${input.avgRequestsPerUser}) yüksek görünüyor — eksik önbellekleme ya da N+1 sorgu olup olmadığını kontrol edin.`,
    );
  }

  if (
    input.monthlyActiveUsers > 0 &&
    input.egressGbPerMonth / input.monthlyActiveUsers > HIGH_EGRESS_PER_USER_GB_THRESHOLD
  ) {
    flags.push("Kullanıcı başına veri transferi yüksek görünüyor — büyük yanıtlar ya da optimize edilmemiş görseller olabilir.");
  }

  return flags;
}

// The full v0 formula (see TODOS.md / the plan this shipped from for the
// reasoning): included-quota-then-overage per line item, not linear from
// zero — real infra tiers bundle a base allowance, and charging for
// already-included usage would make every estimate look worse than
// reality. avgRequestsPerUser deliberately never multiplies into the
// dollar total (see computeBottleneckFlags) — it only feeds the
// qualitative flags, so this generator never has to source and defend a
// second, separate $/request rate on top of an already-illustrative
// $/MAU-overage one.
export function computeCostEstimate(
  input: CostEstimateInputParams,
  tables: CostEstimateTable[],
): CostEstimateResult {
  const preset = getCostPreset(input.presetId);

  const perTableBreakdown = buildPerTableBreakdown(tables, input.assumedRowsPerTable);
  const derivedStorageGb = perTableBreakdown.reduce((sum, t) => sum + t.estimatedGb, 0);
  const totalStorageGb = derivedStorageGb + input.manualFileStorageGb;

  const computeOverage = Math.max(0, input.monthlyActiveUsers - preset.includedMAU) * preset.perActiveUserOverageUsd;
  const storageOverage = Math.max(0, totalStorageGb - preset.includedStorageGb) * preset.storageOverageUsdPerGb;
  const egressOverage = Math.max(0, input.egressGbPerMonth - preset.includedEgressGb) * preset.egressOverageUsdPerGb;

  const totalCostUsd = preset.baseCostUsd + computeOverage + storageOverage + egressOverage;

  return {
    derivedStorageGb,
    totalStorageGb,
    perTableBreakdown,
    totalCostUsd,
    breakdown: { base: preset.baseCostUsd, computeOverage, storageOverage, egressOverage },
    flags: computeBottleneckFlags(perTableBreakdown, totalStorageGb, input),
  };
}
