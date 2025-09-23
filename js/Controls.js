import { DEFAULT_SETTINGS } from './UserData.js';
import { formatDateWithOrdinal, getIconUrl, clamp } from './utils.js';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;

const PEN_SIZES = {
  small: { id: 'smallPenButton', width: 4, icon: 'penSmallIcon.svg' },
  medium: { id: 'mediumPenButton', width: 8, icon: 'penMediumIcon.svg' },
  large: { id: 'largePenButton', width: 14, icon: 'penLargeIcon.svg' }
};

const PEN_TYPES = {
  marker: { id: 'markerPenTypeButton', imageKey: 'pen', icon: 'pen.svg' },
  pencil: { id: 'pencilPenTypeButton', imageKey: 'pencil', icon: 'pencil.svg' },
  quill: { id: 'quillPenTypeButton', imageKey: 'quill', icon: 'quill.svg' },
  none: { id: 'nonePenTypeButton', imageKey: 'none', icon: 'nonePen.svg' }
};

const DEFAULT_PEN_COLOUR = normalizeHexColour(DEFAULT_SETTINGS.selectedPenColour, '#000000');

const PAGE_COLOURS = {
  white: { id: 'whitePageButton', colour: '#ffffff', icon: 'whitePageColourIcon.svg' },
  peach: { id: 'peachPageButton', colour: '#ffe9d5', icon: 'peachPageColourIcon.svg' },
  yellow: { id: 'yellowPageButton', colour: '#fff7c2', icon: 'yellowPageColourIcon.svg' },
  blue: { id: 'bluePageButton', colour: '#e5f1ff', icon: 'bluePageColourIcon.svg' },
  blueGrey: { id: 'blueGreyPageButton', colour: '#dce6f2', icon: 'blueGreyPageColourIcon.svg' }
};

const BACKGROUND_DRAWERS = {
  'blue-dotted': drawBlueDottedLines,
  'grey-dotted': drawGreyDottedLines,
  'red-blue': drawRedBlueGuidelines,
  'grey-dotted-2': drawGreyDottedLinesDense,
  'yellow-tram': drawYellowTramLines,
  ground: drawGroundLine,
  'grey-lines': drawGreyLines,
  squares: drawSquares,
  blank: clearBackground
};

const BACKGROUND_ICONS = {
  'blue-dotted': { id: 'backgroundButton1', icon: 'blueDottedLinesIcon.svg' },
  'grey-dotted': { id: 'backgroundButton2', icon: 'greyDottedLinesIcon.svg' },
  'red-blue': { id: 'backgroundButton3', icon: 'redBlueLinesIcon.svg' },
  'grey-dotted-2': { id: 'backgroundButton9', icon: 'greyDottedLines2Icon.svg' },
  'yellow-tram': { id: 'backgroundButton7', icon: 'yellowTramLinesIcon.svg' },
  ground: { id: 'backgroundButton5', icon: 'groundIcon.svg' },
  'grey-lines': { id: 'backgroundButton4', icon: 'greyLinesIcon.svg' },
  squares: { id: 'backgroundButton6', icon: 'squaresIcon.svg' },
  blank: { id: 'backgroundButton8', icon: 'blankIcon.svg' }
};

function clearBackground(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

function withContext(ctx, drawFn) {
  ctx.save();
  try {
    drawFn();
  } finally {
    ctx.restore();
  }
}

function drawHorizontalLines(ctx, width, height, { spacing, colour, widthPx = 2, dash = [], offset = 0 }) {
  withContext(ctx, () => {
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = colour;
    ctx.lineWidth = widthPx;
    ctx.setLineDash(dash);

    for (let y = offset; y <= height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  });
}

function drawBlueDottedLines(ctx, width, height) {
  drawHorizontalLines(ctx, width, height, {
    spacing: 80,
    colour: '#1e4dd8',
    widthPx: 2,
    dash: [12, 24],
    offset: 60
  });
}

function drawGreyDottedLines(ctx, width, height) {
  drawHorizontalLines(ctx, width, height, {
    spacing: 70,
    colour: '#7a7a7a',
    widthPx: 2,
    dash: [10, 20],
    offset: 50
  });
}

function drawGreyDottedLinesDense(ctx, width, height) {
  drawHorizontalLines(ctx, width, height, {
    spacing: 50,
    colour: '#7a7a7a',
    widthPx: 1.5,
    dash: [6, 18],
    offset: 40
  });
}

function drawRedBlueGuidelines(ctx, width, height) {
  withContext(ctx, () => {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;

    const spacing = 80;
    for (let y = spacing; y <= height; y += spacing) {
      ctx.beginPath();
      ctx.strokeStyle = '#1e4dd8';
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();

      const mid = y - spacing / 2;
      ctx.beginPath();
      ctx.strokeStyle = '#d8342c';
      ctx.moveTo(0, mid);
      ctx.lineTo(width, mid);
      ctx.stroke();
    }
  });
}

function drawYellowTramLines(ctx, width, height) {
  withContext(ctx, () => {
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f5c400';
    const spacing = 75;
    for (let y = spacing; y <= height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y - spacing / 3);
      ctx.lineTo(width, y - spacing / 3);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, y + spacing / 3);
      ctx.lineTo(width, y + spacing / 3);
      ctx.stroke();
    }
  });
}

