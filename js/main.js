import { UserData, DEFAULT_SETTINGS } from './UserData.js';
import { Controls } from './Controls.js';
import { Point } from './Point.js';
import { DrawnLine } from './DrawnLine.js';
import { clamp, getAssetUrl, loadImage, getLocalStorage } from './utils.js';
import { TimerController } from './timer.js';
import { TeachController } from './teach.js';

const ICON_SPRITE_PATH = 'assets/icons.svg';
const DEFAULT_PEN_IMAGE_SRC = getAssetUrl('icons/pen.svg');

const userData = new UserData();
userData.loadFromLocalStorage();

const controls = new Controls(userData);
const storage = getLocalStorage();

const PEN_COLOUR_DEFAULT = '#333';
const PEN_SIZE_DEFAULT = 8;
const ERASER_STROKE_COLOUR = '#000000';

const penColourInput = document.getElementById('penColour');
const penSizeInput = document.getElementById('penSize');
const eraserButton = document.getElementById('btnEraser');
const eraserSizeInput = document.getElementById('btnEraserSize');
const eraserSizeControl = document.getElementById('eraserSizeControl');
const uploadCursorButton = document.getElementById('btnUploadCursor');
const resetCursorButton = document.getElementById('btnResetCursor');
const cursorFileInput = document.getElementById('cursorFile');
const backgroundButton = document.getElementById('btnBackground');
const writerPageCanvas = document.getElementById('writerPage');

const CURSOR_STORAGE_KEY = 'ph.cursor';
const BACKGROUND_STORAGE_KEY = 'ph.bg';
const DOTTED_LINE_SPACING = 24;
const DOTTED_BASELINE_OFFSET = 6;
const DOTTED_PATTERN_WIDTH = 240;

const BACKGROUND_OPTIONS = {
  white: { className: 'bg-white', label: 'White' },
  dotted: { className: 'bg-dotted', label: 'Dotted' }
};

const BACKGROUND_CLASS_NAMES = Object.values(BACKGROUND_OPTIONS).map(option => option.className);

const backgroundOptionElements = new Map();
let backgroundPopover = null;
let currentBackgroundKey = null;

const normaliseBackgroundKey = key => (key === 'dotted' ? 'dotted' : 'white');

const updateBackgroundSelectionUI = key => {
  backgroundOptionElements.forEach((label, optionKey) => {
    const isSelected = optionKey === key;
    const input = label.querySelector('input[type="radio"]');
    label.classList.toggle('is-selected', isSelected);
    if (input) {
      input.checked = isSelected;
    }
  });
};

const generateDottedBackgroundPattern = () => {
  try {
    const ratio = window.devicePixelRatio || 1;
    const canvas = document.createElement('canvas');
    const width = Math.max(1, Math.round(DOTTED_PATTERN_WIDTH * ratio));
    const height = Math.max(1, Math.round(DOTTED_LINE_SPACING * ratio));
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.save();
    context.scale(ratio, ratio);
    context.strokeStyle = 'rgba(29, 41, 81, 0.45)';
    context.lineWidth = 1.4;
    context.setLineDash([4, 6]);
    context.lineCap = 'round';
    const baselineY = DOTTED_LINE_SPACING - DOTTED_BASELINE_OFFSET;
    context.beginPath();
    context.moveTo(0, baselineY);
    context.lineTo(width / ratio, baselineY);
    context.stroke();
    context.restore();

    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn('Unable to generate dotted background pattern.', error);
    return null;
  }
};

const applyWriterBackground = (key, { persist = true } = {}) => {
  const normalisedKey = normaliseBackgroundKey(key);
  currentBackgroundKey = normalisedKey;

  if (writerPageCanvas) {
    writerPageCanvas.classList.remove(...BACKGROUND_CLASS_NAMES);
    const className = BACKGROUND_OPTIONS[normalisedKey]?.className ?? BACKGROUND_OPTIONS.white.className;
    writerPageCanvas.classList.add(className);

    if (normalisedKey === 'dotted') {
      const patternUrl = generateDottedBackgroundPattern();
      if (patternUrl) {
        writerPageCanvas.style.backgroundImage = `url(${patternUrl})`;
        writerPageCanvas.style.backgroundSize = `auto ${DOTTED_LINE_SPACING}px`;
        writerPageCanvas.style.backgroundRepeat = 'repeat';
        writerPageCanvas.style.backgroundPosition = 'left top';
      } else {
        writerPageCanvas.style.backgroundImage = 'none';
        writerPageCanvas.style.removeProperty('background-size');
        writerPageCanvas.style.removeProperty('background-position');
        writerPageCanvas.style.removeProperty('background-repeat');
      }
    } else {
      writerPageCanvas.style.backgroundImage = 'none';
      writerPageCanvas.style.removeProperty('background-size');
      writerPageCanvas.style.removeProperty('background-position');
      writerPageCanvas.style.removeProperty('background-repeat');
    }
  }

  updateBackgroundSelectionUI(normalisedKey);

  if (persist && storage) {
    storage.setItem(BACKGROUND_STORAGE_KEY, normalisedKey);
  }

  return normalisedKey;
};

const buildBackgroundPopover = () => {
  if (!document?.body) {
    return null;
  }

  backgroundOptionElements.clear();

  const popover = document.createElement('div');
  popover.id = 'backgroundPopover';
  popover.className = 'popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Background options');

  const section = document.createElement('div');
  section.className = 'popover-section';

  const heading = document.createElement('h2');
  heading.className = 'popover-title';
  heading.textContent = 'Background';
  section.appendChild(heading);

  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'background-options';

  Object.entries(BACKGROUND_OPTIONS).forEach(([optionKey, option]) => {
    const label = document.createElement('label');
    label.className = 'background-option';
    label.dataset.backgroundKey = optionKey;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'writerBackground';
    input.value = optionKey;

    const text = document.createElement('span');
    text.className = 'background-option__label';
    text.textContent = option.label;

    label.appendChild(input);
    label.appendChild(text);
    optionsContainer.appendChild(label);
    backgroundOptionElements.set(optionKey, label);

    input.addEventListener('change', () => {
      if (!input.checked) {
        return;
      }
      applyWriterBackground(optionKey);
      controls.closeOpenPopover();
    });
  });

  section.appendChild(optionsContainer);
  popover.appendChild(section);
  document.body.appendChild(popover);

  return popover;
};

const initialiseBackgroundControls = () => {
  if (!backgroundButton || !writerPageCanvas) {
    return;
  }

  backgroundPopover = buildBackgroundPopover();
  if (!backgroundPopover) {
    return;
  }

  backgroundButton.setAttribute('aria-haspopup', 'dialog');
  backgroundButton.setAttribute('aria-expanded', 'false');

  backgroundButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    controls.togglePopover(backgroundButton, backgroundPopover);
  });

  const storedBackground = storage?.getItem?.(BACKGROUND_STORAGE_KEY);
  applyWriterBackground(storedBackground, { persist: false });

  window.addEventListener('resize', () => {
    if (currentBackgroundKey === 'dotted') {
      applyWriterBackground('dotted', { persist: false });
    }
  });
};

initialiseBackgroundControls();

if (typeof controls.setPageColour === 'function') {
  const originalSetPageColour = controls.setPageColour.bind(controls);
  controls.setPageColour = function patchedSetPageColour(colour, persist = true) {
    originalSetPageColour(colour, persist);

    const pageCanvas = this.rewriterPageCanvas ?? null;
    const pageContext = this.pageContext ?? pageCanvas?.getContext?.('2d') ?? null;
    if (pageCanvas && pageContext) {
      pageContext.clearRect(0, 0, pageCanvas.width || 0, pageCanvas.height || 0);
    }
  };
}

const applyCustomCursor = dataUrl => {
  if (typeof dataUrl === 'string' && dataUrl) {
    document.body.style.cursor = `url(${dataUrl}) 0 0, auto`;
    return;
  }

  document.body.style.cursor = '';
};

const persistCursor = dataUrl => {
  if (!storage) {
    return;
  }

  if (typeof dataUrl === 'string' && dataUrl) {
    storage.setItem(CURSOR_STORAGE_KEY, dataUrl);
  } else {
    storage.removeItem(CURSOR_STORAGE_KEY);
  }
};

const resetCursor = () => {
  applyCustomCursor(null);
  persistCursor(null);

  if (cursorFileInput) {
    cursorFileInput.value = '';
  }
};

const storedCursor = storage?.getItem?.(CURSOR_STORAGE_KEY);
if (typeof storedCursor === 'string' && storedCursor) {
  applyCustomCursor(storedCursor);
}

if (uploadCursorButton && cursorFileInput) {
  uploadCursorButton.addEventListener('click', () => {
    cursorFileInput.click();
  });
}

if (cursorFileInput) {
  cursorFileInput.addEventListener('change', event => {
    const file = event.target?.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', e => {
      const result = typeof e.target?.result === 'string' ? e.target.result : null;
      if (!result) {
        return;
      }

      applyCustomCursor(result);
      persistCursor(result);
    });
    reader.readAsDataURL(file);
  });
}

if (resetCursorButton) {
  resetCursorButton.addEventListener('click', () => {
    resetCursor();
  });
}

const STOPWATCH_POSITION_STORAGE_KEY = 'ph.stopwatch.pos';

const boardRegionElement = document.getElementById('boardRegion');
const stopwatchPanel = document.getElementById('stopwatchPanel');
const stopwatchToggleButton = document.getElementById('btnStopwatchLeft');
const stopwatchCloseButton = stopwatchPanel?.querySelector('[data-stopwatch-close]') ?? null;
const stopwatchDisplay = document.getElementById('stopwatchDisplay');
const stopwatchStartButton = document.getElementById('stopwatchStart');
const stopwatchPauseButton = document.getElementById('stopwatchPause');
const stopwatchResetButton = document.getElementById('stopwatchReset');
const stopwatchDragHandle = stopwatchPanel?.querySelector('[data-stopwatch-drag-handle]') ?? null;

let stopwatchPosition = readStoredStopwatchPosition();
let stopwatchHasLoadedPosition = Boolean(stopwatchPosition);
let stopwatchIsRunning = false;
let stopwatchStartTimestamp = 0;
let stopwatchAccumulatedMs = 0;
let stopwatchAnimationFrameId = null;
let stopwatchDragPointerId = null;
let stopwatchResizeAnimationFrameId = null;
const stopwatchDragOffset = { x: 0, y: 0 };

