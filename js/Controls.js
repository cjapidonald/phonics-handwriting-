import { DEFAULT_SETTINGS } from './UserData.js';
import { formatDateWithOrdinal, getIconUrl, clamp } from './utils.js';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;

const PEN_SIZE_MIN = 1;
const PEN_SIZE_MAX = 40;
const SMALL_ICON = 'penSmallIcon.svg';
const MEDIUM_ICON = 'penMediumIcon.svg';
const LARGE_ICON = 'penLargeIcon.svg';

const PEN_COLOURS = {
  black: { id: 'blackPenColourButton', colour: '#000000', icon: 'blackPenColourIcon.svg' },
  red: { id: 'redPenColourButton', colour: '#d8342c', icon: 'redPenColourIcon.svg' },
  green: { id: 'greenPenColourButton', colour: '#0f7a3d', icon: 'greenPenColourIcon.svg' },
  blue: { id: 'bluePenColourButton', colour: '#1e4dd8', icon: 'bluePenColourIcon.svg' },
  yellow: { id: 'yellowPenColourButton', colour: '#f5c400', icon: 'yellowPenColourIcon.svg' },
  purple: { id: 'purplePenColourButton', colour: '#7f3f98', icon: 'purplePenColourIcon.svg' },
  orange: { id: 'orangePenColourButton', colour: '#f17f1a', icon: 'orangePenColourIcon.svg' },
  darkGreen: { id: 'darkGreenPenColourButton', colour: '#1b5035', icon: 'darkGreenPenColourIcon.svg' },
  pink: { id: 'pinkPenColourButton', colour: '#e969ad', icon: 'pinkPenColourIcon.svg' },
  brown: { id: 'brownPenColourButton', colour: '#5b3a1d', icon: 'brownPenColourIcon.svg' },
  grey: { id: 'greyPenColourButton', colour: '#5e5e5e', icon: 'greyPenColourIcon.svg' }
};

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

    this.rewriteButton = document.getElementById('rewriteButton');
    this.undoButton = document.getElementById('undoButton');
    this.redoButton = document.getElementById('redoButton');
    this.resetButton = document.getElementById('resetButton');

    this.penSizeButton = document.getElementById('penSizeButton');
    this.penSizeOptions = document.getElementById('penSizeButtonOptions');
    this.penColourButton = document.getElementById('penColourButton');
    this.penColourOptions = document.getElementById('penColourButtonOptions');
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

    this.penColourButtons = mapButtons(PEN_COLOURS);
    this.backgroundButtons = mapButtons(BACKGROUND_ICONS);
    this.pageColourButtons = mapButtons(PAGE_COLOURS);

    this.initialiseCanvases();
    this.setupOptionToggles();
    this.loadPenPreferences();
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
    this.initialisePenSizeSlider();

    Object.entries(PEN_COLOURS).forEach(([key, config]) => {
      const button = this.penColourButtons[config.id];
      if (!button) return;
      button.addEventListener('click', () => {
        this.setPenColour(key);
        this.closeOpenOptionsMenu();
      });
    });
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
    this.setPenSize(this.userData.userSettings.selectedPenWidth ?? DEFAULT_SETTINGS.selectedPenWidth, false);
    this.setPenColour(this.resolvePenColourKey(this.userData.userSettings.selectedPenColour), false);
    this.setBackground(this.userData.userSettings.selectedBackground ?? DEFAULT_SETTINGS.selectedBackground, false);
    this.setPageColour(this.resolvePageColourKey(this.userData.userSettings.selectedPageColour), false);
    this.setZoom(this.userData.userSettings.zoomLevel ?? DEFAULT_SETTINGS.zoomLevel, false);
    this.setRewriteSpeed(this.userData.userSettings.rewriteSpeed ?? DEFAULT_SETTINGS.rewriteSpeed, false);
  }

  setPenSize(value, persist = true) {
    const size = clamp(Number(value) || DEFAULT_SETTINGS.selectedPenWidth, PEN_SIZE_MIN, PEN_SIZE_MAX);
    this.userData.userSettings.selectedPenWidth = size;
    this.updatePenSizeSliderDisplay(size);
    this.updateButtonIcon(this.penSizeButton, this.resolvePenSizeIcon(size));

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('pen.size', String(size));
    }

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  setPenColour(key, persist = true) {
    const config = PEN_COLOURS[key] ?? PEN_COLOURS.black;
    this.userData.userSettings.selectedPenColour = config.colour;
    updateSelectedClass(this.penColourButtons, config.id);
    this.updateButtonIcon(this.penColourButton, config.icon);

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('pen.color', config.colour);
    }

    if (persist) {
      this.userData.saveToLocalStorage();
    }
  }

  resolvePenColourKey(colour) {
    const entry = Object.entries(PEN_COLOURS).find(([, cfg]) => cfg.colour.toLowerCase() === (colour ?? '').toLowerCase());
    return entry ? entry[0] : 'black';
  }

  initialisePenSizeSlider() {
    if (!this.penSizeOptions) {
      return;
    }

    this.penSizeOptions.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'pen-size-slider-container';

    const label = document.createElement('div');
    label.className = 'pen-size-label';
    label.textContent = 'Pen Size';

    const valueDisplay = document.createElement('div');
    valueDisplay.className = 'pen-size-value';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(PEN_SIZE_MIN);
    slider.max = String(PEN_SIZE_MAX);
    slider.step = '1';
    slider.value = String(this.userData.userSettings.selectedPenWidth ?? DEFAULT_SETTINGS.selectedPenWidth);
    slider.id = 'penSizeSliderInput';
    slider.className = 'pen-size-slider';

    container.appendChild(label);
    container.appendChild(valueDisplay);
    container.appendChild(slider);

    this.penSizeOptions.appendChild(container);

    this.penSizeValue = valueDisplay;
    this.penSizeSlider = slider;

    this.updatePenSizeSliderDisplay(Number(slider.value));

    slider.addEventListener('input', () => {
      const size = Number(slider.value) || DEFAULT_SETTINGS.selectedPenWidth;
      this.setPenSize(size);
    });
  }

  updatePenSizeSliderDisplay(size) {
    if (this.penSizeSlider && this.penSizeSlider.value !== String(size)) {
      this.penSizeSlider.value = String(size);
    }

    if (this.penSizeValue) {
      this.penSizeValue.textContent = `${Math.round(size)} px`;
    }
  }

  resolvePenSizeIcon(size) {
    if (size <= 4) {
      return SMALL_ICON;
    }

    if (size >= 12) {
      return LARGE_ICON;
    }

    return MEDIUM_ICON;
  }

  loadPenPreferences() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const storedSize = Number(window.localStorage.getItem('pen.size'));
    if (Number.isFinite(storedSize)) {
      this.userData.userSettings.selectedPenWidth = clamp(storedSize, PEN_SIZE_MIN, PEN_SIZE_MAX);
    }

    const storedColour = window.localStorage.getItem('pen.color');
    if (typeof storedColour === 'string' && storedColour) {
      const key = this.resolvePenColourKey(storedColour);
      const config = PEN_COLOURS[key];
      this.userData.userSettings.selectedPenColour = config?.colour ?? storedColour;
    }
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
