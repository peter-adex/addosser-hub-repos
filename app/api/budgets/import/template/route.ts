import { NextResponse } from "next/server";
import { BUDGET_IMPORT_TEMPLATE_HEADERS } from "@/lib/budget-import";

export async function GET() {
  const header = BUDGET_IMPORT_TEMPLATE_HEADERS.join(",") + "\n";
  const example = "1,50001,ADVERT. NEWSPAPER,AFL,2026,107500,7000,7500,8000,8500,9500,9500,9583.33,9583.33,9583.33,9583.33,9583.33,\n";
  const csv = header + example;

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="opex-budget-import-template.csv"' },
  });
}