function readStoredStopwatchPosition() {
  if (!storage || typeof storage.getItem !== 'function') {
    return null;
  }

  try {
    const rawValue = storage.getItem(STOPWATCH_POSITION_STORAGE_KEY);
    if (typeof rawValue !== 'string' || rawValue === '') {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    const left = Number(parsed?.left);
    const top = Number(parsed?.top);
    if (Number.isFinite(left) && Number.isFinite(top)) {
      return { left, top };
    }
  } catch (error) {
    // Ignore malformed stored values
  }

  return null;
}

function persistStopwatchPosition(position) {
  if (!storage || typeof storage.setItem !== 'function' || !position) {
    return;
  }

  try {
    storage.setItem(
      STOPWATCH_POSITION_STORAGE_KEY,
      JSON.stringify({ left: Number(position.left) || 0, top: Number(position.top) || 0 })
    );
  } catch (error) {
    // Ignore storage write errors
  }
}

function formatStopwatchTime(elapsedMs) {
  const totalMs = Math.max(0, Math.floor(elapsedMs));
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((totalMs % 1000) / 10);

  const minutePart = String(minutes).padStart(2, '0');
  const secondPart = String(seconds).padStart(2, '0');
  const hundredthPart = String(hundredths).padStart(2, '0');
  return `${minutePart}:${secondPart}.${hundredthPart}`;
}

function updateStopwatchDisplay(elapsedMs) {
  if (!stopwatchDisplay) {
    return;
  }

  const formatted = formatStopwatchTime(elapsedMs);
  if (stopwatchDisplay.textContent !== formatted) {
    stopwatchDisplay.textContent = formatted;
  }
}

function getStopwatchElapsedMs() {
  if (stopwatchIsRunning) {
    return stopwatchAccumulatedMs + (performance.now() - stopwatchStartTimestamp);
  }
  return stopwatchAccumulatedMs;
}

function updateStopwatchControls() {
  const elapsed = getStopwatchElapsedMs();

  if (stopwatchStartButton) {
    stopwatchStartButton.disabled = stopwatchIsRunning;
  }

  if (stopwatchPauseButton) {
    stopwatchPauseButton.disabled = !stopwatchIsRunning;
  }

  if (stopwatchResetButton) {
    const shouldDisableReset = !stopwatchIsRunning && elapsed <= 10;
    stopwatchResetButton.disabled = shouldDisableReset;
  }

  if (stopwatchPanel) {
    stopwatchPanel.classList.toggle('is-running', stopwatchIsRunning);
  }
}

function handleStopwatchFrame(now) {
  if (!stopwatchIsRunning) {
    stopwatchAnimationFrameId = null;
    return;
  }

  const elapsed = stopwatchAccumulatedMs + (now - stopwatchStartTimestamp);
  updateStopwatchDisplay(elapsed);
  stopwatchAnimationFrameId = window.requestAnimationFrame(handleStopwatchFrame);
}

function startStopwatch() {
  if (stopwatchIsRunning) {
    return;
  }

  stopwatchIsRunning = true;
  stopwatchStartTimestamp = performance.now();
  updateStopwatchControls();
  updateStopwatchDisplay(getStopwatchElapsedMs());
  stopwatchAnimationFrameId = window.requestAnimationFrame(handleStopwatchFrame);
}

function pauseStopwatch() {
  if (!stopwatchIsRunning) {
    return;
  }

  const now = performance.now();
  stopwatchAccumulatedMs += now - stopwatchStartTimestamp;
  stopwatchIsRunning = false;

  if (stopwatchAnimationFrameId !== null) {
    window.cancelAnimationFrame(stopwatchAnimationFrameId);
    stopwatchAnimationFrameId = null;
  }

  updateStopwatchDisplay(stopwatchAccumulatedMs);
  updateStopwatchControls();
}

function resetStopwatch() {
  if (stopwatchIsRunning) {
    pauseStopwatch();
  }

  stopwatchAccumulatedMs = 0;
  updateStopwatchDisplay(0);
  updateStopwatchControls();
}

function applyStopwatchPosition(left, top, { persist = false } = {}) {
  if (!stopwatchPanel || !boardRegionElement) {
    return null;
  }

  const boardRect = boardRegionElement.getBoundingClientRect();
  const panelWidth = stopwatchPanel.offsetWidth;
  const panelHeight = stopwatchPanel.offsetHeight;

  if (!panelWidth || !panelHeight || boardRect.width <= 0 || boardRect.height <= 0) {
    return null;
  }

  const numericLeft = Number(left);
  const numericTop = Number(top);
  const desiredLeft = Number.isFinite(numericLeft) ? numericLeft : 0;
  const desiredTop = Number.isFinite(numericTop) ? numericTop : 0;

  const maxLeft = Math.max(0, boardRect.width - panelWidth);
  const maxTop = Math.max(0, boardRect.height - panelHeight);

  const clampedLeft = clamp(desiredLeft, 0, maxLeft);
  const clampedTop = clamp(desiredTop, 0, maxTop);

  stopwatchPanel.style.left = `${clampedLeft}px`;
  stopwatchPanel.style.top = `${clampedTop}px`;

  const applied = { left: clampedLeft, top: clampedTop };
  stopwatchPosition = applied;
  stopwatchHasLoadedPosition = true;

  if (persist) {
    persistStopwatchPosition(applied);
  }

  return applied;
}

function ensureStopwatchWithinBounds({ persist = false } = {}) {
  if (!stopwatchPanel || stopwatchPanel.hidden) {
    return;
  }

  const currentLeft = Number.parseFloat(stopwatchPanel.style.left);
  const currentTop = Number.parseFloat(stopwatchPanel.style.top);
  const fallbackLeft = stopwatchPosition?.left ?? 0;
  const fallbackTop = stopwatchPosition?.top ?? 0;

  const applied = applyStopwatchPosition(
    Number.isFinite(currentLeft) ? currentLeft : fallbackLeft,
    Number.isFinite(currentTop) ? currentTop : fallbackTop,
    { persist }
  );

  if (applied) {
    stopwatchPosition = applied;
  }
}

function getDefaultStopwatchPosition() {
  const margin = 24;
  const boardRect = boardRegionElement?.getBoundingClientRect();
  const panelWidth = stopwatchPanel?.offsetWidth ?? 0;

  if (boardRect) {
    const defaultLeft = boardRect.width - panelWidth - margin;
    return {
      left: Number.isFinite(defaultLeft) ? defaultLeft : margin,
      top: margin
    };
  }

  return { left: margin, top: margin };
}

function showStopwatchPanel() {
  if (!stopwatchPanel || !boardRegionElement) {
    return;
  }

  if (!stopwatchPanel.hidden) {
    ensureStopwatchWithinBounds({ persist: true });
    return;
  }

  stopwatchPanel.hidden = false;
  stopwatchPanel.setAttribute('aria-hidden', 'false');
  stopwatchPanel.classList.add('is-floating');

  if (stopwatchToggleButton) {
    stopwatchToggleButton.classList.add('is-active');
    stopwatchToggleButton.setAttribute('aria-pressed', 'true');
  }

  window.requestAnimationFrame(() => {
    if (!stopwatchPanel) {
      return;
    }

    if (!stopwatchHasLoadedPosition) {
      const stored = readStoredStopwatchPosition();
      if (stored) {
        stopwatchPosition = stored;
      }

      const target = stopwatchPosition ?? getDefaultStopwatchPosition();
      const applied = applyStopwatchPosition(target.left, target.top, { persist: !stopwatchPosition });
      if (applied) {
        stopwatchPosition = applied;
      }
    } else {
      ensureStopwatchWithinBounds({ persist: true });
    }
  });
}

function hideStopwatchPanel() {
  if (!stopwatchPanel || stopwatchPanel.hidden) {
    return;
  }

  stopwatchPanel.hidden = true;
  stopwatchPanel.setAttribute('aria-hidden', 'true');
  stopwatchPanel.classList.remove('is-dragging');

  if (stopwatchToggleButton) {
    stopwatchToggleButton.classList.remove('is-active');
    stopwatchToggleButton.setAttribute('aria-pressed', 'false');
  }
}

function toggleStopwatchPanel() {
  if (!stopwatchPanel) {
    return;
  }

  if (stopwatchPanel.hidden) {
    showStopwatchPanel();
  } else {
    hideStopwatchPanel();
  }
}

function updateStopwatchDragPosition(event) {
  if (!boardRegionElement || !stopwatchPanel) {
    return null;
  }

  const boardRect = boardRegionElement.getBoundingClientRect();
  const proposedLeft = event.clientX - boardRect.left - stopwatchDragOffset.x;
  const proposedTop = event.clientY - boardRect.top - stopwatchDragOffset.y;
  return applyStopwatchPosition(proposedLeft, proposedTop);
}

function handleStopwatchPointerDown(event) {
  if (!stopwatchPanel || !stopwatchDragHandle || !boardRegionElement) {
    return;
  }

  if (stopwatchPanel.hidden) {
    return;
  }

  if (event.pointerType !== 'touch' && event.button !== 0) {
    return;
  }

  stopwatchDragPointerId = event.pointerId;

  const panelRect = stopwatchPanel.getBoundingClientRect();
  stopwatchDragOffset.x = event.clientX - panelRect.left;
  stopwatchDragOffset.y = event.clientY - panelRect.top;

  stopwatchPanel.classList.add('is-dragging');
  stopwatchDragHandle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}

function handleStopwatchPointerMove(event) {
  if (event.pointerId !== stopwatchDragPointerId) {
    return;
  }

  event.preventDefault();
  const applied = updateStopwatchDragPosition(event);
  if (applied) {
    stopwatchPosition = applied;
  }
}

function handleStopwatchPointerUp(event) {
  if (event.pointerId !== stopwatchDragPointerId) {
    return;
  }

  stopwatchDragHandle?.releasePointerCapture?.(event.pointerId);
  stopwatchDragPointerId = null;

  if (stopwatchPanel) {
    stopwatchPanel.classList.remove('is-dragging');
  }

  if (stopwatchPosition) {
    persistStopwatchPosition(stopwatchPosition);
  }
}

function handleStopwatchPointerCancel(event) {
  if (event.pointerId !== stopwatchDragPointerId) {
    return;
  }

  handleStopwatchPointerUp(event);
}

function handleStopwatchResize() {
  if (!stopwatchPanel || stopwatchPanel.hidden) {
    return;
  }

  if (stopwatchResizeAnimationFrameId !== null) {
    return;
  }

  stopwatchResizeAnimationFrameId = window.requestAnimationFrame(() => {
    stopwatchResizeAnimationFrameId = null;
    ensureStopwatchWithinBounds({ persist: true });
  });
}

if (stopwatchStartButton) {
  stopwatchStartButton.addEventListener('click', () => {
    startStopwatch();
  });
}

if (stopwatchPauseButton) {
  stopwatchPauseButton.addEventListener('click', () => {
    pauseStopwatch();
  });
}

if (stopwatchResetButton) {
  stopwatchResetButton.addEventListener('click', () => {
    resetStopwatch();
  });
}

if (stopwatchToggleButton && stopwatchPanel) {
  stopwatchToggleButton.addEventListener('click', () => {
    toggleStopwatchPanel();
  });
}

if (stopwatchCloseButton) {
  stopwatchCloseButton.addEventListener('click', () => {
    hideStopwatchPanel();
    stopwatchToggleButton?.focus?.({ preventScroll: true });
  });
}

if (stopwatchPanel) {
  stopwatchPanel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      hideStopwatchPanel();
      stopwatchToggleButton?.focus?.({ preventScroll: true });
    }
  });
}

