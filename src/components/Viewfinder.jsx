import React from "react";
import { getTextLocation, normalizeLocation } from "../lib/location.js";

const SHUTTER_MS = 380;

function formatExposure(meta) {
  const aperture = (meta.aperture || "").replace(/^f\//i, "").replace(/\.0$/, "");
  let shutter = (meta.shutter || "").replace(/s$/, "");
  if (shutter && !shutter.includes("/")) shutter = `${shutter}"`;
  return [
    { label: "Aperture", value: aperture ? `F${aperture}` : "--" },
    { label: "Shutter", value: shutter || "--" },
    { label: "ISO", value: (meta.iso || "").replace(/^ISO\s*/i, "") || "--" },
    { label: "Focal", value: meta.focalLength || "--" },
  ];
}

function formatDate(created) {
  if (!created) return "";
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return "";
  // EXIF times are camera-local; show them as stored rather than shifting zones.
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
}

// Re-keys on change so the new value rolls in from below.
function Roll({ value }) {
  return (
    <span className="roll">
      <span key={value}>{value}</span>
    </span>
  );
}

export default function Viewfinder({ photos, index, onIndex, onClose }) {
  const [shown, setShown] = React.useState(index);
  const [shutterKey, setShutterKey] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [grid, setGrid] = React.useState(true);
  const closeRef = React.useRef(null);
  const touch = React.useRef(null);
  const photo = photos[shown];
  const total = photos.length;

  // Fire the shutter, swap the frame while it is closed.
  React.useEffect(() => {
    if (index === shown) return undefined;
    setShutterKey((k) => k + 1);
    const t = window.setTimeout(() => {
      setShown(index);
      setLoaded(false);
    }, SHUTTER_MS / 2);
    return () => window.clearTimeout(t);
  }, [index, shown]);

  const go = React.useCallback((dir) => onIndex((index + dir + total) % total), [index, total, onIndex]);

  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "g" || e.key === "G") setGrid((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Warm up the neighbours so arrowing through feels instant.
  React.useEffect(() => {
    [1, -1].forEach((d) => {
      const next = photos[(shown + d + total) % total];
      if (next) new Image().src = next.large;
    });
  }, [shown, photos, total]);

  if (!photo) return null;
  const exposure = formatExposure(photo.metadata);
  const place = photo.place?.label || normalizeLocation(getTextLocation(photo.metadata));
  const date = formatDate(photo.metadata.created);

  return (
    <div
      className="vf"
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.title}${place ? `, ${place}` : ""}`}
      onPointerDown={(e) => {
        touch.current = e.pointerType === "touch" ? e.clientX : null;
      }}
      onPointerUp={(e) => {
        if (touch.current === null) return;
        const dx = e.clientX - touch.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touch.current = null;
      }}
    >
      <header className="vf-top">
        <span className="vf-rec">
          <i />
          <Roll value={String(shown + 1).padStart(2, "0")} />
          <span>/ {String(total).padStart(2, "0")}</span>
        </span>
        <span className="vf-where">
          <Roll value={place || "Unknown location"} />
          {date && <Roll value={date} />}
        </span>
        <button type="button" className="vf-close" ref={closeRef} onClick={onClose}>
          Esc ✕
        </button>
      </header>

      <div className="vf-stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <button type="button" className="vf-nav vf-prev" aria-label="Previous photo" onClick={() => go(-1)}>
          ‹
        </button>
        <div className="vf-frame" style={{ "--ratio": photo.ratio }}>
          <img className="vf-placeholder" src={photo.small} alt="" aria-hidden="true" />
          <img
            className={`vf-image${loaded ? " is-loaded" : ""}`}
            src={photo.large}
            alt={photo.title}
            onLoad={() => setLoaded(true)}
          />
          <div className={`vf-grid${grid ? "" : " is-off"}`} aria-hidden="true" />
          <span className="vf-corner tl" />
          <span className="vf-corner tr" />
          <span className="vf-corner bl" />
          <span className="vf-corner br" />
          <span className={`vf-af${loaded ? " is-locked" : ""}`} aria-hidden="true" />
          {!loaded && <span className="vf-focusing">focusing…</span>}
        </div>
        <button type="button" className="vf-nav vf-next" aria-label="Next photo" onClick={() => go(1)}>
          ›
        </button>
        <div className="vf-shutter" key={shutterKey} data-run={shutterKey > 0 ? "" : undefined} aria-hidden="true">
          <span />
          <span />
        </div>
      </div>

      <footer className="vf-bottom">
        <dl className="vf-exposure">
          {exposure.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>
                <Roll value={item.value} />
              </dd>
            </div>
          ))}
        </dl>
        <div className="vf-meter" aria-hidden="true">
          <span>-2</span>
          <i />
          <span>-1</span>
          <i />
          <b>0</b>
          <i />
          <span>+1</span>
          <i />
          <span>+2</span>
        </div>
        <p className="vf-gear">
          <Roll value={[photo.metadata.camera, photo.metadata.lens].filter(Boolean).join(" · ") || photo.title} />
          <button type="button" onClick={() => setGrid((v) => !v)}>
            Grid {grid ? "on" : "off"} <kbd>G</kbd>
          </button>
        </p>
      </footer>
    </div>
  );
}
