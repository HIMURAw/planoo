export interface ExportColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencesTable: string | null;
  referencesColumn: string | null;
}

export interface ExportTable {
  name: string;
  columns: ExportColumn[];
}

// MySQL-dialect DDL generator for a hand-designed schema — the ".sql
// export" half of "design your schema on the site, get it back as .sql"
// (the other half is the schema builder UI writing DesignedTable/Column).
export function generateSql(tables: ExportTable[]): string {
  const statements = tables.map((table) => {
    const columnLines = table.columns.map((col) => {
      const parts = [`  \`${col.name}\` ${col.dataType}`, col.nullable ? "NULL" : "NOT NULL"];
      if (col.isPrimaryKey) parts.push("PRIMARY KEY");
      return parts.join(" ");
    });

    const fkLines = table.columns
      .filter((col) => col.isForeignKey && col.referencesTable && col.referencesColumn)
      .map(
        (col) =>
          `  FOREIGN KEY (\`${col.name}\`) REFERENCES \`${col.referencesTable}\`(\`${col.referencesColumn}\`)`,
      );

    const body = [...columnLines, ...fkLines].join(",\n");
    return `CREATE TABLE \`${table.name}\` (\n${body}\n);`;
  });

  return statements.join("\n\n") + "\n";
}
