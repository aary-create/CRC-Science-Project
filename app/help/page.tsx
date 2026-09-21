"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { loadGoogleMaps, MAPS_KEY } from "@/lib/maps";
import seed from "@/data/seed.json";
const { helplines } = seed;
import { loadProfile } from "@/lib/options";
import { haversineKm } from "@/lib/geo";
import type { HelpPlace } from "@/lib/types";

declare global { interface Window { google?: any } }

function searchHospitals(google: any, lat: number, lng: number): Promise<any[]> {
  return new Promise((resolve) => {
    const svc = new google.maps.places.PlacesService(document.createElement("div"));
    svc.nearbySearch(
      { location: { lat, lng }, rankBy: google.maps.places.RankBy.DISTANCE, type: "hospital" },
      (results: any[], status: string) => resolve(status === "OK" && results ? results.slice(0, 8) : [])
    );
  });
}

function getDetails(google: any, placeId: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const svc = new google.maps.places.PlacesService(document.createElement("div"));
    svc.getDetails({ placeId, fields: ["formatted_phone_number"] }, (r: any, status: string) =>
      resolve(status === "OK" ? r?.formatted_phone_number : undefined)
    );
  });
}

export default function Help() {
  const mapEl = useRef<HTMLDivElement>(null);
  const { t } = useT();
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [hospitals, setHospitals] = useState<HelpPlace[] | null>(null);
  const [error, setError] = useState<"" | "noGeo" | "locOff" | "mapsMissing">("");

  useEffect(() => {
    const p = loadProfile();
    if (p && Number.isFinite(p.lat)) return setMe({ lat: p.lat, lng: p.lng });
    if (!navigator.geolocation) return setError("noGeo");
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("locOff"),
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (!me) return;
    if (!MAPS_KEY) return setError("mapsMissing");
    loadGoogleMaps().then(async (google) => {
      const results = await searchHospitals(google, me.lat, me.lng);
      const withPhones = await Promise.all(
        results.map(async (r, i): Promise<HelpPlace> => ({
          name: r.name,
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
          place_id: r.place_id,
          phone: i < 5 ? await getDetails(google, r.place_id) : undefined,
          distance_km: haversineKm(me, { lat: r.geometry.location.lat(), lng: r.geometry.location.lng() }),
        }))
      );
      setHospitals(withPhones);

      if (!mapEl.current) return;
      const map = new google.maps.Map(mapEl.current, { center: me, zoom: 13, disableDefaultUI: true, zoomControl: true });
      new google.maps.Marker({ position: me, map, title: t("youAreHere"), icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: "#7cc4ff", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 } });
      const bounds = new google.maps.LatLngBounds(me);
      withPhones.forEach((h) => {
        new google.maps.Marker({ position: { lat: h.lat, lng: h.lng }, map, title: h.name, label: "H" });
        bounds.extend(h);
      });
      map.fitBounds(bounds, 48);
    }).catch(() => setError("mapsMissing"));
  }, [me?.lat, me?.lng]);

  return (
    <main>
      <h1>{t("helpTitle")}</h1>
      <p className="muted">{t("hospitalsNote")}</p>
      {error && <p className="banner">{t(error)}</p>}

      {MAPS_KEY && me && <div ref={mapEl} className="map" />}

      <h2>{t("findNearestHospital")}</h2>
      {hospitals === null ? (
        <p className="muted">{t("loading")}</p>
      ) : hospitals.length === 0 ? (
        <p className="muted">{t("noHospitals")}</p>
      ) : (
        <ul className="list">
          {hospitals.map((h) => (
            <li key={h.place_id}>
              <div className="title">{h.name}</div>
              <div className="muted">{t("distanceAway", { km: h.distance_km.toFixed(1) })}</div>
              <div className="row" style={{ marginTop: 8 }}>
                {h.phone && <a className="btn ghost" href={`tel:${h.phone}`}>{t("call", { n: h.phone })}</a>}
                <a className="btn ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&destination_place_id=${h.place_id}`} target="_blank" rel="noreferrer">{t("directions")}</a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>{t("helplines")}</h2>
      <ul className="list">
        {helplines.map((hl, i) => (
          <li key={i} className="row" style={{ justifyContent: "space-between" }}>
            <span>{hl.name}</span>
            <a className="btn" href={`tel:${hl.contact}`}>{hl.contact}</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
