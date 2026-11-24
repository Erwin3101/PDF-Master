import { BlobRegistry } from './blobRegistry.js';
import { ToastManager } from '../ui/toastManager.js';
import { t } from './i18n.js';

/**
 * Popup-free printing using a hidden sandbox iframe inside the document.
 * Prevents browser popup-blockers from aborting print flows after async PDF generation.
 */
class PrintServiceManager {
    constructor() {
        this._activeIframe = null;
    }

    _cleanup() {
        if (this._activeIframe) {
            this._activeIframe.remove();
            this._activeIframe = null;
        }
        BlobRegistry.revokeScope('__print__');
    }

    /**
     * Prints a PDF Blob through a hidden iframe without opening a popup window.
     * @param {Blob} blob
     */
    printPdfBlob(blob) {
        if (!blob) return;
        this._cleanup();

        const url = BlobRegistry.create(blob, '__print__');
        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.opacity = '0.001';
        iframe.style.pointerEvents = 'none';
        iframe.style.border = '0';

        this._activeIframe = iframe;

        const cleanupLater = () => {
            setTimeout(() => {
                if (this._activeIframe === iframe) {
                    this._cleanup();
                }
            }, 60000);
        };

        iframe.addEventListener(
            'load',
            () => {
                setTimeout(() => {
                    try {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        cleanupLater();
                    } catch {
                        ToastManager.warning(t('toast_print_fallback'));
                        BlobRegistry.downloadBlob(blob, 'imprimir_documento.pdf');
                        this._cleanup();
                    }
                }, 250);
            },
            { once: true }
        );

        iframe.src = url;
        document.body.appendChild(iframe);
    }

    /**
     * Prints an HTMLCanvasElement cleanly via hidden iframe `srcdoc` with @media print CSS.
     * @param {HTMLCanvasElement | string} canvasOrId
     * @param {string} [title='PDF Master']
     */
    printCanvas(canvasOrId, title = 'PDF Master') {
        const canvas = typeof canvasOrId === 'string' ? document.getElementById(canvasOrId) : canvasOrId;
        if (!canvas || typeof canvas.toDataURL !== 'function') {
            ToastManager.error(t('toast_print_error'));
            return;
        }

        this._cleanup();
        const dataUrl = canvas.toDataURL('image/png');
        const safeTitle = String(title).replace(/[<>&"']/g, '');

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '1px';
        iframe.style.height = '1px';
        iframe.style.opacity = '0.001';
        iframe.style.pointerEvents = 'none';
        iframe.style.border = '0';

        this._activeIframe = iframe;

        iframe.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
  @page { margin: 8mm; }
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; }
  body { display: flex; align-items: center; justify-content: center; }
  img { max-width: 100%; max-height: 100vh; object-fit: contain; display: block; }
</style>
</head>
<body>
  <img id="print-target" src="${dataUrl}" alt="">
</body>
</html>`;

        iframe.addEventListener(
            'load',
            () => {
                const doc = iframe.contentDocument;
                const img = doc?.getElementById('print-target');
                const trigger = () => {
                    setTimeout(() => {
                        try {
                            iframe.contentWindow?.focus();
                            iframe.contentWindow?.print();
                        } catch {
                            ToastManager.error(t('toast_print_error'));
                        }
                        setTimeout(() => {
                            if (this._activeIframe === iframe) {
                                this._cleanup();
                            }
                        }, 60000);
                    }, 120);
                };

                if (img && !img.complete) {
                    img.addEventListener('load', trigger, { once: true });
                } else {
                    trigger();
                }
            },
            { once: true }
        );

        document.body.appendChild(iframe);
    }
}

export const PrintService = new PrintServiceManager();
