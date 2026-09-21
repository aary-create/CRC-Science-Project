"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, makeT } from "@/lib/i18n";
import { DWELLINGS, OCCUPATIONS, VULNERABILITIES, loadProfile, saveProfile } from "@/lib/options";
import type { Location, Profile } from "@/lib/types";

const EMPTY: Profile = { label: "", lat: NaN, lng: NaN, district: "", state: "", dwelling_type: "", occupation: "", vulnerabilities: [], language: "en" };
const legend = { fontWeight: 700, margin: "22px 0 8px" } as const;
const fieldset = { border: 0, padding: 0, margin: 0 } as const;

function LocateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [p, setP] = useState<Profile>(EMPTY);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Location[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearch = useRef(false);
  const t = makeT(p.language);

  useEffect(() => {
    const saved = loadProfile();
    if (saved) { setP(saved); setQuery(saved.label ?? ""); }
  }, []);
  useEffect(() => { document.documentElement.lang = p.language; }, [p.language]);

  // Debounced search-as-you-type against Nominatim (proxied server-side).
  useEffect(() => {
    if (skipNextSearch.current) { skipNextSearch.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode/search?q=${encodeURIComponent(query)}`);
        const d = await res.json();
        setSuggestions(d.results ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function applyLocation(g: Location) {
    setLocErr("");
    setSuggestions([]);
    skipNextSearch.current = true;
    setQuery(g.label);
    setP((prev) => ({ ...prev, label: g.label, lat: g.lat, lng: g.lng, district: g.district, state: g.state }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) return setLocErr("noGeo");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
          const d = await res.json();
          applyLocation(d.result);
        } catch {
          applyLocation({ label: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, lat, lng, district: "", state: "" });
        } finally {
          setLocating(false);
        }
      },
      () => { setLocating(false); setLocErr("locOff"); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const set = (k: keyof Profile, v: any) => setP((prev) => ({ ...prev, [k]: v }));
  const toggleVuln = (id: string) =>
    set("vulnerabilities", p.vulnerabilities.includes(id) ? p.vulnerabilities.filter((v) => v !== id) : [...p.vulnerabilities, id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p.label || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !p.dwelling_type || !p.occupation) return setError(true);
    setSaving(true);
    saveProfile(p);
    await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).catch(() => {});
    router.push("/dashboard");
  }

  return (
    <main>
      <h1>Suraksha Setu</h1>
      <p className="muted">{t("appTagline")}</p>

      <form onSubmit={submit}>
        <label className="field" htmlFor="language">{t("language")}</label>
        <select id="language" value={p.language} onChange={(e) => set("language", e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>

        <label className="field" htmlFor="location">{t("locationQ")}</label>
        <div className="locate-row" style={{ position: "relative" }}>
          <input
            id="location" type="text" value={query} placeholder={t("searchPlaceholder")} autoComplete="off"
            onChange={(e) => { setQuery(e.target.value); setP((prev) => ({ ...prev, label: e.target.value, lat: NaN, lng: NaN })); }}
          />
          <button type="button" className="locate-btn" onClick={useMyLocation} disabled={locating} aria-label={t("useMyLocation")}>
            <LocateIcon />
          </button>
          {suggestions.length > 0 && (
            <ul className="suggestions">
              {suggestions.map((s, i) => (
                <li key={i}><button type="button" onClick={() => applyLocation(s)}>{s.label}</button></li>
              ))}
            </ul>
          )}
        </div>
        {searching && <p className="muted" style={{ marginTop: 8 }}>{t("locating")}</p>}
        {locating && <p className="muted" style={{ marginTop: 8 }}>{t("locating")}</p>}
        {locErr && <p className="muted" style={{ marginTop: 8 }}>{t(locErr as any)}</p>}
        {p.label && Number.isFinite(p.lat) && <p className="picked-place">📍 {p.label}</p>}

        <fieldset style={fieldset}>
          <legend style={legend}>{t("homeQ")}</legend>
          <div className="choices">
            {DWELLINGS.map((id) => (
              <label key={id} className="choice">
                <input type="radio" name="dwelling" checked={p.dwelling_type === id} onChange={() => set("dwelling_type", id)} />
                {t(`d_${id}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>{t("youQ")}</legend>
          <div className="choices">
            {OCCUPATIONS.map((id) => (
              <label key={id} className="choice">
                <input type="radio" name="occupation" checked={p.occupation === id} onChange={() => set("occupation", id)} />
                {t(`o_${id}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>{t("careQ")}</legend>
          <div className="choices">
            {VULNERABILITIES.map((id) => (
              <label key={id} className="choice">
                <input type="checkbox" checked={p.vulnerabilities.includes(id)} onChange={() => toggleVuln(id)} />
                {t(`v_${id}`)}
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="banner" role="alert">{t("requiredErr")}</p>}
        <div style={{ marginTop: 28 }}>
          <button className="btn block" disabled={saving}>{saving ? t("saving") : t("showAlerts")}</button>
        </div>
      </form>
    </main>
  );
}
