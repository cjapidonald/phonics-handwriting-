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

const rewriterLinesContext = controls.rewriterLinesCanvas.getContext('2d');
const rewriterContext = controls.rewriterCanvas.getContext('2d');
const rewriterMaskContext = controls.rewriterMaskCanvas.getContext('2d');

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

  if (eraserSizeInput) {
    eraserSizeInput.hidden = !eraserMode;
    eraserSizeInput.setAttribute('aria-hidden', eraserMode ? 'false' : 'true');
  }

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
  const lessonTitleButton = document.getElementById('btnLessonTitlePrompt');
  let lessonTitleFlyout = document.getElementById('lessonTitleFlyout');
  let lessonTitleFlyoutInput = document.getElementById('lessonTitleFlyoutInput');
  let isLessonFlyoutOpen = false;

  const isFullscreenActive = () => document.body?.classList.contains('is-fullscreen') ?? false;

  const ensureLessonFlyoutElements = () => {
    if (lessonTitleFlyout && lessonTitleFlyoutInput) {
      return;
    }

    if (!lessonTitleButton) {
      return;
    }

    const flyoutContainer =
      lessonTitleButton.closest('.side-panel__flyout') ?? lessonTitleButton.parentElement ?? lessonTitleButton;
    lessonTitleButton.setAttribute('aria-controls', 'lessonTitleFlyout');

    if (!lessonTitleFlyout) {
      lessonTitleFlyout = document.createElement('div');
      lessonTitleFlyout.id = 'lessonTitleFlyout';
      lessonTitleFlyout.className = 'lesson-title-flyout';
      lessonTitleFlyout.setAttribute('role', 'presentation');
      lessonTitleFlyout.setAttribute('aria-hidden', 'true');
      flyoutContainer.appendChild(lessonTitleFlyout);
    }

    if (!lessonTitleFlyoutInput) {
      const label = document.createElement('label');
      label.className = 'lesson-title-flyout__label';
      label.htmlFor = 'lessonTitleFlyoutInput';
      label.textContent = 'Lesson title';

      lessonTitleFlyoutInput = document.createElement('input');
      lessonTitleFlyoutInput.id = 'lessonTitleFlyoutInput';
      lessonTitleFlyoutInput.className = 'lesson-title-flyout__input';
      lessonTitleFlyoutInput.type = 'text';
      lessonTitleFlyoutInput.placeholder = 'Put the lesson title';
      lessonTitleFlyoutInput.autocomplete = 'off';

      lessonTitleFlyout.appendChild(label);
      lessonTitleFlyout.appendChild(lessonTitleFlyoutInput);
    }
  };

  ensureLessonFlyoutElements();

  const syncStoredLessonTitle = value => {
    const trimmed = value.trim();
    if (controls.lessonTitleInput) {
      controls.lessonTitleInput.value = trimmed;
    }
    controls.applyLessonTitle(trimmed);
    if (trimmed) {
      controls.setStorageItem?.('ui.lessonTitle', trimmed);
    } else {
      controls.removeStorageItem?.('ui.lessonTitle');
    }
  };

  const closeLessonFlyout = ({ focusButton = false } = {}) => {
    if (!lessonTitleFlyout || !lessonTitleButton || !isLessonFlyoutOpen) {
      return;
    }
    isLessonFlyoutOpen = false;
    lessonTitleFlyout.classList.remove('is-open');
    lessonTitleFlyout.setAttribute('aria-hidden', 'true');
    lessonTitleButton.setAttribute('aria-expanded', 'false');
    if (focusButton) {
      lessonTitleButton.focus?.({ preventScroll: true });
    }
  };

  const openLessonFlyout = () => {
    if (!lessonTitleFlyout || !lessonTitleButton || !lessonTitleFlyoutInput) {
      return;
    }

    const inputValue = controls.lessonTitleInput?.value ?? '';
    const boardValue = controls.boardLessonTitle?.textContent ?? '';
    const initialValue = (inputValue || boardValue).trim();

    lessonTitleFlyoutInput.value = initialValue;
    isLessonFlyoutOpen = true;
    lessonTitleFlyout.classList.add('is-open');
    lessonTitleFlyout.setAttribute('aria-hidden', 'false');
    lessonTitleButton.setAttribute('aria-expanded', 'true');
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

      practiceStripCancel = document.createElement('button');
      practiceStripCancel.type = 'button';
      practiceStripCancel.id = 'practiceStripCancel';
      practiceStripCancel.className = 'practice-strip__button';
      practiceStripCancel.textContent = 'Cancel';

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
      if (!teachController) {
        return;
      }

      if (isPracticeStripOpen) {
        closePracticeStrip({ restoreFocus: false });
        return;
      }

      const currentText =
        teachController.getCurrentText?.() ?? controls.textInput?.value ?? '';

      if (practiceStripInput) {
        practiceStripInput.value = currentText;
      }

      openPracticeStrip();
    });
  }

  practiceStripForm?.addEventListener('submit', event => {
    event.preventDefault();

    if (!teachController) {
      closePracticeStrip({ restoreFocus: true });
      return;
    }

    const textValue = practiceStripInput?.value ?? '';
    teachController.applyText(textValue);

    if (controls.textInput) {
      controls.textInput.value = textValue.replace(/\n/g, ' ');
    }

    closePracticeStrip({ restoreFocus: true });
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


  const clearPracticeButton = document.getElementById('btnClearPracticeText');
  if (clearPracticeButton) {
    clearPracticeButton.addEventListener('click', () => {
      if (!teachController) {
        return;
      }
      teachController.applyText('');
      closePracticeStrip({ restoreFocus: false });
      const practiceInput = document.getElementById('teachTextInput');
      if (practiceInput) {
        practiceInput.value = '';
        practiceInput.focus?.({ preventScroll: true });
      }
    });
  }
}

function resetCanvas() {
  if (isReplaying) {
    stopReplay({ restore: false });
  }

  rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
  rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
  userData.deletedLines = [];
  userData.storedLines = [];
  userData.saveToLocalStorage();
  updateUndoRedoButtonState();
}

async function rewrite(abortSignal = new AbortSignal()) {
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

  if (typeof gtag === 'function') {
    gtag('event', 'activate_rewrite', {
      selected_background: userData.userSettings.selectedBackground,
      selected_page_colour: userData.userSettings.selectedPageColour,
      write_speed_multiplier: userData.userSettings.rewriteSpeed,
      zoom: userData.userSettings.zoomLevel
    });
  }

  try {
    rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    await drawStoredLines(rewriterContext, false, abortSignal);
  } finally {
    isRewriting = false;
    controls.setUndoRedoEnabled(true);
    rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
    setRewriteButtonState(false);

    if (abortSignal.aborted) {
      rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    }

    await drawStoredLines(rewriterContext, true);
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
