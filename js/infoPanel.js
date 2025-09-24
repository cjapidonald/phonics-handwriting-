const toggleButton = document.getElementById('infoPanelToggle');
const panel = document.getElementById('infoPanel');
const closeButton = panel?.querySelector('[data-info-panel-close]');
const backdrop = document.getElementById('infoPanelBackdrop');

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

let previouslyFocusedElement = null;

const isPanelHidden = () => panel?.hasAttribute('hidden');

const trapFocus = event => {
  if (!panel) {
    return;
  }

  const focusableElements = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(element => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const styles = window.getComputedStyle(element);
    return styles.display !== 'none' && styles.visibility !== 'hidden' && !element.hasAttribute('disabled');
  });

  if (focusableElements.length === 0) {
    event.preventDefault();
    panel.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey) {
    if (document.activeElement === firstElement || document.activeElement === panel) {
      event.preventDefault();
      lastElement.focus();
    }
    return;
  }

  if (document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
};

const handleKeydown = event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePanel();
    return;
  }

  if (event.key === 'Tab') {
    trapFocus(event);
  }
};

const openPanel = () => {
  if (!toggleButton || !panel) {
    return;
  }

  previouslyFocusedElement = document.activeElement;
  panel.removeAttribute('hidden');
  backdrop?.removeAttribute('hidden');
  toggleButton.setAttribute('aria-expanded', 'true');
  document.body.classList.add('info-panel-open');

  const focusTarget = closeButton || panel;
  focusTarget.focus({ preventScroll: true });

  document.addEventListener('keydown', handleKeydown);
};

function closePanel() {
  if (!toggleButton || !panel || isPanelHidden()) {
    return;
  }

  panel.setAttribute('hidden', '');
  backdrop?.setAttribute('hidden', '');
  toggleButton.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('info-panel-open');
  document.removeEventListener('keydown', handleKeydown);

  if (previouslyFocusedElement instanceof HTMLElement) {
    previouslyFocusedElement.focus({ preventScroll: true });
  } else {
    toggleButton.focus({ preventScroll: true });
  }
}

const togglePanel = () => {
  if (isPanelHidden()) {
    openPanel();
  } else {
    closePanel();
  }
};

toggleButton?.addEventListener('click', togglePanel);

closeButton?.addEventListener('click', () => {
  closePanel();
  toggleButton?.focus({ preventScroll: true });
});

backdrop?.addEventListener('click', closePanel);

panel?.addEventListener('click', event => {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }

  if (event.target.closest('[data-info-panel-close]')) {
    closePanel();
  }
});

export {};
