import { NextResponse } from "next/server";
import { GL_ACCOUNT_IMPORT_TEMPLATE_HEADERS } from "@/lib/gl-account-import";

export async function GET() {
  const header = GL_ACCOUNT_IMPORT_TEMPLATE_HEADERS.join(",") + "\n";
  const example = "1000007,Cash Imprest\n1200001,Placement- Globus bank\n";
  const csv = header + example;

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="gl-account-import-template.csv"' },
  });
}
