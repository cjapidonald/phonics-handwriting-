const imageCache = new Map();

export function getAssetUrl(fileName) {
  return new URL(`../assets/${fileName}`, import.meta.url).href;
}

export function loadImage(src) {
  if (!src) {
    return Promise.resolve(null);
  }

  if (imageCache.has(src)) {
    const cached = imageCache.get(src);
    if (cached.complete) {
      return Promise.resolve(cached);
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const ORDINAL_SUFFIXES = { 1: 'st', 2: 'nd', 3: 'rd' };

export function formatDateWithOrdinal(date = new Date()) {
  const day = date.getDate();
  const suffix = ORDINAL_SUFFIXES[day % 10] && ![11, 12, 13].includes(day) ? ORDINAL_SUFFIXES[day % 10] : 'th';
  const formatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const formatted = formatter.format(date);
  return formatted.replace(String(day), `${day}${suffix}`);
}
