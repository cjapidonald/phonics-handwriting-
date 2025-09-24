import { DEFAULT_SETTINGS } from './UserData.js';
import { formatDateWithOrdinal, clamp, getAssetUrl, loadImage, getLocalStorage } from './utils.js';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;

const PEN_SIZE_MIN = 1;
const PEN_SIZE_MAX = 40;

const REWRITE_SPEED_MIN = 0.5;
const REWRITE_SPEED_MAX = 8;

const TOOLBAR_POSITION_KEY = 'ui.toolbarPosition';

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

const PHONICS_LINES_ASSET_PATH = 'icons/Phonics lines.png';
const PHONICS_LINES_IMAGE_SRC = getAssetUrl(PHONICS_LINES_ASSET_PATH);
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

    this.toolbar = document.getElementById('toolbarBottom');
    this.toolbarHandle = document.getElementById('toolbarDragHandle');

    this.rewriteButton = document.getElementById('btnRewrite');
    this.undoButton = document.getElementById('btnUndo');
    this.redoButton = document.getElementById('btnRedo');
    this.resetButton = document.getElementById('btnReset');
    this.fullscreenButtons = Array.from(document.querySelectorAll('[data-action="fullscreen"]'));
    this.fullscreenButton = this.fullscreenButtons[0] ?? null;

    this.zoomOutButton = document.getElementById('btnZoomOut');
    this.zoomInButton = document.getElementById('btnZoomIn');

    this.backgroundWhiteButton = document.getElementById('btnBackgroundWhite');
    this.backgroundLinesButton = document.getElementById('btnBackgroundLines');

    this.speedSlider = document.getElementById('sliderSpeed');
    this.penSizeSlider = document.getElementById('sliderPenSize');

    this.penSizeToggleButton = document.getElementById('btnPenSizeToggle');
    this.penSizePanel = document.getElementById('penSizePanel');
    this.penSizeValueLabel = document.getElementById('penSizeValue');
    this.speedToggleButton = document.getElementById('btnSpeedToggle');
    this.speedPanel = document.getElementById('speedPanel');
    this.speedValueLabel = document.getElementById('speedValue');
    this.speedQuickButton = document.getElementById('btnSpeedQuick');

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

    this.boardBookmarks = document.getElementById('boardBookmarks');
    this.boardBookmarksToggle = document.getElementById('boardBookmarksToggle');
    this.boardBookmarksPanel = document.getElementById('boardBookmarksPanel');

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
    this.boardHeader = document.getElementById('boardHeader');
    this.lessonTitleInput = document.getElementById('inputLessonTitle');
    this.lessonTitleSubmitButton = document.getElementById('btnLessonTitleApply');

    this.storage = getLocalStorage();
    this.toolbarLayoutVersion = this.getStorageItem?.('ui.toolbarLayoutVersion') ?? null;

    this.openPopover = null;
    this.openPopoverButton = null;
    this.sliderPanelEntries = new Map();
    this.openSliderKey = null;
    this.toolbarHasCustomPosition = false;
    this.fullscreenToolbarResizeObserver = null;
    this.boardWidthResizeObserver = null;
    this.boardHeaderResizeObserver = null;
    this.boardHeaderResizeAnimationFrame = null;
    this.handleBoardHeaderResize = () => {
      this.queueBoardHeaderResize();
    };

    this.migrateSettings();
    this.initialiseCanvases();
    this.setupPopovers();
    this.loadStoredPreferences();
    this.setupPenControls();
    this.setupPageControls();
    this.setupSliders();
    this.setupZoomButtons();
    this.setupAuxiliaryButtons();
    this.setupBookmarkDock();
    this.applyToolbarLayoutVersion();
    this.setupToolbarDragging();
    this.setupCookieBanner();
    this.setupDateDisplay();
    this.setupLessonTitle();
    this.setupBoardHeaderScaling();
    this.setupFullscreenBehaviour();
    this.setupToolbarWidthSync();
    this.applyInitialState();
  }

  getStorageItem(key) {
    if (!this.storage) {
      return null;
    }
    try {
      return this.storage.getItem(key);
    } catch (error) {
      console.warn(`Unable to read "${key}" from localStorage.`, error);
      return null;
    }
  }

  setStorageItem(key, value) {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem(key, value);
    } catch (error) {
      console.warn(`Unable to write "${key}" to localStorage.`, error);
    }
  }

  removeStorageItem(key) {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.removeItem(key);
    } catch (error) {
      console.warn(`Unable to remove "${key}" from localStorage.`, error);
    }
  }

  migrateSettings() {
    if (!this.storage) {
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
      ['timer.durationLastUsed', this.getStorageItem('timer.durationLastUsed') ?? '60'],
      ['tv.enabled', this.getStorageItem('tv.enabled') ?? 'true']
    ]);

    map.forEach((value, key) => {
      if (value === undefined || value === null) {
        return;
      }
      if (this.getStorageItem(key) === null) {
        this.setStorageItem(key, String(value));
      }
    });

    ['pen.type', 'pen.mode', 'pen.selected', 'ui.sidebarLayoutVersion'].forEach(key => {
      this.removeStorageItem(key);
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
      canvas.style.width = '100%';
      canvas.style.height = '100%';
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
    this.closeSliderPanels();
  }

  closeSliderPanels() {
    if (!this.sliderPanelEntries) {
      return;
    }

    this.sliderPanelEntries.forEach(({ button, panel }) => {
      if (panel) {
        panel.hidden = true;
        panel.setAttribute('aria-hidden', 'true');
      }
      if (button) {
        button.setAttribute('aria-expanded', 'false');
      }
      const container = button?.closest('.control-popover') ?? panel?.closest('.control-popover') ?? null;
      if (container) {
        container.classList.remove('is-open');
      }
    });

    this.openSliderKey = null;
  }

  toggleSliderPanel(key) {
    if (!this.sliderPanelEntries) {
      return;
    }

    const entry = this.sliderPanelEntries.get(key);
    if (!entry) {
      return;
    }

    const isAlreadyOpen = this.openSliderKey === key;
    this.closeSliderPanels();

    if (isAlreadyOpen) {
      return;
    }

    if (entry.panel) {
      entry.panel.hidden = false;
      entry.panel.setAttribute('aria-hidden', 'false');
    }

    if (entry.button) {
      entry.button.setAttribute('aria-expanded', 'true');
    }

    const container = entry.button?.closest('.control-popover') ?? entry.panel?.closest('.control-popover') ?? null;
    if (container) {
      container.classList.add('is-open');
    }

    this.openSliderKey = key;
  }

  loadStoredPreferences() {
    if (!this.storage) {
      return;
    }

    const storedSize = Number(this.getStorageItem('pen.size'));
    if (Number.isFinite(storedSize)) {
      this.userData.userSettings.selectedPenWidth = clamp(storedSize, PEN_SIZE_MIN, PEN_SIZE_MAX);
    }

    const storedColour = this.getStorageItem('pen.color');
    if (typeof storedColour === 'string' && storedColour) {
      this.userData.userSettings.selectedPenColour = storedColour;
    }

    const storedImage = this.getStorageItem('pen.imageSrc');
    if (typeof storedImage === 'string') {
      this.userData.userSettings.customPenImageSrc = storedImage;
    }

    const storedScale = Number(this.getStorageItem('pen.imageScale'));
    if (Number.isFinite(storedScale) && storedScale > 0) {
      this.userData.userSettings.penImageScale = storedScale;
    }

    const storedBackground = this.getStorageItem('page.style');
    if (storedBackground && PAGE_STYLE_DRAWERS[storedBackground]) {
      this.userData.userSettings.selectedBackground = storedBackground;
    }

    const storedPageColour = this.getStorageItem('page.color');
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

    if (this.backgroundWhiteButton) {
      this.backgroundWhiteButton.addEventListener('click', () => {
        this.closeSliderPanels();
        this.setBackground('blank', true);
        this.setPageColour('#ffffff', true);
      });
    }

    if (this.backgroundLinesButton) {
      this.backgroundLinesButton.addEventListener('click', () => {
        this.closeSliderPanels();
        this.setBackground('phonics-lines', true);
      });
    }
  }

  setupSliders() {
    if (this.speedSlider) {
      this.speedSlider.min = String(REWRITE_SPEED_MIN);
      this.speedSlider.max = String(REWRITE_SPEED_MAX);
      this.speedSlider.setAttribute('aria-valuemin', String(REWRITE_SPEED_MIN));
      this.speedSlider.setAttribute('aria-valuemax', String(REWRITE_SPEED_MAX));
      this.speedSlider.addEventListener('input', () => {
        const speed = clamp(
          Number(this.speedSlider.value) || DEFAULT_SETTINGS.rewriteSpeed,
          REWRITE_SPEED_MIN,
          REWRITE_SPEED_MAX
        );
        this.setRewriteSpeed(speed, true);
      });
    }

    if (this.penSizeToggleButton && this.penSizePanel) {
      this.sliderPanelEntries.set('pen', {
        button: this.penSizeToggleButton,
        panel: this.penSizePanel
      });
      this.penSizeToggleButton.setAttribute('aria-expanded', 'false');
      this.penSizePanel.hidden = true;
      this.penSizePanel.setAttribute('aria-hidden', 'true');
      this.penSizeToggleButton.addEventListener('click', event => {
        event.stopPropagation();
        this.toggleSliderPanel('pen');
      });
    }

    if (this.speedToggleButton && this.speedPanel) {
      this.sliderPanelEntries.set('speed', {
        button: this.speedToggleButton,
        panel: this.speedPanel
      });
      this.speedToggleButton.setAttribute('aria-expanded', 'false');
      this.speedPanel.hidden = true;
      this.speedPanel.setAttribute('aria-hidden', 'true');
      this.speedToggleButton.addEventListener('click', event => {
        event.stopPropagation();
        this.toggleSliderPanel('speed');
      });
    }

    if (this.speedQuickButton) {
      this.speedQuickButton.addEventListener('click', event => {
        event.stopPropagation();
        this.toggleSliderPanel('speed');
      });
    }

    if (this.sliderPanelEntries.size > 0) {
      document.addEventListener('click', event => {
        if (!this.openSliderKey) {
          return;
        }
        const entry = this.sliderPanelEntries.get(this.openSliderKey);
        if (!entry) {
          this.openSliderKey = null;
          return;
        }
        const target = event.target instanceof Element ? event.target : null;
        if (target && (entry.button?.contains(target) || entry.panel?.contains(target))) {
          return;
        }
        this.closeSliderPanels();
      });

      document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          this.closeSliderPanels();
        }
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
    if (this.fullscreenButtons.length > 0) {
      const toggleFullscreen = () => {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          (this.writerContainer ?? document.documentElement).requestFullscreen().catch(() => {});
        }
      };

      this.fullscreenButtons.forEach(button => {
        button.addEventListener('click', toggleFullscreen);
      });
    }
  }

  setupBookmarkDock() {
    if (!this.boardBookmarks || !this.boardBookmarksToggle) {
      return;
    }

    const panel = this.boardBookmarksPanel ?? null;
    const actionButtons = panel ? Array.from(panel.querySelectorAll('button')) : [];

    const setExpandedState = expanded => {
      this.boardBookmarks.classList.toggle('is-expanded', expanded);
      this.boardBookmarksToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      this.boardBookmarksToggle.setAttribute('aria-label', expanded ? 'Hide quick actions' : 'Show quick actions');
      if (panel) {
        panel.setAttribute('aria-hidden', expanded ? 'false' : 'true');
      }
      actionButtons.forEach(button => {
        if (expanded) {
          button.removeAttribute('tabindex');
        } else {
          button.setAttribute('tabindex', '-1');
        }
      });
      if (!expanded && this.openPopoverButton && actionButtons.includes(this.openPopoverButton)) {
        this.closeOpenPopover();
      }
    };

    setExpandedState(false);

    this.boardBookmarksToggle.addEventListener('click', () => {
      const isExpanded = this.boardBookmarks.classList.contains('is-expanded');
      const nextExpanded = !isExpanded;
      setExpandedState(nextExpanded);
      if (nextExpanded && actionButtons.length > 0) {
        window.setTimeout(() => {
          const firstButton = actionButtons[0];
          if (firstButton && typeof firstButton.focus === 'function') {
            try {
              firstButton.focus({ preventScroll: true });
            } catch (error) {
              firstButton.focus();
            }
          }
        }, 0);
      }
    });

    if (panel) {
      panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setExpandedState(false);
          this.boardBookmarksToggle.focus({ preventScroll: true });
        }
      });
    }
  }
  setupToolbarDragging() {
    if (!this.toolbar || typeof window === 'undefined') {
      return;
    }

    if (this.toolbarLayoutVersion === '3') {
      this.toolbar.classList.remove('is-dragging');
      return;
    }

    const handle = this.toolbarHandle ?? this.toolbar;
    const storedPosition = this.loadStoredToolbarPosition();
    if (storedPosition) {
      this.positionToolbar(storedPosition.x, storedPosition.y);
      this.toolbarHasCustomPosition = true;
    }

    let pointerId = null;
    let offsetX = 0;
    let offsetY = 0;

    const handlePointerDown = event => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      const rect = this.toolbar.getBoundingClientRect();
      pointerId = event.pointerId;
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      this.toolbar.classList.add('is-dragging');

      try {
        handle.setPointerCapture(pointerId);
      } catch (error) {
        // Ignore inability to capture pointer.
      }

      event.stopPropagation();
      event.preventDefault();
    };

    const handlePointerMove = event => {
      if (pointerId === null || event.pointerId !== pointerId) {
        return;
      }

      this.positionToolbar(event.clientX - offsetX, event.clientY - offsetY);
      event.preventDefault();
    };

    const endDrag = () => {
      if (pointerId === null) {
        return;
      }

      const activePointerId = pointerId;
      pointerId = null;
      this.toolbar.classList.remove('is-dragging');
      try {
        handle.releasePointerCapture(activePointerId);
      } catch (error) {
        // Ignore inability to release pointer.
      }

      const rect = this.toolbar.getBoundingClientRect();
      this.saveToolbarPosition(rect.left, rect.top);
    };

    handle.addEventListener('pointerdown', handlePointerDown);
    handle.addEventListener('pointermove', handlePointerMove);
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
    handle.addEventListener('lostpointercapture', () => {
      pointerId = null;
      this.toolbar.classList.remove('is-dragging');
    });

    window.addEventListener('resize', () => {
      this.ensureToolbarWithinViewport();
    });
  }

  setupFullscreenBehaviour() {
    if (typeof document === 'undefined' || !this.toolbarBottom) {
      return;
    }

    const applyCollapsedState = collapsed => {
      const isFullscreen = this.toolbarBottom?.classList.contains('is-fullscreen-active') ?? false;
      const effectiveCollapsed = isFullscreen && collapsed;
      if (this.toolbarBottom) {
        this.toolbarBottom.classList.toggle('is-collapsed', effectiveCollapsed);
      }
      if (this.toolbarToggleButton) {
        const expanded = !effectiveCollapsed;
        this.toolbarToggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        this.toolbarToggleButton.setAttribute('aria-label', expanded ? 'Hide controls' : 'Show controls');
        this.toolbarToggleButton.setAttribute('aria-hidden', isFullscreen ? 'false' : 'true');
      }
      this.scheduleFullscreenToolbarOffsetUpdate();
    };

    applyCollapsedState(false);

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

      const wasCollapsed = this.toolbarBottom?.classList.contains('is-collapsed') ?? false;
      if (this.toolbarBottom) {
        this.toolbarBottom.classList.toggle('is-fullscreen-active', isAppFullscreen);
      }

      applyCollapsedState(isAppFullscreen && wasCollapsed);
      this.updateToolbarWidthFromBoard();
    };

    if (this.toolbarToggleButton) {
      this.toolbarToggleButton.addEventListener('click', () => {
        if (!this.toolbarBottom?.classList.contains('is-fullscreen-active')) {
          return;
        }
        const shouldCollapse = !this.toolbarBottom.classList.contains('is-collapsed');
        applyCollapsedState(shouldCollapse);
      });
    }

    ['fullscreenchange', 'webkitfullscreenchange'].forEach(eventName => {
      document.addEventListener(eventName, handleFullscreenChange);
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => {
        this.scheduleFullscreenToolbarOffsetUpdate();
      });
    }

    if (typeof ResizeObserver === 'function' && this.toolbarBottom) {
      this.fullscreenToolbarResizeObserver = new ResizeObserver(() => {
        this.scheduleFullscreenToolbarOffsetUpdate();
      });
      this.fullscreenToolbarResizeObserver.observe(this.toolbarBottom);
    }

    handleFullscreenChange();
  }

  setupToolbarWidthSync() {
    if (!this.toolbarBottom || !this.writerBoard) {
      return;
    }

    const updateWidth = () => {
      this.updateToolbarWidthFromBoard();
    };

    updateWidth();

    if (typeof ResizeObserver === 'function') {
      this.boardWidthResizeObserver = new ResizeObserver(updateWidth);
      this.boardWidthResizeObserver.observe(this.writerBoard);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateWidth);
    }
  }

  updateToolbarWidthFromBoard() {
    if (!this.toolbarBottom || !this.writerBoard) {
      return;
    }

    const rect = this.writerBoard.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.width) || rect.width <= 0) {
      return;
    }

    this.toolbarBottom.style.setProperty('--board-width', `${rect.width}px`);
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
      this.setStorageItem('ui.dateText', formatted);
      this.queueBoardHeaderResize();
    };

    let storedDate = '';
    const savedDate = this.getStorageItem('ui.dateText');
    if (typeof savedDate === 'string') {
      storedDate = savedDate;
    }

    if (storedDate) {
      const needsUpdate = /\d(?:st|nd|rd|th)/.test(storedDate) || !storedDate.includes(',');
      if (needsUpdate) {
        applyDate();
      } else {
        this.boardDate.textContent = storedDate;
        this.queueBoardHeaderResize();
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

    this.queueBoardHeaderResize();
  }

  setupLessonTitle() {
    if (!this.lessonTitleInput || !this.boardLessonTitle) {
      return;
    }

    const storedTitle = this.getStorageItem('ui.lessonTitle') ?? '';
    const initialTitle = storedTitle.trim();
    this.lessonTitleInput.value = storedTitle;
    this.applyLessonTitle(initialTitle);

    const updateButtonState = () => {
      if (!this.lessonTitleSubmitButton) {
        return;
      }
      const trimmedValue = (this.lessonTitleInput.value ?? '').trim();
      this.lessonTitleSubmitButton.disabled = trimmedValue.length === 0;
      this.lessonTitleSubmitButton.classList.toggle('is-disabled', trimmedValue.length === 0);
    };

    const applyInputValue = () => {
      const rawValue = this.lessonTitleInput.value ?? '';
      const trimmedValue = rawValue.trim();
      this.applyLessonTitle(trimmedValue);

      if (trimmedValue) {
        this.setStorageItem('ui.lessonTitle', trimmedValue);
      } else {
        this.removeStorageItem('ui.lessonTitle');
      }

      updateButtonState();
    };

    updateButtonState();

    this.lessonTitleInput.addEventListener('input', () => {
      updateButtonState();
    });

    this.lessonTitleInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyInputValue();
      }
    });

    this.lessonTitleSubmitButton?.addEventListener('click', () => {
      applyInputValue();
    });
  }

  setupBoardHeaderScaling() {
    if (!this.boardHeader) {
      return;
    }

    this.queueBoardHeaderResize();

    if (typeof ResizeObserver === 'function') {
      this.boardHeaderResizeObserver = new ResizeObserver(() => {
        this.queueBoardHeaderResize();
      });

      this.boardHeaderResizeObserver.observe(this.boardHeader);

      const titleWrapper = this.boardLessonTitle?.parentElement ?? null;
      const dateWrapper = this.boardDate?.parentElement ?? null;
      const headerParent = this.boardHeader.parentElement ?? null;

      if (titleWrapper) {
        this.boardHeaderResizeObserver.observe(titleWrapper);
      }

      if (dateWrapper) {
        this.boardHeaderResizeObserver.observe(dateWrapper);
      }

      if (headerParent) {
        this.boardHeaderResizeObserver.observe(headerParent);
      }

      if (this.writerBoard) {
        this.boardHeaderResizeObserver.observe(this.writerBoard);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.handleBoardHeaderResize);
    }
  }

  queueBoardHeaderResize() {
    if (!this.boardHeader) {
      return;
    }

    if (typeof window === 'undefined') {
      this.adjustBoardHeaderScaling();
      return;
    }

    if (this.boardHeaderResizeAnimationFrame) {
      window.cancelAnimationFrame(this.boardHeaderResizeAnimationFrame);
    }

    this.boardHeaderResizeAnimationFrame = window.requestAnimationFrame(() => {
      this.boardHeaderResizeAnimationFrame = null;
      this.adjustBoardHeaderScaling();
    });
  }

  adjustBoardHeaderScaling() {
    if (!this.boardHeader || typeof window === 'undefined') {
      return;
    }

    const adjustElement = (element, minScale = 0.6) => {
      if (!element) {
        return;
      }

      const container = element.parentElement;
      if (!container) {
        return;
      }

      element.style.fontSize = '';

      const computed = window.getComputedStyle(element);
      const baseSize = parseFloat(computed.fontSize) || 16;

      if (!Number.isFinite(baseSize) || baseSize <= 0) {
        element.style.fontSize = '';
        return;
      }

      element.style.fontSize = `${baseSize}px`;

      const hasContent = (element.textContent ?? '').trim().length > 0;
      const containerWidth = container.clientWidth;

      if (!hasContent || !containerWidth) {
        return;
      }

      const elementWidth = element.scrollWidth;

      if (elementWidth <= containerWidth) {
        return;
      }

      const scale = containerWidth / elementWidth;
      const clampedScale = Math.max(scale, minScale);
      element.style.fontSize = `${baseSize * clampedScale}px`;
    };

    adjustElement(this.boardLessonTitle, 0.55);
    adjustElement(this.boardDate, 0.65);
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

    this.queueBoardHeaderResize();
  }

  applyToolbarLayoutVersion() {
    const nextVersion = '3';
    if (this.toolbarLayoutVersion !== nextVersion) {
      this.removeStorageItem(TOOLBAR_POSITION_KEY);
      this.toolbarHasCustomPosition = false;
      if (this.toolbar) {
        this.toolbar.style.left = '';
        this.toolbar.style.top = '';
        this.toolbar.style.right = '';
        this.toolbar.style.bottom = '';
        this.toolbar.style.transform = '';
      }
    }
    this.setStorageItem('ui.toolbarLayoutVersion', nextVersion);
    this.toolbarLayoutVersion = nextVersion;
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

    if (this.penSizeValueLabel) {
      this.penSizeValueLabel.textContent = String(size);
    }

    this.setStorageItem('pen.size', String(size));

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

    this.setStorageItem('pen.color', nextColour);

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

    if (this.backgroundWhiteButton) {
      const isBlank = styleKey === 'blank';
      this.backgroundWhiteButton.classList.toggle('is-active', isBlank);
      this.backgroundWhiteButton.setAttribute('aria-pressed', isBlank ? 'true' : 'false');
    }

    if (this.backgroundLinesButton) {
      const isLines = styleKey === 'phonics-lines';
      this.backgroundLinesButton.classList.toggle('is-active', isLines);
      this.backgroundLinesButton.setAttribute('aria-pressed', isLines ? 'true' : 'false');
    }

    this.setStorageItem('page.style', styleKey);

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

    this.setStorageItem('page.color', value);

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setZoom(value, persist = true) {
    const zoom = clamp(Number(value) || DEFAULT_SETTINGS.zoomLevel, 0.5, 3);
    this.userData.userSettings.zoomLevel = zoom;
    if (this.writerContainer) {
      this.writerContainer.style.setProperty('--zoom-level', String(zoom));
    }

    if (this.writerBoard) {
      this.writerBoard.style.setProperty('--zoom-level', String(zoom));
    }

    this.updateToolbarWidthFromBoard();

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setRewriteSpeed(value, persist = true) {
    const speed = clamp(Number(value) || DEFAULT_SETTINGS.rewriteSpeed, REWRITE_SPEED_MIN, REWRITE_SPEED_MAX);
    this.userData.userSettings.rewriteSpeed = speed;
    if (this.speedSlider && this.speedSlider.value !== String(speed)) {
      this.speedSlider.value = String(speed);
      this.speedSlider.setAttribute('aria-valuenow', String(speed));
    }

    if (this.speedValueLabel) {
      const formatted = Number(speed).toFixed(1);
      const display = formatted.endsWith('.0') ? String(Number(formatted)) : formatted;
      this.speedValueLabel.textContent = `${display}×`;
    }
    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  positionToolbar(left, top) {
    if (!this.toolbar || typeof window === 'undefined') {
      return { left, top };
    }

    const rect = this.toolbar.getBoundingClientRect();
    const padding = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const availableWidth = viewportWidth - rect.width - padding;
    const availableHeight = viewportHeight - rect.height - padding;

    const minLeft = padding;
    const minTop = padding;
    const maxLeft = availableWidth >= minLeft ? availableWidth : minLeft;
    const maxTop = availableHeight >= minTop ? availableHeight : minTop;

    const safeLeft = clamp(left, minLeft, maxLeft);
    const safeTop = clamp(top, minTop, maxTop);

    this.toolbar.style.left = `${safeLeft}px`;
    this.toolbar.style.top = `${safeTop}px`;
    this.toolbar.style.right = 'auto';
    this.toolbar.style.bottom = 'auto';
    this.toolbar.style.transform = 'none';
    this.toolbarHasCustomPosition = true;

    return { left: safeLeft, top: safeTop };
  }

  ensureToolbarWithinViewport() {
    if (!this.toolbarHasCustomPosition || !this.toolbar || typeof window === 'undefined') {
      return;
    }

    const rect = this.toolbar.getBoundingClientRect();
    const position = this.positionToolbar(rect.left, rect.top);
    this.saveToolbarPosition(position.left, position.top);
  }

  scheduleFullscreenToolbarOffsetUpdate() {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.updateFullscreenToolbarOffset());
    } else {
      this.updateFullscreenToolbarOffset();
    }
  }

  updateFullscreenToolbarOffset() {
    if (typeof document === 'undefined') {
      return;
    }

    const body = document.body;
    if (!body) {
      return;
    }

    if (!body.classList.contains('is-fullscreen')) {
      body.style.setProperty('--fullscreen-toolbar-offset', '0px');
      return;
    }

    const baseSpacing = 32;
    let offset = baseSpacing;

    if (this.toolbarBottom) {
      const toolbarHeight = this.toolbarBottom.offsetHeight || 0;
      if (toolbarHeight > 0) {
        offset += toolbarHeight;
      }
    }

    if (this.writerContainer && typeof window !== 'undefined') {
      try {
        const styles = window.getComputedStyle(this.writerContainer);
        const paddingBottom = parseFloat(styles.paddingBottom) || 0;
        const gap = parseFloat(styles.rowGap || styles.gap) || 0;
        offset += paddingBottom + gap;
      } catch (error) {
        // Ignore inability to read computed styles.
      }
    }

    body.style.setProperty('--fullscreen-toolbar-offset', `${Math.max(offset, baseSpacing)}px`);
  }

  loadStoredToolbarPosition() {
    if (!this.storage) {
      return null;
    }

    try {
      const raw = this.storage.getItem(TOOLBAR_POSITION_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        Number.isFinite(parsed.x) &&
        Number.isFinite(parsed.y)
      ) {
        return { x: Number(parsed.x), y: Number(parsed.y) };
      }
    } catch (error) {
      console.warn('Unable to load toolbar position from localStorage.', error);
    }

    return null;
  }

  saveToolbarPosition(left, top) {
    if (!this.storage) {
      return;
    }

    try {
      const payload = JSON.stringify({ x: left, y: top });
      this.storage.setItem(TOOLBAR_POSITION_KEY, payload);
      this.toolbarHasCustomPosition = true;
    } catch (error) {
      console.warn('Unable to save toolbar position to localStorage.', error);
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
        console.warn(`Unable to load phonics lines background from "${PHONICS_LINES_ASSET_PATH}".`, error);
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
