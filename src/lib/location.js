const REVERSE_GEOCODE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const LOCATION_CACHE_PREFIX = "photo-location-label";
const MIN_GEOCODE_INTERVAL = 1100;
let geocodeQueue = Promise.resolve();

function coordinateNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function coordinatesFromObject(value) {
  if (!value || typeof value !== "object") return null;
  const latitude = coordinateNumber(value.latitude ?? value.lat);
  const longitude = coordinateNumber(value.longitude ?? value.lng ?? value.lon);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function coordinatesFromString(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return {
    latitude: Number(match[1]),
    longitude: Number(match[2]),
  };
}

export function getPhotoCoordinates(metadata) {
  return (
    coordinatesFromObject(metadata?.location) ||
    coordinatesFromObject(metadata?.gps) ||
    coordinatesFromString(metadata?.location) ||
    coordinatesFromString(metadata?.locationText)
  );
}

export function getTextLocation(metadata) {
  const locationText = metadata?.locationText;
  if (typeof locationText === "string" && locationText.trim() && !coordinatesFromString(locationText)) {
    return locationText.trim();
  }

  const location = metadata?.location;
  if (typeof location === "string" && location.trim() && !coordinatesFromString(location)) {
    return location.trim();
  }

  return "";
}

export function hasPhotoLocation(metadata) {
  return Boolean(getTextLocation(metadata) || getPhotoCoordinates(metadata));
}

export function getLocationDependency(metadata) {
  const text = getTextLocation(metadata);
  if (text) return `text:${text}`;
  const coordinates = getPhotoCoordinates(metadata);
  return coordinates ? `coords:${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}` : "";
}

function formatCoordinates({ latitude, longitude }) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatReverseGeocode(data) {
  const label = data?.label || data?.displayName;
  if (label) return String(label);

  const address = data?.address || {};
  const region =
    data?.region ||
    data?.state ||
    data?.province ||
    data?.principalSubdivision ||
    address.state ||
    address.province ||
    address.region ||
    address.state_district;
  const country = data?.country || data?.countryName || address.country;

  return [region, country].filter(Boolean).join("，") || data?.display_name || "";
}

function cacheKey({ latitude, longitude }) {
  return `${LOCATION_CACHE_PREFIX}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function wait(ms) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

async function queuedReverseGeocode(coordinates) {
  const task = geocodeQueue.then(async () => {
    await wait(MIN_GEOCODE_INTERVAL);
    const url = new URL(REVERSE_GEOCODE_ENDPOINT);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(coordinates.latitude));
    url.searchParams.set("lon", String(coordinates.longitude));
    url.searchParams.set("zoom", "5");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "en");

    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  });

  geocodeQueue = task.catch(() => {});
  return task;
}

export async function resolvePhotoLocationLabel(metadata) {
  const textLocation = getTextLocation(metadata);
  if (textLocation) return textLocation;

  const coordinates = getPhotoCoordinates(metadata);
  if (!coordinates) return "";

  const key = cacheKey(coordinates);
  const cached = typeof localStorage === "undefined" ? "" : localStorage.getItem(key);
  if (cached) return cached;

  try {
    const label = formatReverseGeocode(await queuedReverseGeocode(coordinates));
    if (label) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, label);
      }
      return label;
    }
  } catch {
    return formatCoordinates(coordinates);
  }

  return formatCoordinates(coordinates);
}
