// Looks up a city-level name for each photo's GPS position (OpenStreetMap
// Nominatim) and stores it in src/data/place-names.json, keyed by photo id.
//
// The API only knows counties and districts ("Cook County", "Hanyang
// District"); visitors expect "Chicago" and "Wuhan". Existing entries are
// never overwritten, so hand edits in the JSON file stick. Only photos that
// are missing get looked up. Never fails the build.

import fs from "node:fs/promises";
import path from "node:path";

const API = (process.env.VITE_API_BASE_URL || "https://api.weiqizhou.com").replace(/\/$/, "");
const OUT = path.resolve("src/data/place-names.json");
const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function coordsOf(photo) {
  const gps = photo.metadata?.gps;
  if (!gps || typeof gps !== "object") return null;
  const lat = Number(gps.latitude ?? gps.lat);
  const lon = Number(gps.longitude ?? gps.lng ?? gps.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

function cityFrom(address = {}) {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.county ||
    address.state_district ||
    address.state ||
    ""
  )
    .replace(/\s+(City|Municipality)$/i, "")
    .trim();
}

async function reverse({ lat, lon }) {
  const url = `${NOMINATIM}?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lon}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "weiqizhou.com photo page build (https://github.com/WeiqiZhou2002)" },
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = await res.json();
  return cityFrom(data.address);
}

async function main() {
  let names = {};
  try {
    names = JSON.parse(await fs.readFile(OUT, "utf8"));
  } catch {
    names = {};
  }

  const res = await fetch(`${API}/api/photos`);
  if (!res.ok) throw new Error(`photo list: ${res.status}`);
  const data = await res.json();
  const photos = Array.isArray(data) ? data : data.photos || [];

  let added = 0;
  for (const photo of photos) {
    const id = String(photo.id);
    const coords = coordsOf(photo);
    if (names[id] || !coords) continue;
    try {
      const city = await reverse(coords);
      if (city) {
        names[id] = city;
        added += 1;
        console.log(`places: ${id} -> ${city}`);
      }
    } catch (error) {
      console.warn(`places: skipped ${id} (${error.message})`);
    }
    // Nominatim's usage policy: at most one request per second.
    await sleep(1100);
  }

  if (added) {
    const sorted = Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b)));
    await fs.writeFile(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  }
  console.log(`places: ${added} new, ${Object.keys(names).length} total`);
}

main().catch((error) => {
  console.warn(`places: skipped entirely (${error.message})`);
});
