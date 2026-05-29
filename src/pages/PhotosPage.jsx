import React from "react";
import { Camera, ImagePlus, MapPin } from "lucide-react";
import PageShell from "../components/PageShell.jsx";
import { fetchPhotosFromApi } from "../lib/api.js";
import { getLocationDependency, hasPhotoLocation, resolvePhotoLocationLabel } from "../lib/location.js";

export default function PhotosPage() {
  const [items, setItems] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

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

  return (
    <PageShell
      eyebrow="Photography"
      title="A backend-powered photo gallery."
      intro="Photos and metadata are loaded directly from the API, with location shown from saved text or resolved GPS context."
    >
      <section className="photo-dashboard photo-dashboard-readonly">
        <div className="photo-stats">
          <div>
            <ImagePlus size={20} />
            <span>{loading ? "..." : items.length}</span>
            <strong>Photos</strong>
          </div>
          <div>
            <MapPin size={20} />
            <span>{items.filter((item) => hasPhotoLocation(item.metadata)).length}</span>
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
            <p>{error || "Add photos through the backend and the gallery will update automatically."}</p>
          </div>
        )}
        {selected && <PhotoDetail photo={selected} />}
      </section>
    </PageShell>
  );
}

function useResolvedLocation(metadata) {
  const dependency = getLocationDependency(metadata);
  const [location, setLocation] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLocation("");
    resolvePhotoLocationLabel(metadata).then((label) => {
      if (alive) setLocation(label);
    });

    return () => {
      alive = false;
    };
  }, [dependency, metadata]);

  return location;
}

function PhotoDetail({ photo }) {
  const locationLabel = useResolvedLocation(photo.metadata);
  const locationLoading = hasPhotoLocation(photo.metadata) && !locationLabel;

  const rows = [
    ["Camera", photo.metadata.camera],
    ["Lens", photo.metadata.lens],
    ["Created", photo.metadata.created],
    ["Location", locationLoading ? "Resolving location..." : locationLabel],
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
      </div>
    </aside>
  );
}
