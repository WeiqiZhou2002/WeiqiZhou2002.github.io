// Builds small WebP versions of every photo served by the API, so the gallery
// never has to download the multi-megabyte originals.
//
// Output: public/thumbs/<id>-sm.webp (grid), <id>-lg.webp (viewer) and
// manifest.json. Generated files are cached in THUMB_CACHE (default
// ~/.cache/weiqi-photo-thumbs) so CI only processes new photos.
//
// Never fails the build: if the API is unreachable the site falls back to the
// API's own URLs.

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const API = (process.env.VITE_API_BASE_URL || "https://api.weiqizhou.com").replace(/\/$/, "");
const CACHE = process.env.THUMB_CACHE || path.join(os.homedir(), ".cache", "weiqi-photo-thumbs");
const OUT = path.resolve("public/thumbs");
const SIZES = { sm: 720, lg: 2200 };

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function main() {
  const res = await fetch(`${API}/api/photos`);
  if (!res.ok) throw new Error(`photo list: ${res.status}`);
  const data = await res.json();
  const photos = Array.isArray(data) ? data : data.photos || [];

  await fs.mkdir(CACHE, { recursive: true });
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const manifest = {};
  for (const photo of photos) {
    const source = photo.imageUrl || photo.url || photo.src;
    if (!source) continue;
    const id = safeId(photo.id || photo.slug || photo.filename);
    // Key the cache on the source path so a replaced file gets regenerated.
    const key = `${id}-${safeId(path.basename(source))}`;
    const metaFile = path.join(CACHE, `${key}.json`);

    try {
      if (!(await exists(metaFile))) {
        const img = await fetch(new URL(source, `${API}/`));
        if (!img.ok) throw new Error(`${img.status}`);
        const buffer = Buffer.from(await img.arrayBuffer());
        const base = sharp(buffer, { failOn: "none" }).rotate();
        const raw = await sharp(buffer).metadata();
        // EXIF orientations 5-8 are rotated a quarter turn.
        const swap = (raw.orientation || 1) >= 5;
        const width = swap ? raw.height : raw.width;
        const height = swap ? raw.width : raw.height;
        for (const [name, size] of Object.entries(SIZES)) {
          await base
            .clone()
            .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
            .webp({ quality: name === "sm" ? 72 : 82 })
            .toFile(path.join(CACHE, `${key}-${name}.webp`));
        }
        const { dominant } = await base.clone().stats();
        const color = `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`;
        await fs.writeFile(metaFile, JSON.stringify({ width, height, color }));
        console.log(`thumbs: built ${id}`);
      }

      const meta = JSON.parse(await fs.readFile(metaFile, "utf8"));
      for (const name of Object.keys(SIZES)) {
        await fs.copyFile(path.join(CACHE, `${key}-${name}.webp`), path.join(OUT, `${id}-${name}.webp`));
      }
      manifest[String(photo.id)] = {
        sm: `thumbs/${id}-sm.webp`,
        lg: `thumbs/${id}-lg.webp`,
        width: meta.width,
        height: meta.height,
        color: meta.color,
      };
    } catch (error) {
      console.warn(`thumbs: skipped ${id} (${error.message})`);
    }
  }

  await fs.writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest));
  console.log(`thumbs: ${Object.keys(manifest).length}/${photos.length} photos ready`);
}

main().catch((error) => {
  console.warn(`thumbs: skipped entirely (${error.message})`);
});
