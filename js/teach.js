const DESCENDER_CHARACTERS = new Set(['g', 'j', 'p', 'q', 'y']);
const PUNCTUATION_REGEX = /^[!?;:,]$/;

export class TeachController {
  constructor({ overlay, textInput, teachButton, nextButton, previewContainer }) {
    this.overlay = overlay ?? null;
    this.textInput = textInput ?? null;
    this.teachButton = teachButton ?? null;
    this.nextButton = nextButton ?? null;
    this.previewContainer = previewContainer ?? null;

    this.overlayContent = null;
    this.lines = [];
    this.letters = [];
    this.manualFrozenIndices = new Set();
    this.revealedByNext = new Set();
    this.nextPointer = 0;

    this.handleTeach = this.handleTeach.bind(this);
    this.handleNext = this.handleNext.bind(this);
    this.handlePreviewClick = this.handlePreviewClick.bind(this);

    this.teachButton?.addEventListener('click', this.handleTeach);
    this.nextButton?.addEventListener('click', this.handleNext);
    this.previewContainer?.addEventListener('click', this.handlePreviewClick);
    this.textInput?.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.handleTeach();
      }
    });

    if (this.overlay && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.fitOverlay());
      this.resizeObserver.observe(this.overlay);
    }

    window.addEventListener('resize', () => this.fitOverlay());

    this.setOverlayHidden(true);
    this.updateButtonStates();
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

    if (this.manualFrozenIndices.has(index)) {
      this.manualFrozenIndices.delete(index);
    } else {
      this.manualFrozenIndices.add(index);
    }

    this.updateLetterState(letter);
    this.updateButtonStates();
  }

  applyText(rawText) {
    const text = typeof rawText === 'string' ? rawText : '';
    this.lines = [];
    this.letters = [];
    this.manualFrozenIndices.clear();
    this.revealedByNext.clear();
    this.nextPointer = 0;

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

    this.lines.forEach(line => {
      const lineElement = document.createElement('div');
      lineElement.className = 'teach-line';
      this.overlayContent.appendChild(lineElement);

      let previewLine = null;
      if (this.previewContainer) {
        previewLine = document.createElement('div');
        previewLine.className = 'teach-preview__line';
        this.previewContainer.appendChild(previewLine);
      }

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

        letter.element = letterElement;
        letter.placeholderElement = placeholder;
        letter.charElement = charElement;

        if (this.previewContainer && previewLine) {
          if (letter.isSpace) {
            const space = document.createElement('span');
            space.className = 'teach-preview__space';
            space.setAttribute('aria-hidden', 'true');
            previewLine.appendChild(space);
          } else {
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
            previewLine.appendChild(button);
            letter.previewElement = button;
          }
        }
      });
    });
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
      this.nextPointer = index + 1;
      this.updateLetterState(letter);
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
    }

    if (letter.previewElement) {
      letter.previewElement.classList.toggle('is-revealed', isRevealed);
      letter.previewElement.classList.toggle('is-frozen', isFrozen);
      letter.previewElement.setAttribute('aria-pressed', isFrozen ? 'true' : 'false');
    }
  }

  updateButtonStates() {
    if (!this.nextButton) {
      return;
    }
    const hasRevealableLetters = this.letters.some(letter => letter?.isRevealable);
    const allRevealed = hasRevealableLetters
      ? this.letters.every(letter => !letter?.isRevealable || this.isLetterRevealed(letter))
      : false;

    this.nextButton.disabled = !hasRevealableLetters || allRevealed;
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
