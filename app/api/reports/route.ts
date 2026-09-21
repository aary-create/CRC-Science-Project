import { NextResponse } from "next/server";
import { saveReport } from "@/lib/data";
import { HAZARDS } from "@/lib/options";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const place = String(body.place ?? "").trim();
  const hazard = String(body.hazard_type ?? "");
  const text = String(body.text ?? "").trim();
  if (!(HAZARDS as readonly string[]).includes(hazard)) return NextResponse.json({ error: "unknown hazard_type" }, { status: 400 });
  if (place.length < 2 || place.length > 100) return NextResponse.json({ error: "place must be 2 to 100 characters" }, { status: 400 });
  if (text.length < 5 || text.length > 200) return NextResponse.json({ error: "text must be 5 to 200 characters" }, { status: 400 });
  return NextResponse.json({ report: await saveReport(place, hazard, text) });
}
