import { UserData, DEFAULT_SETTINGS } from './UserData.js';
import { Controls } from './Controls.js';
import { Point } from './Point.js';
import { DrawnLine } from './DrawnLine.js';
import { PenOptions } from './PenOptions.js';
import { clamp, getAssetUrl, loadImage, getLocalStorage } from './utils.js';
import { TimerController } from './timer.js';
import { TeachController } from './teach.js';

const ICON_SPRITE_PATH = 'assets/icons.svg';
const DEFAULT_PEN_IMAGE_SRC = getAssetUrl('icons/pen.svg');

const userData = new UserData();
userData.loadFromLocalStorage();

const controls = new Controls(userData);
const storage = getLocalStorage();

const rewriterLinesContext = controls.rewriterLinesCanvas.getContext('2d');
rewriterLinesContext.imageSmoothingEnabled = false;
const rewriterContext = controls.rewriterCanvas.getContext('2d');
const rewriterMaskContext = controls.rewriterMaskCanvas.getContext('2d');

rewriterContext.lineCap = 'round';

let penDown = false;
let isRewriting = false;
let previousDrawPosition = new Point(0, 0);
let currentLine = [];
let rainbowHue = 0;
let lastPenColour = userData.userSettings.selectedPenColour ?? DEFAULT_SETTINGS.selectedPenColour;
let boardControlsRestoreTimer = null;

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

await loadInitialPenImage();
await drawStoredLines(rewriterContext, true);

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
  const attachClickListener = (element, handler, elementId) => {
    if (!element) {
      console.warn(`Missing expected element ${elementId}.`);
      return;
    }

    element.addEventListener('click', handler);
  };

  const attachChangeListener = (element, handler, elementId) => {
    if (!element) {
      console.warn(`Missing expected element ${elementId}.`);
      return;
    }

    element.addEventListener('change', handler);
  };

  attachClickListener(
    controls.rewriteButton,
    async () => {
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
    controls.undoButton,
    async () => {
      await undoLastLine();
    },
    '#btnUndo'
  );

  attachClickListener(
    controls.redoButton,
    async () => {
      await redoLastLine();
    },
    '#btnRedo'
  );

  attachClickListener(
    controls.resetButton,
    () => {
      if (isRewriting) {
        controller?.abort();
      }
      resetCanvas();
    },
    '#btnReset'
  );

  controls.penSizeSlider?.addEventListener('change', () => {
    // Pen size is already persisted by Controls; redraw pen indicator on next move.
  });

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
    controls.rewriterCanvas.addEventListener('touchstart', event => {
      const touch = event.touches[0];
      if (touch) {
        drawStart(touch);
      }
    });

    controls.rewriterCanvas.addEventListener('mousedown', event => {
      drawStart(event);
    });
  } else {
    console.warn('Missing expected drawing surface #writer.');
  }

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

  setRewriteButtonState(false);
}

async function undoLastLine() {
  if (isRewriting) {
    return false;
  }

  if (userData.deletedLines.length < 100 && userData.storedLines.length > 0) {
    userData.deletedLines.push(userData.storedLines.pop());
    rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    await drawStoredLines(rewriterContext, true);
    userData.saveToLocalStorage();
    return true;
  }

  return false;
}

async function redoLastLine() {
  if (isRewriting) {
    return false;
  }

  if (userData.deletedLines.length > 0) {
    userData.storedLines.push(userData.deletedLines.pop());
    rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
    await drawStoredLines(rewriterContext, true);
    userData.saveToLocalStorage();
    return true;
  }

  return false;
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
  const lessonTitleFlyout = document.getElementById('lessonTitleFlyout');
  const lessonTitleFlyoutInput = document.getElementById('lessonTitleFlyoutInput');
  let isLessonFlyoutOpen = false;

  const isFullscreenActive = () => document.body?.classList.contains('is-fullscreen') ?? false;

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
  const practiceStrip = document.getElementById('practiceStrip');
  const practiceStripBackdrop = document.getElementById('practiceStripBackdrop');
  const practiceStripForm = document.getElementById('practiceStripForm');
  const practiceStripInput = document.getElementById('practiceStripInput');
  const practiceStripCancel = document.getElementById('practiceStripCancel');

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
  rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
  rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
  userData.deletedLines = [];
  userData.storedLines = [];
  userData.saveToLocalStorage();
}

async function rewrite(abortSignal = new AbortSignal()) {
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

      const segment = line[j];
      ctx.lineWidth = segment.penOptions.width;
      ctx.strokeStyle = segment.penOptions.colour;

      ctx.beginPath();
      ctx.moveTo(segment.start.x, segment.start.y);
      ctx.lineTo(segment.end.x, segment.end.y);

      if (!instantDraw) {
        drawPenIndicator(segment.end.x, segment.end.y, segment.penOptions.width);
      }

      ctx.stroke();

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
  if (isRewriting) {
    return;
  }

  setBoardControlsHidden(true);

  const mousePos = getCanvasCoordinates(event);
  if (!mousePos) {
    return;
  }

  if (isWithinCanvas(mousePos)) {
    userData.deletedLines = [];
    const currentPenColour = userData.userSettings.selectedPenColour ?? DEFAULT_SETTINGS.selectedPenColour;
    if ((lastPenColour ?? '') !== currentPenColour) {
      if (typeof currentPenColour === 'string' && currentPenColour.toLowerCase() === 'rainbow') {
        rainbowHue = 0;
      }
      lastPenColour = currentPenColour;
    }

    const strokeColour = getActiveStrokeColour();

    rewriterContext.strokeStyle = strokeColour;
    rewriterContext.beginPath();
    rewriterContext.lineWidth = userData.userSettings.selectedPenWidth;
    rewriterContext.moveTo(mousePos.x, mousePos.y);
    rewriterContext.lineTo(mousePos.x, mousePos.y);
    rewriterContext.stroke();

    currentLine.push(new DrawnLine(mousePos, mousePos, new PenOptions(strokeColour, userData.userSettings.selectedPenWidth)));

    previousDrawPosition = mousePos;
    penDown = true;
  }
}

function drawMove(event) {
  if (!penDown) {
    return;
  }

  const strokeColour = getActiveStrokeColour();
  rewriterContext.strokeStyle = strokeColour;
  rewriterContext.beginPath();
  rewriterContext.lineWidth = userData.userSettings.selectedPenWidth;
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
    new DrawnLine(
      previousDrawPosition,
      constrainedPos,
      new PenOptions(strokeColour, userData.userSettings.selectedPenWidth)
    )
  );

  rewriterContext.lineTo(constrainedPos.x, constrainedPos.y);
  rewriterContext.stroke();

  drawPenIndicator(constrainedPos.x, constrainedPos.y, userData.userSettings.selectedPenWidth);

  previousDrawPosition = constrainedPos;
}

function drawEnd() {
  setBoardControlsHidden(false);
  if (!penDown) {
    return;
  }

  userData.storedLines.push(currentLine.slice());
  currentLine = [];
  penDown = false;
  rewriterMaskContext.clearRect(0, 0, controls.rewriterMaskCanvas.width, controls.rewriterMaskCanvas.height);
  userData.saveToLocalStorage();
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