function drawGroundLine(ctx, width, height) {
  withContext(ctx, () => {
    ctx.clearRect(0, 0, width, height);
    const groundHeight = height * 0.2;
    ctx.fillStyle = '#9fd26c';
    ctx.fillRect(0, height - groundHeight, width, groundHeight);

    ctx.strokeStyle = '#5c8f35';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, height - groundHeight);
    ctx.lineTo(width, height - groundHeight);
    ctx.stroke();
  });
}

function drawGreyLines(ctx, width, height) {
  drawHorizontalLines(ctx, width, height, {
    spacing: 70,
    colour: '#8f8f8f',
    widthPx: 2,
    dash: [],
    offset: 50
  });
}

function drawSquares(ctx, width, height) {
  withContext(ctx, () => {
    ctx.clearRect(0, 0, width, height);
    const spacing = 70;
    ctx.strokeStyle = '#1f4ea3';
    ctx.lineWidth = 1.5;

    for (let y = spacing; y <= height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let x = spacing; x <= width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  });
}

export class Controls {
  constructor(userData) {
    this.userData = userData;

    this.writerContainer = document.getElementById('writerContainer');
    this.rewriterCanvas = document.getElementById('writer');
    this.rewriterTraceCanvas = document.getElementById('writerTrace');
    this.rewriterLinesCanvas = document.getElementById('writerLines');
    this.rewriterPageCanvas = document.getElementById('writerPage');
    this.rewriterMaskCanvas = document.getElementById('writerMask');

    this.linesContext = this.rewriterLinesCanvas.getContext('2d');
    this.pageContext = this.rewriterPageCanvas.getContext('2d');

    this.traceButton = document.getElementById('traceButton');
    this.loopButton = document.getElementById('loopButton');
    this.rewriteButton = document.getElementById('rewriteButton');
    this.undoButton = document.getElementById('undoButton');
    this.redoButton = document.getElementById('redoButton');
    this.resetButton = document.getElementById('resetButton');

    this.penSizeButton = document.getElementById('penSizeButton');
    this.penSizeOptions = document.getElementById('penSizeButtonOptions');
    this.penTypeButton = document.getElementById('penTypeButton');
    this.penTypeOptions = document.getElementById('penTypeButtonOptions');
    this.penColourButton = document.getElementById('penColourButton');
    this.penColourOptions = document.getElementById('penColourButtonOptions');
    this.paletteContainer = document.getElementById('palette');
    this.customColourInput = document.getElementById('colorPicker');
    this.swatchButtons = Array.from(this.paletteContainer?.querySelectorAll('.swatch') ?? []);
    this.backgroundButton = document.getElementById('backgroundButton');
    this.backgroundOptions = document.getElementById('backgroundButtonOptions');
    this.pageColourButton = document.getElementById('pageColourButton');
    this.pageColourOptions = document.getElementById('pageColourButtonOptions');

    this.zoomSlider = document.getElementById('zoomSlider');
    this.speedSlider = document.getElementById('speedSlider');

    this.collapseLeftSidebar = document.getElementById('collapseLeftSidebar');
    this.collapseRightSidebar = document.getElementById('collapseRightSidebar');
    this.leftSidebarOptions = document.getElementById('leftSidebarOptions');
    this.rightSidebarOptions = document.getElementById('rightSidebarOptions');

    this.fullscreenButton = document.getElementById('fullscreenButton');
    this.contactButton = document.getElementById('contactButton');
    this.helpButton = document.getElementById('helpButton');
    this.contactFormContainer = document.getElementById('formContainer');
    this.contactForm = document.getElementById('emailForm');
    this.contactFormClose = document.getElementById('closeFormButton');
    this.contactResult = document.getElementById('emailResult');

    this.cookiePopup = document.getElementById('cookiePopup');
    this.cookieAcceptButton = document.getElementById('cookieAcceptButton');
    this.cookieRejectButton = document.getElementById('cookieRejectButton');
    this.cookieSettingsLink = document.getElementById('cookieSettingsLink');

    this.dateText = document.getElementById('dateText');
    this.dateButton = document.getElementById('dateButton');

    this.openOptionsMenu = null;

    this.penSizeButtons = mapButtons(PEN_SIZES);
    this.penTypeButtons = mapButtons(PEN_TYPES);
    this.backgroundButtons = mapButtons(BACKGROUND_ICONS);
    this.pageColourButtons = mapButtons(PAGE_COLOURS);

    this.initialiseCanvases();
    this.setupOptionToggles();
    this.setupPenControls();
    this.setupBackgroundControls();
    this.setupSliders();
    this.setupSidebarCollapses();
    this.setupAuxiliaryButtons();
    this.setupContactForm();
    this.setupCookieBanner();
    this.setupDateDisplay();
    this.applyInitialState();
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

  setupOptionToggles() {
    const toggleMap = [
      [this.penSizeButton, this.penSizeOptions],
      [this.penTypeButton, this.penTypeOptions],
      [this.penColourButton, this.penColourOptions],
      [this.backgroundButton, this.backgroundOptions],
      [this.pageColourButton, this.pageColourOptions]
    ];

    toggleMap.forEach(([button, container]) => {
      if (!button || !container) return;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleOptionsMenu(container, button);
      });
    });

    document.addEventListener('click', event => {
      if (this.openOptionsMenu && !this.openOptionsMenu.contains(event.target)) {
        this.closeOpenOptionsMenu();
      }
    });
  }

  toggleOptionsMenu(container, button) {
    if (!container) return;

    if (this.openOptionsMenu === container) {
      this.closeOpenOptionsMenu();
      return;
    }

    this.closeOpenOptionsMenu();
    const rect = button.getBoundingClientRect();
    container.style.left = `${rect.left}px`;
    container.style.top = `${rect.bottom + 8}px`;
    container.classList.add('options-button-options-show');
    this.openOptionsMenu = container;
  }

  closeOpenOptionsMenu() {
    if (this.openOptionsMenu) {
      this.openOptionsMenu.classList.remove('options-button-options-show');
      this.openOptionsMenu = null;
    }
  }

  setupPenControls() {
    Object.entries(PEN_SIZES).forEach(([key, config]) => {
      const button = this.penSizeButtons[config.id];
      if (!button) return;
      button.addEventListener('click', () => {
        this.setPenSize(key);
        this.closeOpenOptionsMenu();
      });
    });

    Object.entries(PEN_TYPES).forEach(([key, config]) => {
      const button = this.penTypeButtons[config.id];
      if (!button) return;
      button.addEventListener('click', () => {
        this.setPenType(key);
        this.closeOpenOptionsMenu();
      });
    });

    this.swatchButtons.forEach(button => {
      if (!button) {
        return;
      }
      const normalisedColour = normalizeHexColour(button.dataset?.color, DEFAULT_PEN_COLOUR);
      button.dataset.color = normalisedColour;
      button.style.setProperty('--swatch-color', normalisedColour);
      button.style.backgroundColor = normalisedColour;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        this.setPenColour(normalisedColour);
        this.closeOpenOptionsMenu();
      });
    });

    if (this.customColourInput) {
      this.customColourInput.value = normalizeHexColour(this.customColourInput.value, DEFAULT_PEN_COLOUR);
      this.customColourInput.addEventListener('input', event => {
        const { value } = event.target;
        this.setPenColour(value);
      });
    }

    if (this.loopButton) {
      this.loopButton.addEventListener('click', () => {
        this.userData.userSettings.isLoopOn = !this.userData.userSettings.isLoopOn;
        this.loopButton.classList.toggle('option-selected', this.userData.userSettings.isLoopOn);
        this.userData.saveToLocalStorage();
      });
    }
  }

  setupBackgroundControls() {
    Object.entries(BACKGROUND_ICONS).forEach(([key, config]) => {
      const button = this.backgroundButtons[config.id];
      if (!button) return;
      button.addEventListener('click', () => {
        this.setBackground(key);
        this.closeOpenOptionsMenu();
      });
    });

    Object.entries(PAGE_COLOURS).forEach(([key, config]) => {
      const button = this.pageColourButtons[config.id];
      if (!button) return;
      button.addEventListener('click', () => {
        this.setPageColour(key);
        this.closeOpenOptionsMenu();
      });
    });
  }

  setupSliders() {
    if (this.zoomSlider) {
      this.zoomSlider.addEventListener('input', () => {
        const zoomValue = clamp(Number(this.zoomSlider.value) || DEFAULT_SETTINGS.zoomLevel, 0.5, 4);
        this.setZoom(zoomValue, true);
      });
    }

    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', () => {
        const speed = clamp(Number(this.speedSlider.value) || DEFAULT_SETTINGS.rewriteSpeed, 0.1, 10);
        this.setRewriteSpeed(speed, true);
      });
    }
  }

  setupSidebarCollapses() {
    if (this.collapseLeftSidebar && this.leftSidebarOptions) {
      this.collapseLeftSidebar.addEventListener('click', () => {
        this.leftSidebarOptions.classList.toggle('collapse');
        this.collapseLeftSidebar.classList.toggle('collapse-button-collapsed');
      });
    }

    if (this.collapseRightSidebar && this.rightSidebarOptions) {
      this.collapseRightSidebar.addEventListener('click', () => {
        this.rightSidebarOptions.classList.toggle('collapse');
        this.collapseRightSidebar.classList.toggle('collapse-button-collapsed');
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

    if (this.helpButton) {
      this.helpButton.addEventListener('click', () => {
        window.open('https://handwritingrepeater.app', '_blank');
      });
    }

    if (this.contactButton && this.contactFormContainer) {
      this.contactButton.addEventListener('click', () => {
        this.contactFormContainer.style.display = 'flex';
      });
    }
  }

  setupContactForm() {
    if (!this.contactForm || !this.contactFormClose || !this.contactFormContainer) {
      return;
    }

    this.contactFormClose.addEventListener('click', event => {
      event.preventDefault();
      this.contactFormContainer.style.display = 'none';
    });

    this.contactForm.addEventListener('submit', async event => {
      event.preventDefault();
      const formData = new FormData(this.contactForm);
      const json = JSON.stringify(Object.fromEntries(formData.entries()));
      if (this.contactResult) {
        this.contactResult.textContent = 'Please wait...';
      }

      try {
        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: json
        });

        const result = await response.json();
        if (this.contactResult) {
          this.contactResult.textContent = result.message ?? 'Message sent!';
        }
        if (response.ok) {
          this.contactForm.reset();
        }
      } catch (error) {
        if (this.contactResult) {
          this.contactResult.textContent = 'Something went wrong!';
        }
        console.error('Contact form submission failed', error);
      }
    });
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
    if (!this.dateText) {
      return;
    }

    const updateDate = () => {
      this.dateText.textContent = formatDateWithOrdinal(new Date());
    };

    updateDate();
    if (this.dateButton) {
      this.dateButton.addEventListener('click', updateDate);
    }
  }

  applyInitialState() {
    this.setPenSize(this.resolvePenSizeKey(this.userData.userSettings.selectedPenWidth), false);
    this.setPenColour(this.userData.userSettings.selectedPenColour ?? DEFAULT_PEN_COLOUR, false);
    this.setPenType(this.userData.userSettings.penType ?? DEFAULT_SETTINGS.penType, false);
    this.setBackground(this.userData.userSettings.selectedBackground ?? DEFAULT_SETTINGS.selectedBackground, false);
    this.setPageColour(this.resolvePageColourKey(this.userData.userSettings.selectedPageColour), false);
    this.setZoom(this.userData.userSettings.zoomLevel ?? DEFAULT_SETTINGS.zoomLevel, false);
    this.setRewriteSpeed(this.userData.userSettings.rewriteSpeed ?? DEFAULT_SETTINGS.rewriteSpeed, false);

    if (this.loopButton) {
      this.loopButton.classList.toggle('option-selected', !!this.userData.userSettings.isLoopOn);
    }

    if (this.traceButton) {
      this.traceButton.classList.toggle('option-selected', !!this.userData.userSettings.isTraceOn);
    }
  }

  setPenSize(key, persist = true) {
    const config = PEN_SIZES[key] ?? PEN_SIZES.medium;
    this.userData.userSettings.selectedPenWidth = config.width;
    updateSelectedClass(this.penSizeButtons, config.id);
    this.updateButtonIcon(this.penSizeButton, config.icon);
    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  resolvePenSizeKey(width) {
    const entry = Object.entries(PEN_SIZES).find(([, cfg]) => cfg.width === width);
    return entry ? entry[0] : 'medium';
  }

  setPenType(key, persist = true) {
    const config = PEN_TYPES[key] ?? PEN_TYPES.marker;
    this.userData.userSettings.penType = key;
    this.userData.userSettings.selectedPenImage = config.imageKey;
    updateSelectedClass(this.penTypeButtons, config.id);
    this.updateButtonIcon(this.penTypeButton, config.icon);
    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setPenColour(colour, persist = true) {
    const normalisedColour = normalizeHexColour(colour, DEFAULT_PEN_COLOUR);
    this.userData.userSettings.selectedPenColour = normalisedColour;
    this.updatePaletteSelection(normalisedColour);
    this.updatePenColourPreview(normalisedColour);
    this.updateCustomColourPicker(normalisedColour);
    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  updatePaletteSelection(colour) {
    if (!Array.isArray(this.swatchButtons) || this.swatchButtons.length === 0) {
      return;
    }

    const matchingButton = this.swatchButtons.find(button => {
      const swatchColour = parseHexColour(button.dataset?.color);
      return swatchColour !== null && swatchColour === colour;
    });

    this.swatchButtons.forEach(button => {
      const isSelected = button === matchingButton;
      button.classList.toggle('swatch-selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
  }

  updatePenColourPreview(colour) {
    if (this.penColourButton) {
      this.penColourButton.style.setProperty('--selected-pen-colour', colour);
    }
  }

  updateCustomColourPicker(colour) {
    if (!this.customColourInput) {
      return;
    }

    const currentColour = parseHexColour(this.customColourInput.value);
    if (currentColour === colour) {
      return;
    }

    this.customColourInput.value = colour;
  }

  setBackground(key, persist = true) {
    const config = BACKGROUND_ICONS[key] ?? BACKGROUND_ICONS['blue-dotted'];
    this.userData.userSettings.selectedBackground = key;
    updateSelectedClass(this.backgroundButtons, config.id);
    this.updateButtonIcon(this.backgroundButton, config.icon);

    const drawer = BACKGROUND_DRAWERS[key] ?? clearBackground;
    drawer(this.linesContext, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setPageColour(key, persist = true) {
    const config = PAGE_COLOURS[key] ?? PAGE_COLOURS.white;
    this.userData.userSettings.selectedPageColour = config.colour;
    updateSelectedClass(this.pageColourButtons, config.id);
    this.updateButtonIcon(this.pageColourButton, config.icon);

    if (this.pageContext) {
      this.pageContext.save();
      this.pageContext.fillStyle = config.colour;
      this.pageContext.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.pageContext.restore();
    }

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  resolvePageColourKey(colour) {
    const entry = Object.entries(PAGE_COLOURS).find(([, cfg]) => cfg.colour.toLowerCase() === (colour ?? '').toLowerCase());
    return entry ? entry[0] : 'white';
  }

  setZoom(value, persist = true) {
    const zoom = clamp(Number(value) || DEFAULT_SETTINGS.zoomLevel, 0.5, 4);
    this.userData.userSettings.zoomLevel = zoom;
    if (this.writerContainer) {
      this.writerContainer.style.transform = `scale(${zoom})`;
      this.writerContainer.style.transformOrigin = 'top center';
    }
    if (this.zoomSlider && this.zoomSlider.value !== String(zoom)) {
      this.zoomSlider.value = String(zoom);
    }
    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setRewriteSpeed(value, persist = true) {
    const speed = clamp(Number(value) || DEFAULT_SETTINGS.rewriteSpeed, 0.1, 10);
    this.userData.userSettings.rewriteSpeed = speed;
    if (this.speedSlider && this.speedSlider.value !== String(speed)) {
      this.speedSlider.value = String(speed);
    }
    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  updateButtonIcon(button, iconFileName) {
    if (!button) {
      return;
    }

    const image = button.querySelector('img');
    if (image) {
      image.src = getIconUrl(iconFileName);
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
      let c = cookie.trim();
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
}

function mapButtons(config) {
  const map = {};
  Object.values(config).forEach(({ id }) => {
    const element = document.getElementById(id);
    if (element) {
      map[id] = element;
    }
  });
  return map;
}

function updateSelectedClass(buttonMap, selectedId) {
  Object.entries(buttonMap).forEach(([id, element]) => {
    element.classList.toggle('option-selected', id === selectedId);
  });
}

function parseHexColour(colour) {
  if (typeof colour !== 'string') {
    return null;
  }

  const trimmed = colour.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return null;
}

function normalizeHexColour(colour, fallback = '#000000') {
  const parsed = parseHexColour(colour);
  if (parsed) {
    return parsed;
  }

  const fallbackParsed = parseHexColour(fallback);
  return fallbackParsed ?? '#000000';
}