if (stopwatchDragHandle) {
  stopwatchDragHandle.addEventListener('pointerdown', handleStopwatchPointerDown);
  stopwatchDragHandle.addEventListener('pointermove', handleStopwatchPointerMove);
  stopwatchDragHandle.addEventListener('pointerup', handleStopwatchPointerUp);
  stopwatchDragHandle.addEventListener('pointercancel', handleStopwatchPointerCancel);
}

if (boardRegionElement) {
  window.addEventListener('resize', handleStopwatchResize);
}

if (stopwatchDisplay) {
  updateStopwatchDisplay(stopwatchAccumulatedMs);
}

if (stopwatchPanel) {
  updateStopwatchControls();
}

const isHexColour = colour => typeof colour === 'string' && /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(colour);

const toColourInputValue = colour => {
  if (!isHexColour(colour)) {
    return null;
  }
  if (colour.length === 4) {
    const [, r, g, b] = colour;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return colour.length === 7 ? colour.toLowerCase() : null;
};

const syncPenColourInput = colour => {
  if (!penColourInput) {
    return;
  }

  const inputColour = toColourInputValue(colour);
  if (!inputColour) {
    return;
  }

  if (penColourInput.value !== inputColour) {
    penColourInput.value = inputColour;
  }
};

const syncPenSizeInput = size => {
  if (!penSizeInput) {
    return;
  }

  const stringValue = String(size);
  if (penSizeInput.value !== stringValue) {
    penSizeInput.value = stringValue;
  }
  penSizeInput.setAttribute('aria-valuenow', stringValue);
};

const originalSetPenColour = controls.setPenColour.bind(controls);
controls.setPenColour = function patchedSetPenColour(colour, persist = true) {
  originalSetPenColour(colour, persist);

  const nextColour = this.userData?.userSettings?.selectedPenColour;
  if (isHexColour(nextColour)) {
    syncPenColourInput(nextColour);
  } else {
    syncPenColourInput(PEN_COLOUR_DEFAULT);
  }
};

const originalSetPenSize = controls.setPenSize.bind(controls);
controls.setPenSize = function patchedSetPenSize(value, persist = true) {
  originalSetPenSize(value, persist);

  const nextSize = this.userData?.userSettings?.selectedPenWidth ?? PEN_SIZE_DEFAULT;
  syncPenSizeInput(nextSize);
};

let undoRedoGloballyEnabled = true;

function updateUndoRedoButtonState() {
  const storedLinesLength = Array.isArray(userData?.storedLines) ? userData.storedLines.length : 0;
  const deletedLinesLength = Array.isArray(userData?.deletedLines) ? userData.deletedLines.length : 0;

  const canUndo = undoRedoGloballyEnabled && storedLinesLength > 0;
  const canRedo = undoRedoGloballyEnabled && deletedLinesLength > 0;

  if (controls.undoButton) {
    controls.undoButton.disabled = !canUndo;
    controls.undoButton.classList.toggle('is-disabled', !canUndo);
  }

  if (controls.redoButton) {
    controls.redoButton.disabled = !canRedo;
    controls.redoButton.classList.toggle('is-disabled', !canRedo);
  }
}

const originalSetUndoRedoEnabled =
  typeof controls.setUndoRedoEnabled === 'function' ? controls.setUndoRedoEnabled.bind(controls) : null;

if (typeof controls.setUndoRedoEnabled === 'function') {
  controls.setUndoRedoEnabled = function patchedSetUndoRedoEnabled(enabled) {
    undoRedoGloballyEnabled = Boolean(enabled);

    if (originalSetUndoRedoEnabled) {
      originalSetUndoRedoEnabled(enabled);
    }

    updateUndoRedoButtonState();
  };
}

updateUndoRedoButtonState();

const resolveStoredPenColour = () => {
  const stored = typeof controls.getStorageItem === 'function' ? controls.getStorageItem('pen.color') : null;
  if (typeof stored === 'string' && stored) {
    return stored;
  }
  const current = userData.userSettings.selectedPenColour;
  if (
    typeof current === 'string' &&
    current &&
    current !== DEFAULT_SETTINGS.selectedPenColour &&
    current !== undefined
  ) {
    return current;
  }
  return PEN_COLOUR_DEFAULT;
};

const resolveStoredPenSize = () => {
  const stored =
    typeof controls.getStorageItem === 'function' ? Number(controls.getStorageItem('pen.size')) : Number.NaN;
  if (Number.isFinite(stored)) {
    return clamp(stored, 1, 200);
  }
  const current = userData.userSettings.selectedPenWidth;
  if (Number.isFinite(current) && current !== DEFAULT_SETTINGS.selectedPenWidth) {
    return clamp(current, 1, 200);
  }
  return PEN_SIZE_DEFAULT;
};

const initialPenColour = resolveStoredPenColour();
const initialPenSize = resolveStoredPenSize();

controls.setPenColour(initialPenColour, false);
controls.setPenSize(initialPenSize, false);

syncPenColourInput(isHexColour(initialPenColour) ? initialPenColour : PEN_COLOUR_DEFAULT);
syncPenSizeInput(initialPenSize);

const rewriterLinesContext = controls.rewriterLinesCanvas?.getContext('2d');
const rewriterContext = controls.rewriterCanvas?.getContext('2d');
const rewriterMaskContext = controls.rewriterMaskCanvas?.getContext('2d');

if (!rewriterLinesContext || !rewriterContext || !rewriterMaskContext) {
  console.error('Failed to initialize canvas contexts');
}

const canvasElements = [
  controls.rewriterCanvas,
  controls.rewriterTraceCanvas,
  controls.rewriterLinesCanvas,
  controls.rewriterPageCanvas,
  controls.rewriterMaskCanvas
];

let resizeDebounceHandle = null;

let eraserMode = false;
let eraserSize = clamp(
  Number(eraserSizeInput?.value) || 24,
  Number(eraserSizeInput?.min) || 1,
  Number(eraserSizeInput?.max) || 200
);

function applyCanvasContextDefaults() {
  [rewriterContext, rewriterLinesContext, rewriterMaskContext].forEach(context => {
    if (!context) {
      return;
    }
    context.lineCap = 'round';
    context.lineJoin = 'round';
  });

  if (rewriterLinesContext) {
    rewriterLinesContext.imageSmoothingEnabled = false;
  }
}

function resizeCanvasesToContainer() {
  const container = controls.writerContainer;
  if (!container) {
    return;
  }

  const rect = container.getBoundingClientRect();
  const cssWidth = rect.width || container.clientWidth || 0;
  const cssHeight = rect.height || container.clientHeight || 0;
  if (!cssWidth || !cssHeight) {
    return;
  }
  const pixelRatio = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(0, Math.round(cssWidth * pixelRatio));
  const pixelHeight = Math.max(0, Math.round(cssHeight * pixelRatio));

  canvasElements.forEach(canvas => {
    if (!canvas) {
      return;
    }

    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }
    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }

    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  });

  applyCanvasContextDefaults();
}

function handleResizeDebounced() {
  if (resizeDebounceHandle !== null) {
    window.clearTimeout(resizeDebounceHandle);
  }

  resizeDebounceHandle = window.setTimeout(() => {
    resizeDebounceHandle = null;
    resizeCanvasesToContainer();
  }, 150);
}

function initialiseCanvasResizing() {
  resizeCanvasesToContainer();
  window.addEventListener('resize', handleResizeDebounced);
}

function updateEraserSize(value) {
  const min = Number(eraserSizeInput?.min) || 1;
  const max = Number(eraserSizeInput?.max) || 200;
  const parsedValue = Number(value);
  const numericValue = clamp(Number.isFinite(parsedValue) ? parsedValue : eraserSize, min, max);
  eraserSize = numericValue;

  if (eraserSizeInput && eraserSizeInput.value !== String(numericValue)) {
    eraserSizeInput.value = String(numericValue);
  }

  if (eraserSizeInput) {
    eraserSizeInput.setAttribute('aria-valuenow', String(numericValue));
  }
}

function setEraserMode(isActive) {
  eraserMode = Boolean(isActive);

  const body = document.body;
  if (body) {
    body.classList.toggle('is-eraser', eraserMode);
  }

  if (eraserButton) {
    eraserButton.classList.toggle('is-active', eraserMode);
    eraserButton.setAttribute('aria-pressed', eraserMode ? 'true' : 'false');
  }

  const eraserControls = [eraserSizeInput, eraserSizeControl];
  eraserControls.forEach(element => {
    if (!element) {
      return;
    }

    element.hidden = !eraserMode;
    element.setAttribute('aria-hidden', eraserMode ? 'false' : 'true');
  });

  if (eraserMode) {
    if (rewriterMaskContext && controls.rewriterMaskCanvas) {
      rewriterMaskContext.clearRect(
        0,
        0,
        controls.rewriterMaskCanvas.width,
        controls.rewriterMaskCanvas.height
      );
    }
  } else if (rewriterContext) {
    rewriterContext.globalCompositeOperation = 'source-over';
  }
}

function toggleEraserMode() {
  setEraserMode(!eraserMode);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiseCanvasResizing);
} else {
  initialiseCanvasResizing();
}

applyCanvasContextDefaults();

updateEraserSize(eraserSize);
setEraserMode(false);

let penDown = false;
let isRewriting = false;
let isReplaying = false;
let replayAnimationFrameId = null;
let replayQueueEntries = [];
let replayQueueIndex = 0;
let replayLastTimestamp = null;
let previousDrawPosition = new Point(0, 0);
let currentLine = [];
let rainbowHue = 0;
let lastPenColour = userData.userSettings.selectedPenColour ?? DEFAULT_SETTINGS.selectedPenColour;
let boardControlsRestoreTimer = null;
let activePointerId = null;

let controller = new AbortController();
let signal = controller.signal;

const rewriteIconUse = controls.rewriteButton?.querySelector('use');

let currentPenImage = null;
let customPenScale = clamp(userData.userSettings.penImageScale ?? 1, 0.1, 5);

let teachController = null;

const retroTvElement = document.getElementById('retroTv');
const timerController = new TimerController({
  menu: controls.timerMenu,
  retroTv: retroTvElement,
  controls
});
timerController.init();

const replayButton = document.getElementById('btnReplay');
const replaySpeedInput = document.getElementById('replaySpeed');

async function initialiseApp() {
  try {
    await loadInitialPenImage();
  } catch (error) {
    console.error('Unable to load the initial pen image.', error);
  }

  try {
    await drawStoredLines(rewriterContext, true);
  } catch (error) {
    console.error('Unable to restore stored handwriting.', error);
  }

  setupEventListeners();

  teachController = new TeachController({
    overlay: document.getElementById('teachOverlay'),
    textInput: document.getElementById('teachTextInput'),
    teachButton: document.getElementById('btnTeach'),
    nextButton: document.getElementById('btnTeachNext'),
    previousButton: document.getElementById('btnTeachPrevious'),
    previewContainer: document.getElementById('teachPreview'),
    previewToggleButton: document.getElementById('btnToggleFreezePreview'),
    hideLettersButton: document.getElementById('btnHideLetters'),
    hideLettersModal: document.getElementById('hideLettersModal'),
    hideLettersBackdrop: document.getElementById('hideLettersModalBackdrop'),
    hideLettersList: document.getElementById('hideLettersList'),
    hideLettersCloseButton: document.getElementById('hideLettersClose'),
    hideLettersResetButton: document.getElementById('hideLettersReset'),
    hideLettersDoneButton: document.getElementById('hideLettersDone'),
    enableDefaultNextHandler: false
  });

  setupCombinedNextRedoButton();
  setupLessonAndPracticePrompts();
}

