import React from "react";
import L from "leaflet";
import { Camera, ImagePlus, MapPin } from "lucide-react";
import PageShell from "../components/PageShell.jsx";
import { fetchPhotosFromApi } from "../lib/api.js";
import { formatCoordinates, getDisplayLocation, getPhotoCoordinates, hasPhotoLocation } from "../lib/location.js";

export default function PhotosPage() {
  const [items, setItems] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [focusedPhotoId, setFocusedPhotoId] = React.useState("");
  const [mapResetKey, setMapResetKey] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const cameraCount = React.useMemo(() => countUniqueCameras(items), [items]);
  const locationCount = React.useMemo(() => items.filter((item) => hasPhotoLocation(item.metadata)).length, [items]);
  const mapPinCount = React.useMemo(() => items.filter((item) => getPhotoCoordinates(item.metadata)).length, [items]);

  const selectPhoto = React.useCallback((photo, options = {}) => {
    setSelected(photo);
    if (options.focusMap !== false) {
      setFocusedPhotoId(photo?.id || "");
    }
  }, []);

  const resetMapView = React.useCallback(() => {
    setFocusedPhotoId("");
    setMapResetKey((key) => key + 1);
  }, []);

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
      title="A photo gallery."
      intro=""
    >
      <section className="photo-dashboard photo-dashboard-readonly">
        <div className="photo-stats">
          <div className="photo-stat">
            <ImagePlus size={20} />
            <span>{loading ? "..." : items.length}</span>
            <strong>Photos</strong>
          </div>
          <button
            aria-label="Show all photo locations on the map"
            className="photo-stat photo-stat-action"
            disabled={!mapPinCount}
            type="button"
            onClick={resetMapView}
          >
            <MapPin size={20} />
            <span>{locationCount}</span>
            <strong>Locations</strong>
          </button>
          <div className="photo-stat">
            <Camera size={20} />
            <span>{cameraCount}</span>
            <strong>Cameras</strong>
          </div>
        </div>
      </section>

      <PhotoMap
        focusedPhotoId={focusedPhotoId}
        photos={items}
        resetKey={mapResetKey}
        selected={selected}
        onSelect={selectPhoto}
      />

      <section className={selected ? "photo-browser" : "photo-browser photo-browser-empty"}>
        {items.length ? (
          <div className="photo-grid">
            {items.map((item) => (
              <button
                aria-label={`Open ${item.title}`}
                className={selected?.id === item.id ? "photo-card is-selected" : "photo-card"}
                type="button"
                key={item.id}
                onClick={() => selectPhoto(item)}
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

function countUniqueCameras(photos) {
  return new Set(
    photos
      .map((photo) => photo.metadata.camera)
      .filter(Boolean)
      .map((camera) => camera.trim().replace(/\s+/g, " ").toLowerCase()),
  ).size;
}

function PhotoMap({ focusedPhotoId, photos, resetKey, selected, onSelect }) {
  const mapNodeRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const markerLayerRef = React.useRef(null);
  const markersRef = React.useRef(new Map());
  const photosWithCoordinates = React.useMemo(
    () =>
      photos
        .map((photo) => ({
          photo,
          coordinates: getPhotoCoordinates(photo.metadata),
        }))
        .filter((item) => item.coordinates),
    [photos],
  );

  React.useEffect(() => {
    if (!photosWithCoordinates.length || !mapNodeRef.current || mapRef.current) return undefined;

    const map = L.map(mapNodeRef.current, {
      scrollWheelZoom: false,
      worldCopyJump: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    window.setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, [photosWithCoordinates.length]);

  React.useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    markersRef.current.clear();

    photosWithCoordinates.forEach(({ photo, coordinates }) => {
      const position = [coordinates.latitude, coordinates.longitude];
      const marker = L.marker(position, {
        title: photo.title,
        icon: createPhotoMarkerIcon(selected?.id === photo.id),
      })
        .on("click", () => onSelect(photo, { focusMap: false }))
        .addTo(markerLayer);
      markersRef.current.set(photo.id, marker);
    });

    fitMapToAllPhotoPins(map, photosWithCoordinates);
  }, [photosWithCoordinates, onSelect]);

  React.useEffect(() => {
    markersRef.current.forEach((marker, photoId) => {
      marker.setIcon(createPhotoMarkerIcon(selected?.id === photoId));
    });
  }, [selected?.id]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !resetKey) return;
    fitMapToAllPhotoPins(map, photosWithCoordinates);
  }, [photosWithCoordinates, resetKey]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusedPhotoId) return;
    const focusedPhoto = photosWithCoordinates.find(({ photo }) => photo.id === focusedPhotoId);
    if (!focusedPhoto) return;
    const { coordinates } = focusedPhoto;
    map.flyTo([coordinates.latitude, coordinates.longitude], Math.max(map.getZoom(), 7), {
      duration: 0.55,
    });
  }, [focusedPhotoId, photosWithCoordinates]);

  if (!photosWithCoordinates.length) {
    return null;
  }

  return (
    <section className="photo-map-panel" aria-label="Photo locations map">
      <div className="photo-map-canvas" ref={mapNodeRef} />
    </section>
  );
}

function createPhotoMarkerIcon(isSelected) {
  return L.divIcon({
    className: isSelected ? "photo-map-marker is-selected" : "photo-map-marker",
    html: "<span></span>",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function fitMapToAllPhotoPins(map, photosWithCoordinates) {
  const bounds = photosWithCoordinates.map(({ coordinates }) => [coordinates.latitude, coordinates.longitude]);

  if (!bounds.length) {
    map.setView([20, 0], 2);
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 7);
  } else {
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 7 });
  }

  requestAnimationFrame(() => map.invalidateSize());
}

function PhotoDetail({ photo }) {
  const locationLabel = getDisplayLocation(photo.metadata);
  const coordinates = getPhotoCoordinates(photo.metadata);

  const rows = [
    ["Camera", photo.metadata.camera],
    ["Lens", photo.metadata.lens],
    ["Created", photo.metadata.created],
    ["Location", locationLabel],
    ["GPS", coordinates ? formatCoordinates(coordinates) : ""],
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
