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
    coordinatesFromObject(metadata?.gps) ||
    coordinatesFromString(metadata?.gps) ||
    coordinatesFromObject(metadata?.location)
  );
}

export function getTextLocation(metadata) {
  const location = metadata?.location;
  if (typeof location === "string" && location.trim() && !coordinatesFromString(location)) {
    return location.trim();
  }

  const locationText = metadata?.locationText;
  if (typeof locationText === "string" && locationText.trim() && !coordinatesFromString(locationText)) {
    return locationText.trim();
  }

  return "";
}

export function hasPhotoLocation(metadata) {
  return Boolean(getTextLocation(metadata) || getPhotoCoordinates(metadata));
}

export function formatCoordinates({ latitude, longitude }) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function getDisplayLocation(metadata) {
  const textLocation = getTextLocation(metadata);
  if (textLocation) return textLocation;
  const coordinates = getPhotoCoordinates(metadata);
  return coordinates ? formatCoordinates(coordinates) : "";
}

// Reverse geocoding labels everything in the PRC as "…, China". Show Hong Kong
// and Macau on their own and call the rest "China Mainland".
const SEPARATE_REGIONS = new Set(["Hong Kong", "Macau", "Macao"]);

export function normalizeLocation(text) {
  if (!text) return text;
  const parts = text.split(",").map((part) => part.trim());
  if (parts.length < 2 || parts[parts.length - 1] !== "China") return text;
  if (SEPARATE_REGIONS.has(parts[0])) return parts[0];
  return [...parts.slice(0, -1), "China Mainland"].join(", ");
}
