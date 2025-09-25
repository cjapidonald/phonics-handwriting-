import { DrawnLine } from './DrawnLine.js';
import { getLocalStorage } from './utils.js';

const STROKES_STORAGE_KEY = 'ph.strokes';
const STROKES_DELETED_STORAGE_KEY = 'ph.strokes.deleted';

const DEFAULT_SETTINGS = {
  selectedPenWidth: 6,
  selectedPenColour: '#111111',
  customPenImageSrc: '',
  selectedBackground: 'phonics-lines',
  selectedPageColour: '#ffffff',
  rewriteSpeed: 2,
  zoomLevel: 1,
  penImageScale: 1
};

export class UserData {
  constructor(storageKey = 'handwriting-repeater') {
    this.storageKey = storageKey;
    this.userSettings = { ...DEFAULT_SETTINGS };
    this.storedLines = [];
    this.deletedLines = [];
    this.storage = getLocalStorage();
  }

  loadFromLocalStorage() {
    if (!this.storage) {
      return;
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return;
      }

      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.userSettings) {
          this.userSettings = {
            ...DEFAULT_SETTINGS,
            ...data.userSettings
          };
        }

        this.storedLines = this.parseStoredStrokeData(data.storedLines, STROKES_STORAGE_KEY);
        this.deletedLines = this.parseStoredStrokeData(data.deletedLines, STROKES_DELETED_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Unable to load handwriting data from localStorage.', error);
      this.userSettings = { ...DEFAULT_SETTINGS };
      this.storedLines = [];
      this.deletedLines = [];
    }
  }

  saveToLocalStorage() {
    if (!this.storage) {
      return;
    }

    try {
      const serialiseLine = line => line.map(segment => DrawnLine.fromObject(segment).toJSON());

      const payload = {
        userSettings: this.userSettings,
        storedLines: this.storedLines.map(serialiseLine),
        deletedLines: this.deletedLines.map(serialiseLine)
      };

      this.storage.setItem(this.storageKey, JSON.stringify(payload));
      this.storage.setItem(STROKES_STORAGE_KEY, JSON.stringify(payload.storedLines));
      this.storage.setItem(STROKES_DELETED_STORAGE_KEY, JSON.stringify(payload.deletedLines));
    } catch (error) {
      console.warn('Unable to save handwriting data to localStorage.', error);
    }
  }

  parseStoredStrokeData(raw, storageKey) {
    let data = raw;

    if (this.storage) {
      try {
        const storedRaw = this.storage.getItem(storageKey);
        if (storedRaw) {
          data = JSON.parse(storedRaw);
        }
      } catch (error) {
        console.warn(`Unable to read ${storageKey} from localStorage.`, error);
      }
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(line => (Array.isArray(line) ? line.map(DrawnLine.fromObject) : []));
  }
}

export { DEFAULT_SETTINGS };
