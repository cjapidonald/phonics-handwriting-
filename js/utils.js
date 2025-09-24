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

export function formatDateWithOrdinal(date = new Date()) {
  const safeDate = date instanceof Date ? date : new Date(date);
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(safeDate);
  const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(safeDate);
  return `${weekday}, ${dayMonthYear}`;
}
