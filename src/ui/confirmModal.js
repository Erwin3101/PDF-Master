import { t } from '../core/i18n.js';
import { trapModalFocus } from './modalFocus.js';

let activeCleanup = null;

/**
 * Opens an accessible confirmation dialog using `#confirm-modal` and resolves
 * `true` on confirm or `false` on cancel, backdrop click, or Escape key.
 * @param {object} [options]
 * @param {string} [options.title]
 * @param {string} [options.message]
 * @param {string} [options.confirmLabel]
 * @param {string} [options.cancelLabel]
 * @param {boolean} [options.danger=false]
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
    title = '',
    message = '',
    confirmLabel = '',
    cancelLabel = '',
    danger = false,
} = {}) {
    if (typeof activeCleanup === 'function') {
        activeCleanup(false);
    }

    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const messageEl = document.getElementById('confirm-message');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    const okBtn = document.getElementById('confirm-ok-btn');

    if (!modal || !okBtn || !cancelBtn) {
        return Promise.resolve(false);
    }

    if (titleEl) {
        titleEl.textContent = title || t('confirm_default_title');
    }
    if (messageEl) {
        messageEl.textContent = String(message ?? '');
    }
    cancelBtn.textContent = cancelLabel || t('btn_cancel');
    okBtn.textContent = confirmLabel || t('confirm_ok');

    okBtn.classList.toggle('is-danger', Boolean(danger));
    okBtn.classList.toggle('btn-danger', Boolean(danger));
    okBtn.classList.toggle('btn-primary', !danger);
    okBtn.dataset.variant = danger ? 'danger' : 'primary';

    const previousFocus = document.activeElement;

    modal.classList.remove('hidden');
    modal.classList.add('is-open');
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');

    return new Promise((resolve) => {
        let settled = false;

        const settle = (result) => {
            if (settled) return;
            settled = true;
            activeCleanup = null;

            okBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdropClick);
            document.removeEventListener('keydown', onKeyDown, true);

            modal.classList.remove('is-open');
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');

            if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) {
                previousFocus.focus({ preventScroll: true });
            }

            resolve(result);
        };

        const onConfirm = () => settle(true);
        const onCancel = () => settle(false);
        const onBackdropClick = (event) => {
            const target = event.target;
            if (
                target === modal ||
                (target instanceof Element &&
                    (target.classList.contains('modal-backdrop') || target.hasAttribute('data-close-modal')))
            ) {
                settle(false);
            }
        };
        const onKeyDown = (event) => {
            if (trapModalFocus(event, modal)) {
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                settle(false);
            }
        };

        activeCleanup = settle;

        okBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdropClick);
        document.addEventListener('keydown', onKeyDown, true);

        const initialFocus = danger ? cancelBtn : okBtn;
        requestAnimationFrame(() => {
            initialFocus.focus({ preventScroll: true });
        });
    });
}
