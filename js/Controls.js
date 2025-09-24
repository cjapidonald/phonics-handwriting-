import { DEFAULT_SETTINGS } from './UserData.js';
import { formatDateWithOrdinal, clamp, getAssetUrl, loadImage } from './utils.js';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;

const PEN_SIZE_MIN = 1;
const PEN_SIZE_MAX = 40;

const PEN_COLOUR_SWATCHES = [
  '#111111',
  '#444444',
  '#1e4dd8',
  '#d8342c',
  '#0f7a3d',
  '#7f3f98',
  '#f17f1a',
  '#5b3a1d',
  '#e969ad',
  '#00bcd4',
  '#ffffff'
];

const PHONICS_LINES_IMAGE_SRC = getAssetUrl('icons/Phonics lines.png');
let phonicsLinesImage = null;
let phonicsLinesImagePromise = null;

const PAGE_STYLE_DRAWERS = {
  blank: clearBackground,
  'phonics-lines': drawPhonicsLinesGuidelines
};

export class Controls {
  constructor(userData) {
    this.userData = userData;

    this.writerContainer = document.getElementById('writerContainer');
    this.writerBoard = document.getElementById('writerBoard');
    this.rewriterCanvas = document.getElementById('writer');
    this.rewriterTraceCanvas = document.getElementById('writerTrace');
    this.rewriterLinesCanvas = document.getElementById('writerLines');
    this.rewriterPageCanvas = document.getElementById('writerPage');
    this.rewriterMaskCanvas = document.getElementById('writerMask');

    this.linesContext = this.rewriterLinesCanvas?.getContext('2d') ?? null;
    this.pageContext = this.rewriterPageCanvas?.getContext('2d') ?? null;

    this.rewriteButton = document.getElementById('btnRewrite');
    this.undoButton = document.getElementById('btnUndo');
    this.redoButton = document.getElementById('btnRedo');
    this.resetButton = document.getElementById('btnReset');
    this.fullscreenButton = document.getElementById('btnFullscreen');

    this.zoomOutButton = document.getElementById('btnZoomOut');
    this.zoomInButton = document.getElementById('btnZoomIn');

    this.speedSlider = document.getElementById('sliderSpeed');
    this.penSizeSlider = document.getElementById('sliderPenSize');

    this.pageStyleButton = document.getElementById('btnPageStyle');
    this.pageStylePopover = document.getElementById('pageStylePopover');
    this.pageStyleButtons = this.pageStylePopover
      ? Array.from(this.pageStylePopover.querySelectorAll('[data-page-style]'))
      : [];

    this.pageColourButtons = this.pageStylePopover
      ? Array.from(this.pageStylePopover.querySelectorAll('[data-page-colour]'))
      : [];

    this.paletteButton = document.getElementById('btnPalette');
    this.palettePopover = document.getElementById('palettePopover');
    this.paletteSwatches = this.palettePopover
      ? Array.from(this.palettePopover.querySelectorAll('.swatch[data-colour]'))
      : [];
    this.customColourInput = document.getElementById('colorPicker');

    this.timerButton = document.getElementById('btnTimer');
    this.timerMenu = document.getElementById('timerMenu');
    this.timerOptions = this.timerMenu
      ? Array.from(this.timerMenu.querySelectorAll('.timer-option'))
      : [];
    this.timerProgress = document.getElementById('timerProgress');

    this.toolbarBottom = document.getElementById('toolbarBottom');
    this.toolbarToggleButton = document.getElementById('toolbarToggle');
    this.toolbarOriginalParent = this.toolbarBottom?.parentElement ?? null;
    this.toolbarNextSibling = this.toolbarBottom?.nextSibling ?? null;

    this.uploadPenButton = document.getElementById('btnUploadPen');
    this.removePenImageButton = document.getElementById('btnRemovePenImage');
    this.penImageInput = document.getElementById('inputPenImage');

    this.cookiePopup = document.getElementById('cookiePopup');
    this.cookieAcceptButton = document.getElementById('cookieAcceptButton');
    this.cookieRejectButton = document.getElementById('cookieRejectButton');
    this.cookieSettingsLink = document.getElementById('cookieSettingsLink');

    this.boardDate = document.getElementById('boardDate');
    this.boardLessonTitle = document.getElementById('boardLessonTitle');
    this.lessonTitleInput = document.getElementById('inputLessonTitle');

    this.openPopover = null;
    this.openPopoverButton = null;

    this.migrateSettings();
    this.initialiseCanvases();
    this.setupPopovers();
    this.loadStoredPreferences();
    this.setupPenControls();
    this.setupPageControls();
    this.setupSliders();
    this.setupZoomButtons();
    this.setupAuxiliaryButtons();
    this.setupCookieBanner();
    this.setupDateDisplay();
    this.setupLessonTitle();
    this.setupFullscreenBehaviour();
    this.applyToolbarLayoutVersion();
    this.applyInitialState();
  }

