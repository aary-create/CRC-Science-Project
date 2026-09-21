export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

declare global {
  interface Window { google?: any; __ssGmapsReady?: () => void }
}

let mapsPromise: Promise<any> | null = null;

// Loads the Maps JS SDK with the Places library once, cached for reuse across
// the onboarding location search, the "use my location" reverse geocode, and
// the nearest-hospital lookup on Help.
export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    window.__ssGmapsReady = () => resolve(window.google);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places&callback=__ssGmapsReady&loading=async`;
    s.async = true;
    s.onerror = () => { mapsPromise = null; reject(new Error("failed to load Google Maps")); };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

function component(components: any[], types: string[]): string {
  for (const c of components ?? []) if (types.some((t) => c.types.includes(t))) return c.long_name;
  return "";
}

export type GeoResult = { label: string; lat: number; lng: number; district: string; state: string };

export function fromPlaceResult(p: any): GeoResult | null {
  const loc = p?.geometry?.location;
  if (!loc) return null;
  const comps = p.address_components ?? [];
  return {
    label: p.formatted_address || p.name || "",
    lat: typeof loc.lat === "function" ? loc.lat() : loc.lat,
    lng: typeof loc.lng === "function" ? loc.lng() : loc.lng,
    district: component(comps, ["administrative_area_level_2", "administrative_area_level_3"]),
    state: component(comps, ["administrative_area_level_1"]),
  };
}
