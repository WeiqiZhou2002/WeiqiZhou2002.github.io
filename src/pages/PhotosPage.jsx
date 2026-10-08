import React from "react";
import { fetchPhotosFromApi } from "../lib/api.js";
import { getPhotoCoordinates, getTextLocation, normalizeLocation } from "../lib/location.js";
import Viewfinder from "../components/Viewfinder.jsx";
import placeNames from "../data/place-names.json";

const Globe = React.lazy(() => import("../scene/Globe.jsx"));

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

async function fetchThumbManifest() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}thumbs/manifest.json`);
    return res.ok ? await res.json() : {};
  } catch {
    return {};
  }
}

function withThumbs(photo, manifest) {
  const t = manifest[photo.id];
  const [w, h] = (photo.metadata.dimensions || "").split(/\s*x\s*/).map(Number);
  return {
    ...photo,
    small: t ? `${import.meta.env.BASE_URL}${t.sm}` : photo.thumbnail || photo.image,
    large: t ? `${import.meta.env.BASE_URL}${t.lg}` : photo.image,
    ratio: t ? t.width / t.height : w && h ? w / h : 1.5,
    color: t?.color || "#cfc6b6",
    place: placeOf(photo),
    coords: coordsOf(photo),
  };
}

// An entry in place-names.json is either a city name, or an object that can
// also correct the country and position when the camera's GPS was wrong.
function override(photo) {
  const entry = placeNames[photo.id];
  return typeof entry === "string" ? { city: entry } : entry || {};
}

function coordsOf(photo) {
  const { lat, lon } = override(photo);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { latitude: lat, longitude: lon };
  return getPhotoCoordinates(photo.metadata);
}

// City from place-names.json (built by scripts/geocode-places.mjs), country
// from the API's location text. "Cook County, United States" -> Chicago.
function placeOf(photo) {
  const text = normalizeLocation(getTextLocation(photo.metadata));
  const parts = text ? text.split(",").map((part) => part.trim()) : [];
  const fix = override(photo);
  const country = fix.country || (parts.length > 1 ? parts[parts.length - 1] : parts[0] || "");
  const city = fix.city || parts[0] || "";
  const label = city && country && city !== country ? `${city}, ${country}` : city || country;
  return { city, country, label };
}

export function photoYear(photo) {
  const created = photo.metadata.created;
  const year = created ? new Date(created).getFullYear() : NaN;
  return Number.isFinite(year) ? year : null;
}

function groupPlaces(photos) {
  const byKey = new Map();
  photos.forEach((photo) => {
    const coords = photo.coords;
    if (!coords) return;
    const key = photo.place.label || `${coords.latitude.toFixed(1)},${coords.longitude.toFixed(1)}`;
    if (!byKey.has(key)) {
      byKey.set(key, { key, photos: [], lat: 0, lon: 0, name: photo.place.city || key, country: photo.place.country });
    }
    const place = byKey.get(key);
    place.photos.push(photo);
    place.lat += coords.latitude;
    place.lon += coords.longitude;
  });

  return [...byKey.values()]
    .map((place) => {
      const years = place.photos.map(photoYear).filter(Boolean);
      const sorted = [...place.photos].sort((a, b) => String(a.metadata.created).localeCompare(String(b.metadata.created)));
      return {
        ...place,
        photos: sorted,
        lat: place.lat / place.photos.length,
        lon: place.lon / place.photos.length,
        group: place.country || place.name,
        latest: Math.max(0, ...years),
        years: years.length ? [Math.min(...years), Math.max(...years)] : [],
      };
    })
    .sort((a, b) => b.latest - a.latest || a.name.localeCompare(b.name));
}

// The list and the card fan work per country; pins stay per place.
function groupCountries(places) {
  const byName = new Map();
  places.forEach((place) => {
    if (!byName.has(place.group)) byName.set(place.group, []);
    byName.get(place.group).push(place);
  });

  return [...byName.entries()]
    .map(([name, members]) => {
      const photos = members
        .flatMap((p) => p.photos)
        .sort((a, b) => String(a.metadata.created).localeCompare(String(b.metadata.created)));
      const weight = (fn) => members.reduce((sum, p) => sum + fn(p) * p.photos.length, 0) / photos.length;
      const years = photos.map(photoYear).filter(Boolean);
      return {
        key: name,
        name,
        photos,
        placeCount: members.length,
        lat: weight((p) => p.lat),
        lon: weight((p) => p.lon),
        years: years.length ? [Math.min(...years), Math.max(...years)] : [],
      };
    })
    .sort((a, b) => b.photos.length - a.photos.length || a.name.localeCompare(b.name));
}

export default function PhotosPage() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [focus, setFocus] = React.useState(null);
  const [preview, setPreview] = React.useState(null);
  const [openIndex, setOpenIndex] = React.useState(-1);
  const [webgl] = React.useState(hasWebGL);

  React.useEffect(() => {
    let alive = true;
    Promise.all([fetchPhotosFromApi(), fetchThumbManifest()])
      .then(([remote, manifest]) => {
        if (!alive) return;
        setItems((remote || []).map((photo) => withThumbs(photo, manifest)));
      })
      .catch(() => alive && setError("Could not load photos right now."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const places = React.useMemo(() => groupPlaces(items), [items]);
  const countries = React.useMemo(() => groupCountries(places), [places]);
  // focus is { kind: "country" | "place", key }: the list opens a country's
  // stack, a pin opens just that place's photos (one card, or a stack).
  const focusedCountry = focus?.kind === "country" ? countries.find((c) => c.key === focus.key) || null : null;
  const focusedPlace = focus?.kind === "place" ? places.find((p) => p.key === focus.key) || null : null;
  const previewCountry = focus ? null : countries.find((c) => c.key === preview) || null;
  const indexOf = React.useCallback((photo) => items.findIndex((item) => item.id === photo.id), [items]);

  React.useEffect(() => {
    if (!focus || openIndex >= 0) return undefined;
    const onKey = (e) => e.key === "Escape" && setFocus(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, openIndex]);

  return (
    <div className="photos-page">
      <section className="atlas">
        <div className="atlas-copy">
          <p className="eyebrow">04 — Photographs</p>
          <h1>Photographs.</h1>
          <p className="atlas-sub">
            {loading
              ? "Developing…"
              : error || `${items.length} frames from ${countries.length} countries and regions. Spin the globe, or pick one.`}
          </p>
          <ol className="place-list">
            {countries.map((country) => (
              <li
                key={country.key}
                className={focusedCountry?.key === country.key ? "is-on" : preview === country.key ? "is-hover" : ""}
              >
                <button
                  type="button"
                  onClick={() =>
                    setFocus(focusedCountry?.key === country.key ? null : { kind: "country", key: country.key })
                  }
                  onMouseEnter={() => setPreview(country.key)}
                  onMouseLeave={() => setPreview(null)}
                >
                  <span className="place-name">{country.name}</span>
                  <span className="place-country">
                    {country.placeCount > 1 ? `${country.placeCount} places` : ""}
                  </span>
                  <span className="place-count">{String(country.photos.length).padStart(2, "0")}</span>
                </button>
              </li>
            ))}
          </ol>
          <a className="atlas-all" href="#all-frames" onClick={(e) => {
            e.preventDefault();
            document.getElementById("all-frames")?.scrollIntoView({ behavior: "smooth" });
          }}>
            All frames ↓
          </a>
        </div>

        <figure className={`atlas-scene${focus ? " is-focused" : ""}`}>
          {webgl && places.length > 0 && (
            <React.Suspense fallback={<div className="stage-loading">loading the globe…</div>}>
              <Globe
                places={places}
                focusPoint={focusedCountry || focusedPlace}
                previewPoint={previewCountry}
                activeGroup={focusedCountry?.key || previewCountry?.key || null}
                activePlace={focusedPlace?.key || null}
                initial={countries[0]}
                onBackground={() => setFocus(null)}
                onPinSelect={(place) => setFocus({ kind: "place", key: place.key })}
              />
            </React.Suspense>
          )}
          {focusedCountry && (
            <CardFan
              key={`country-${focusedCountry.key}`}
              title={focusedCountry.name}
              meta={[
                `${focusedCountry.photos.length} ${focusedCountry.photos.length === 1 ? "frame" : "frames"}`,
                focusedCountry.placeCount > 1 ? `${focusedCountry.placeCount} places` : "",
                formatYears(focusedCountry.years),
              ]}
              photos={focusedCountry.photos}
              onOpen={(photo) => setOpenIndex(indexOf(photo))}
              onClose={() => setFocus(null)}
            />
          )}
          {focusedPlace && (
            <CardFan
              key={`place-${focusedPlace.key}`}
              title={focusedPlace.name}
              meta={[
                focusedPlace.country,
                formatYears(focusedPlace.years),
                focusedPlace.photos.length > 1 ? `${focusedPlace.photos.length} frames` : "",
              ]}
              photos={focusedPlace.photos}
              onOpen={(photo) => setOpenIndex(indexOf(photo))}
              onClose={() => setFocus(null)}
            />
          )}
          <figcaption>Drag to turn the globe. Pins are places I've stood with a camera.</figcaption>
        </figure>
      </section>

      <section className="frames" id="all-frames">
        <h2 className="section-label">All frames</h2>
        <FrameGrid items={items} onOpen={setOpenIndex} />
      </section>

      {openIndex >= 0 && items[openIndex] && (
        <Viewfinder photos={items} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(-1)} />
      )}
    </div>
  );
}

function useColumnCount() {
  const pick = () => (window.innerWidth < 760 ? 2 : window.innerWidth < 1100 ? 3 : 4);
  const [count, setCount] = React.useState(pick);
  React.useEffect(() => {
    const onResize = () => setCount(pick());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return count;
}

// Masonry that still reads left to right: frame i goes to column i % n.
function FrameGrid({ items, onOpen }) {
  const n = useColumnCount();
  const columns = Array.from({ length: n }, () => []);
  items.forEach((photo, i) => columns[i % n].push([photo, i]));

  return (
    <div className="frame-grid" style={{ "--cols": n }}>
      {columns.map((column, c) => (
        <div className="frame-col" key={c}>
          {column.map(([photo, i]) => (
            <button type="button" className="frame" key={photo.id} onClick={() => onOpen(i)}>
              <span className="frame-img" style={{ aspectRatio: photo.ratio, background: photo.color }}>
                <img src={photo.small} alt={photo.title} loading="lazy" decoding="async" />
              </span>
              <span className="frame-caption">
                <b>{String(i + 1).padStart(2, "0")}</b>
                <span>{photo.place.city || "Somewhere"}</span>
                <em>{photoYear(photo) || ""}</em>
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatYears(years) {
  if (!years.length) return "";
  return years[0] === years[1] ? String(years[0]) : years.join("–");
}

function CardFan({ title, meta, photos, onOpen, onClose }) {
  const shown = photos.slice(0, 9);
  const n = shown.length;
  const spread = Math.min(9 * (n - 1), 64);

  return (
    <div className={`fan${n === 1 ? " is-single" : ""}`} role="group" aria-label={`Photos from ${title}`}>
      <div className="fan-cards">
        {shown.map((photo, i) => {
          const angle = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
          return (
            <button
              type="button"
              key={photo.id}
              className="fan-card"
              style={{
                "--angle": `${angle}deg`,
                "--i": i,
                "--ratio": photo.ratio,
                background: photo.color,
              }}
              onClick={() => onOpen(photo)}
            >
              <img src={photo.small} alt={photo.title} decoding="async" />
            </button>
          );
        })}
      </div>
      <div className="fan-caption">
        <strong>{title}</strong>
        <span>{meta.filter(Boolean).join(" · ")}</span>
        <button type="button" onClick={onClose}>
          ← back to the globe
        </button>
      </div>
    </div>
  );
}
