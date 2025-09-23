const iconUrlCache = new Map();

export function getIconUrl(fileName) {
  if (!iconUrlCache.has(fileName)) {
    const url = new URL(`../assets/icons/${fileName}`, import.meta.url).href;
    iconUrlCache.set(fileName, url);
  }
  return iconUrlCache.get(fileName);
}

const penImageCache = new Map();

function ensurePenImage(key, fileName) {
  if (!penImageCache.has(key)) {
    const src = getIconUrl(fileName);
    const image = new Image();
    image.src = src;
    penImageCache.set(key, image);
  }
}

ensurePenImage('pen', 'pen.svg');
ensurePenImage('pencil', 'pencil.svg');
ensurePenImage('quill', 'quill.svg');

export function PenEnumToImage(key) {
  if (key === 'none') {
    return null;
  }
  return penImageCache.get(key) ?? null;
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
