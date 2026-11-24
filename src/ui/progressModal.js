import { t } from '../core/i18n.js';
import { trapModalFocus } from './modalFocus.js';

/**
 * Manages the shared blocking progress modal with per-operation AbortController support.
 */
class ProgressModalService {
    constructor() {
        /** @type {AbortController | null} */
        this._controller = null;
        /** @type {HTMLElement | null} */
        this._boundCancelBtn = null;
        /** @type {Element | null} */
        this._previousFocus = null;
        this._cancellable = true;
        this._handleCancelClick = this._handleCancelClick.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
    }

    _handleKeyDown(event) {
        const { modal } = this._getElements();
        if (!modal || !modal.classList.contains('is-open')) return;
        if (trapModalFocus(event, modal)) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (this._cancellable) {
                this._handleCancelClick();
            }
        }
    }

    _getElements() {
        return {
            modal: document.getElementById('progress-modal'),
            titleEl: document.getElementById('progress-title'),
            detailEl: document.getElementById('progress-detail'),
            percentEl: document.getElementById('progress-percent'),
            barFillEl: document.getElementById('progress-bar-fill'),
            cancelBtn: document.getElementById('progress-cancel-btn'),
        };
    }

    _handleCancelClick() {
        if (!this._controller || this._controller.signal.aborted) return;

        this._controller.abort();

        const { modal, detailEl, cancelBtn } = this._getElements();
        if (cancelBtn) {
            cancelBtn.disabled = true;
            cancelBtn.setAttribute('aria-disabled', 'true');
        }
        if (detailEl) {
            detailEl.textContent = t('toast_cancelled');
        }
        if (modal) {
            modal.dispatchEvent(new CustomEvent('progress:cancelled', { bubbles: true }));
        }
    }

    _bindCancelButton(cancelBtn) {
        if (!cancelBtn || this._boundCancelBtn === cancelBtn) return;
        if (this._boundCancelBtn) {
            this._boundCancelBtn.removeEventListener('click', this._handleCancelClick);
        }
        cancelBtn.addEventListener('click', this._handleCancelClick);
        this._boundCancelBtn = cancelBtn;
    }

    /**
     * Opens the progress modal and returns a fresh `AbortSignal` for the operation.
     * @param {object} [options]
     * @param {string} [options.title='']
     * @param {string} [options.detail='']
     * @param {boolean} [options.cancellable=true]
     * @returns {AbortSignal}
     */
    open({ title = '', detail = '', cancellable = true } = {}) {
        if (this._controller && !this._controller.signal.aborted) {
            this._controller.abort();
        }
        this._controller = new AbortController();

        const { modal, titleEl, detailEl, percentEl, barFillEl, cancelBtn } = this._getElements();

        if (titleEl) {
            titleEl.textContent = title || t('progress_title');
        }
        if (detailEl) {
            detailEl.textContent = detail || '';
        }
        if (percentEl) {
            percentEl.textContent = '0%';
        }
        if (barFillEl) {
            barFillEl.style.width = '0%';
            barFillEl.setAttribute('aria-valuenow', '0');
        }

        if (cancelBtn) {
            this._bindCancelButton(cancelBtn);
            cancelBtn.disabled = !cancellable;
            cancelBtn.setAttribute('aria-disabled', String(!cancellable));
            cancelBtn.classList.toggle('hidden', !cancellable);
            cancelBtn.style.display = cancellable ? '' : 'none';
            cancelBtn.textContent = t('progress_cancel');
        }

        if (modal) {
            this._cancellable = Boolean(cancellable);
            this._previousFocus = document.activeElement;
            modal.classList.remove('hidden');
            modal.classList.add('is-open');
            modal.removeAttribute('hidden');
            modal.setAttribute('aria-hidden', 'false');
            document.addEventListener('keydown', this._handleKeyDown, true);

            if (cancellable && cancelBtn) {
                requestAnimationFrame(() => {
                    cancelBtn.focus({ preventScroll: true });
                });
            }
        }

        return this._controller.signal;
    }

    /**
     * Updates progress percentage, detail message, and/or title while active.
     * @param {object} [patch]
     * @param {number} [patch.percent]
     * @param {string} [patch.detail]
     * @param {string} [patch.title]
     */
    update({ percent, detail, title } = {}) {
        const { titleEl, detailEl, percentEl, barFillEl } = this._getElements();

        if (title !== undefined && titleEl) {
            titleEl.textContent = String(title);
        }
        if (detail !== undefined && detailEl && !this._controller?.signal.aborted) {
            detailEl.textContent = String(detail);
        }
        if (percent !== undefined && Number.isFinite(Number(percent))) {
            const clamped = Math.max(0, Math.min(100, Number(percent)));
            const rounded = Math.round(clamped);
            if (percentEl) {
                percentEl.textContent = `${rounded}%`;
            }
            if (barFillEl) {
                barFillEl.style.width = `${clamped}%`;
                barFillEl.setAttribute('aria-valuenow', String(rounded));
            }
        }
    }

    /**
     * Closes the progress modal and clears the active operation controller.
     */
    close() {
        document.removeEventListener('keydown', this._handleKeyDown, true);
        const { modal, cancelBtn } = this._getElements();

        if (modal) {
            modal.classList.remove('is-open');
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
        }

        if (cancelBtn) {
            cancelBtn.disabled = false;
            cancelBtn.removeAttribute('aria-disabled');
        }

        this._controller = null;

        if (this._previousFocus && typeof this._previousFocus.focus === 'function' && this._previousFocus.isConnected) {
            this._previousFocus.focus({ preventScroll: true });
        }
        this._previousFocus = null;
    }
}

export const ProgressModal = new ProgressModalService();
