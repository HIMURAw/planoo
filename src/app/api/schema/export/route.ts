import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  generateSql,
  generatePostgresSql,
  generateSqliteSql,
  generatePrismaSchema,
  generateTypeOrmEntities,
  generateDrizzleSchema,
  generateSequelizeModels,
  generateMongooseSchema,
} from "@/lib/schema-export";

const CONTENT_BY_FORMAT = {
  sql: { contentType: "application/sql; charset=utf-8", filename: "schema.sql" },
  postgres: { contentType: "application/sql; charset=utf-8", filename: "schema.postgres.sql" },
  sqlite: { contentType: "application/sql; charset=utf-8", filename: "schema.sqlite.sql" },
  prisma: { contentType: "text/plain; charset=utf-8", filename: "schema.prisma" },
  typeorm: { contentType: "text/plain; charset=utf-8", filename: "schema.entities.ts" },
  drizzle: { contentType: "text/plain; charset=utf-8", filename: "schema.drizzle.ts" },
  sequelize: { contentType: "text/plain; charset=utf-8", filename: "schema.sequelize.ts" },
  mongoose: { contentType: "text/plain; charset=utf-8", filename: "schema.mongoose.ts" },
} as const;

type ExportFormat = keyof typeof CONTENT_BY_FORMAT;

const GENERATORS: Record<ExportFormat, typeof generateSql> = {
  sql: generateSql,
  postgres: generatePostgresSql,
  sqlite: generateSqliteSql,
  prisma: generatePrismaSchema,
  typeorm: generateTypeOrmEntities,
  drizzle: generateDrizzleSchema,
  sequelize: generateSequelizeModels,
  mongoose: generateMongooseSchema,
};

function isExportFormat(value: string | null): value is ExportFormat {
  return value !== null && value in CONTENT_BY_FORMAT;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "project_id_required" }, { status: 400 });
  }
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: session.user.id } });
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const formatParam = searchParams.get("format");
  const format: ExportFormat = isExportFormat(formatParam) ? formatParam : "sql";

  const tables = await prisma.designedTable.findMany({
    where: { projectId },
    include: { columns: { orderBy: { order: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  if (tables.length === 0) {
    return NextResponse.json({ error: "no tables designed yet" }, { status: 400 });
  }

  const body = GENERATORS[format](tables);
  const { contentType, filename } = CONTENT_BY_FORMAT[format];

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
