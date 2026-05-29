export const DEFAULT_API_BASE_URL = "https://api.weiqizhou.com";
const env = import.meta.env || {};
export const API_BASE_URL = (env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function resolveApiAssetUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, `${API_BASE_URL}/`).href;
  } catch {
    return value;
  }
}

async function apiRequest(path, options = {}) {
  if (!API_BASE_URL) return null;
  const response = await fetch(apiUrl(path), options);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export async function fetchPhotosFromApi() {
  const data = await apiRequest("/api/photos");
  const records = Array.isArray(data) ? data : data?.photos;
  return Array.isArray(records) ? records.map(normalizePhotoFromApi).filter(Boolean) : null;
}

export async function fetchPostsFromApi() {
  const data = await apiRequest("/api/posts");
  const records = Array.isArray(data) ? data : data?.posts;
  return Array.isArray(records) ? records.map(normalizePostFromApi).filter(Boolean) : null;
}

export async function fetchPostFromApi(post) {
  const id = post.slug || post.id;
  const data = await apiRequest(`/api/posts/${encodeURIComponent(id)}`);
  return data ? normalizePostFromApi(data.post || data) : null;
}

function normalizePhotoFromApi(record) {
  if (!record) return null;
  const image = resolveApiAssetUrl(record.imageUrl || record.url || record.src);
  if (!image) return null;
  const metadata = record.metadata || {};
  const location =
    metadata.locationText ||
    metadata.location ||
    record.location?.label ||
    record.location?.name ||
    (typeof record.location === "string" ? record.location : "");

  return {
    id: String(record.id || record._id || record.slug || record.filename || image),
    title: record.title || record.filename || "Untitled photo",
    image,
    thumbnail: resolveApiAssetUrl(record.thumbnailUrl) || image,
    featured: Boolean(record.featured),
    metadata: {
      camera: metadata.camera || record.camera || "",
      lens: metadata.lens || record.lens || "",
      created: metadata.created || record.createdAt || record.takenAt || "",
      location,
      locationText: metadata.locationText || "",
      gps: metadata.gps || "",
      aperture: metadata.aperture || "",
      shutter: metadata.shutter || "",
      iso: metadata.iso || "",
      focalLength: metadata.focalLength || "",
      dimensions: metadata.dimensions || record.dimensions || "",
      fileName: metadata.fileName || record.filename || "",
    },
  };
}

function normalizePostFromApi(record) {
  if (!record) return null;
  const content = record.content || record.body || "";
  return {
    id: String(record.id || record._id || record.slug || record.title),
    slug: record.slug || String(record.id || record._id || record.title),
    title: record.title || "Untitled post",
    date: record.date || record.publishedAt || record.createdAt || "",
    tag: record.tag || record.category || "Note",
    excerpt: record.excerpt || content.slice(0, 140),
    content,
  };
}
