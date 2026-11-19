import { NextResponse } from "next/server";
import { ASSET_IMPORT_TEMPLATE_HEADERS } from "@/lib/asset-import";

export async function GET() {
  const header = ASSET_IMPORT_TEMPLATE_HEADERS.join(",") + "\n";
  const example =
    "AST-000123,Dell Latitude Laptop,Head Office,IT Equipment,2022-03-15,850000,2026-07-24,17708,637500,212500,ACTIVE\n";
  const csv = header + example;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="asset-import-template.csv"',
    },
  });
}