initialiseApp().catch(error => {
  console.error('Failed to initialise Teach Handwriting.', error);
});

function stopReplay({ restore = true } = {}) {
  if (replayAnimationFrameId !== null) {
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(replayAnimationFrameId);
    }
    replayAnimationFrameId = null;
  }

  const wasReplaying = isReplaying;
  replayQueueEntries = [];
  replayQueueIndex = 0;
  replayLastTimestamp = null;
  isReplaying = false;

  if (replayButton) {
    replayButton.classList.remove('is-active');
    replayButton.setAttribute('aria-pressed', 'false');
  }

  controls.setUndoRedoEnabled(true);

  if (restore && wasReplaying && controls.rewriterCanvas) {
    rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
    rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    drawStoredLines(rewriterContext, true).catch(error => {
      console.error('Unable to restore stored handwriting after replay.', error);
    });
  }
}

function replayStrokes(speed = Number(replaySpeedInput?.value ?? 1)) {
  if (isRewriting || isReplaying) {
    return;
  }

  if (!controls.rewriterCanvas || !rewriterContext || !userData?.storedLines?.length) {
    return;
  }

  const entries = [];
  for (let lineIndex = 0; lineIndex < userData.storedLines.length; lineIndex++) {
    const line = userData.storedLines[lineIndex];
    if (!Array.isArray(line) || !line.length) {
      continue;
    }

    for (let segmentIndex = 0; segmentIndex < line.length; segmentIndex++) {
      const segment = line[segmentIndex];
      if (!segment) {
        continue;
      }
      entries.push({ type: 'segment', segment });
    }

    if (lineIndex < userData.storedLines.length - 1) {
      entries.push({ type: 'pause' });
    }
  }

  if (!entries.length) {
    return;
  }

  replayQueueEntries = entries;
  replayQueueIndex = 0;
  replayLastTimestamp = null;
  isReplaying = true;

  controls.setUndoRedoEnabled(false);

  if (replayButton) {
    replayButton.classList.add('is-active');
    replayButton.setAttribute('aria-pressed', 'true');
  }

  rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
  rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);

  const resolveSpeed = () => {
    const sliderValue = Number(replaySpeedInput?.value);
    if (Number.isFinite(sliderValue) && sliderValue > 0) {
      return sliderValue;
    }
    if (Number.isFinite(speed) && speed > 0) {
      return speed;
    }
    return 1;
  };

  const step = timestamp => {
    if (!isReplaying) {
      return;
    }

    if (replayQueueIndex >= replayQueueEntries.length) {
      stopReplay({ restore: false });
      return;
    }

    const entry = replayQueueEntries[replayQueueIndex];
    const currentSpeed = Math.max(resolveSpeed(), 0.01);
    const baseDelay = entry.type === 'pause' ? 400 : 50;
    const requiredElapsed = baseDelay / currentSpeed;

    if (replayLastTimestamp === null) {
      replayLastTimestamp = timestamp - requiredElapsed;
    }

    if (timestamp - replayLastTimestamp < requiredElapsed) {
      replayAnimationFrameId = window.requestAnimationFrame(step);
      return;
    }

    replayLastTimestamp = timestamp;

    if (entry.type === 'segment') {
      const { segment } = entry;
      rewriterContext.lineWidth = segment.penOptions.width;
      rewriterContext.strokeStyle = segment.penOptions.colour;
      rewriterContext.beginPath();
      rewriterContext.moveTo(segment.start.x, segment.start.y);
      rewriterContext.lineTo(segment.end.x, segment.end.y);
      rewriterContext.stroke();
    }

    replayQueueIndex += 1;

    if (replayQueueIndex >= replayQueueEntries.length) {
      stopReplay({ restore: false });
      return;
    }

    replayAnimationFrameId = window.requestAnimationFrame(step);
  };

  replayAnimationFrameId = window.requestAnimationFrame(step);
}

function setBoardControlsHidden(isHidden) {
  const body = document.body;
  if (!body) {
    return;
  }

  if (isHidden) {
    body.classList.add('board-controls-hidden');
  } else {
    body.classList.remove('board-controls-hidden');
  }

  window.clearTimeout(boardControlsRestoreTimer);
  if (isHidden) {
    boardControlsRestoreTimer = window.setTimeout(() => {
      body.classList.remove('board-controls-hidden');
    }, 2000);
  }
}

async function loadInitialPenImage() {
  const storedSrc = userData.userSettings.customPenImageSrc;
  const initialSrc = storedSrc || DEFAULT_PEN_IMAGE_SRC;
  currentPenImage = await safeLoadPenImage(initialSrc);
  if (!currentPenImage) {
    currentPenImage = await safeLoadPenImage(DEFAULT_PEN_IMAGE_SRC);
  }
}

function setupEventListeners() {
  const normaliseId = elementId =>
    typeof elementId === 'string' && elementId.startsWith('#') ? elementId.slice(1) : elementId;

  const resolveElement = (element, elementId) => {
    if (element) {
      const targetId = normaliseId(elementId);
      if (targetId && element.id && element.id !== targetId) {
        console.warn(`Element ${elementId} did not match expected id ${targetId}. Found ${element.id} instead.`);
      }
      return element;
    }

    if (!elementId) {
      return null;
    }

    const target = document.getElementById(normaliseId(elementId));
    if (!target) {
      console.warn(`Missing expected element ${elementId}.`);
    }
    return target;
  };

  const attachClickListener = (element, handler, elementId) => {
    const target = resolveElement(element, elementId);
    if (!target) {
      return;
    }

    target.addEventListener('click', handler);
  };

  const attachChangeListener = (element, handler, elementId) => {
    const target = resolveElement(element, elementId);
    if (!target) {
      return;
    }

    target.addEventListener('change', handler);
  };

  attachClickListener(
    controls.rewriteButton,
    async () => {
      if (isReplaying) {
        stopReplay({ restore: false });
      }

      if (isRewriting) {
        controller?.abort();
        return;
      }

      controller?.abort();
      controller = new AbortController();
      signal = controller.signal;
      await rewrite(signal);
    },
    '#btnRewrite'
  );

  attachClickListener(
    replayButton,
    () => {
      if (isReplaying) {
        stopReplay();
        return;
      }

      replayStrokes();
    },
    '#btnReplay'
  );

  const undoRedoHandlers = [
    {
      element: controls.undoButton,
      id: '#btnUndo',
      handler: async () => {
        await undoLastLine();
      }
    },
    {
      element: controls.redoButton,
      id: '#btnRedo',
      handler: async () => {
        await redoLastLine();
      }
    },
    {
      element: controls.resetButton,
      id: '#btnReset',
      handler: () => {
        if (isRewriting) {
          controller?.abort();
        }
        if (isReplaying) {
          stopReplay({ restore: false });
        }
        resetCanvas();
      }
    }
  ];

  undoRedoHandlers.forEach(({ element, id, handler }) => attachClickListener(element, handler, id));

  attachClickListener(
    eraserButton,
    () => {
      toggleEraserMode();
    },
    '#btnEraser'
  );

  if (eraserSizeInput) {
    const handleEraserSizeInput = event => {
      updateEraserSize(event.target.value);
    };

    eraserSizeInput.addEventListener('input', handleEraserSizeInput);
    eraserSizeInput.addEventListener('change', handleEraserSizeInput);
  }

  controls.penSizeSlider?.addEventListener('change', () => {
    // Pen size is already persisted by Controls; redraw pen indicator on next move.
  });

  if (penColourInput) {
    penColourInput.addEventListener('input', event => {
      const value = event.target.value;
      if (!isHexColour(value)) {
        return;
      }

      if (typeof controls.clearPaletteSelection === 'function') {
        controls.clearPaletteSelection();
      }

      controls.setPenColour(value, true);
    });
  }

  if (penSizeInput) {
    const handlePenSizeInput = event => {
      const nextSize = clamp(Number(event.target.value) || PEN_SIZE_DEFAULT, 1, 200);
      controls.setPenSize(nextSize, true);

      if (penDown) {
        rewriterContext.lineWidth = nextSize;
      }
    };

    penSizeInput.addEventListener('input', handlePenSizeInput);
    penSizeInput.addEventListener('change', handlePenSizeInput);
  }

  attachChangeListener(
    controls.penImageInput,
    async event => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const dataUrl = await readFileAsDataURL(file);
        const image = await safeLoadPenImage(dataUrl);
        if (image) {
          currentPenImage = image;
          userData.userSettings.customPenImageSrc = dataUrl;
          if (storage) {
            try {
              storage.setItem('pen.imageSrc', dataUrl);
            } catch (storageError) {
              console.warn('Unable to save custom pen image to localStorage.', storageError);
            }
          }
          userData.saveToLocalStorage();
          controls.setCustomPenImageState(true);
        }
      } catch (error) {
        console.warn('Unable to load custom pen image.', error);
      } finally {
        event.target.value = '';
      }
    },
    '#inputPenImage'
  );

  attachClickListener(
    controls.removePenImageButton,
    async () => {
      await resetPenImageToDefault();
    },
    '#btnRemovePenImage'
  );

  if (controls.rewriterCanvas) {
    const canvas = controls.rewriterCanvas;
    if (window?.PointerEvent) {
      const handlePointerDown = event => {
        if (event.pointerType === 'mouse' && event.button !== 0) {
          return;
        }

        try {
          canvas.setPointerCapture?.(event.pointerId);
        } catch (error) {
          console.warn('Unable to set pointer capture on drawing surface.', error);
        }

        drawStart(event);

        if (penDown) {
          activePointerId = event.pointerId;
        } else {
          try {
            canvas.releasePointerCapture?.(event.pointerId);
          } catch (error) {
            // Ignore release errors for failed starts.
          }
        }

        event.preventDefault();
      };

      const handlePointerMove = event => {
        if (activePointerId !== event.pointerId || !penDown) {
          return;
        }

        drawMove(event);
        event.preventDefault();
      };

      const handlePointerUp = event => {
        if (activePointerId !== event.pointerId) {
          return;
        }

        if (penDown) {
          drawEnd();
        }

        try {
          canvas.releasePointerCapture?.(event.pointerId);
        } catch (error) {
          // No action needed if releasePointerCapture is unsupported or fails.
        }

        event.preventDefault();
      };

      canvas.addEventListener('pointerdown', handlePointerDown);
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
    } else {
      canvas.addEventListener('touchstart', event => {
        const touch = event.touches[0];
        if (touch) {
          drawStart(touch);
        }
      });

      canvas.addEventListener('mousedown', event => {
        drawStart(event);
      });

      document.addEventListener('touchmove', event => {
        const touch = event.touches[0];
        if (touch && penDown) {
          drawMove(touch);
        }
      });

      document.addEventListener('mousemove', event => {
        if (penDown) {
          drawMove(event);
        }
      });

      document.addEventListener('touchend', () => {
        drawEnd();
      });

      document.addEventListener('mouseup', () => {
        drawEnd();
      });
    }
  } else {
    console.warn('Missing expected drawing surface #writer.');
  }

  setRewriteButtonState(false);
}

