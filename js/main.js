import { UserData, DEFAULT_SETTINGS } from './UserData.js';
import { Controls } from './Controls.js';
import { Point } from './Point.js';
import { DrawnLine } from './DrawnLine.js';
import { PenOptions } from './PenOptions.js';
import { clamp, getAssetUrl, loadImage } from './utils.js';
import { TimerController } from './timer.js';
import { TeachController } from './teach.js';

const ICON_SPRITE_PATH = 'assets/icons.svg';
const DEFAULT_PEN_IMAGE_SRC = getAssetUrl('icons/pen.svg');

const userData = new UserData();
userData.loadFromLocalStorage();

const controls = new Controls(userData);

const rewriterLinesContext = controls.rewriterLinesCanvas.getContext('2d');
rewriterLinesContext.imageSmoothingEnabled = false;
const rewriterContext = controls.rewriterCanvas.getContext('2d');
const rewriterMaskContext = controls.rewriterMaskCanvas.getContext('2d');

rewriterContext.lineCap = 'round';

let penDown = false;
let isRewriting = false;
let previousDrawPosition = new Point(0, 0);
let currentLine = [];

let controller = new AbortController();
let signal = controller.signal;

const rewriteIconUse = controls.rewriteButton?.querySelector('use');

let currentPenImage = null;
let customPenScale = clamp(userData.userSettings.penImageScale ?? 1, 0.1, 5);

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

new TeachController({
  overlay: document.getElementById('teachOverlay'),
  textInput: document.getElementById('teachTextInput'),
  teachButton: document.getElementById('btnTeach'),
  nextButton: document.getElementById('btnTeachNext'),
  freezeInput: document.getElementById('freezeLettersInput'),
  previewContainer: document.getElementById('teachPreview')
});

async function loadInitialPenImage() {
  const storedSrc = userData.userSettings.customPenImageSrc;
  const initialSrc = storedSrc || DEFAULT_PEN_IMAGE_SRC;
  currentPenImage = await safeLoadPenImage(initialSrc);
  if (!currentPenImage) {
    currentPenImage = await safeLoadPenImage(DEFAULT_PEN_IMAGE_SRC);
  }
}

function setupEventListeners() {
  controls.rewriteButton?.addEventListener('click', async () => {
    if (isRewriting) {
      controller?.abort();
      return;
    }

    controller?.abort();
    controller = new AbortController();
    signal = controller.signal;
    await rewrite(signal);
  });

  controls.undoButton?.addEventListener('click', async () => {
    if (isRewriting) {
      return;
    }
    if (userData.deletedLines.length < 100 && userData.storedLines.length > 0) {
      userData.deletedLines.push(userData.storedLines.pop());
      rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
      await drawStoredLines(rewriterContext, true);
      userData.saveToLocalStorage();
    }
  });

  controls.redoButton?.addEventListener('click', async () => {
    if (isRewriting) {
      return;
    }
    if (userData.deletedLines.length > 0) {
      userData.storedLines.push(userData.deletedLines.pop());
      rewriterContext.clearRect(0, 0, controls.rewriterCanvas.width, controls.rewriterCanvas.height);
      await drawStoredLines(rewriterContext, true);
      userData.saveToLocalStorage();
    }
  });

  controls.resetButton?.addEventListener('click', () => {
    if (isRewriting) {
      controller?.abort();
    }
    resetCanvas();
  });

  controls.penSizeSlider?.addEventListener('change', () => {
    // Pen size is already persisted by Controls; redraw pen indicator on next move.
  });

  controls.penImageInput?.addEventListener('change', async event => {
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
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('pen.imageSrc', dataUrl);
        }
        userData.saveToLocalStorage();
        controls.setCustomPenImageState(true);
      }
    } catch (error) {
      console.warn('Unable to load custom pen image.', error);
    } finally {
      event.target.value = '';
    }
  });

  controls.removePenImageButton?.addEventListener('click', async () => {
    await resetPenImageToDefault();
  });

  controls.rewriterCanvas.addEventListener('touchstart', event => {
    const touch = event.touches[0];
    if (touch) {
      drawStart(touch);
    }
  });

  controls.rewriterCanvas.addEventListener('mousedown', event => {
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

  setRewriteButtonState(false);
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

function drawStart(event) {
  if (isRewriting) {
    return;
  }

  const mousePos = getCanvasCoordinates(event);
  if (!mousePos) {
    return;
  }

  if (isWithinCanvas(mousePos)) {
    userData.deletedLines = [];

    rewriterContext.strokeStyle = userData.userSettings.selectedPenColour;
    rewriterContext.beginPath();
    rewriterContext.lineWidth = userData.userSettings.selectedPenWidth;
    rewriterContext.moveTo(mousePos.x, mousePos.y);
    rewriterContext.lineTo(mousePos.x, mousePos.y);
    rewriterContext.stroke();

    currentLine.push(new DrawnLine(mousePos, mousePos, new PenOptions(userData.userSettings.selectedPenColour, userData.userSettings.selectedPenWidth)));

    previousDrawPosition = mousePos;
    penDown = true;
  }
}

function drawMove(event) {
  if (!penDown) {
    return;
  }

  rewriterContext.strokeStyle = userData.userSettings.selectedPenColour;
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
      new PenOptions(userData.userSettings.selectedPenColour, userData.userSettings.selectedPenWidth)
    )
  );

  rewriterContext.lineTo(constrainedPos.x, constrainedPos.y);
  rewriterContext.stroke();

  drawPenIndicator(constrainedPos.x, constrainedPos.y, userData.userSettings.selectedPenWidth);

  previousDrawPosition = constrainedPos;
}

function drawEnd() {
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

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('pen.imageSrc', '');
    window.localStorage.setItem('pen.imageScale', String(DEFAULT_SETTINGS.penImageScale));
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
