import { NextResponse } from "next/server";
import { fetchLiveAlerts, recentReports } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const [{ sachetOk, imdOk, alerts }, reports] = await Promise.all([fetchLiveAlerts(), recentReports()]);
  alerts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return NextResponse.json({ sachetOk, imdOk, alerts, reports });
}