async function undoLastLine() {
  if (isRewriting || isReplaying) {
    updateUndoRedoButtonState();
    return false;
  }

  let lineUndone = false;

  if (userData.deletedLines.length < 100 && userData.storedLines.length > 0) {
    userData.deletedLines.push(userData.storedLines.pop());
    rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    await drawStoredLines(rewriterContext, true);
    userData.saveToLocalStorage();
    lineUndone = true;
  }

  updateUndoRedoButtonState();
  return lineUndone;
}

async function redoLastLine() {
  if (isRewriting || isReplaying) {
    updateUndoRedoButtonState();
    return false;
  }

  let lineRestored = false;

  if (userData.deletedLines.length > 0) {
    userData.storedLines.push(userData.deletedLines.pop());
    rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    await drawStoredLines(rewriterContext, true);
    userData.saveToLocalStorage();
    lineRestored = true;
  }

  updateUndoRedoButtonState();
  return lineRestored;
}

function setupCombinedNextRedoButton() {
  const combinedButton = document.getElementById('btnTeachNext');
  if (!combinedButton) {
    return;
  }

  const handleNext = () => {
    if (teachController) {
      teachController.handleNext();
    }
  };

  combinedButton.addEventListener('click', event => {
    event.preventDefault();
    handleNext();
  });

  combinedButton.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      handleNext();
      return;
    }
  });
}

