import * as exifr from "exifr";

export async function fileToPhoto(file) {
  const url = URL.createObjectURL(file);
  let metadata = {};
  try {
    const exif = await exifr.parse(file, { gps: true, xmp: true, tiff: true, exif: true });
    metadata = normalizeExif(exif || {});
  } catch {
    metadata = {};
  }

  return {
    id: `upload-${file.name}-${file.lastModified}`,
    title: file.name.replace(/\.[^.]+$/, ""),
    image: url,
    metadata: {
      ...metadata,
      dimensions: metadata.dimensions || "",
      fileName: file.name,
    },
  };
}

function normalizeExif(exif) {
  const camera = [exif.Make, exif.Model].filter(Boolean).join(" ");
  const coordinates = exif.latitude && exif.longitude ? `${exif.latitude.toFixed(5)}, ${exif.longitude.toFixed(5)}` : "";
  return {
    camera: camera || exif.Model || "",
    lens: exif.LensModel || exif.Lens || "",
    created: formatDate(exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate),
    location: coordinates,
    aperture: exif.FNumber ? `f/${Number(exif.FNumber).toFixed(1)}` : "",
    shutter: exif.ExposureTime ? formatShutter(exif.ExposureTime) : "",
    iso: exif.ISO ? `ISO ${exif.ISO}` : "",
    focalLength: exif.FocalLength ? `${exif.FocalLength}mm` : "",
  };
}

function formatDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
}

function formatShutter(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (number >= 1) return `${number.toFixed(1)}s`;
  return `1/${Math.round(1 / number)}s`;
}
