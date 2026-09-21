"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HazardIcon from "@/components/HazardIcon";
import SeverityBadge from "@/components/SeverityBadge";
import { makeT, speechLang, timeAgo, useT, type Key, type T } from "@/lib/i18n";
import { recordHistory } from "@/lib/history";
import { CACHE_KEY, loadProfile } from "@/lib/options";
import type { LiveAlert, Severity } from "@/lib/types";

type Data = {
  sachetOk: boolean; imdOk: boolean;
  current: { alert: LiveAlert; sources: { agency: string; severity: Severity; headline: string }[]; conflict: boolean } | null;
  action: string;
  occupationTip: string | null;
  vulnerabilityTips: string[];
  node: { node_id: string; last_seen: string } | null;
  fetchedAt: string;
};

const EDGE: Record<Severity, string> = { Extreme: "var(--extreme)", Severe: "var(--severe)", Moderate: "var(--moderate)", Minor: "var(--minor)" };
const hazardKey = (h: string) => (`h_${h}` as Key);

function alertTitle(d: Data, t: T) {
  if (!d.current) return t("noAlert");
  return `${t(`s_${d.current.alert.severity}`)} ${t(hazardKey(d.current.alert.hazard_type))}`;
}

async function notify(d: Data, t: T) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker?.ready;
  const title = `${alertTitle(d, t)}`;
  if (reg) reg.showNotification(title, { body: d.action, tag: "suraksha-alert", data: { url: "/dashboard" } });
  else new Notification(title, { body: d.action });
}

export default function Dashboard() {
  const router = useRouter();
  const { lang, t } = useT();
  const [data, setData] = useState<Data | null>(null);
  const [placeLabel, setPlaceLabel] = useState("");
  const [offline, setOffline] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => setPerm("Notification" in window ? Notification.permission : "unsupported"), []);

  useEffect(() => {
    const p = loadProfile();
    if (!p || !Number.isFinite(p.lat)) return router.replace("/onboarding");
    setPlaceLabel(p.label);
    const qs = new URLSearchParams({
      lat: String(p.lat), lng: String(p.lng), district: p.district, state: p.state, label: p.label,
      occupation: p.occupation, dwelling: p.dwelling_type, vulns: p.vulnerabilities.join(","), lang: p.language,
    });
    const tr = makeT(p.language);

    const load = () =>
      fetch(`/api/dashboard?${qs}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: Data) => {
          const prev: Data | null = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
          if (prev && d.current && d.current.alert.id !== prev.current?.alert.id) notify(d, tr);
          recordHistory({
            label: p.label,
            hazard_type: d.current?.alert.hazard_type ?? null,
            severity: d.current?.alert.severity ?? null,
            headline: d.current?.alert.headline ?? null,
            source_agency: d.current?.alert.source_agency ?? null,
            action: d.action,
          });
          setData(d);
          setOffline(false);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ...d, district: { name: p.label } }));
        })
        .catch(() => {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) setData(JSON.parse(cached));
          setOffline(true);
        });

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [router]);

  async function enableNotifications() {
    setPerm(await Notification.requestPermission());
  }

  function readAloud() {
    if (!data || !("speechSynthesis" in window)) return;
    const c = data.current;
    const text = [alertTitle(data, t), c?.alert.headline, t("whatToDo"), data.action, data.occupationTip, ...data.vulnerabilityTips].filter(Boolean).join(". ");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang(lang);
    speechSynthesis.speak(u);
  }

  if (!data) return <main><p className="muted">{t("loading")}</p></main>;
  const c = data.current;
  const edge = c ? EDGE[c.alert.severity] : "var(--minor)";

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>{placeLabel}</h1>
        <Link href="/onboarding" className="muted">{t("editProfile")}</Link>
      </div>
      <div className="status">
        <span className={`dot ${data.sachetOk && !offline ? "on" : "off"}`} />
        {t("sachetFeed")} {offline ? t("noConnection") : data.sachetOk ? t("connected") : t("cached")}
      </div>
      <div className="status">
        <span className={`dot ${data.imdOk && !offline ? "on" : "off"}`} />
        {t("imdFeed")} {offline ? t("noConnection") : data.imdOk ? t("connected") : t("cached")}
      </div>
      {data.node && (
        <div className="status"><span className="dot on" />{t("nodeSynced", { id: data.node.node_id, ago: timeAgo(data.node.last_seen, t) })}</div>
      )}

      {offline && <p className="banner">{t("offlineBanner", { ago: timeAgo(data.fetchedAt, t) })}</p>}

      {c ? (
        <section className="alert" style={{ ["--edge" as any]: edge }}>
          <SeverityBadge severity={c.alert.severity} t={t} />
          <div className="alert-head">
            <span className="icon-wrap"><HazardIcon hazard={c.alert.hazard_type} /></span>
            <p className="hazard">{t(hazardKey(c.alert.hazard_type))}</p>
          </div>
          <p style={{ margin: 0 }}>{c.alert.headline}</p>
          <ul className="sources">
            {c.sources.map((s, i) => <li key={i}>{t("says", { agency: s.agency, severity: t(`s_${s.severity}`) })}</li>)}
          </ul>
          {c.conflict && <p className="conflict">{t("conflict")}</p>}
          <p className="muted" style={{ marginTop: 10 }}>{t("issued", { ago: timeAgo(c.alert.timestamp, t) })}</p>
        </section>
      ) : (
        <section className="alert">
          <div className="alert-head">
            <span className="icon-wrap" style={{ ["--edge" as any]: "var(--minor)" }}><HazardIcon hazard="other" /></span>
            <p className="hazard" style={{ fontSize: 28 }}>{t("noAlert")}</p>
          </div>
          <p className="muted">{t("noAlertSub")}</p>
        </section>
      )}

      <section className="action" style={{ ["--edge" as any]: edge }}>
        <span className="muted">{t("whatToDo")}</span>
        <p>{data.action}</p>
      </section>
      {data.occupationTip && (
        <section className="action secondary">
          <span className="muted">{t("yourOccupation")}</span>
          <p>{data.occupationTip}</p>
        </section>
      )}
      {data.vulnerabilityTips.length > 0 && (
        <section className="action secondary">
          <ul style={{ margin: 0, paddingLeft: 20 }}>{data.vulnerabilityTips.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
      )}

      <div className="row" style={{ marginTop: 20 }}>
        <Link href="/help" className="btn">{t("findNearestHospital")}</Link>
        <a href="tel:112" className="btn ghost">{t("call", { n: 112 })}</a>
        <button className="btn ghost" onClick={readAloud}>{t("readAloud")}</button>
      </div>

      {perm !== "unsupported" && (
        <div style={{ marginTop: 12 }}>
          {perm === "default" && <button className="btn ghost block" onClick={enableNotifications}>{t("notifyOn")}</button>}
          {perm === "granted" && <p className="note">{t("notifyEnabled")}</p>}
          {perm === "denied" && <p className="note">{t("notifyBlocked")}</p>}
        </div>
      )}
    </main>
  );
}