function setupLessonAndPracticePrompts() {
  const LESSON_TITLE_STORAGE_KEY = 'ph.lessonTitle';
  const LESSON_TITLE_POSITION_STORAGE_KEY = 'ph.lessonTitle.pos';

  const lessonTitleButton = document.getElementById('btnLessonTitlePrompt');
  let lessonTitleFlyout = document.getElementById('lessonTitleFlyout');
  let lessonTitleFlyoutInput = document.getElementById('lessonTitleFlyoutInput');
  let isLessonFlyoutOpen = false;

  const isFullscreenActive = () => document.body?.classList.contains('is-fullscreen') ?? false;

  const ensureLessonFlyoutElements = () => {
    if (!lessonTitleButton) {
      return;
    }

    lessonTitleButton.setAttribute('aria-controls', 'lessonTitleFlyout');

    if (!lessonTitleFlyout) {
      lessonTitleFlyout = document.createElement('div');
      lessonTitleFlyout.id = 'lessonTitleFlyout';
      lessonTitleFlyout.className = 'lesson-title-flyout';
      lessonTitleFlyout.setAttribute('role', 'presentation');
      lessonTitleFlyout.setAttribute('aria-hidden', 'true');
      document.body.appendChild(lessonTitleFlyout);
    }

    if (!lessonTitleFlyoutInput) {
      lessonTitleFlyoutInput = document.createElement('input');
      lessonTitleFlyoutInput.id = 'lessonTitleFlyoutInput';
      lessonTitleFlyoutInput.className = 'lesson-title-flyout__input';
      lessonTitleFlyoutInput.type = 'text';
      lessonTitleFlyoutInput.placeholder = 'Lesson title';
      lessonTitleFlyoutInput.setAttribute('aria-label', 'Lesson title');
      lessonTitleFlyoutInput.autocomplete = 'off';
      lessonTitleFlyout.appendChild(lessonTitleFlyoutInput);
    }
  };

  ensureLessonFlyoutElements();

  const syncStoredLessonTitle = value => {
    const trimmed = value.trim();
    if (lessonTitleFlyoutInput) {
      lessonTitleFlyoutInput.value = trimmed;
    }
    if (controls.lessonTitleInput) {
      controls.lessonTitleInput.value = trimmed;
    }

    controls.applyLessonTitle(trimmed);

    if (trimmed) {
      controls.setStorageItem?.(LESSON_TITLE_STORAGE_KEY, trimmed);
      controls.removeStorageItem?.('ui.lessonTitle');
      controls.removeStorageItem?.('ui.lessonTitlePosition');
      controls.enableLessonTitleFloating?.(true);
    } else {
      controls.removeStorageItem?.(LESSON_TITLE_STORAGE_KEY);
      controls.removeStorageItem?.(LESSON_TITLE_POSITION_STORAGE_KEY);
      controls.removeStorageItem?.('ui.lessonTitle');
      controls.removeStorageItem?.('ui.lessonTitlePosition');
      controls.lessonTitleHasStoredPosition = false;
      controls.lessonTitlePosition = null;
      controls.lessonTitlePointerId = null;
      controls.lessonTitlePointerOffset = { x: 0, y: 0 };
      controls.lessonTitleIsFloating = false;
      if (controls.boardLessonTitle) {
        controls.boardLessonTitle.style.left = '';
        controls.boardLessonTitle.style.top = '';
        controls.boardLessonTitle.style.transform = '';
        controls.boardLessonTitle.classList.remove('is-dragging', 'is-floating');
      }
    }
  };

  if (lessonTitleFlyoutInput) {
    const storedValue = controls.getStorageItem?.(LESSON_TITLE_STORAGE_KEY) ?? '';
    lessonTitleFlyoutInput.value = storedValue.trim();
  }

  const closeLessonFlyout = ({ focusButton = false } = {}) => {
    if (!lessonTitleFlyout || !lessonTitleButton || !isLessonFlyoutOpen) {
      return;
    }
    isLessonFlyoutOpen = false;
    lessonTitleFlyout.classList.remove('is-open');
    lessonTitleFlyout.setAttribute('aria-hidden', 'true');
    lessonTitleFlyout.style.visibility = '';
    lessonTitleButton.setAttribute('aria-expanded', 'false');
    if (focusButton) {
      lessonTitleButton.focus?.({ preventScroll: true });
    }
  };

  const openLessonFlyout = () => {
    if (!lessonTitleFlyout || !lessonTitleButton || !lessonTitleFlyoutInput) {
      return;
    }

    const inputValue = controls.lessonTitleInput?.value ?? lessonTitleFlyoutInput.value ?? '';
    const boardValue = controls.boardLessonTitle?.textContent ?? '';
    const initialValue = (inputValue || boardValue).trim();

    lessonTitleFlyoutInput.value = initialValue;
    isLessonFlyoutOpen = true;

    lessonTitleFlyout.style.visibility = 'hidden';
    lessonTitleFlyout.classList.add('is-open');
    lessonTitleFlyout.setAttribute('aria-hidden', 'false');
    lessonTitleButton.setAttribute('aria-expanded', 'true');

    const buttonRect = lessonTitleButton.getBoundingClientRect();
    const flyoutRect = lessonTitleFlyout.getBoundingClientRect();
    const margin = 12;
    const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
    const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0);
    const scrollX = window.scrollX ?? window.pageXOffset ?? 0;
    const scrollY = window.scrollY ?? window.pageYOffset ?? 0;

    const minLeft = scrollX + margin;
    const maxLeft = scrollX + Math.max(viewportWidth - flyoutRect.width - margin, margin);
    let left = scrollX + buttonRect.right + margin;
    if (left > maxLeft) {
      left = scrollX + buttonRect.left - flyoutRect.width - margin;
    }
    left = clamp(left, minLeft, maxLeft);

    const minTop = scrollY + margin;
    const maxTop = scrollY + Math.max(viewportHeight - flyoutRect.height - margin, margin);
    let top = scrollY + buttonRect.top + buttonRect.height / 2 - flyoutRect.height / 2;
    top = clamp(top, minTop, maxTop);

    lessonTitleFlyout.style.left = `${left}px`;
    lessonTitleFlyout.style.top = `${top}px`;
    lessonTitleFlyout.style.visibility = '';

    lessonTitleFlyoutInput.focus({ preventScroll: true });
    lessonTitleFlyoutInput.select();
  };

  const toggleLessonFlyout = () => {
    if (!lessonTitleFlyout || !lessonTitleFlyoutInput) {
      return;
    }

    if (isLessonFlyoutOpen) {
      closeLessonFlyout({ focusButton: true });
    } else {
      openLessonFlyout();
    }
  };

  const applyLessonFlyoutValue = () => {
    if (!lessonTitleFlyoutInput) {
      return;
    }
    const value = lessonTitleFlyoutInput.value ?? '';
    syncStoredLessonTitle(value);
    closeLessonFlyout({ focusButton: true });
  };

  if (lessonTitleButton) {
    lessonTitleButton.addEventListener('click', () => {
      if (lessonTitleFlyout && lessonTitleFlyoutInput) {
        toggleLessonFlyout();
      }
    });
  }

  if (lessonTitleFlyoutInput) {
    lessonTitleFlyoutInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyLessonFlyoutValue();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLessonFlyout({ focusButton: true });
      }
    });
  }

  if (lessonTitleFlyout) {
    lessonTitleFlyout.addEventListener('focusout', () => {
      if (!isLessonFlyoutOpen) {
        return;
      }
      const activeElement = document.activeElement;
      if (!lessonTitleFlyout.contains(activeElement) && activeElement !== lessonTitleButton) {
        closeLessonFlyout();
      }
    });
  }

  document.addEventListener('pointerdown', event => {
    if (!isLessonFlyoutOpen || !lessonTitleFlyout || !lessonTitleButton) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      closeLessonFlyout();
      return;
    }
    if (lessonTitleFlyout.contains(target) || lessonTitleButton.contains(target)) {
      return;
    }
    closeLessonFlyout();
  });

  ['fullscreenchange', 'webkitfullscreenchange'].forEach(eventName => {
    document.addEventListener(eventName, () => {
      if (!isFullscreenActive()) {
        closeLessonFlyout();
      }
    });
  });

  const practiceButton = document.getElementById('btnPracticeTextPrompt');
  let practiceStrip = document.getElementById('practiceStrip');
  let practiceStripBackdrop = document.getElementById('practiceStripBackdrop');
  let practiceStripForm = document.getElementById('practiceStripForm');
  let practiceStripInput = document.getElementById('practiceStripInput');
  let practiceStripCancel = document.getElementById('practiceStripCancel');

  const practicePreview = document.getElementById('practicePreview');
  const practicePreviewLetters = document.getElementById('practicePreviewLetters');
  const previousLetterButton = document.getElementById('btnPrevLetter');
  const nextLetterButton = document.getElementById('btnNextLetter');
  const revealLettersButton = document.getElementById('btnRevealLettersPrompt');
  const deletePracticeButton = document.getElementById('btnDeletePracticeText');
  const revealLettersFlyout = document.getElementById('revealLettersFlyout');
  const revealLettersForm = document.getElementById('revealLettersForm');
  const revealLettersInput = document.getElementById('revealLettersInput');
  const revealLettersCancel = document.getElementById('revealLettersCancel');

  if (revealLettersButton) {
    revealLettersButton.setAttribute('aria-controls', 'revealLettersFlyout');
    revealLettersButton.setAttribute('aria-expanded', 'false');
    revealLettersButton.setAttribute('aria-haspopup', 'dialog');
  }

  const practiceState = {
    text: '',
    letters: [],
    revealableIndices: [],
    activeRevealableIndex: -1,
    activeLetterIndex: -1,
    activeLetterElement: null,
    hiddenLetters: new Set()
  };

  const normaliseHiddenLetters = rawValue => {
    let characters = [];

    if (rawValue instanceof Set) {
      characters = Array.from(rawValue);
    } else if (Array.isArray(rawValue)) {
      characters = rawValue;
    } else if (typeof rawValue === 'string') {
      characters = Array.from(rawValue);
    }

    const seen = new Set();
    const uniqueCharacters = [];

    characters.forEach(char => {
      if (typeof char !== 'string') {
        return;
      }
      const trimmed = char.trim();
      if (!trimmed) {
        return;
      }
      const lower = trimmed.toLowerCase();
      if (!lower) {
        return;
      }
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueCharacters.push(lower);
      }
    });

    return new Set(uniqueCharacters);
  };

  const updatePracticeNavigationButtons = hasRevealable => {
    const disable = !hasRevealable;

    const applyState = (button, disabled) => {
      if (!button) {
        return;
      }
      button.disabled = disabled;
      if (disabled) {
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.removeAttribute('aria-disabled');
      }
    };

    applyState(previousLetterButton, disable);
    applyState(nextLetterButton, disable);
  };

  const updateRevealLettersButtonState = hasLetters => {
    if (!revealLettersButton) {
      return;
    }

    const shouldDisable = !hasLetters;
    revealLettersButton.disabled = shouldDisable;
    if (shouldDisable) {
      revealLettersButton.setAttribute('aria-disabled', 'true');
      revealLettersButton.setAttribute('aria-expanded', 'false');
    } else {
      revealLettersButton.removeAttribute('aria-disabled');
    }
  };

  const triggerPracticeLetterAnimation = element => {
    if (!element) {
      return;
    }
    element.classList.remove('is-animating');
    void element.offsetWidth;
    element.classList.add('is-animating');
    element.addEventListener(
      'animationend',
      () => {
        element.classList.remove('is-animating');
      },
      { once: true }
    );
  };

  const LETTER_APPEAR_CLASS = 'letter-appear';

  const animateLetterPaths = element => {
    if (!element) {
      return false;
    }

    const svgPaths = element.querySelectorAll('svg path');
    if (!svgPaths.length) {
      return false;
    }

    let applied = false;

    svgPaths.forEach(path => {
      if (typeof path?.getTotalLength !== 'function') {
        path.style.transition = '';
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
        return;
      }

      const totalLength = path.getTotalLength();
      if (!Number.isFinite(totalLength) || totalLength <= 0) {
        path.style.transition = '';
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
        return;
      }

      applied = true;

      path.style.transition = 'none';
      path.style.strokeDasharray = totalLength;
      path.style.strokeDashoffset = totalLength;

      path.getBoundingClientRect();

      path.style.transition = 'stroke-dashoffset 420ms ease-out';
      path.style.strokeDashoffset = '0';

      const cleanup = () => {
        path.style.transition = '';
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
        path.removeEventListener('transitionend', cleanup);
        path.removeEventListener('transitioncancel', cleanup);
      };

      path.addEventListener('transitionend', cleanup);
      path.addEventListener('transitioncancel', cleanup);
    });

    return applied;
  };

  const animatePracticeLetterReveal = element => {
    if (!element) {
      return;
    }

    if (animateLetterPaths(element)) {
      return;
    }

    element.classList.remove(LETTER_APPEAR_CLASS);
    void element.offsetWidth;

    const cleanup = () => {
      element.classList.remove(LETTER_APPEAR_CLASS);
      element.removeEventListener('animationend', cleanup);
      element.removeEventListener('animationcancel', cleanup);
    };

    element.addEventListener('animationend', cleanup);
    element.addEventListener('animationcancel', cleanup);
    element.classList.add(LETTER_APPEAR_CLASS);
  };

  const setActivePracticeLetter = pointerIndex => {
    if (practiceState.activeLetterElement) {
      practiceState.activeLetterElement.classList.remove('is-active');
    }

    if (
      typeof pointerIndex !== 'number' ||
      pointerIndex < 0 ||
      pointerIndex >= practiceState.revealableIndices.length
    ) {
      practiceState.activeRevealableIndex = -1;
      practiceState.activeLetterIndex = -1;
      practiceState.activeLetterElement = null;
      return;
    }

    const letterIndex = practiceState.revealableIndices[pointerIndex];
    const letter = practiceState.letters[letterIndex];
    practiceState.activeRevealableIndex = pointerIndex;
    practiceState.activeLetterIndex = letterIndex;
    practiceState.activeLetterElement = letter?.element ?? null;

    if (letter?.element) {
      letter.element.classList.add('is-active');
      triggerPracticeLetterAnimation(letter.element);
    }
  };

  const rebuildPracticeLetters = () => {
    const normalised = (practiceState.text ?? '').replace(/\r\n/g, '\n');
    const characters = Array.from(normalised);
    const letters = [];

    characters.forEach((char, index) => {
      const isNewline = char === '\n';
      const isWhitespace = !isNewline && /\s/.test(char);
      const isRevealable = !isWhitespace && !isNewline;
      const lower = typeof char === 'string' ? char.toLowerCase() : '';
      const shouldHide = isRevealable && practiceState.hiddenLetters.has(lower);

      letters.push({
        index,
        char,
        lower,
        type: isNewline ? 'newline' : isWhitespace ? 'space' : 'char',
        isRevealable,
        isHidden: shouldHide,
        element: null
      });
    });

    practiceState.letters = letters;
    practiceState.revealableIndices = [];

    letters.forEach((letter, letterIndex) => {
      if (letter.isRevealable) {
        practiceState.revealableIndices.push(letterIndex);
      }
    });

    let firstHiddenOrderIndex = -1;
    for (let orderIndex = 0; orderIndex < practiceState.revealableIndices.length; orderIndex += 1) {
      const revealIndex = practiceState.revealableIndices[orderIndex];
      const letter = letters[revealIndex];
      if (letter?.isHidden) {
        firstHiddenOrderIndex = orderIndex;
        break;
      }
    }

    let pointerIndex = -1;
    const revealableCount = practiceState.revealableIndices.length;
    if (firstHiddenOrderIndex >= 0 && revealableCount > 0) {
      pointerIndex = (firstHiddenOrderIndex - 1 + revealableCount) % revealableCount;
    } else if (revealableCount) {
      pointerIndex = 0;
    }

    practiceState.activeRevealableIndex = pointerIndex;
    practiceState.activeLetterIndex =
      pointerIndex >= 0 ? practiceState.revealableIndices[pointerIndex] : -1;
    practiceState.activeLetterElement = null;
  };

  const updatePracticePreviewUI = () => {
    if (practicePreviewLetters) {
      practicePreviewLetters.innerHTML = '';
    }

    const hasLetters = practiceState.letters.length > 0;
    if (!hasLetters) {
      if (practicePreview) {
        practicePreview.hidden = true;
        practicePreview.setAttribute('aria-hidden', 'true');
      }
      updatePracticeNavigationButtons(false);
      updateRevealLettersButtonState(false);
      setActivePracticeLetter(-1);
      return;
    }

    if (practicePreview) {
      practicePreview.hidden = false;
      practicePreview.setAttribute('aria-hidden', 'false');
    }

    const fragment = document.createDocumentFragment();

    practiceState.letters.forEach((letter, index) => {
      if (letter.type === 'newline') {
        const breakElement = document.createElement('span');
        breakElement.className = 'practice-preview__break';
        breakElement.setAttribute('aria-label', 'Line break');
        breakElement.textContent = '↵';
        fragment.appendChild(breakElement);
        fragment.appendChild(document.createElement('br'));
        letter.element = breakElement;
        return;
      }

      const letterElement = document.createElement('span');
      letterElement.className = 'practice-preview__letter';
      letterElement.dataset.practiceIndex = String(index);

      if (!letter.isRevealable) {
        letterElement.classList.add('practice-preview__letter--space');
        letterElement.textContent = '·';
        letterElement.setAttribute('aria-label', 'Space');
      } else {
        letterElement.textContent = letter.char;
        letterElement.setAttribute('aria-label', `Character ${letter.char}`);
      }

      if (letter.isHidden) {
        letterElement.classList.add('is-hidden');
      }

      fragment.appendChild(letterElement);
      letter.element = letterElement;
    });

    practicePreviewLetters?.appendChild(fragment);

    const hasRevealable = practiceState.revealableIndices.length > 0;
    updatePracticeNavigationButtons(hasRevealable);
    updateRevealLettersButtonState(hasRevealable);

    let pointerIndex = practiceState.activeRevealableIndex;
    if (pointerIndex >= practiceState.revealableIndices.length) {
      pointerIndex = hasRevealable ? practiceState.revealableIndices.length - 1 : -1;
    }
    setActivePracticeLetter(pointerIndex);
  };

  const refreshPracticePreview = () => {
    rebuildPracticeLetters();
    updatePracticePreviewUI();
  };

  const setPracticeText = text => {
    practiceState.text = typeof text === 'string' ? text : '';
    refreshPracticePreview();
  };

  const movePracticePointer = step => {
    if (!practiceState.revealableIndices.length) {
      return;
    }

    const total = practiceState.revealableIndices.length;
    let pointer = practiceState.activeRevealableIndex;

    if (pointer === -1) {
      pointer = step > 0 ? 0 : total - 1;
    } else {
      pointer = (pointer + step + total) % total;
    }

    const letterIndex = practiceState.revealableIndices[pointer];
    const letter = practiceState.letters[letterIndex];

    if (letter && letter.isHidden) {
      letter.isHidden = false;
      letter.element?.classList.remove('is-hidden');
      if (letter.element) {
        animatePracticeLetterReveal(letter.element);
      }
    }

    setActivePracticeLetter(pointer);
  };

  const getHiddenLettersDisplayValue = () =>
    Array.from(practiceState.hiddenLetters)
      .map(char => char.toUpperCase())
      .join('');

  let isRevealFlyoutOpen = false;

  const positionRevealFlyout = () => {
    if (!isRevealFlyoutOpen || !revealLettersFlyout || !revealLettersButton) {
      return;
    }

    const buttonRect = revealLettersButton.getBoundingClientRect();
    const flyoutRect = revealLettersFlyout.getBoundingClientRect();
    const scrollX =
      window.scrollX ?? window.pageXOffset ?? document.documentElement.scrollLeft ?? 0;
    const scrollY =
      window.scrollY ?? window.pageYOffset ?? document.documentElement.scrollTop ?? 0;
    const viewportWidth = window.innerWidth ?? document.documentElement.clientWidth ?? flyoutRect.width;
    const margin = 16;

    let left = buttonRect.left + scrollX;
    const maxLeft = scrollX + viewportWidth - flyoutRect.width - margin;
    if (left > maxLeft) {
      left = Math.max(scrollX + margin, maxLeft);
    } else {
      left = Math.max(scrollX + margin, left);
    }

    const top = buttonRect.bottom + scrollY + 12;

    revealLettersFlyout.style.left = `${left}px`;
    revealLettersFlyout.style.top = `${top}px`;
  };

  const handleRevealFlyoutPointerDown = event => {
    if (!isRevealFlyoutOpen) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (revealLettersFlyout?.contains(target) || revealLettersButton?.contains(target)) {
      return;
    }
    closeRevealFlyout({ restoreFocus: false });
  };

  const handleRevealFlyoutKeydown = event => {
    if (!isRevealFlyoutOpen) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeRevealFlyout({ restoreFocus: true });
    }
  };

  const closeRevealFlyout = ({ restoreFocus = false } = {}) => {
    if (!isRevealFlyoutOpen || !revealLettersFlyout) {
      if (restoreFocus) {
        revealLettersButton?.focus?.({ preventScroll: true });
      }
      return;
    }

    isRevealFlyoutOpen = false;
    revealLettersFlyout.classList.remove('is-open');
    revealLettersFlyout.setAttribute('aria-hidden', 'true');
    revealLettersFlyout.hidden = true;
    revealLettersFlyout.style.visibility = '';

    revealLettersButton?.setAttribute('aria-expanded', 'false');

    document.removeEventListener('pointerdown', handleRevealFlyoutPointerDown);
    document.removeEventListener('keydown', handleRevealFlyoutKeydown, true);
    window.removeEventListener('resize', positionRevealFlyout);
    window.removeEventListener('scroll', positionRevealFlyout, true);

    if (restoreFocus) {
      revealLettersButton?.focus?.({ preventScroll: true });
    }
  };

  const requestRevealFlyoutSubmit = () => {
    if (!revealLettersForm) {
      return;
    }

    if (typeof revealLettersForm.requestSubmit === 'function') {
      revealLettersForm.requestSubmit();
    } else {
      revealLettersForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  };

  const openRevealFlyout = () => {
    if (!revealLettersFlyout || !revealLettersButton || isRevealFlyoutOpen) {
      return;
    }

    if (!practiceState.revealableIndices.length) {
      return;
    }

    if (revealLettersInput) {
      revealLettersInput.value = getHiddenLettersDisplayValue();
    }

    revealLettersFlyout.hidden = false;
    revealLettersFlyout.style.visibility = 'hidden';
    revealLettersFlyout.setAttribute('aria-hidden', 'false');
    revealLettersFlyout.classList.add('is-open');
    revealLettersButton.setAttribute('aria-expanded', 'true');
    isRevealFlyoutOpen = true;

    requestAnimationFrame(() => {
      positionRevealFlyout();
      revealLettersFlyout.style.visibility = '';
      revealLettersInput?.focus?.({ preventScroll: true });
      revealLettersInput?.select?.();
    });

    document.addEventListener('pointerdown', handleRevealFlyoutPointerDown);
    document.addEventListener('keydown', handleRevealFlyoutKeydown, true);
    window.addEventListener('resize', positionRevealFlyout);
    window.addEventListener('scroll', positionRevealFlyout, true);
  };

  const applyHiddenLetters = value => {
    practiceState.hiddenLetters = normaliseHiddenLetters(value);
    refreshPracticePreview();
  };

  refreshPracticePreview();

  const ensurePracticeStripElements = () => {
    if (practiceButton) {
      practiceButton.setAttribute('aria-controls', 'practiceStrip');
    }

    if (!practiceStripBackdrop) {
      practiceStripBackdrop = document.createElement('div');
      practiceStripBackdrop.id = 'practiceStripBackdrop';
      practiceStripBackdrop.className = 'practice-strip__backdrop';
      practiceStripBackdrop.hidden = true;
      document.body.appendChild(practiceStripBackdrop);
    }

    if (!practiceStrip) {
      practiceStrip = document.createElement('section');
      practiceStrip.id = 'practiceStrip';
      practiceStrip.className = 'practice-strip';
      practiceStrip.setAttribute('role', 'dialog');
      practiceStrip.setAttribute('aria-modal', 'true');
      practiceStrip.setAttribute('aria-labelledby', 'practiceStripLabel');
      practiceStrip.hidden = true;

      practiceStripForm = document.createElement('form');
      practiceStripForm.id = 'practiceStripForm';
      practiceStripForm.className = 'practice-strip__form';

      const label = document.createElement('label');
      label.id = 'practiceStripLabel';
      label.className = 'practice-strip__label';
      label.htmlFor = 'practiceStripInput';
      label.textContent = 'Practice text';

      practiceStripInput = document.createElement('textarea');
      practiceStripInput.id = 'practiceStripInput';
      practiceStripInput.className = 'practice-strip__input';
      practiceStripInput.name = 'practiceText';
      practiceStripInput.rows = 2;
      practiceStripInput.placeholder = 'Type the text you want to practice';
      practiceStripInput.autocomplete = 'off';

      const actions = document.createElement('div');
      actions.className = 'practice-strip__actions';

      const applyButton = document.createElement('button');
      applyButton.type = 'submit';
      applyButton.className = 'practice-strip__button practice-strip__button--primary';
      applyButton.textContent = 'Apply';
      applyButton.setAttribute('aria-label', 'Apply practice text');

      practiceStripCancel = document.createElement('button');
      practiceStripCancel.type = 'button';
      practiceStripCancel.id = 'practiceStripCancel';
      practiceStripCancel.className = 'practice-strip__button';
      practiceStripCancel.textContent = 'Cancel';
      practiceStripCancel.setAttribute('aria-label', 'Cancel practice text changes');

      actions.appendChild(applyButton);
      actions.appendChild(practiceStripCancel);

      practiceStripForm.appendChild(label);
      practiceStripForm.appendChild(practiceStripInput);
      practiceStripForm.appendChild(actions);

      practiceStrip.appendChild(practiceStripForm);
      document.body.appendChild(practiceStrip);
    }

    if (!practiceStripForm) {
      practiceStripForm = practiceStrip.querySelector('form');
    }

    if (!practiceStripInput) {
      practiceStripInput = practiceStrip.querySelector('textarea');
    }

    if (!practiceStripCancel) {
      practiceStripCancel = practiceStrip.querySelector('#practiceStripCancel');
    }
  };

  ensurePracticeStripElements();

  const PRACTICE_STRIP_TRANSITION_MS = 400;
  let practiceStripHideTimer = null;
  let isPracticeStripOpen = false;

  const setPracticeButtonExpanded = expanded => {
    if (practiceButton) {
      practiceButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }
  };

  const closePracticeStrip = ({ restoreFocus = false } = {}) => {
    if (!practiceStrip) {
      if (restoreFocus) {
        practiceButton?.focus?.({ preventScroll: true });
      }
      return;
    }

    if (!isPracticeStripOpen && practiceStrip.hidden) {
      if (restoreFocus) {
        practiceButton?.focus?.({ preventScroll: true });
      }
      return;
    }

    isPracticeStripOpen = false;
    practiceStrip.classList.remove('is-open');
    practiceStrip.setAttribute('aria-hidden', 'true');
    practiceStripBackdrop?.classList.remove('is-visible');
    setPracticeButtonExpanded(false);

    window.clearTimeout(practiceStripHideTimer);
    practiceStripHideTimer = window.setTimeout(() => {
      practiceStrip.hidden = true;
      if (practiceStripBackdrop) {
        practiceStripBackdrop.hidden = true;
      }
      if (restoreFocus) {
        practiceButton?.focus?.({ preventScroll: true });
      }
    }, PRACTICE_STRIP_TRANSITION_MS);
  };

  const openPracticeStrip = () => {
    if (!practiceStrip) {
      return;
    }

    window.clearTimeout(practiceStripHideTimer);
    practiceStrip.hidden = false;
    practiceStrip.setAttribute('aria-hidden', 'false');
    if (practiceStripBackdrop) {
      practiceStripBackdrop.hidden = false;
    }

    practiceStrip.classList.add('is-open');
    practiceStripBackdrop?.classList.add('is-visible');

    setPracticeButtonExpanded(true);
    isPracticeStripOpen = true;

    if (practiceStripInput) {
      window.setTimeout(() => {
        practiceStripInput.focus?.({ preventScroll: true });
        practiceStripInput.select?.();
      }, 50);
    }
  };

  if (practiceButton) {
    practiceButton.addEventListener('click', () => {
      if (isPracticeStripOpen) {
        closePracticeStrip({ restoreFocus: false });
        return;
      }

      const currentText =
        practiceState.text ||
        teachController?.getCurrentText?.() ||
        controls.textInput?.value ||
        '';

      if (practiceStripInput) {
        practiceStripInput.value = currentText;
      }

      openPracticeStrip();
    });
  }

  practiceStripForm?.addEventListener('submit', event => {
    event.preventDefault();

    const textValue = practiceStripInput?.value ?? '';
    setPracticeText(textValue);

    if (!teachController) {
      closePracticeStrip({ restoreFocus: true });
      return;
    }

    teachController.applyText(textValue);

    if (controls.textInput) {
      controls.textInput.value = textValue.replace(/\n/g, ' ');
    }

    closePracticeStrip({ restoreFocus: true });
  });

  const requestPracticeStripSubmit = () => {
    if (!practiceStripForm) {
      return;
    }

    if (typeof practiceStripForm.requestSubmit === 'function') {
      practiceStripForm.requestSubmit();
    } else {
      practiceStripForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  };

  practiceStripInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      requestPracticeStripSubmit();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closePracticeStrip({ restoreFocus: true });
    }
  });

  const handlePracticeStripDismiss = () => {
    closePracticeStrip({ restoreFocus: true });
  };

  practiceStripCancel?.addEventListener('click', handlePracticeStripDismiss);
  practiceStripBackdrop?.addEventListener('click', handlePracticeStripDismiss);

  practiceStrip?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePracticeStrip({ restoreFocus: true });
    }
  });

  document.addEventListener('keydown', event => {
    if (!isPracticeStripOpen) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closePracticeStrip({ restoreFocus: true });
    }
  });

  previousLetterButton?.addEventListener('click', () => {
    movePracticePointer(-1);
  });

  nextLetterButton?.addEventListener('click', () => {
    movePracticePointer(1);
  });

  revealLettersButton?.addEventListener('click', () => {
    if (isRevealFlyoutOpen) {
      closeRevealFlyout({ restoreFocus: false });
    } else {
      openRevealFlyout();
    }
  });

  revealLettersForm?.addEventListener('submit', event => {
    event.preventDefault();
    applyHiddenLetters(revealLettersInput?.value ?? '');
    closeRevealFlyout({ restoreFocus: true });
  });

  revealLettersInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      requestRevealFlyoutSubmit();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeRevealFlyout({ restoreFocus: true });
    }
  });

  revealLettersCancel?.addEventListener('click', () => {
    closeRevealFlyout({ restoreFocus: true });
  });

  deletePracticeButton?.addEventListener('click', () => {
    practiceState.hiddenLetters = new Set();
    setPracticeText('');
    closeRevealFlyout({ restoreFocus: false });
    closePracticeStrip({ restoreFocus: false });
    if (practiceStripInput) {
      practiceStripInput.value = '';
    }
    if (controls.textInput) {
      controls.textInput.value = '';
    }
    teachController?.applyText('');
  });
}

