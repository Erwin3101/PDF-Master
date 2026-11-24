const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Keeps keyboard Tab / Shift+Tab navigation trapped inside an active modal element.
 * Returns true when focus wrapping handled the Tab keydown event.
 *
 * @param {KeyboardEvent} event
 * @param {HTMLElement | null} modalEl
 * @returns {boolean}
 */
export function trapModalFocus(event, modalEl) {
    if (!modalEl || event.key !== 'Tab') return false;

    const focusables = Array.from(modalEl.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el instanceof HTMLElement && el.offsetParent !== null && !el.closest('.hidden')
    );

    if (focusables.length === 0) {
        event.preventDefault();
        return true;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
        if (active === first || !modalEl.contains(active)) {
            event.preventDefault();
            last.focus({ preventScroll: true });
            return true;
        }
    } else if (active === last || !modalEl.contains(active)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
        return true;
    }

    return false;
}
