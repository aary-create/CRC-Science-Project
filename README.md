# Suraksha Setu

Personalised disaster alerts for India — built on two real, public, keyless
sources: **SACHET** (NDMA's national alert aggregator — IMD, CWC and every
state SDMA) and **IMD's own CAP bulletin feed**. Nothing in the alert data is
invented; if both feeds are unreachable, the app says so and shows nothing
rather than sample data.

Pages: `/onboarding`, `/dashboard`, `/help`, `/feed`, `/offline`
APIs: `/api/users`, `/api/dashboard`, `/api/feed`, `/api/reports`, `/api/esp32-sync`

## What changed from the last version

- **Real data, nothing else.** SACHET's `FetchAllAlertDetails` endpoint gives every alert a precise lat/lng and its warned radius, so alerts are matched to your exact point, not a fixed list of 4 districts. IMD's bulletin feed is merged in alongside it, matched by area text since it has no coordinates.
- **Any location.** Onboarding replaces the district dropdown with a Google Places search box and a "use my current location" button — type any place in India, or let the browser find you.
- **Nearest hospital, for real.** The Help page calls Google Places directly for hospitals near your exact coordinates, with live distance, phone number and directions. The old shelter/NDRF list was fabricated sample data and has been removed entirely; only real, official national helpline numbers remain.
- **Broader, more useful options.** Home type grew from 4 to 6 (added mid-floor and kutcha/temporary housing), occupation from 3 to 6 (added fisherman, daily-wage/outdoor worker, healthcare worker), and who-needs-care from 3 to 5 (added infant-or-pregnant, ongoing medical condition). Hazard coverage grew to include thunderstorm/lightning and earthquake, since SACHET carries both.
- **Redesigned.** New color and type system (Space Grotesk for headlines, Atkinson Hyperlegible for body — kept for its accessibility to low-vision readers), hazard icons, and a cleaner card structure.
- **5-day on-device history.** Both the phone app and the ESP32 node now keep a rolling 5-day log of alert changes in local storage/flash — visible on the Offline tab in the app, and at `/api/history` on the node. Nothing older than 5 days is kept; nothing is sent anywhere, it stays on the device.
- **Complete ESP32 firmware.** `firmware/suraksha_setu_node.ino` is now the full, ready-to-flash sketch, not a patch — see the ESP32 section below.

## Run on your laptop

Needs Node 20 or newer.

```bash
npm install
cp .env.example .env.local     # fill in values if you have them, or leave blank
npm run dev                    # open http://localhost:3000
```

## Deploy to Vercel

1. Push this folder to a GitHub repo, then on vercel.com: Add New → Project → import the repo → Deploy.
2. **Location search, geolocation reverse-lookup, and hospital search all need one key.** In Google Cloud Console, enable both **Maps JavaScript API** and **Places API**, create a key restricted to `https://YOUR-APP.vercel.app/*`, and add it in Vercel → Settings → Environment Variables as `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Redeploy — `NEXT_PUBLIC_` values are baked in at build time.
3. **Database (optional):** Vercel → Storage → Create Database → Neon → Connect to project. Tables are created automatically on first request; no setup command needed.
4. Test the live feeds: open `https://YOUR-APP.vercel.app/api/feed` — `sachetOk` and `imdOk` should both be `true`. (Re-verified directly against both source endpoints while building this version — both are live, public, and returning current alerts as of today. My own sandbox can't reach either domain to run the Next.js server against them locally, so confirm on your actual deployment too.)

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
- **Location search is restricted to India** (`componentRestrictions: { country: "in" }` in `app/onboarding/page.tsx`) — remove that if you want it to work worldwide.
- Notifications fire only while the app is open or backgrounded in a tab, not to a fully closed app — that needs Web Push, which isn't built.
- Community reports and ESP32 node status live in memory without a database, and reset when Vercel restarts the server instance.
