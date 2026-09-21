"use client";
import { useEffect, useState } from "react";
import HazardIcon from "@/components/HazardIcon";
import SeverityBadge from "@/components/SeverityBadge";
import { timeAgo, useT, type Key, type T } from "@/lib/i18n";
import { HAZARDS, loadProfile } from "@/lib/options";
import type { CommunityReport, LiveAlert } from "@/lib/types";

type Feed = { sachetOk: boolean; imdOk: boolean; alerts: LiveAlert[]; reports: CommunityReport[] };

function AlertList({ alerts, t }: { alerts: LiveAlert[]; t: T }) {
  if (!alerts.length) return <p className="muted">{t("nothing")}</p>;
  return (
    <ul className="list">
      {alerts.map((a) => (
        <li key={a.id}>
          <div className="row">
            <SeverityBadge severity={a.severity} t={t} />
            <HazardIcon hazard={a.hazard_type} size={18} />
            <span className="title">{t(`h_${a.hazard_type}` as Key)}</span>
          </div>
          <div style={{ marginTop: 6 }}>{a.headline}</div>
          <div className="muted">{a.source_agency}, {a.area_text.length > 60 ? a.area_text.slice(0, 60) + "…" : a.area_text}, {timeAgo(a.timestamp, t)}</div>
        </li>
      ))}
    </ul>
  );
}

function ReportList({ reports, t }: { reports: CommunityReport[]; t: T }) {
  if (!reports.length) return <p className="muted">{t("nothing")}</p>;
  return (
    <ul className="list">
      {reports.map((r) => (
        <li key={r.id}>
          <div className="row"><span className="tag">{t("unverifiedTag")}</span><span className="title">{t(`h_${r.hazard_type}` as Key)}</span></div>
          <div style={{ marginTop: 6 }}>{r.text}</div>
          <div className="muted">{r.place}, {timeAgo(r.timestamp, t)}</div>
        </li>
      ))}
    </ul>
  );
}

function ReportForm({ t, onPosted }: { t: T; onPosted: () => void }) {
  const [place, setPlace] = useState(loadProfile()?.label ?? "");
  const [hazard, setHazard] = useState<string>("flood");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"" | "sending" | "sent" | "failed">("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (place.trim().length < 2 || text.trim().length < 5) return;
    setStatus("sending");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place, hazard_type: hazard, text }),
    }).catch(() => null);
    if (res?.ok) { setText(""); setStatus("sent"); onPosted(); } else setStatus("failed");
  }

  return (
    <form onSubmit={submit}>
      <h2>{t("reportTitle")}</h2>
      <label className="field" htmlFor="place" style={{ marginTop: 0 }}>{t("reportPlace")}</label>
      <input id="place" type="text" value={place} placeholder={t("reportPlacePlaceholder")} onChange={(e) => setPlace(e.target.value)} />
      <label className="field" htmlFor="hazard">{t("reportHazard")}</label>
      <select id="hazard" value={hazard} onChange={(e) => setHazard(e.target.value)}>
        {HAZARDS.filter((h) => h !== "other").map((h) => <option key={h} value={h}>{t(`h_${h}` as Key)}</option>)}
      </select>
      <label className="field" htmlFor="report">{t("reportText")}</label>
      <textarea id="report" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
      <div style={{ marginTop: 12 }}>
        <button className="btn block" disabled={status === "sending" || text.trim().length < 5 || place.trim().length < 2}>{t("reportSend")}</button>
      </div>
      {status === "sent" && <p className="note">{t("reportSent")}</p>}
      {status === "failed" && <p className="banner">{t("reportFail")}</p>}
    </form>
  );
}

export default function FeedPage() {
  const { t } = useT();
  const [data, setData] = useState<Feed | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => fetch("/api/feed").then((r) => r.json()).then(setData).catch(() => setFailed(true));
  useEffect(() => { load(); }, []);

  if (failed) return <main><h1>{t("feedTitle")}</h1><p className="banner">{t("loadFail")}</p></main>;
  if (!data) return <main><p className="muted">{t("loading")}</p></main>;

  return (
    <main>
      <h1>{t("feedTitle")}</h1>
      <div className="status"><span className={`dot ${data.sachetOk ? "on" : "off"}`} />{t("sachetFeed")} {data.sachetOk ? t("connected") : t("cached")}</div>
      <div className="status"><span className={`dot ${data.imdOk ? "on" : "off"}`} />{t("imdFeed")} {data.imdOk ? t("connected") : t("cached")}</div>
      <h2>{t("official")}</h2>
      <AlertList alerts={data.alerts} t={t} />
      <h2>{t("community")}</h2>
      <p className="muted">{t("communityNote")}</p>
      <ReportList reports={data.reports} t={t} />
      <ReportForm t={t} onPosted={load} />
    </main>
  );
}
