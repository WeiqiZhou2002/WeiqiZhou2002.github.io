import React from "react";
import { Camera, Check, ImagePlus, KeyRound, MapPin, Save, Upload } from "lucide-react";
import PageShell from "../components/PageShell.jsx";
import {
  API_BASE_URL,
  API_TOKEN_STORAGE_KEY,
  fetchPhotosFromApi,
  getApiToken,
  getStoredApiToken,
  updatePhotoLocationInApi,
  uploadPhotoToApi,
} from "../lib/api.js";
import { fileToPhoto } from "../lib/exif.js";

export default function PhotosPage() {
  const [items, setItems] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [tokenDraft, setTokenDraft] = React.useState(getStoredApiToken);
  const [tokenSaved, setTokenSaved] = React.useState(false);
  const hasBuildToken = Boolean(import.meta.env.VITE_API_TOKEN);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPhotosFromApi()
      .then((remotePhotos) => {
        if (!alive) return;
        const nextPhotos = remotePhotos || [];
        setItems(nextPhotos);
        setSelected(nextPhotos[0] || null);
        setError("");
      })
      .catch(() => {
        if (alive) setError("Could not load photos from the API.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const onUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const parsed = await Promise.all(
      files.map(async (file) => {
        const localPhoto = await fileToPhoto(file);
        if (!API_BASE_URL || !getApiToken()) return localPhoto;

        try {
          return (await uploadPhotoToApi(file, { ...localPhoto.metadata, title: localPhoto.title })) || localPhoto;
        } catch {
          return localPhoto;
        }
      }),
    );
    setItems((current) => [...parsed, ...current]);
    setSelected(parsed[0]);
    setUploading(false);
    event.target.value = "";
  };

  const updatePhotoLocation = React.useCallback((photoId, nextLocation) => {
    const update = (photo) =>
      photo?.id === photoId
        ? {
            ...photo,
            metadata: {
              ...photo.metadata,
              location: nextLocation,
            },
          }
        : photo;

    setItems((current) => current.map(update));
    setSelected((current) => update(current));
  }, []);

  const saveApiToken = () => {
    if (hasBuildToken) return;
    const nextToken = tokenDraft.trim();
    if (nextToken) {
      localStorage.setItem(API_TOKEN_STORAGE_KEY, nextToken);
    } else {
      localStorage.removeItem(API_TOKEN_STORAGE_KEY);
    }
    setTokenSaved(true);
  };

  return (
    <PageShell
      eyebrow="Photography"
      title="A gallery with upload, EXIF, and editable location."
      intro="Photos are loaded directly from the backend; uploads still parse EXIF locally before sending metadata to the API."
    >
      <section className="photo-dashboard">
        <div className="upload-stack">
          <label className="upload-card">
            <input type="file" accept="image/*" multiple onChange={onUpload} />
            <Upload size={22} />
            <strong>{uploading ? "Reading EXIF..." : "Upload photos"}</strong>
            <span>JPG, HEIC, PNG where browser support allows</span>
          </label>

          <div className="token-card">
            <div className="token-card-heading">
              <KeyRound size={18} />
              <strong>{hasBuildToken ? "Build token active" : "API token"}</strong>
            </div>
            <div className="token-editor">
              <input
                aria-label="API token"
                disabled={hasBuildToken}
                onChange={(event) => {
                  setTokenDraft(event.target.value);
                  setTokenSaved(false);
                }}
                placeholder="Bearer token"
                type="password"
                value={hasBuildToken ? "Configured by environment" : tokenDraft}
              />
              <button disabled={hasBuildToken} type="button" onClick={saveApiToken} aria-label="Save API token">
                {tokenSaved || hasBuildToken ? <Check size={18} /> : <Save size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="photo-stats">
          <div>
            <ImagePlus size={20} />
            <span>{loading ? "..." : items.length}</span>
            <strong>Photos</strong>
          </div>
          <div>
            <MapPin size={20} />
            <span>{items.filter((item) => getSavedLocation(item)).length}</span>
            <strong>Locations</strong>
          </div>
          <div>
            <Camera size={20} />
            <span>{items.filter((item) => item.metadata.camera).length}</span>
            <strong>Cameras</strong>
          </div>
        </div>
      </section>

      <section className={selected ? "photo-browser" : "photo-browser photo-browser-empty"}>
        {items.length ? (
          <div className="photo-grid">
            {items.map((item) => (
              <button
                aria-label={`Open ${item.title}`}
                className={selected?.id === item.id ? "photo-card is-selected" : "photo-card"}
                type="button"
                key={item.id}
                onClick={() => setSelected(item)}
              >
                <img src={item.thumbnail || item.image} alt={item.title} />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>{loading ? "Loading photos..." : "No photos yet."}</strong>
            <p>{error || "Upload photos through the backend and the gallery will update automatically."}</p>
          </div>
        )}
        {selected && <PhotoDetail photo={selected} onLocationSaved={updatePhotoLocation} />}
      </section>
    </PageShell>
  );
}

function getSavedLocation(photo) {
  if (!photo) return "";
  const localValue = typeof localStorage === "undefined" ? "" : localStorage.getItem(`photo-location-${photo.id}`);
  return localValue || photo.metadata.location || "";
}

function PhotoDetail({ photo, onLocationSaved }) {
  const [location, setLocation] = React.useState(getSavedLocation(photo));
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    setLocation(getSavedLocation(photo));
    setSaved(false);
  }, [photo]);

  const saveLocation = async () => {
    localStorage.setItem(`photo-location-${photo.id}`, location);
    onLocationSaved?.(photo.id, location);
    setSaved(true);
    if (!getApiToken()) return;
    try {
      await updatePhotoLocationInApi(photo.id, location);
    } catch {
      // Local storage keeps the edit usable while the photo API is offline.
    }
  };

  const rows = [
    ["Camera", photo.metadata.camera],
    ["Lens", photo.metadata.lens],
    ["Created", photo.metadata.created],
    ["Aperture", photo.metadata.aperture],
    ["Shutter", photo.metadata.shutter],
    ["ISO", photo.metadata.iso],
    ["Focal length", photo.metadata.focalLength],
    ["Dimensions", photo.metadata.dimensions],
    ["File", photo.metadata.fileName],
  ].filter(([, value]) => Boolean(value));

  return (
    <aside className="photo-detail">
      <img src={photo.image} alt={photo.title} />
      <div className="photo-detail-copy">
        <div className="photo-detail-heading">
          <p className="eyebrow">Photo detail</p>
        </div>

        <div className="exif-grid">
          {rows.length ? (
            rows.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))
          ) : (
            <div>
              <span>EXIF</span>
              <strong>No embedded metadata found</strong>
            </div>
          )}
        </div>

        <label className="location-editor">
          <span>Location</span>
          <div>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Add location" />
            <button type="button" onClick={saveLocation}>
              {saved ? <Check size={18} /> : <Save size={18} />}
            </button>
          </div>
        </label>
      </div>
    </aside>
  );
}
