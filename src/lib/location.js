import { API_BASE_URL } from "./api.js";

const REVERSE_GEOCODE_ENDPOINT = `${API_BASE_URL}/api/locations/reverse`;
const LOCATION_CACHE_PREFIX = "photo-location-label";

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
  const label = data?.label || data?.displayName || data?.display_name;
  if (label) return String(label);

  const region =
    data?.region ||
    data?.state ||
    data?.province ||
    data?.principalSubdivision ||
    data?.address?.state ||
    data?.address?.province ||
    data?.address?.region;
  const country = data?.country || data?.countryName || data?.address?.country;

  return [region, country].filter(Boolean).join("，");
}

function cacheKey({ latitude, longitude }) {
  return `${LOCATION_CACHE_PREFIX}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
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
    const url = new URL(REVERSE_GEOCODE_ENDPOINT);
    url.searchParams.set("latitude", String(coordinates.latitude));
    url.searchParams.set("longitude", String(coordinates.longitude));

    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const label = formatReverseGeocode(await response.json());
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
