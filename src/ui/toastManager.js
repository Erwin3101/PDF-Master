const MAX_VISIBLE_TOASTS = 5;
const VALID_TYPES = new Set(['success', 'info', 'warning', 'error']);
const TYPE_ICONS = Object.freeze({
    success: 'check-circle-2',
    info: 'info',
    warning: 'alert-triangle',
    error: 'alert-circle',
});

/**
 * Centralized toast notification service rendering safely into `#toast-container`.
 */
class ToastManagerService {
    /**
     * Resolves `#toast-container`, creating a fallback container if missing.
     * @returns {HTMLElement | null}
     */
    _getContainer() {
        let container = document.getElementById('toast-container');
        if (!container && document.body) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }
        return container;
    }

    /**
     * Removes excess oldest toasts so the visible stack never exceeds `MAX_VISIBLE_TOASTS`.
     * @param {HTMLElement} container
     */
    _enforceStackLimit(container) {
        while (container.children.length >= MAX_VISIBLE_TOASTS) {
            const oldest = container.firstElementChild;
            if (!oldest) break;
            if (typeof oldest._toastCleanup === 'function') {
                oldest._toastCleanup();
            }
            oldest.remove();
        }
    }

    /**
     * Displays a toast notification.
     * @param {object} options
     * @param {'success'|'info'|'warning'|'error'} [options.type='info']
     * @param {string} [options.title='']
     * @param {string} [options.message='']
     * @param {number} [options.duration=4000]
     * @returns {() => void} Dismiss callback for this toast
     */
    show({ type = 'info', title = '', message = '', duration = 4000 } = {}) {
        const container = this._getContainer();
        if (!container) return () => {};

        const safeType = VALID_TYPES.has(type) ? type : 'info';
        this._enforceStackLimit(container);

        const toast = document.createElement('div');
        toast.className = `toast toast-${safeType}`;
        toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', safeType === 'error' ? 'assertive' : 'polite');

        const iconWrap = document.createElement('span');
        iconWrap.className = 'toast-icon';
        iconWrap.setAttribute('aria-hidden', 'true');
        const iconEl = document.createElement('i');
        iconEl.setAttribute('data-lucide', TYPE_ICONS[safeType]);
        iconWrap.appendChild(iconEl);

        const body = document.createElement('div');
        body.className = 'toast-body';

        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = String(title);
            body.appendChild(titleEl);
        }

        const msgEl = document.createElement('div');
        msgEl.className = 'toast-message';
        msgEl.textContent = String(message ?? '');
        body.appendChild(msgEl);

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Cerrar notificación');
        const closeIcon = document.createElement('i');
        closeIcon.setAttribute('data-lucide', 'x');
        closeBtn.appendChild(closeIcon);

        toast.appendChild(iconWrap);
        toast.appendChild(body);
        toast.appendChild(closeBtn);

        let timerId = null;
        let remaining = Number.isFinite(duration) && duration > 0 ? duration : 0;
        let startTime = 0;
        let dismissed = false;

        const cleanupTimer = () => {
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }
        };

        const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            cleanupTimer();
            toast.classList.add('is-leaving');
            const computed =
                typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
                    ? window.getComputedStyle(toast)
                    : null;
            const hasTransition = computed && parseFloat(computed.transitionDuration || '0') > 0;
            if (hasTransition) {
                setTimeout(() => toast.remove(), 180);
            } else {
                toast.remove();
            }
        };

        const scheduleDismiss = (ms) => {
            if (ms <= 0 || dismissed) return;
            cleanupTimer();
            startTime = Date.now();
            timerId = setTimeout(dismiss, ms);
        };

        toast._toastCleanup = cleanupTimer;
        closeBtn.addEventListener('click', dismiss);

        if (remaining > 0) {
            toast.addEventListener('mouseenter', () => {
                if (timerId === null) return;
                const elapsed = Date.now() - startTime;
                remaining = Math.max(300, remaining - elapsed);
                cleanupTimer();
            });
            toast.addEventListener('mouseleave', () => {
                if (!dismissed && remaining > 0) {
                    scheduleDismiss(remaining);
                }
            });
            scheduleDismiss(remaining);
        }

        container.appendChild(toast);
        globalThis.lucide?.createIcons?.();

        requestAnimationFrame(() => {
            if (!dismissed) {
                toast.classList.add('is-visible');
            }
        });

        return dismiss;
    }

    /**
     * Shows a success toast notification.
     * @param {string} message
     * @param {string} [title='']
     * @param {number} [duration=4000]
     * @returns {() => void}
     */
    success(message, title = '', duration = 4000) {
        return this.show({ type: 'success', title, message, duration });
    }

    /**
     * Shows an informational toast notification.
     * @param {string} message
     * @param {string} [title='']
     * @param {number} [duration=4000]
     * @returns {() => void}
     */
    info(message, title = '', duration = 4000) {
        return this.show({ type: 'info', title, message, duration });
    }

    /**
     * Shows a warning toast notification.
     * @param {string} message
     * @param {string} [title='']
     * @param {number} [duration=4500]
     * @returns {() => void}
     */
    warning(message, title = '', duration = 4500) {
        return this.show({ type: 'warning', title, message, duration });
    }

    /**
     * Shows an error toast notification.
     * @param {string} message
     * @param {string} [title='']
     * @param {number} [duration=5500]
     * @returns {() => void}
     */
    error(message, title = '', duration = 5500) {
        return this.show({ type: 'error', title, message, duration });
    }
}

export const ToastManager = new ToastManagerService();
