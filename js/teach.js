const DESCENDER_CHARACTERS = new Set(['g', 'j', 'p', 'q', 'y']);
const PUNCTUATION_REGEX = /^[!?;:,]$/;
const LETTER_COLLATOR =
  typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
    ? new Intl.Collator(undefined, { sensitivity: 'base' })
    : null;

export class TeachController {
  constructor({
    overlay,
    textInput,
    teachButton,
    nextButton,
    previousButton,
    previewContainer,
    previewToggleButton,
    hideLettersButton,
    hideLettersModal,
    hideLettersBackdrop,
    hideLettersList,
    hideLettersCloseButton,
    hideLettersResetButton,
    hideLettersDoneButton,
    enableDefaultNextHandler = true
  }) {
    this.overlay = overlay ?? null;
    this.textInput = textInput ?? null;
    this.teachButton = teachButton ?? null;
    this.nextButton = nextButton ?? null;
    this.previousButton = previousButton ?? null;
    this.previewContainer = previewContainer ?? null;
    this.previewToggleButton = previewToggleButton ?? null;
    this.hideLettersButton = hideLettersButton ?? null;
    this.hideLettersLabelElement = this.hideLettersButton?.querySelector('[data-button-label]') ?? null;
    this.hideLettersModal = hideLettersModal ?? null;
    this.hideLettersBackdrop = hideLettersBackdrop ?? null;
    this.hideLettersList = hideLettersList ?? null;
    this.hideLettersCloseButton = hideLettersCloseButton ?? null;
    this.hideLettersResetButton = hideLettersResetButton ?? null;
    this.hideLettersDoneButton = hideLettersDoneButton ?? null;
    this.enableDefaultNextHandler = enableDefaultNextHandler;

    this.overlayContent = null;
    this.lines = [];
    this.letters = [];
    this.manualFrozenIndices = new Set();
    this.revealedByNext = new Set();
    this.nextPointer = 0;
    this.isPreviewHidden = false;
    this.isHideMode = false;
    const initialLabelSource =
      this.hideLettersLabelElement?.textContent ??
      this.hideLettersButton?.getAttribute('aria-label') ??
      'Show letters';
    this.hideLettersButtonInitialLabel = initialLabelSource.trim();
    this.setHideLettersButtonText(this.hideLettersButtonInitialLabel);
    this.currentRawText = '';
    this.revealHistory = [];
    this.hiddenLetterFilter = new Set();
    this.isHideLettersModalOpen = false;
    this.hideLettersModalHideTimer = null;

    this.handleTeach = this.handleTeach.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handlePrevious = this.handlePrevious.bind(this);
    this.handlePreviewClick = this.handlePreviewClick.bind(this);
    this.handleTogglePreview = this.handleTogglePreview.bind(this);
    this.handleHideLetters = this.handleHideLetters.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleOverlayKeydown = this.handleOverlayKeydown.bind(this);
    this.handleHideLettersListClick = this.handleHideLettersListClick.bind(this);
    this.handleHideLettersListKeydown = this.handleHideLettersListKeydown.bind(this);

    this.teachButton?.addEventListener('click', this.handleTeach);
    if (this.nextButton && this.enableDefaultNextHandler) {
      this.nextButton.addEventListener('click', this.handleNext);
    }
    if (this.previousButton && this.enableDefaultNextHandler) {
      this.previousButton.addEventListener('click', this.handlePrevious);
    }
    this.previewContainer?.addEventListener('click', this.handlePreviewClick);
    this.previewToggleButton?.addEventListener('click', this.handleTogglePreview);
    this.hideLettersButton?.addEventListener('click', this.handleHideLetters);
    this.hideLettersList?.addEventListener('click', this.handleHideLettersListClick);
    this.hideLettersList?.addEventListener('keydown', this.handleHideLettersListKeydown);
    this.hideLettersCloseButton?.addEventListener('click', () => {
      this.closeHideLettersModal({ restoreFocus: true });
    });
    this.hideLettersDoneButton?.addEventListener('click', () => {
      this.closeHideLettersModal({ restoreFocus: true });
    });
    this.hideLettersResetButton?.addEventListener('click', () => {
      this.applyHiddenLetterFilter('');
      this.updateHideLettersModalButtons();
    });
    this.hideLettersBackdrop?.addEventListener('click', () => {
      this.closeHideLettersModal({ restoreFocus: true });
    });
    this.textInput?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.handleTeach();
      }
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', event => {
        if (!this.isHideLettersModalOpen) {
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          this.closeHideLettersModal({ restoreFocus: true });
        }
      });
    }

    this.overlay?.addEventListener('click', this.handleOverlayClick);
    this.overlay?.addEventListener('keydown', this.handleOverlayKeydown, true);

    if (this.overlay && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.fitOverlay());
      this.resizeObserver.observe(this.overlay);
    }

    window.addEventListener('resize', () => this.fitOverlay());

    this.setOverlayHidden(true);
    this.updateButtonStates();
    this.updatePreviewVisibility();
  }

  setHideLettersButtonText(label) {
    if (!this.hideLettersButton) {
      return;
    }

    const text = typeof label === 'string' ? label : '';

    if (this.hideLettersLabelElement) {
      this.hideLettersLabelElement.textContent = text;
    } else {
      this.hideLettersButton.textContent = text;
    }

    this.hideLettersButton.setAttribute('aria-label', text);
    this.hideLettersButton.title = text;
  }

  updateHideLettersButtonLabel() {
    if (!this.hideLettersButton) {
      return;
    }

    const hasLetters = this.hasPreviewLetters();
    if (!hasLetters) {
      const fallbackLabel = this.hideLettersButtonInitialLabel || 'Show letters';
      this.setHideLettersButtonText(fallbackLabel);
      return;
    }

    const hasHiddenLetters = this.hiddenLetterFilter.size > 0;
    const label = hasHiddenLetters ? 'Show letters' : 'Hide letters';
    this.setHideLettersButtonText(label);
  }

  handleTeach() {
    const text = this.textInput?.value ?? '';
    this.applyText(text);

    if (this.textInput) {
      this.textInput.value = '';
    }
  }

  handleNext() {
    this.revealNextLetter();
  }

  handlePrevious() {
    this.revealPreviousLetter();
  }

  handlePreviewClick(event) {
    const target = event.target.closest('[data-letter-index]');
    if (!target) {
      return;
    }

    const index = Number.parseInt(target.dataset.letterIndex ?? '', 10);
    if (Number.isNaN(index)) {
      return;
    }

    const letter = this.letters[index];
    if (!letter || !letter.isRevealable) {
      return;
    }

    this.toggleLetterFreeze(letter);
  }

  handleTogglePreview() {
    this.isPreviewHidden = !this.isPreviewHidden;
    this.updatePreviewVisibility();
  }

  handleHideLetters() {
    if (!this.hasPreviewLetters()) {
      return;
    }

    this.openHideLettersModal();
  }

  openHideLettersModal() {
    if (!this.hideLettersModal) {
      return;
    }

    this.populateHideLettersModal();
    this.updateHideLettersModalButtons();

    window.clearTimeout(this.hideLettersModalHideTimer);
    this.hideLettersModalHideTimer = null;

    if (this.hideLettersBackdrop) {
      this.hideLettersBackdrop.hidden = false;
      window.requestAnimationFrame(() => {
        this.hideLettersBackdrop?.classList.add('is-visible');
      });
    }

    this.hideLettersModal.hidden = false;
    this.hideLettersModal.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(() => {
      this.hideLettersModal?.classList.add('is-open');
    });

    this.isHideLettersModalOpen = true;

    const initialLetterButton = this.hideLettersList?.querySelector('.hide-letters__letter[data-letter]');
    const canFocusReset = this.hideLettersResetButton && !this.hideLettersResetButton.disabled;
    const focusTarget =
      initialLetterButton ??
      (canFocusReset ? this.hideLettersResetButton : null) ??
      this.hideLettersDoneButton ??
      this.hideLettersCloseButton ??
      this.hideLettersButton;

    if (focusTarget?.focus) {
      window.setTimeout(() => {
        focusTarget.focus({ preventScroll: true });
      }, 50);
    }
  }

  closeHideLettersModal({ restoreFocus = false } = {}) {
    if (!this.hideLettersModal) {
      if (restoreFocus) {
        this.hideLettersButton?.focus?.({ preventScroll: true });
      }
      return;
    }

    if (!this.isHideLettersModalOpen && this.hideLettersModal.hidden) {
      if (restoreFocus) {
        this.hideLettersButton?.focus?.({ preventScroll: true });
      }
      return;
    }

    this.isHideLettersModalOpen = false;
    this.hideLettersModal.classList.remove('is-open');
    this.hideLettersModal.setAttribute('aria-hidden', 'true');
    this.hideLettersBackdrop?.classList.remove('is-visible');

    window.clearTimeout(this.hideLettersModalHideTimer);
    this.hideLettersModalHideTimer = window.setTimeout(() => {
      if (this.hideLettersModal) {
        this.hideLettersModal.hidden = true;
      }
      if (this.hideLettersBackdrop) {
        this.hideLettersBackdrop.hidden = true;
      }
      if (restoreFocus) {
        this.hideLettersButton?.focus?.({ preventScroll: true });
      }
      this.hideLettersModalHideTimer = null;
    }, 220);
  }

  getHideLettersCandidates() {
    const uniqueLetters = new Map();
    this.letters.forEach(letter => {
      if (!letter || !letter.isRevealable) {
        return;
      }
      const rawChar = typeof letter.char === 'string' ? letter.char : '';
      if (!rawChar.trim()) {
        return;
      }
      const key = rawChar.toLowerCase();
      if (!key) {
        return;
      }
      if (!uniqueLetters.has(key)) {
        uniqueLetters.set(key, rawChar);
      }
    });

    const keys = Array.from(uniqueLetters.keys());
    if (LETTER_COLLATOR) {
      keys.sort((a, b) => LETTER_COLLATOR.compare(a, b));
    } else {
      keys.sort((a, b) => a.localeCompare(b));
    }

    return keys.map(key => {
      const displaySource = uniqueLetters.get(key) ?? key;
      return {
        key,
        display: displaySource.toUpperCase()
      };
    });
  }

  populateHideLettersModal() {
    if (!this.hideLettersList) {
      return;
    }

    this.hideLettersList.innerHTML = '';
    const candidates = this.getHideLettersCandidates();

    if (!candidates.length) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'hide-letters__empty';
      emptyMessage.textContent = 'Add practice text to choose letters to hide.';
      this.hideLettersList.appendChild(emptyMessage);
      if (this.hideLettersResetButton) {
        this.hideLettersResetButton.disabled = true;
        this.hideLettersResetButton.setAttribute('aria-disabled', 'true');
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    candidates.forEach(({ key, display }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hide-letters__letter';
      button.dataset.letter = key;
      button.dataset.display = display;
      button.textContent = display;
      fragment.appendChild(button);
    });

    this.hideLettersList.appendChild(fragment);
  }

  updateHideLettersModalButtons() {
    if (!this.hideLettersList) {
      return;
    }

    const hasHiddenLetters = this.hiddenLetterFilter.size > 0;
    if (this.hideLettersResetButton) {
      this.hideLettersResetButton.disabled = !hasHiddenLetters;
      if (hasHiddenLetters) {
        this.hideLettersResetButton.removeAttribute('aria-disabled');
      } else {
        this.hideLettersResetButton.setAttribute('aria-disabled', 'true');
      }
    }

    const buttons = Array.from(
      this.hideLettersList.querySelectorAll('.hide-letters__letter[data-letter]')
    );

    buttons.forEach(button => {
      const letterKey = button.dataset.letter ?? '';
      const display = button.dataset.display ?? letterKey.toUpperCase();
      const isHidden = this.hiddenLetterFilter.has(letterKey);
      button.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
      button.classList.toggle('is-active', isHidden);
      const action = isHidden ? 'Show' : 'Hide';
      const labelText = `${action} letter ${display}`;
      button.setAttribute('aria-label', labelText);
      button.title = labelText;
    });
  }

  handleHideLettersListClick(event) {
    const target = event.target?.closest?.('.hide-letters__letter[data-letter]');
    if (!target) {
      return;
    }

    const letterKey = target.dataset.letter ?? '';
    if (!letterKey) {
      return;
    }

    event.preventDefault();
    this.toggleHiddenLetter(letterKey);
  }

  handleHideLettersListKeydown(event) {
    const target = event.target?.closest?.('.hide-letters__letter[data-letter]');
    if (!target) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const letterKey = target.dataset.letter ?? '';
      if (letterKey) {
        this.toggleHiddenLetter(letterKey);
      }
    }
  }

  toggleHiddenLetter(letterKey) {
    if (typeof letterKey !== 'string' || !letterKey) {
      return;
    }

    const normalizedKey = letterKey.toLowerCase();
    const nextFilter = new Set(this.hiddenLetterFilter);
    if (nextFilter.has(normalizedKey)) {
      nextFilter.delete(normalizedKey);
    } else {
      nextFilter.add(normalizedKey);
    }

    this.applyHiddenLetterFilter(nextFilter);
    this.updateHideLettersModalButtons();
  }

  applyHiddenLetterFilter(rawValue) {
    let characters = [];

    if (rawValue instanceof Set) {
      characters = Array.from(rawValue);
    } else if (Array.isArray(rawValue)) {
      characters = rawValue;
    } else if (typeof rawValue === 'string') {
      characters = rawValue.replace(/\s+/g, '').split('');
    }

    const normalized = characters
      .map(char => (typeof char === 'string' ? char.trim().toLowerCase() : ''))
      .filter(char => char.length > 0);

    const uniqueCharacters = Array.from(new Set(normalized));
    this.hiddenLetterFilter = new Set(uniqueCharacters);
    this.revealedByNext.clear();
    this.manualFrozenIndices.clear();
    this.revealHistory = [];
    this.nextPointer = 0;

    const hasFilter = this.hiddenLetterFilter.size > 0;

    this.letters.forEach(letter => {
      if (!letter || !letter.isRevealable) {
        return;
      }

      const letterChar = letter.char?.toLowerCase?.() ?? '';
      const shouldHide = hasFilter && this.hiddenLetterFilter.has(letterChar);
      if (!shouldHide) {
        this.manualFrozenIndices.add(letter.index);
      }
    });

    this.updateAllLetterStates();
    this.updateButtonStates();
    this.setHideMode(false);
  }

  handleOverlayClick(event) {
    if (!this.isHideMode) {
      return;
    }
    const target = event.target.closest('[data-letter-index]');
    if (!target) {
      return;
    }
    const index = Number.parseInt(target.dataset.letterIndex ?? '', 10);
    if (Number.isNaN(index)) {
      return;
    }
    const letter = this.letters[index];
    if (!letter || !letter.isRevealable) {
      return;
    }
    this.toggleLetterFreeze(letter);
  }

  handleOverlayKeydown(event) {
    if (!this.isHideMode) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const target = event.target.closest('[data-letter-index]');
    if (!target) {
      return;
    }
    const index = Number.parseInt(target.dataset.letterIndex ?? '', 10);
    if (Number.isNaN(index)) {
      return;
    }
    const letter = this.letters[index];
    if (!letter || !letter.isRevealable) {
      return;
    }
    event.preventDefault();
    this.toggleLetterFreeze(letter);
  }

  toggleLetterFreeze(letter) {
    if (!letter || !letter.isRevealable) {
      return;
    }

    if (this.manualFrozenIndices.has(letter.index)) {
      this.manualFrozenIndices.delete(letter.index);
    } else {
      this.manualFrozenIndices.add(letter.index);
    }

    this.updateLetterState(letter);
    this.updateButtonStates();
  }

  setHideMode(enabled) {
    const hasLetters = this.hasPreviewLetters();
    const nextState = Boolean(enabled) && hasLetters;
    if (this.isHideMode === nextState) {
      if (!nextState && this.hideLettersButton) {
        this.updateHideLettersButtonLabel();
        this.hideLettersButton.setAttribute('aria-pressed', 'false');
        this.hideLettersButton.classList.remove('is-active');
      }
      if (!nextState && this.overlay) {
        this.overlay.classList.remove('is-hide-mode');
      }
      return;
    }

    this.isHideMode = nextState;

    if (this.overlay) {
      this.overlay.classList.toggle('is-hide-mode', this.isHideMode);
    }

    if (this.hideLettersButton) {
      if (this.isHideMode) {
        this.setHideLettersButtonText('Done hiding');
      } else {
        this.updateHideLettersButtonLabel();
      }
      this.hideLettersButton.setAttribute('aria-pressed', this.isHideMode ? 'true' : 'false');
      this.hideLettersButton.classList.toggle('is-active', this.isHideMode);
    }

    this.letters.forEach(letter => {
      if (!letter || !letter.element) {
        return;
      }
      if (letter.isRevealable) {
        letter.element.setAttribute('tabindex', this.isHideMode ? '0' : '-1');
        letter.element.setAttribute('aria-pressed', this.manualFrozenIndices.has(letter.index) ? 'true' : 'false');
      } else {
        letter.element.removeAttribute('tabindex');
      }
    });
  }

  getCurrentText() {
    return this.currentRawText;
  }

  applyText(rawText) {
    const text = typeof rawText === 'string' ? rawText : '';
    this.currentRawText = text;
    this.lines = [];
    this.letters = [];
    this.manualFrozenIndices.clear();
    this.revealedByNext.clear();
    this.nextPointer = 0;
    this.revealHistory = [];
    this.hiddenLetterFilter.clear();
    this.setHideMode(false);
    this.closeHideLettersModal({ restoreFocus: false });

    if (!text.trim()) {
      this.clearOverlay();
      this.updateButtonStates();
      return;
    }

    const normalised = text.replace(/\r\n/g, '\n');
    const rawLines = normalised.split('\n');
    let index = 0;

    rawLines.forEach(line => {
      const characters = Array.from(line);
      const lineLetters = characters.map(char => {
        const letter = this.createLetterData(char, index);
        this.letters.push(letter);
        index += 1;
        return letter;
      });
      this.lines.push(lineLetters);
    });

    this.renderOverlay();
    this.updateAllLetterStates();
    this.updateButtonStates();
    this.updatePreviewVisibility();

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.fitOverlay());
    } else {
      this.fitOverlay();
    }
  }

  createLetterData(char, index) {
    const classification = this.classifyCharacter(char);
    return {
      index,
      char,
      classification,
      isSpace: classification === 'space',
      isRevealable: classification !== 'space',
      element: null,
      placeholderElement: null,
      charElement: null,
      previewElement: null
    };
  }

  classifyCharacter(char) {
    if (!char) {
      return 'other';
    }

    if (/\s/.test(char)) {
      return 'space';
    }

    if (char === '.') {
      return 'period';
    }

    if (/^[0-9]$/.test(char)) {
      return 'number';
    }

    if (/^[A-Z]$/.test(char)) {
      return 'uppercase';
    }

    if (/^[a-z]$/.test(char)) {
      return DESCENDER_CHARACTERS.has(char) ? 'descender' : 'lowercase';
    }

    if (PUNCTUATION_REGEX.test(char)) {
      return 'punctuation';
    }

    return 'other';
  }

  renderOverlay() {
    if (!this.overlay) {
      return;
    }

    this.overlay.innerHTML = '';

    if (!this.letters.length) {
      this.overlayContent = null;
      this.setOverlayHidden(true);
      if (this.previewContainer) {
        this.previewContainer.innerHTML = '';
      }
      return;
    }

    this.overlayContent = document.createElement('div');
    this.overlayContent.className = 'teach-content';
    this.overlay.appendChild(this.overlayContent);
    this.setOverlayHidden(false);

    if (this.previewContainer) {
      this.previewContainer.innerHTML = '';
    }

    const previewLetters = [];

    this.lines.forEach(line => {
      const lineElement = document.createElement('div');
      lineElement.className = 'teach-line';
      this.overlayContent.appendChild(lineElement);

      line.forEach(letter => {
        const letterElement = document.createElement('div');
        const className = ['teach-letter', this.getLetterClass(letter.classification)];
        if (letter.isSpace) {
          className.push('teach-letter--space');
        }
        letterElement.className = className.filter(Boolean).join(' ');

        const placeholder = document.createElement('span');
        placeholder.className = 'teach-placeholder';
        placeholder.textContent = letter.isSpace ? '\u00a0' : '_';

        const charElement = document.createElement('span');
        charElement.className = 'teach-char';
        charElement.textContent = letter.char;

        letterElement.appendChild(placeholder);
        letterElement.appendChild(charElement);
        lineElement.appendChild(letterElement);

        letterElement.dataset.letterIndex = String(letter.index);
        if (letter.isRevealable) {
          letterElement.setAttribute('role', 'button');
          letterElement.setAttribute('tabindex', this.isHideMode ? '0' : '-1');
          letterElement.setAttribute('aria-pressed', this.manualFrozenIndices.has(letter.index) ? 'true' : 'false');
        } else {
          letterElement.removeAttribute('role');
          letterElement.removeAttribute('tabindex');
          letterElement.removeAttribute('aria-pressed');
        }

        letter.element = letterElement;
        letter.placeholderElement = placeholder;
        letter.charElement = charElement;

        if (letter.isRevealable) {
          previewLetters.push(letter);
        }
      });
    });

    if (this.previewContainer && previewLetters.length) {
      const fragment = document.createDocumentFragment();
      const sortedLetters = this.sortPreviewLetters(previewLetters);
      sortedLetters.forEach(letter => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'teach-preview__letter';
        button.dataset.letterIndex = String(letter.index);
        button.textContent = letter.char;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', `Freeze letter ${letter.char}`);
        button.setAttribute('title', 'Click to freeze or unfreeze this letter');
        const previewClass = this.getLetterClass(letter.classification);
        if (previewClass) {
          button.classList.add(previewClass);
        }
        fragment.appendChild(button);
        letter.previewElement = button;
      });
      this.previewContainer.appendChild(fragment);
    }
  }

  clearOverlay() {
    if (this.overlay) {
      this.overlay.innerHTML = '';
      this.setOverlayHidden(true);
    }
    if (this.previewContainer) {
      this.previewContainer.innerHTML = '';
    }
    this.overlayContent = null;
    this.lines = [];
    this.letters = [];
    this.manualFrozenIndices.clear();
    this.revealedByNext.clear();
    this.nextPointer = 0;
    this.currentRawText = '';
    this.revealHistory = [];
    this.hiddenLetterFilter.clear();
    this.setHideMode(false);
    this.updatePreviewVisibility();
  }

  revealNextLetter() {
    if (!this.letters.length) {
      return;
    }

    const total = this.letters.length;
    for (let offset = 0; offset < total; offset += 1) {
      const index = (this.nextPointer + offset) % total;
      const letter = this.letters[index];
      if (!letter || !letter.isRevealable) {
        continue;
      }
      if (this.isLetterRevealed(letter)) {
        continue;
      }
      this.revealedByNext.add(letter.index);
      this.revealHistory.push(letter.index);
      this.nextPointer = index + 1;
      this.updateLetterState(letter);
      this.updateButtonStates();
      return;
    }

    this.updateButtonStates();
  }

  revealPreviousLetter() {
    if (!this.letters.length) {
      this.updateButtonStates();
      return;
    }

    while (this.revealHistory.length > 0) {
      const lastIndex = this.revealHistory.pop();
      if (typeof lastIndex !== 'number') {
        continue;
      }
      const letter = this.letters[lastIndex];
      if (!letter || !letter.isRevealable) {
        continue;
      }
      if (!this.revealedByNext.has(lastIndex)) {
        continue;
      }

      this.revealedByNext.delete(lastIndex);
      this.updateLetterState(letter);
      this.nextPointer = lastIndex;
      this.updateButtonStates();
      return;
    }

    this.updateButtonStates();
  }

  isLetterFrozen(letterIndex) {
    return this.manualFrozenIndices.has(letterIndex);
  }

  isLetterRevealed(letter) {
    if (!letter) {
      return false;
    }
    if (letter.isSpace) {
      return true;
    }
    if (this.isLetterFrozen(letter.index)) {
      return true;
    }
    return this.revealedByNext.has(letter.index);
  }

  updateAllLetterStates() {
    this.letters.forEach(letter => this.updateLetterState(letter));
  }

  updateLetterState(letter) {
    if (!letter) {
      return;
    }

    const isFrozen = this.isLetterFrozen(letter.index);
    const isRevealed = this.isLetterRevealed(letter);

    if (letter.element) {
      letter.element.classList.toggle('is-revealed', isRevealed);
      if (letter.isRevealable) {
        letter.element.setAttribute('aria-pressed', isFrozen ? 'true' : 'false');
      }
    }

    if (letter.previewElement) {
      letter.previewElement.classList.toggle('is-revealed', isRevealed);
      letter.previewElement.classList.toggle('is-frozen', isFrozen);
      letter.previewElement.setAttribute('aria-pressed', isFrozen ? 'true' : 'false');
    }
  }

  hasPreviewLetters() {
    return this.letters.some(letter => letter?.isRevealable);
  }

  sortPreviewLetters(letters) {
    const sorted = [...letters];
    sorted.sort((a, b) => {
      if (LETTER_COLLATOR) {
        const compareResult = LETTER_COLLATOR.compare(a.char, b.char);
        if (compareResult !== 0) {
          return compareResult;
        }
      } else {
        const aLower = a.char.toLowerCase();
        const bLower = b.char.toLowerCase();
        if (aLower < bLower) {
          return -1;
        }
        if (aLower > bLower) {
          return 1;
        }
      }

      const directCompare = a.char.localeCompare(b.char);
      if (directCompare !== 0) {
        return directCompare;
      }

      return a.index - b.index;
    });
    return sorted;
  }

  updatePreviewVisibility() {
    const hasLetters = this.hasPreviewLetters();
    const shouldHide = this.isPreviewHidden || !hasLetters;

    if (this.previewContainer) {
      this.previewContainer.classList.toggle('is-hidden', shouldHide);
      this.previewContainer.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
    }

    if (this.previewToggleButton) {
      this.previewToggleButton.disabled = !hasLetters;
      const expanded = hasLetters && !this.isPreviewHidden;
      const labelText = expanded ? 'Hide letters' : 'Show letters';
      const ariaLabel = expanded ? 'Hide freeze letters' : 'Show freeze letters';
      this.previewToggleButton.textContent = labelText;
      this.previewToggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      this.previewToggleButton.setAttribute('aria-label', ariaLabel);
      this.previewToggleButton.setAttribute('title', ariaLabel);
    }
  }

  updateButtonStates() {
    const hasRevealableLetters = this.letters.some(letter => letter?.isRevealable);
    const allRevealed = hasRevealableLetters
      ? this.letters.every(letter => !letter?.isRevealable || this.isLetterRevealed(letter))
      : false;

    if (this.nextButton) {
      this.nextButton.disabled = !hasRevealableLetters || allRevealed;
    }

    if (this.hideLettersButton) {
      const shouldDisable = !hasRevealableLetters;
      this.hideLettersButton.disabled = shouldDisable;
      if (shouldDisable) {
        this.hideLettersButton.setAttribute('aria-disabled', 'true');
      } else {
        this.hideLettersButton.removeAttribute('aria-disabled');
      }
      if (shouldDisable) {
        this.setHideMode(false);
      }
      if (!this.isHideMode) {
        this.updateHideLettersButtonLabel();
        this.hideLettersButton.setAttribute('aria-pressed', 'false');
        this.hideLettersButton.classList.remove('is-active');
      } else {
        this.hideLettersButton.setAttribute('aria-pressed', 'true');
        this.hideLettersButton.classList.add('is-active');
      }
    }

    if (this.previousButton) {
      const hasHistory = this.revealHistory.length > 0;
      const shouldDisablePrev = !hasRevealableLetters || !hasHistory;
      this.previousButton.disabled = shouldDisablePrev;
      if (shouldDisablePrev) {
        this.previousButton.setAttribute('aria-disabled', 'true');
      } else {
        this.previousButton.removeAttribute('aria-disabled');
      }
    }
  }

  fitOverlay() {
    if (!this.overlay || !this.overlayContent || !this.letters.length) {
      return;
    }

    this.overlayContent.style.transform = 'scale(1)';

    const overlayRect = this.overlay.getBoundingClientRect();
    const contentRect = this.overlayContent.getBoundingClientRect();

    if (!overlayRect.width || !overlayRect.height || !contentRect.width || !contentRect.height) {
      return;
    }

    const scaleX = overlayRect.width / contentRect.width;
    const scaleY = overlayRect.height / contentRect.height;
    const scale = Math.min(1, scaleX, scaleY);
    this.overlayContent.style.transform = `scale(${scale})`;
  }

  setOverlayHidden(isHidden) {
    if (!this.overlay) {
      return;
    }
    this.overlay.classList.toggle('is-hidden', Boolean(isHidden));
    this.overlay.setAttribute('aria-hidden', isHidden ? 'true' : 'false');
  }

  getLetterClass(classification) {
    switch (classification) {
      case 'uppercase':
        return 'teach-letter--uppercase';
      case 'lowercase':
        return 'teach-letter--lowercase';
      case 'descender':
        return 'teach-letter--descender';
      case 'period':
        return 'teach-letter--period';
      case 'punctuation':
        return 'teach-letter--punctuation';
      case 'number':
        return 'teach-letter--number';
      case 'other':
        return 'teach-letter--other';
      default:
        return 'teach-letter--default';
    }
  }
}
