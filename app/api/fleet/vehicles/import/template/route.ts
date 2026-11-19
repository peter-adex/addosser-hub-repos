import { NextResponse } from "next/server";
import { VEHICLE_IMPORT_TEMPLATE_HEADERS } from "@/lib/vehicle-import";

export async function GET() {
  const header = VEHICLE_IMPORT_TEMPLATE_HEADERS.join(",") + "\n";
  const example = "ABC-123-XY,Toyota,Hilux,2021,jeep,White,JTFHT05J104012345,ENG-998877,45000,2021-06-10,18500000,5,Head Office\n";
  const csv = header + example;

  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="vehicle-import-template.csv"' },
  });
}