  migrateSettings() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const storedData = this.userData?.userSettings ?? DEFAULT_SETTINGS;
    const map = new Map([
      ['pen.size', storedData.selectedPenWidth ?? DEFAULT_SETTINGS.selectedPenWidth],
      ['pen.color', storedData.selectedPenColour ?? DEFAULT_SETTINGS.selectedPenColour],
      ['pen.imageSrc', storedData.customPenImageSrc ?? ''],
      ['pen.imageScale', storedData.penImageScale ?? DEFAULT_SETTINGS.penImageScale],
      ['page.style', storedData.selectedBackground ?? DEFAULT_SETTINGS.selectedBackground],
      ['page.color', storedData.selectedPageColour ?? DEFAULT_SETTINGS.selectedPageColour],
      ['timer.durationLastUsed', window.localStorage.getItem('timer.durationLastUsed') ?? '60'],
      ['tv.enabled', window.localStorage.getItem('tv.enabled') ?? 'true']
    ]);

    map.forEach((value, key) => {
      if (value === undefined || value === null) {
        return;
      }
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, String(value));
      }
    });

    ['pen.type', 'pen.mode', 'pen.selected', 'ui.sidebarLayoutVersion'].forEach(key => {
      window.localStorage.removeItem(key);
    });
  }

  initialiseCanvases() {
    [
      this.rewriterCanvas,
      this.rewriterTraceCanvas,
      this.rewriterLinesCanvas,
      this.rewriterPageCanvas,
      this.rewriterMaskCanvas
    ].forEach(canvas => {
      if (!canvas) return;
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      canvas.style.width = `${CANVAS_WIDTH}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;
    });
  }

  setupPopovers() {
    const pairs = [
      [this.pageStyleButton, this.pageStylePopover],
      [this.paletteButton, this.palettePopover],
      [this.timerButton, this.timerMenu]
    ];

    pairs.forEach(([button, popover]) => {
      if (!button || !popover) return;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.togglePopover(button, popover);
      });
    });

    document.addEventListener('click', event => {
      if (this.openPopover && !this.openPopover.contains(event.target)) {
        this.closeOpenPopover();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        this.closeOpenPopover();
      }
    });
  }

  togglePopover(button, popover) {
    if (!button || !popover) {
      return;
    }

    if (this.openPopover === popover) {
      this.closeOpenPopover();
      return;
    }

    this.closeOpenPopover();

    popover.style.left = '0px';
    popover.style.top = '0px';
    popover.classList.add('is-visible');

    requestAnimationFrame(() => {
      const rect = button.getBoundingClientRect();
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const left = Math.min(
        viewportWidth - width - 16,
        Math.max(16, rect.left + rect.width / 2 - width / 2)
      );
      const top = Math.min(
        viewportHeight - height - 16,
        rect.bottom + 12
      );

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    });

    button.setAttribute('aria-expanded', 'true');
    this.openPopover = popover;
    this.openPopoverButton = button;
  }

  closeOpenPopover() {
    if (this.openPopover) {
      this.openPopover.classList.remove('is-visible');
      this.openPopover.style.left = '';
      this.openPopover.style.top = '';
    }
    if (this.openPopoverButton) {
      this.openPopoverButton.setAttribute('aria-expanded', 'false');
    }
    this.openPopover = null;
    this.openPopoverButton = null;
  }

  loadStoredPreferences() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const storedSize = Number(window.localStorage.getItem('pen.size'));
    if (Number.isFinite(storedSize)) {
      this.userData.userSettings.selectedPenWidth = clamp(storedSize, PEN_SIZE_MIN, PEN_SIZE_MAX);
    }

    const storedColour = window.localStorage.getItem('pen.color');
    if (typeof storedColour === 'string' && storedColour) {
      this.userData.userSettings.selectedPenColour = storedColour;
    }

    const storedImage = window.localStorage.getItem('pen.imageSrc');
    if (typeof storedImage === 'string') {
      this.userData.userSettings.customPenImageSrc = storedImage;
    }

    const storedScale = Number(window.localStorage.getItem('pen.imageScale'));
    if (Number.isFinite(storedScale) && storedScale > 0) {
      this.userData.userSettings.penImageScale = storedScale;
    }

    const storedBackground = window.localStorage.getItem('page.style');
    if (storedBackground && PAGE_STYLE_DRAWERS[storedBackground]) {
      this.userData.userSettings.selectedBackground = storedBackground;
    }

    const storedPageColour = window.localStorage.getItem('page.color');
    if (storedPageColour) {
      this.userData.userSettings.selectedPageColour = storedPageColour;
    }

    this.setCustomPenImageState(Boolean(this.userData.userSettings.customPenImageSrc));
  }

  setupPenControls() {
    if (this.penSizeSlider) {
      this.penSizeSlider.addEventListener('input', () => {
        const value = clamp(Number(this.penSizeSlider.value) || DEFAULT_SETTINGS.selectedPenWidth, PEN_SIZE_MIN, PEN_SIZE_MAX);
        this.setPenSize(value, true);
      });
    }

    this.paletteSwatches.forEach(button => {
      button.addEventListener('click', () => {
        const colour = button.dataset.colour;
        this.highlightPaletteSwatch(colour);
        this.setPenColour(colour, true);
        this.closeOpenPopover();
      });
    });

    if (this.customColourInput) {
      this.customColourInput.addEventListener('input', () => {
        const value = this.customColourInput.value;
        this.clearPaletteSelection();
        this.setPenColour(value, true);
      });
    }

    if (this.uploadPenButton && this.penImageInput) {
      this.uploadPenButton.addEventListener('click', () => {
        this.penImageInput.click();
      });
    }

    this.setCustomPenImageState(Boolean(this.userData.userSettings.customPenImageSrc));
  }

  setupPageControls() {
    this.pageStyleButtons.forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.pageStyle;
        this.setBackground(key, true);
        this.closeOpenPopover();
      });
    });

    this.pageColourButtons.forEach(button => {
      button.addEventListener('click', () => {
        const colour = button.dataset.pageColour;
        this.setPageColour(colour, true);
      });
    });
  }

  setupSliders() {
    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', () => {
        const speed = clamp(Number(this.speedSlider.value) || DEFAULT_SETTINGS.rewriteSpeed, 0.5, 4);
        this.setRewriteSpeed(speed, true);
      });
    }
  }

  setupZoomButtons() {
    const step = 0.1;
    if (this.zoomOutButton) {
      this.zoomOutButton.addEventListener('click', () => {
        const current = this.userData.userSettings.zoomLevel ?? DEFAULT_SETTINGS.zoomLevel;
        const next = clamp(Number((current - step).toFixed(2)), 0.5, 3);
        this.setZoom(next, true);
      });
    }

    if (this.zoomInButton) {
      this.zoomInButton.addEventListener('click', () => {
        const current = this.userData.userSettings.zoomLevel ?? DEFAULT_SETTINGS.zoomLevel;
        const next = clamp(Number((current + step).toFixed(2)), 0.5, 3);
        this.setZoom(next, true);
      });
    }
  }

  setupAuxiliaryButtons() {
    if (this.fullscreenButton) {
      this.fullscreenButton.addEventListener('click', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          (this.writerContainer ?? document.documentElement).requestFullscreen().catch(() => {});
        }
      });
    }
  }

  setupFullscreenBehaviour() {
    if (typeof document === 'undefined' || !this.toolbarBottom) {
      return;
    }

    const setCollapsedState = collapsed => {
      if (!this.toolbarToggleButton) {
        return;
      }
      const expanded = !collapsed;
      this.toolbarToggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      this.toolbarToggleButton.setAttribute('aria-label', expanded ? 'Hide controls' : 'Show controls');
    };

    setCollapsedState(false);

    const restoreToolbarPosition = () => {
      if (!this.toolbarOriginalParent || !this.toolbarBottom) {
        return;
      }

      if (this.toolbarBottom.parentElement === this.toolbarOriginalParent) {
        return;
      }

      if (this.toolbarNextSibling && this.toolbarNextSibling.parentNode === this.toolbarOriginalParent) {
        this.toolbarOriginalParent.insertBefore(this.toolbarBottom, this.toolbarNextSibling);
      } else {
        this.toolbarOriginalParent.appendChild(this.toolbarBottom);
      }
    };

    const handleFullscreenChange = () => {
      const fullscreenElement = document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
      const isWriterFullscreen = fullscreenElement === this.writerContainer;
      const isDocumentFullscreen =
        fullscreenElement === document.documentElement || fullscreenElement === document.body;
      const isAppFullscreen = isWriterFullscreen || isDocumentFullscreen;
      const body = document.body;

      if (body) {
        body.classList.toggle('is-fullscreen', isAppFullscreen);
      }

      if (isWriterFullscreen) {
        if (this.writerContainer && this.toolbarBottom.parentElement !== this.writerContainer) {
          this.writerContainer.appendChild(this.toolbarBottom);
        }
      } else {
        restoreToolbarPosition();
        this.toolbarBottom.classList.remove('is-collapsed');
        setCollapsedState(false);
      }
    };

    if (this.toolbarToggleButton) {
      this.toolbarToggleButton.addEventListener('click', () => {
        if (!document.body?.classList.contains('is-fullscreen')) {
          return;
        }
        const isCollapsed = this.toolbarBottom.classList.toggle('is-collapsed');
        setCollapsedState(isCollapsed);
      });
    }

    ['fullscreenchange', 'webkitfullscreenchange'].forEach(eventName => {
      document.addEventListener(eventName, handleFullscreenChange);
    });

    handleFullscreenChange();
  }

  setupCookieBanner() {
    if (!this.cookiePopup || !this.cookieAcceptButton || !this.cookieRejectButton) {
      return;
    }

    this.cookieAcceptButton.addEventListener('click', () => {
      this.handleCookieConsent(true);
    });

    this.cookieRejectButton.addEventListener('click', () => {
      this.handleCookieConsent(false);
    });

    if (this.cookieSettingsLink) {
      this.cookieSettingsLink.addEventListener('click', event => {
        event.preventDefault();
        this.showCookieBanner();
      });
    }

    const consent = this.getCookie('cookie_consent');
    if (consent === 'accepted') {
      this.loadAnalytics();
    } else {
      this.cookiePopup.style.display = 'flex';
    }
  }

  setupDateDisplay() {
    if (!this.boardDate) {
      return;
    }

    const applyDate = () => {
      const formatted = formatDateWithOrdinal(new Date());
      this.boardDate.textContent = formatted;
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('ui.dateText', formatted);
      }
    };

    let storedDate = '';
    if (typeof window !== 'undefined' && window.localStorage) {
      storedDate = window.localStorage.getItem('ui.dateText') ?? '';
    }

    if (storedDate) {
      const needsUpdate = /\d(?:st|nd|rd|th)/.test(storedDate) || !storedDate.includes(',');
      if (needsUpdate) {
        applyDate();
      } else {
        this.boardDate.textContent = storedDate;
      }
    } else {
      applyDate();
    }

    this.boardDate.addEventListener('click', () => {
      applyDate();
    });

    this.boardDate.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        applyDate();
      }
    });
  }

  setupLessonTitle() {
    if (!this.lessonTitleInput || !this.boardLessonTitle) {
      return;
    }

    let storedTitle = '';
    if (typeof window !== 'undefined' && window.localStorage) {
      storedTitle = window.localStorage.getItem('ui.lessonTitle') ?? '';
    }

    const initialTitle = storedTitle.trim();
    this.lessonTitleInput.value = storedTitle;
    this.applyLessonTitle(initialTitle);

    this.lessonTitleInput.addEventListener('input', event => {
      const rawValue = event.target.value ?? '';
      const trimmedValue = rawValue.trim();
      this.applyLessonTitle(trimmedValue);

      if (typeof window !== 'undefined' && window.localStorage) {
        if (trimmedValue) {
          window.localStorage.setItem('ui.lessonTitle', trimmedValue);
        } else {
          window.localStorage.removeItem('ui.lessonTitle');
        }
      }
    });
  }

  applyLessonTitle(title) {
    if (!this.boardLessonTitle) {
      return;
    }

    if (title) {
      this.boardLessonTitle.textContent = title;
      this.boardLessonTitle.classList.remove('is-hidden');
      this.boardLessonTitle.setAttribute('aria-hidden', 'false');
    } else {
      this.boardLessonTitle.textContent = '';
      this.boardLessonTitle.classList.add('is-hidden');
      this.boardLessonTitle.setAttribute('aria-hidden', 'true');
    }
  }

  applyToolbarLayoutVersion() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem('ui.toolbarLayoutVersion', '2');
  }

  applyInitialState() {
    this.setPenSize(this.userData.userSettings.selectedPenWidth ?? DEFAULT_SETTINGS.selectedPenWidth, false);
    this.setPenColour(this.userData.userSettings.selectedPenColour ?? DEFAULT_SETTINGS.selectedPenColour, false);
    this.setBackground(this.userData.userSettings.selectedBackground ?? DEFAULT_SETTINGS.selectedBackground, false);
    this.setPageColour(this.userData.userSettings.selectedPageColour ?? DEFAULT_SETTINGS.selectedPageColour, false);
    this.setZoom(this.userData.userSettings.zoomLevel ?? DEFAULT_SETTINGS.zoomLevel, false);
    this.setRewriteSpeed(this.userData.userSettings.rewriteSpeed ?? DEFAULT_SETTINGS.rewriteSpeed, false);
  }

  setPenSize(value, persist = true) {
    const size = clamp(Number(value) || DEFAULT_SETTINGS.selectedPenWidth, PEN_SIZE_MIN, PEN_SIZE_MAX);
    this.userData.userSettings.selectedPenWidth = size;
    if (this.penSizeSlider && this.penSizeSlider.value !== String(size)) {
      this.penSizeSlider.value = String(size);
      this.penSizeSlider.setAttribute('aria-valuenow', String(size));
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('pen.size', String(size));
    }

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setCustomPenImageState(hasCustomImage) {
    const isEnabled = Boolean(hasCustomImage);
    if (this.removePenImageButton) {
      this.removePenImageButton.disabled = !isEnabled;
      this.removePenImageButton.classList.toggle('is-disabled', !isEnabled);
    }
  }

  clearPaletteSelection() {
    this.paletteSwatches.forEach(button => button.classList.remove('is-selected'));
  }

  highlightPaletteSwatch(colour) {
    this.paletteSwatches.forEach(button => {
      const isSelected = button.dataset.colour.toLowerCase() === (colour ?? '').toLowerCase();
      button.classList.toggle('is-selected', isSelected);
    });
  }

  setPenColour(colour, persist = true) {
    const fallback = DEFAULT_SETTINGS.selectedPenColour;
    const nextColour = typeof colour === 'string' && colour ? colour : fallback;
    this.userData.userSettings.selectedPenColour = nextColour;

    this.highlightPaletteSwatch(nextColour);

    if (this.paletteButton) {
      this.paletteButton.style.setProperty('--active-colour', nextColour);
    }

    if (this.customColourInput && this.customColourInput.value !== nextColour) {
      if (!PEN_COLOUR_SWATCHES.some(value => value.toLowerCase() === nextColour.toLowerCase())) {
        this.customColourInput.value = nextColour;
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('pen.color', nextColour);
    }

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setBackground(key, persist = true) {
    const normalisedKey = key === 'red-blue' ? 'phonics-lines' : key;
    const styleKey = PAGE_STYLE_DRAWERS[normalisedKey] ? normalisedKey : 'phonics-lines';
    this.userData.userSettings.selectedBackground = styleKey;
    if (this.linesContext) {
      const drawer = PAGE_STYLE_DRAWERS[styleKey] ?? clearBackground;
      drawer(this.linesContext, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    this.pageStyleButtons.forEach(button => {
      button.classList.toggle('is-selected', button.dataset.pageStyle === styleKey);
    });

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('page.style', styleKey);
    }

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setPageColour(colour, persist = true) {
    const value = typeof colour === 'string' && colour ? colour : DEFAULT_SETTINGS.selectedPageColour;
    this.userData.userSettings.selectedPageColour = value;

    if (this.pageContext) {
      this.pageContext.save();
      this.pageContext.fillStyle = value;
      this.pageContext.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.pageContext.restore();
    }

    this.pageColourButtons.forEach(button => {
      button.classList.toggle('is-selected', button.dataset.pageColour?.toLowerCase() === value.toLowerCase());
    });

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('page.color', value);
    }

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setZoom(value, persist = true) {
    const zoom = clamp(Number(value) || DEFAULT_SETTINGS.zoomLevel, 0.5, 3);
    this.userData.userSettings.zoomLevel = zoom;
    if (this.writerContainer) {
      this.writerContainer.style.transform = `scale(${zoom})`;
      this.writerContainer.style.transformOrigin = 'top center';
      this.writerContainer.style.setProperty('--zoom-level', String(zoom));
    }

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setRewriteSpeed(value, persist = true) {
    const speed = clamp(Number(value) || DEFAULT_SETTINGS.rewriteSpeed, 0.5, 4);
    this.userData.userSettings.rewriteSpeed = speed;
    if (this.speedSlider && this.speedSlider.value !== String(speed)) {
      this.speedSlider.value = String(speed);
      this.speedSlider.setAttribute('aria-valuenow', String(speed));
    }
    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  showCookieBanner() {
    if (this.cookiePopup) {
      this.cookiePopup.style.display = 'flex';
    }
  }

  handleCookieConsent(accepted) {
    this.setCookie('cookie_consent', accepted ? 'accepted' : 'rejected', 365);
    if (this.cookiePopup) {
      this.cookiePopup.style.display = 'none';
    }
    if (accepted) {
      this.loadAnalytics();
    }
  }

  setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
  }

  getCookie(name) {
    const target = `${name}=`;
    const cookies = decodeURIComponent(document.cookie).split(';');
    for (let cookie of cookies) {
      const c = cookie.trim();
      if (c.startsWith(target)) {
        return c.substring(target.length);
      }
    }
    return '';
  }

  loadAnalytics() {
    if (window.gtag) {
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-45NB3EQYGX';
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', 'G-45NB3EQYGX');
  }

  setUndoRedoEnabled(enabled) {
    const disabled = !enabled;
    [this.undoButton, this.redoButton, this.resetButton].forEach(button => {
      if (!button) return;
      button.disabled = disabled;
      button.classList.toggle('is-disabled', disabled);
    });
  }

  setTimerActiveState(isActive) {
    if (this.timerButton) {
      this.timerButton.classList.toggle('is-active', isActive);
      this.timerButton.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
    if (this.timerProgress) {
      this.timerProgress.classList.toggle('is-visible', isActive);
    }
  }

  updateTimerProgress(progressRatio) {
    if (this.timerProgress) {
      const value = clamp(progressRatio, 0, 1) * 100;
      this.timerProgress.style.setProperty('--progress', `${value}%`);
    }
  }
}

function clearBackground(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

function drawPhonicsLinesGuidelines(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);

  if (phonicsLinesImage) {
    ctx.drawImage(phonicsLinesImage, 0, 0, width, height);
    return;
  }

  if (!phonicsLinesImagePromise) {
    phonicsLinesImagePromise = loadImage(PHONICS_LINES_IMAGE_SRC)
      .then(image => {
        phonicsLinesImage = image;
        return image;
      })
      .catch(error => {
        console.warn('Unable to load phonics lines background.', error);
        phonicsLinesImagePromise = null;
        return null;
      });
  }

  phonicsLinesImagePromise.then(image => {
    if (!image) {
      return;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
  });
}
