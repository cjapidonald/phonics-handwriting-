import { DrawnLine } from './DrawnLine.js';

const DEFAULT_SETTINGS = {
  selectedPenWidth: 8,
  selectedPenColour: '#000000',
  selectedPenImage: 'pen',
  selectedBackground: 'blue-dotted',
  selectedPageColour: '#ffffff',
  isLoopOn: false,
  isTraceOn: false,
  rewriteSpeed: 2,
  zoomLevel: 1,
  penType: 'marker'
};

export class UserData {
  constructor(storageKey = 'handwriting-repeater') {
    this.storageKey = storageKey;
    this.userSettings = { ...DEFAULT_SETTINGS };
    this.storedLines = [];
    this.deletedLines = [];
  }

  loadFromLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(this.storageKey);
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

        if (Array.isArray(data.storedLines)) {
          this.storedLines = data.storedLines.map(line =>
            Array.isArray(line) ? line.map(DrawnLine.fromObject) : []
          );
        }

        if (Array.isArray(data.deletedLines)) {
          this.deletedLines = data.deletedLines.map(line =>
            Array.isArray(line) ? line.map(DrawnLine.fromObject) : []
          );
        }
      }
    } catch (error) {
      console.warn('Unable to load handwriting data from localStorage.', error);
      this.userSettings = { ...DEFAULT_SETTINGS };
      this.storedLines = [];
      this.deletedLines = [];
    }
  }

  saveToLocalStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const payload = {
        userSettings: this.userSettings,
        storedLines: this.storedLines.map(line => line.map(segment => segment.toJSON())),
        deletedLines: this.deletedLines.map(line => line.map(segment => segment.toJSON()))
      };
      window.localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Unable to save handwriting data to localStorage.', error);
    }
  }
}

export { DEFAULT_SETTINGS };