function resetCanvas() {
  if (isReplaying) {
    stopReplay({ restore: false });
  }

  if (rewriterMaskContext && controls.rewriterMaskCanvas) {
    rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
  }
  if (rewriterContext && controls.rewriterCanvas) {
    rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
  }
  userData.deletedLines = [];
  userData.storedLines = [];
  userData.saveToLocalStorage();
  updateUndoRedoButtonState();
}

async function rewrite(abortSignal = new AbortController().signal) {
  if (isReplaying) {
    stopReplay({ restore: false });
  }

  if (abortSignal.aborted || isRewriting || !userData.storedLines.length) {
    setRewriteButtonState(false);
    return;
  }

  setRewriteButtonState(true);
  controls.setUndoRedoEnabled(false);
  isRewriting = true;

  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', 'activate_rewrite', {
      selected_background: userData.userSettings.selectedBackground,
      selected_page_colour: userData.userSettings.selectedPageColour,
      write_speed_multiplier: userData.userSettings.rewriteSpeed,
      zoom: userData.userSettings.zoomLevel
    });
  }

  try {
    if (rewriterContext && controls.rewriterCanvas) {
      rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
      await drawStoredLines(rewriterContext, false, abortSignal);
    }
  } finally {
    isRewriting = false;
    controls.setUndoRedoEnabled(true);
    if (rewriterMaskContext && controls.rewriterMaskCanvas) {
      rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
    }
    setRewriteButtonState(false);

    if (abortSignal.aborted && rewriterContext && controls.rewriterCanvas) {
      rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    }

    if (rewriterContext) {
      await drawStoredLines(rewriterContext, true);
    }
  }
}

