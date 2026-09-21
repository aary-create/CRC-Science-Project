# Suraksha Setu

Personalised disaster alerts for India — built entirely on free, public,
keyless services. Alerts come from **SACHET** (NDMA's national alert
aggregator — IMD, CWC and every state SDMA) and **IMD's own CAP bulletin
feed**. Location, search and hospitals run on **OpenStreetMap**
(Nominatim + Overpass), not Google — no API key, no billing account, no
signup, for any of it. Nothing in the alert data is invented; if both
feeds are unreachable, the app says so and shows nothing rather than
sample data.

Pages: `/onboarding`, `/dashboard`, `/help`, `/feed`, `/offline`
APIs: `/api/users`, `/api/dashboard`, `/api/feed`, `/api/reports`, `/api/esp32-sync`, `/api/geocode/search`, `/api/geocode/reverse`, `/api/hospitals`

## What changed from the last version

- **No Google, no key.** Location search, "use my location", and nearest-hospital lookup now run on OpenStreetMap's free services instead of Google Maps/Places: **Nominatim** for search and reverse geocoding, **Overpass** for real hospital data, **Leaflet** for the map. All keyless. The two Nominatim calls are proxied through the app's own server (`/api/geocode/*`) because their usage policy expects a proper `User-Agent` identifying the app, which browsers won't let client-side JS set.
- **Real data, nothing else.** SACHET's `FetchAllAlertDetails` endpoint gives every alert a precise lat/lng and its warned radius, so alerts are matched to your exact point. IMD's bulletin feed is merged in alongside it, matched by area text since it has no coordinates.
- **Broader, more useful options.** Home type grew from 4 to 6 (added mid-floor and kutcha/temporary housing), occupation from 3 to 6 (added fisherman, daily-wage/outdoor worker, healthcare worker), and who-needs-care from 3 to 5 (added infant-or-pregnant, ongoing medical condition). Hazard coverage includes thunderstorm/lightning and earthquake, since SACHET carries both.
- **Redesigned.** New color and type system (Space Grotesk for headlines, Atkinson Hyperlegible for body — kept for its accessibility to low-vision readers), hazard icons, a dark-tinted OpenStreetMap view, and a cleaner card structure.
- **5-day on-device history.** Both the phone app and the ESP32 node keep a rolling 5-day log of alert changes in local storage/flash — visible on the Offline tab, and at `/api/history` on the node. Nothing older than 5 days is kept; nothing is sent anywhere, it stays on the device.
- **Complete ESP32 firmware.** `firmware/suraksha_setu_node.ino` is the full, ready-to-flash sketch.

## Run on your laptop

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env.local     # optional — only DATABASE_URL to fill in, or leave blank
npm run dev                    # open http://localhost:3000
```

## Deploy to Vercel

1. Push this folder to a GitHub repo, then on vercel.com: Add New → Project → import the repo → Deploy. That's it — location, search and hospitals work immediately with no key to create.
2. **Database (optional):** Vercel → Storage → Create Database → Neon → Connect to project. Tables are created automatically on first request; no setup command needed. Without it, users and community reports still work, they just don't persist between server restarts.
3. Test the live feeds: open `https://YOUR-APP.vercel.app/api/feed` — `sachetOk` and `imdOk` should both be `true`. (Re-verified directly against both source endpoints while building this version — both are live, public, and returning current alerts as of today. My own sandbox can't reach either domain to run the Next.js server against them locally, so confirm on your actual deployment too.)

## ESP32

`firmware/suraksha_setu_node.ino` is the complete, ready-to-flash sketch — WiFi AP + home WiFi, ESP-NOW mesh relay, LittleFS-backed alert cache, a 5-day on-device history log (same retention policy as the phone app), and the local web server phones can read offline at `192.168.4.1`.

1. Arduino IDE → install the **ArduinoJson** library (Benoit Blanchon, v6.x) via Library Manager. Everything else (WiFi, WebServer, LittleFS, esp_now) ships with the ESP32 core.
2. Tools → Partition Scheme → pick one with a SPIFFS/LittleFS partition (e.g. "Default 4MB with spiffs").
3. Edit the `CONFIG` block at the top of the file for this specific board: `NODE_ID`, `NODE_LAT`/`NODE_LNG` (its fixed install location), your home WiFi credentials, and `SYNC_URL` set to your Vercel URL.
4. Upload, then open Serial Monitor at 115200 baud to watch it connect and sync.

Endpoints it exposes locally: `/` (readable status page), `/api/alert` (JSON), `/api/history` (last 5 days, JSON).

## Editing content

- Safety steps and helpline numbers: `data/seed.json` — `dwelling_rules` (home type × hazard), `occupation_tips` (job × hazard), `vulnerability_tips`.
- Translations for the above: `data/translations.json`.
- All interface text: `lib/i18n.ts`.

## Known limits

- **Translation coverage is partial.** The universal ("applies to everyone") safety steps and the original elderly/livestock/disability tips are translated into Hindi, Gujarati, Tamil and Assamese. The newly added dwelling-specific rows (e.g. "kutcha house + flood"), all occupation tips, and the report form are English-only for now — falls back to English automatically, never shows blank. None of the translations have had native-speaker review; get them checked before real use, since they're safety instructions.
- **Location search is restricted to India** (`countrycodes=in` in `lib/geocode.ts`) — remove that if you want it to work worldwide.
- **Nominatim is rate-limited to 1 request/second** and isn't meant for heavy/bulk use — fine for one person searching their own location, not for scraping many addresses at once.
- **OpenStreetMap's tile server asks that production apps not hotlink it at real scale** — fine for a demo or small project like this; a larger deployment should move to a dedicated tile provider (several, like MapTiler or Stadia Maps, have generous free tiers).
- Notifications fire only while the app is open or backgrounded in a tab, not to a fully closed app — that needs Web Push, which isn't built.
- Community reports and ESP32 node status live in memory without a database, and reset when Vercel restarts the server instance.
