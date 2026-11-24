const WINDOW_GUARD_KEY = '__pdfMasterGlobalDropGuardInstalled';

/**
 * Installs a once-per-window dragover/drop default prevention guard so files
 * dropped outside a dropzone never cause the browser tab to navigate away.
 */
function ensureGlobalWindowDropGuard() {
    if (typeof window === 'undefined' || window[WINDOW_GUARD_KEY]) return;
    window[WINDOW_GUARD_KEY] = true;

    window.addEventListener('dragover', (event) => {
        event.preventDefault();
    });
    window.addEventListener('drop', (event) => {
        event.preventDefault();
    });
}

/**
 * Binds click, keyboard activation (Enter/Space), drag-and-drop, and file input
 * change events onto a dropzone element and its paired `<input type="file">`.
 *
 * @param {HTMLElement | null} zoneEl
 * @param {HTMLInputElement | null} inputEl
 * @param {object} options
 * @param {(files: File[]) => void | Promise<void>} options.onFiles
 * @param {boolean} [options.multiple=true]
 * @returns {() => void} Cleanup function that removes all bound listeners
 */
export function bindDropzone(zoneEl, inputEl, { onFiles, multiple = true } = {}) {
    if (!zoneEl || !inputEl) {
        return () => {};
    }

    ensureGlobalWindowDropGuard();
    inputEl.multiple = Boolean(multiple);

    if (zoneEl.tagName !== 'BUTTON' && zoneEl.tagName !== 'A') {
        if (!zoneEl.hasAttribute('tabindex')) {
            zoneEl.setAttribute('tabindex', '0');
        }
        if (!zoneEl.hasAttribute('role')) {
            zoneEl.setAttribute('role', 'button');
        }
    }

    let dragDepth = 0;

    const deliverFiles = (rawFiles) => {
        if (!rawFiles || rawFiles.length === 0 || typeof onFiles !== 'function') return;
        const selected = multiple ? rawFiles : rawFiles.slice(0, 1);
        Promise.resolve(onFiles(selected)).catch((err) => {
            console.error('[dropzone] onFiles handler error:', err);
        });
    };

    const handleClick = (event) => {
        if (inputEl.disabled) return;
        const target = event.target;
        if (target === inputEl) return;
        if (target instanceof Element) {
            const label = target.closest('label');
            if (label && label.control === inputEl) return;
        }
        inputEl.click();
    };

    const handleKeyDown = (event) => {
        if (inputEl.disabled) return;
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputEl.click();
        }
    };

    const handleDragEnter = (event) => {
        event.preventDefault();
        dragDepth += 1;
        zoneEl.classList.add('is-dragover');
    };

    const handleDragOver = (event) => {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'copy';
        }
        zoneEl.classList.add('is-dragover');
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        const related = event.relatedTarget;
        if (dragDepth === 0 || !related || !(related instanceof Node) || !zoneEl.contains(related)) {
            dragDepth = 0;
            zoneEl.classList.remove('is-dragover');
        }
    };

    const handleDrop = (event) => {
        event.preventDefault();
        dragDepth = 0;
        zoneEl.classList.remove('is-dragover');
        const files = Array.from(event.dataTransfer?.files || []);
        deliverFiles(files);
    };

    const handleInputChange = () => {
        let files = [];
        try {
            files = Array.from(inputEl.files || []);
        } finally {
            inputEl.value = '';
        }
        deliverFiles(files);
    };

    zoneEl.addEventListener('click', handleClick);
    zoneEl.addEventListener('keydown', handleKeyDown);
    zoneEl.addEventListener('dragenter', handleDragEnter);
    zoneEl.addEventListener('dragover', handleDragOver);
    zoneEl.addEventListener('dragleave', handleDragLeave);
    zoneEl.addEventListener('drop', handleDrop);
    inputEl.addEventListener('change', handleInputChange);

    return () => {
        dragDepth = 0;
        zoneEl.classList.remove('is-dragover');
        zoneEl.removeEventListener('click', handleClick);
        zoneEl.removeEventListener('keydown', handleKeyDown);
        zoneEl.removeEventListener('dragenter', handleDragEnter);
        zoneEl.removeEventListener('dragover', handleDragOver);
        zoneEl.removeEventListener('dragleave', handleDragLeave);
        zoneEl.removeEventListener('drop', handleDrop);
        inputEl.removeEventListener('change', handleInputChange);
    };
}
