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

  try {
    const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(safeDate);
    const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(safeDate);
    return `${weekday}, ${dayMonthYear}`;
  } catch (error) {
    const weekdays = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ];
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];

    const weekday = weekdays[safeDate.getDay()] ?? '';
    const month = months[safeDate.getMonth()] ?? '';
    const day = safeDate.getDate();
    const year = safeDate.getFullYear();

    return `${weekday}, ${day} ${month} ${year}`.trim();
  }
}

let cachedLocalStorage = null;
let localStorageChecked = false;

export function getLocalStorage() {
  if (localStorageChecked) {
    return cachedLocalStorage;
  }

  localStorageChecked = true;

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    storage.getItem('');
    cachedLocalStorage = storage;
  } catch (error) {
    console.warn('Local storage is unavailable.', error);
    cachedLocalStorage = null;
  }

  return cachedLocalStorage;
}
