export const DEFAULT_API_BASE_URL = "https://api.weiqizhou.com";
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
export const API_TOKEN_STORAGE_KEY = "weiqi-api-token";

export function getStoredApiToken() {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(API_TOKEN_STORAGE_KEY) || "";
}

export function getApiToken() {
  return import.meta.env.VITE_API_TOKEN || getStoredApiToken();
}

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
  const { auth = true, headers, ...init } = options;
  const token = getApiToken();
  const requestHeaders = {
    ...headers,
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: Object.keys(requestHeaders).length ? requestHeaders : undefined,
  });
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

export async function uploadPhotoToApi(file, metadata) {
  if (!API_BASE_URL) return null;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("metadata", JSON.stringify(metadata));
  const data = await apiRequest("/api/photos", {
    method: "POST",
    auth: true,
    body: formData,
  });
  return normalizePhotoFromApi(data?.photo || data);
}

export async function updatePhotoLocationInApi(photoId, location) {
  return apiRequest(`/api/photos/${encodeURIComponent(photoId)}`, {
    method: "PATCH",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location }),
  });
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
  const location =
    record.metadata?.location ||
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
      camera: record.metadata?.camera || record.camera || "",
      lens: record.metadata?.lens || record.lens || "",
      created: record.metadata?.created || record.createdAt || record.takenAt || "",
      location,
      aperture: record.metadata?.aperture || "",
      shutter: record.metadata?.shutter || "",
      iso: record.metadata?.iso || "",
      focalLength: record.metadata?.focalLength || "",
      dimensions: record.metadata?.dimensions || record.dimensions || "",
      fileName: record.metadata?.fileName || record.filename || "",
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