async function drawStoredLines(ctx, instantDraw = false, abortSignal = undefined) {
  ctx.lineCap = 'round';

  for (let i = 0; i < userData.storedLines.length; i++) {
    if (abortSignal?.aborted) {
      return;
    }

    const line = userData.storedLines[i];
    for (let j = 0; j < line.length; j++) {
      if (abortSignal?.aborted) {
        return;
      }

      const segment = DrawnLine.fromObject(line[j]);
      const isEraserSegment = segment.tool === 'eraser';

      ctx.globalCompositeOperation = isEraserSegment ? 'destination-out' : 'source-over';
      ctx.lineWidth = segment.width;
      ctx.strokeStyle = isEraserSegment ? ERASER_STROKE_COLOUR : segment.colour;

      ctx.beginPath();
      ctx.moveTo(segment.start.x, segment.start.y);
      ctx.lineTo(segment.end.x, segment.end.y);

      if (!instantDraw) {
        if (isEraserSegment) {
          if (rewriterMaskContext && controls.rewriterMaskCanvas) {
            rewriterMaskContext.clearRect(
              0,
              0,
              controls.rewriterMaskCanvas.width,
              controls.rewriterMaskCanvas.height
            );
          }
        } else {
          drawPenIndicator(segment.end.x, segment.end.y, segment.width);
        }
      }

      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      if (!instantDraw) {
        await delay(50 / userData.userSettings.rewriteSpeed);
      }

      if (abortSignal?.aborted) {
        return;
      }
    }

    if (!instantDraw) {
      await delay(400 / userData.userSettings.rewriteSpeed);
    }
  }

  ctx.globalCompositeOperation = 'source-over';

  if (!instantDraw) {
    rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
  }
}

function getActiveStrokeColour() {
  const selected = userData.userSettings.selectedPenColour ?? DEFAULT_SETTINGS.selectedPenColour;
  if (typeof selected === 'string' && selected.toLowerCase() === 'rainbow') {
    const hue = rainbowHue % 360;
    rainbowHue = (rainbowHue + 8) % 360;
    return `hsl(${hue}, 100%, 50%)`;
  }
  return selected;
}

function drawStart(event) {
  if (isRewriting || isReplaying) {
    return;
  }

  if (penDown) {
    return;
  }

  setBoardControlsHidden(true);

  const mousePos = getCanvasCoordinates(event);
  if (!mousePos) {
    return;
  }

  if (isWithinCanvas(mousePos)) {
    userData.deletedLines = [];
    updateUndoRedoButtonState();
    const usingEraser = eraserMode;

    let strokeColour = ERASER_STROKE_COLOUR;
    let strokeWidth = eraserSize;

    if (!usingEraser) {
      const currentPenColour = userData.userSettings.selectedPenColour ?? DEFAULT_SETTINGS.selectedPenColour;
      if ((lastPenColour ?? '') !== currentPenColour) {
        if (typeof currentPenColour === 'string' && currentPenColour.toLowerCase() === 'rainbow') {
          rainbowHue = 0;
        }
        lastPenColour = currentPenColour;
      }

      strokeColour = getActiveStrokeColour();
      strokeWidth = userData.userSettings.selectedPenWidth;
    } else if (rewriterMaskContext && controls.rewriterMaskCanvas) {
      rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
    }

    rewriterContext.globalCompositeOperation = usingEraser ? 'destination-out' : 'source-over';
    rewriterContext.strokeStyle = strokeColour;
    rewriterContext.beginPath();
    rewriterContext.lineWidth = strokeWidth;
    rewriterContext.moveTo(mousePos.x, mousePos.y);
    rewriterContext.lineTo(mousePos.x, mousePos.y);
    rewriterContext.stroke();

    currentLine.push(
      new DrawnLine(mousePos, mousePos, {
        colour: strokeColour,
        width: strokeWidth,
        tool: usingEraser ? 'eraser' : 'pen'
      })
    );

    if (!usingEraser) {
      drawPenIndicator(mousePos.x, mousePos.y, strokeWidth);
    }

    previousDrawPosition = mousePos;
    penDown = true;
  }
}

function drawMove(event) {
  if (!penDown) {
    return;
  }

  const usingEraser = eraserMode;
  const strokeColour = usingEraser ? ERASER_STROKE_COLOUR : getActiveStrokeColour();
  const strokeWidth = usingEraser ? eraserSize : userData.userSettings.selectedPenWidth;

  rewriterContext.globalCompositeOperation = usingEraser ? 'destination-out' : 'source-over';
  rewriterContext.strokeStyle = strokeColour;
  rewriterContext.beginPath();
  rewriterContext.lineWidth = strokeWidth;
  rewriterContext.moveTo(previousDrawPosition.x, previousDrawPosition.y);

  const mousePos = getCanvasCoordinates(event);
  if (!mousePos) {
    return;
  }

  const constrainedPos = new Point(
    clamp(mousePos.x, 0, controls.rewriterCanvas.width),
    clamp(mousePos.y, 0, controls.rewriterCanvas.height)
  );

  currentLine.push(
    new DrawnLine(previousDrawPosition, constrainedPos, {
      colour: strokeColour,
      width: strokeWidth,
      tool: usingEraser ? 'eraser' : 'pen'
    })
  );

  rewriterContext.lineTo(constrainedPos.x, constrainedPos.y);
  rewriterContext.stroke();

  if (!usingEraser) {
    drawPenIndicator(constrainedPos.x, constrainedPos.y, strokeWidth);
  } else if (rewriterMaskContext && controls.rewriterMaskCanvas) {
    rewriterMaskContext.clearRect(
      0,
      0,
      controls.rewriterMaskCanvas.width,
      controls.rewriterMaskCanvas.height
    );
  }

  previousDrawPosition = constrainedPos;
  rewriterContext.globalCompositeOperation = 'source-over';
}

function drawEnd() {
  setBoardControlsHidden(false);
  if (!penDown) {
    return;
  }

  if (rewriterContext) {
    rewriterContext.globalCompositeOperation = 'source-over';
  }

  userData.storedLines.push(currentLine.slice());
  currentLine = [];
  activePointerId = null;
  penDown = false;
  rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
  userData.saveToLocalStorage();
  updateUndoRedoButtonState();
}

function drawPenIndicator(x, y, penSize) {
  if (!currentPenImage) {
    return;
  }

  const width = currentPenImage.naturalWidth || currentPenImage.width;
  const height = currentPenImage.naturalHeight || currentPenImage.height;
  if (!width || !height) {
    return;
  }

  const scale = computePenScale(penSize);
  const drawWidth = width * scale;
  const drawHeight = height * scale;

  rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
  rewriterMaskContext.drawImage(currentPenImage, x, y - drawHeight, drawWidth, drawHeight);
}

function computePenScale(penSize) {
  const base = clamp(penSize / 18, 0.35, 3);
  return base * customPenScale;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function resetPenImageToDefault() {
  const defaultImage = await safeLoadPenImage(DEFAULT_PEN_IMAGE_SRC);
  if (!defaultImage) {
    return;
  }

  currentPenImage = defaultImage;
  userData.userSettings.customPenImageSrc = '';
  userData.userSettings.penImageScale = DEFAULT_SETTINGS.penImageScale;

  if (storage) {
    try {
      storage.setItem('pen.imageSrc', '');
      storage.setItem('pen.imageScale', String(DEFAULT_SETTINGS.penImageScale));
    } catch (error) {
      console.warn('Unable to reset pen preferences in localStorage.', error);
    }
  }

  customPenScale = clamp(userData.userSettings.penImageScale ?? DEFAULT_SETTINGS.penImageScale, 0.1, 5);
  userData.saveToLocalStorage();
  controls.setCustomPenImageState(false);
  rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
}

async function safeLoadPenImage(src) {
  try {
    const image = await loadImage(src);
    return image;
  } catch (error) {
    console.warn('Failed to load pen image', error);
    return null;
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setRewriteButtonState(isPlaying) {
  if (!rewriteIconUse) {
    return;
  }
  const iconId = isPlaying ? 'pause' : 'play';
  rewriteIconUse.setAttribute('href', `${ICON_SPRITE_PATH}#${iconId}`);
  rewriteIconUse.setAttribute('xlink:href', `${ICON_SPRITE_PATH}#${iconId}`);
  controls.rewriteButton?.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
}

function getCanvasCoordinates(positionEvent) {
  const canvas = controls.rewriterCanvas;
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.width;
  const height = rect.height || canvas.height;

  const scaleX = width !== 0 ? canvas.width / width : 1;
  const scaleY = height !== 0 ? canvas.height / height : 1;

  if (typeof positionEvent.clientX !== 'number' || typeof positionEvent.clientY !== 'number') {
    return null;
  }

  const x = (positionEvent.clientX - rect.left) * scaleX;
  const y = (positionEvent.clientY - rect.top) * scaleY;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return new Point(x, y);
}

function isWithinCanvas(point) {
  if (!controls.rewriterCanvas) {
    return false;
  }

  return (
    point.x >= 0 &&
    point.x <= controls.rewriterCanvas.width &&
    point.y >= 0 &&
    point.y <= controls.rewriterCanvas.height
  );
}
