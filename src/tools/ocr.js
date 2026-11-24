import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import {
    detectFileKind,
    decodeImageFile,
    openPdfFile,
    renderPdfPageToCanvas,
} from '../core/fileLoader.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const PREVIEW_BLOB_SCOPE = 'ocr-preview';

const STATUS_LABELS = Object.freeze({
    es: {
        'loading tesseract core': 'Cargando motor OCR...',
        'initializing tesseract': 'Inicializando Tesseract...',
        'loading language traineddata': 'Descargando paquete de idioma...',
        'initializing api': 'Preparando reconocimiento...',
        'recognizing text': 'Reconociendo texto',
    },
    en: {
        'loading tesseract core': 'Loading OCR core...',
        'initializing tesseract': 'Initializing Tesseract...',
        'loading language traineddata': 'Loading language data...',
        'initializing api': 'Initializing OCR API...',
        'recognizing text': 'Recognizing text',
    },
});

/**
 * Converts an HTMLCanvasElement into a Blob asynchronously.
 * @param {HTMLCanvasElement} canvas
 * @param {string} [mime='image/png']
 * @param {number} [quality]
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, mime = 'image/png', quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('No se pudo generar la imagen de vista previa.'));
                }
            },
            mime,
            quality
        );
    });
}

/**
 * Parses an optional page range string (e.g. "1-3, 5") into unique 1-based page numbers.
 * Returns all pages `[1..totalPages]` when the input is blank.
 * @param {string} rawInput
 * @param {number} totalPages
 * @returns {number[]}
 */
function parsePageRange(rawInput, totalPages) {
    const trimmed = String(rawInput || '').trim();
    if (!trimmed) {
        return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    const tokens = trimmed.split(',').map((part) => part.trim());
    const result = [];
    const seen = new Set();

    for (const token of tokens) {
        if (!token) {
            throw new Error(
                AppState.lang === 'en'
                    ? 'Invalid page range syntax. Example: 1-3, 5'
                    : 'Rango de páginas inválido. Ejemplo: 1-3, 5'
            );
        }

        const singleMatch = /^(\d+)$/.exec(token);
        if (singleMatch) {
            const page = Number(singleMatch[1]);
            if (!Number.isInteger(page) || page < 1 || page > totalPages) {
                throw new Error(
                    AppState.lang === 'en'
                        ? `Page ${token} is out of bounds (1–${totalPages}).`
                        : `La página ${token} está fuera de rango (1–${totalPages}).`
                );
            }
            if (!seen.has(page)) {
                seen.add(page);
                result.push(page);
            }
            continue;
        }

        const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
        if (rangeMatch) {
            const start = Number(rangeMatch[1]);
            const end = Number(rangeMatch[2]);
            if (
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                start < 1 ||
                end < 1 ||
                start > totalPages ||
                end > totalPages ||
                start > end
            ) {
                throw new Error(
                    AppState.lang === 'en'
                        ? `Invalid range "${token}". Valid bounds: 1–${totalPages}.`
                        : `Rango inválido "${token}". Límites válidos: 1–${totalPages}.`
                );
            }
            for (let p = start; p <= end; p++) {
                if (!seen.has(p)) {
                    seen.add(p);
                    result.push(p);
                }
            }
            continue;
        }

        throw new Error(
            AppState.lang === 'en'
                ? `Unrecognized page token "${token}". Use format like "1-3, 5".`
                : `Formato no reconocido "${token}". Usa un formato como "1-3, 5".`
        );
    }

    if (result.length === 0) {
        throw new Error(t('toast_no_pages'));
    }

    return result;
}

/**
 * Races an arbitrary Promise against an AbortSignal without leaving unhandled rejections.
 * @template T
 * @param {Promise<T>} promise
 * @param {AbortSignal} signal
 * @returns {Promise<T>}
 */
function runWithAbort(promise, signal) {
    if (signal.aborted) {
        promise.catch(() => {});
        return Promise.reject(new DOMException('Operation aborted', 'AbortError'));
    }

    promise.catch(() => {});

    return new Promise((resolve, reject) => {
        const onAbort = () => {
            reject(new DOMException('Operation aborted', 'AbortError'));
        };

        signal.addEventListener('abort', onAbort, { once: true });

        promise.then(
            (value) => {
                signal.removeEventListener('abort', onAbort);
                resolve(value);
            },
            (err) => {
                signal.removeEventListener('abort', onAbort);
                reject(err);
            }
        );
    });
}

/**
 * Formats a Tesseract logger status key into a readable localized message.
 * @param {string} status
 * @returns {string}
 */
function formatWorkerStatus(status) {
    const langDict = STATUS_LABELS[AppState.lang] || STATUS_LABELS.es;
    return langDict[status] || status || '';
}

/**
 * Initializes the Multipage OCR tool (`#section-ocr`).
 * Supports single images (JPG, PNG, WebP, HEIC, TIFF) and multi-page PDFs with range parsing,
 * page preview navigation, real progress reporting, cancellation via AbortSignal, clipboard copy,
 * and TXT download.
 */
export function initOcrTool() {
    const section = document.getElementById('section-ocr');
    if (!section || section.dataset.ocrInitialized === 'true') return;
    section.dataset.ocrInitialized = 'true';

    const uploadArea = document.getElementById('ocr-upload-area');
    const dropzone = document.getElementById('ocr-dropzone');
    const fileInput = document.getElementById('file-input-ocr');
    const workspace = document.getElementById('ocr-workspace');
    const langSelect = document.getElementById('ocr-lang');
    const pageRangeWrap = document.getElementById('ocr-page-range-wrap');
    const pageRangeInput = document.getElementById('ocr-page-range');
    const totalPagesBadge = document.getElementById('ocr-total-pages');
    const startBtn = document.getElementById('ocr-start-btn');
    const resetBtn = document.getElementById('ocr-reset-btn');
    const previewNav = document.getElementById('ocr-preview-nav');
    const prevPageBtn = document.getElementById('ocr-prev-page-btn');
    const nextPageBtn = document.getElementById('ocr-next-page-btn');
    const pageIndicator = document.getElementById('ocr-page-indicator');
    const previewImg = document.getElementById('ocr-preview-img');
    const resultTextarea = document.getElementById('ocr-result-text');
    const copyBtn = document.getElementById('ocr-copy-btn');
    const downloadTxtBtn = document.getElementById('ocr-download-txt-btn');

    const state = {
        mode: 'none', // 'none' | 'image' | 'pdf'
        fileName: '',
        imageDataUrl: null,
        pdfDoc: null,
        totalPages: 1,
        currentPage: 1,
        previewToken: 0,
    };

    const updateNavControls = () => {
        if (pageIndicator) {
            pageIndicator.textContent = `Pág ${state.currentPage} / ${state.totalPages}`;
        }
        if (prevPageBtn) {
            prevPageBtn.disabled = state.currentPage <= 1;
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = state.currentPage >= state.totalPages;
        }
    };

    const renderPdfPreview = async (pageNum) => {
        if (state.mode !== 'pdf' || !state.pdfDoc) return;

        const targetPage = Math.max(1, Math.min(state.totalPages, pageNum));
        state.currentPage = targetPage;
        const token = ++state.previewToken;
        updateNavControls();

        let offscreenCanvas = null;
        try {
            const { canvas } = await renderPdfPageToCanvas(state.pdfDoc, targetPage, 1.5);
            offscreenCanvas = canvas;
            if (token !== state.previewToken || state.mode !== 'pdf') return;

            const blob = await canvasToBlob(canvas, 'image/png');
            if (token !== state.previewToken || state.mode !== 'pdf') return;

            BlobRegistry.revokeScope(PREVIEW_BLOB_SCOPE);
            const url = BlobRegistry.create(blob, PREVIEW_BLOB_SCOPE);
            if (previewImg) {
                previewImg.src = url;
            }
        } catch (err) {
            if (token === state.previewToken) {
                ToastManager.error(err?.message || 'No se pudo renderizar la vista previa del PDF.');
            }
        } finally {
            if (offscreenCanvas) {
                offscreenCanvas.width = 0;
                offscreenCanvas.height = 0;
            }
        }
    };

    const releaseLoadedDocument = async () => {
        state.previewToken += 1;
        BlobRegistry.revokeScope(PREVIEW_BLOB_SCOPE);

        if (state.pdfDoc) {
            const doc = state.pdfDoc;
            state.pdfDoc = null;
            try {
                await doc.destroy();
            } catch {
                // Ignore cleanup failure
            }
        }

        state.mode = 'none';
        state.fileName = '';
        state.imageDataUrl = null;
        state.totalPages = 1;
        state.currentPage = 1;
    };

    const clearWorkspaceUi = () => {
        if (previewImg) previewImg.removeAttribute('src');
        if (resultTextarea) resultTextarea.value = '';
        if (pageRangeInput) pageRangeInput.value = '';
        if (totalPagesBadge) totalPagesBadge.textContent = AppState.lang === 'en' ? '1 page' : '1 pág';
        if (pageIndicator) pageIndicator.textContent = AppState.lang === 'en' ? 'Page 1 / 1' : 'Pág 1 / 1';

        pageRangeWrap?.classList.add('hidden');
        previewNav?.classList.add('hidden');
        workspace?.classList.add('hidden');
        uploadArea?.classList.remove('hidden');
    };

    const resetWorkspace = async () => {
        if (AppState.busy) return;
        await releaseLoadedDocument();
        clearWorkspaceUi();
    };

    const handleSelectedFiles = async (files) => {
        const file = files?.[0];
        if (!file) return;

        if (AppState.busy) {
            ToastManager.warning(
                AppState.lang === 'en'
                    ? 'Please wait until the current task finishes.'
                    : 'Espera a que termine la operación actual.'
            );
            return;
        }

        const kind = detectFileKind(file);
        if (kind === 'unknown') {
            ToastManager.error(
                AppState.lang === 'en'
                    ? `Unsupported file format: "${file.name}".`
                    : `Formato no soportado: "${file.name}".`
            );
            return;
        }

        AppState.setBusy(true);
        const loadSignal = ProgressModal.open({
            title: AppState.lang === 'en' ? 'Preparing document for OCR...' : 'Preparando archivo para OCR...',
            detail: file.name,
            cancellable: true,
        });

        try {
            await releaseLoadedDocument();

            if (kind === 'pdf') {
                ProgressModal.update({
                    percent: 25,
                    detail: AppState.lang === 'en' ? `Opening ${file.name}...` : `Abriendo ${file.name}...`,
                });
                const { pdfjsDoc } = await runWithAbort(openPdfFile(file), loadSignal);
                if (loadSignal.aborted) {
                    await pdfjsDoc.destroy().catch(() => {});
                    throw new DOMException('Operation aborted', 'AbortError');
                }
                state.mode = 'pdf';
                state.pdfDoc = pdfjsDoc;
                state.totalPages = pdfjsDoc.numPages;
                state.currentPage = 1;
                state.fileName = file.name;

                if (totalPagesBadge) {
                    totalPagesBadge.textContent =
                        AppState.lang === 'en'
                            ? state.totalPages === 1
                                ? '1 page'
                                : `${state.totalPages} pages`
                            : state.totalPages === 1
                              ? '1 pág'
                              : `${state.totalPages} págs`;
                }
                pageRangeWrap?.classList.remove('hidden');
                previewNav?.classList.remove('hidden');
                ProgressModal.update({
                    percent: 70,
                    detail: AppState.lang === 'en' ? 'Rendering preview...' : 'Renderizando vista previa...',
                });
                await runWithAbort(renderPdfPreview(1), loadSignal);
            } else {
                ProgressModal.update({
                    percent: 45,
                    detail: AppState.lang === 'en' ? `Decoding ${file.name}...` : `Decodificando ${file.name}...`,
                });
                const decoded = await runWithAbort(decodeImageFile(file), loadSignal);
                if (loadSignal.aborted) {
                    throw new DOMException('Operation aborted', 'AbortError');
                }
                state.mode = 'image';
                state.imageDataUrl = decoded.dataUrl;
                state.totalPages = 1;
                state.currentPage = 1;
                state.fileName = decoded.name;

                pageRangeWrap?.classList.add('hidden');
                previewNav?.classList.add('hidden');
                if (previewImg) {
                    previewImg.src = decoded.dataUrl;
                }
            }

            if (loadSignal.aborted) {
                throw new DOMException('Operation aborted', 'AbortError');
            }

            ProgressModal.update({ percent: 100 });
            if (resultTextarea) resultTextarea.value = '';
            if (pageRangeInput) pageRangeInput.value = '';
            uploadArea?.classList.add('hidden');
            workspace?.classList.remove('hidden');
        } catch (err) {
            await releaseLoadedDocument();
            clearWorkspaceUi();
            if (err?.name === 'AbortError' || loadSignal.aborted) {
                ToastManager.info(t('toast_cancelled'));
            } else {
                ToastManager.error(
                    err?.message ||
                        (AppState.lang === 'en'
                            ? 'Could not load the file for OCR.'
                            : 'No se pudo cargar el archivo para OCR.')
                );
            }
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
        }
    };

    const runOcr = async () => {
        if (state.mode === 'none' || AppState.busy) return;

        if (!window.Tesseract || typeof window.Tesseract.createWorker !== 'function') {
            ToastManager.error(
                AppState.lang === 'en'
                    ? 'Tesseract OCR library failed to load.'
                    : 'La librería Tesseract OCR no se cargó correctamente.'
            );
            return;
        }

        let pages = [1];
        if (state.mode === 'pdf') {
            try {
                pages = parsePageRange(pageRangeInput?.value || '', state.totalPages);
            } catch (err) {
                ToastManager.warning(err.message);
                pageRangeInput?.focus();
                return;
            }
        }

        const lang = langSelect?.value || 'spa';
        const isMultiPageOutput = state.mode === 'pdf' && (state.totalPages > 1 || pages.length > 1);
        const signal = ProgressModal.open({
            title: AppState.lang === 'en' ? 'Running OCR...' : 'Ejecutando OCR...',
            detail: formatWorkerStatus('loading tesseract core'),
            cancellable: true,
        });

        AppState.setBusy(true);

        let worker = null;
        let workerTerminated = false;
        let activeIndex = 0;
        let highestPercent = 0;

        const terminateWorker = async () => {
            if (!worker || workerTerminated) return;
            workerTerminated = true;
            const instance = worker;
            worker = null;
            try {
                await instance.terminate();
            } catch {
                // Ignore termination error on cancelled worker
            }
        };

        const onSignalAbort = () => {
            void terminateWorker();
        };
        signal.addEventListener('abort', onSignalAbort, { once: true });

        const logger = (message) => {
            if (signal.aborted || !message) return;

            const status = String(message.status || '');
            const progress = Number.isFinite(message.progress)
                ? Math.max(0, Math.min(1, message.progress))
                : 0;

            if (status === 'recognizing text') {
                const overall = 5 + ((activeIndex + progress) / pages.length) * 95;
                highestPercent = Math.max(highestPercent, overall);
                const pageLabel = pages[activeIndex];
                const pagePct = Math.round(progress * 100);
                const detail =
                    pages.length > 1
                        ? `Pág ${pageLabel} (${activeIndex + 1}/${pages.length}) · ${pagePct}%`
                        : `${formatWorkerStatus(status)} · ${pagePct}%`;
                ProgressModal.update({ percent: highestPercent, detail });
                return;
            }

            if (activeIndex === 0) {
                const initPercent = Math.min(5, progress * 5);
                highestPercent = Math.max(highestPercent, initPercent);
                ProgressModal.update({
                    percent: highestPercent,
                    detail: formatWorkerStatus(status),
                });
            }
        };

        try {
            const createPromise = window.Tesseract.createWorker(lang, 1, { logger });
            createPromise
                .then((createdWorker) => {
                    if ((signal.aborted || workerTerminated) && createdWorker && createdWorker !== worker) {
                        createdWorker.terminate?.().catch(() => {});
                    }
                })
                .catch(() => {});
            worker = await runWithAbort(createPromise, signal);

            if (signal.aborted) {
                await terminateWorker();
                throw new DOMException('Operation aborted', 'AbortError');
            }

            const chunks = [];

            for (let i = 0; i < pages.length; i++) {
                if (signal.aborted) {
                    throw new DOMException('Operation aborted', 'AbortError');
                }

                activeIndex = i;
                const pageNum = pages[i];
                let ocrResult;

                if (state.mode === 'pdf' && state.pdfDoc) {
                    const page = await runWithAbort(state.pdfDoc.getPage(pageNum), signal);
                    const baseVp = page.getViewport({ scale: 1 });
                    page.cleanup();
                    if (signal.aborted) {
                        throw new DOMException('Operation aborted', 'AbortError');
                    }
                    const maxDim = Math.max(baseVp.width, baseVp.height, 1);
                    const ocrScale = Math.min(2.0, Math.max(1.2, 2600 / maxDim));

                    let pageCanvas = null;
                    try {
                        const rendered = await runWithAbort(
                            renderPdfPageToCanvas(state.pdfDoc, pageNum, ocrScale),
                            signal
                        );
                        pageCanvas = rendered.canvas;
                        ocrResult = await runWithAbort(worker.recognize(pageCanvas), signal);
                    } finally {
                        if (pageCanvas) {
                            pageCanvas.width = 0;
                            pageCanvas.height = 0;
                        }
                    }
                } else {
                    ocrResult = await runWithAbort(worker.recognize(state.imageDataUrl), signal);
                }

                const extracted = String(ocrResult?.data?.text || '').trim();
                if (isMultiPageOutput) {
                    chunks.push(`--- Página ${pageNum} / ${state.totalPages} ---\n${extracted}`);
                } else {
                    chunks.push(extracted);
                }

                if (resultTextarea) {
                    resultTextarea.value = chunks.join('\n\n');
                }
            }

            ProgressModal.update({ percent: 100 });
            ToastManager.success(t('toast_ocr_done', { pages: pages.length }));
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
            } else {
                console.error('[OCR] Error:', err);
                ToastManager.error(
                    err?.message ||
                        (AppState.lang === 'en'
                            ? 'OCR recognition failed.'
                            : 'No se pudo completar el reconocimiento OCR.')
                );
            }
        } finally {
            signal.removeEventListener('abort', onSignalAbort);
            await terminateWorker();
            ProgressModal.close();
            AppState.setBusy(false);
        }
    };

    const copyResultText = async () => {
        const text = resultTextarea?.value || '';
        if (!text.trim()) {
            ToastManager.warning(
                AppState.lang === 'en'
                    ? 'There is no extracted text to copy yet.'
                    : 'No hay texto extraído para copiar todavía.'
            );
            return;
        }

        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                ToastManager.success(t('toast_copied'));
                return;
            }
            throw new Error('Clipboard API unavailable');
        } catch {
            if (resultTextarea) {
                resultTextarea.focus();
                resultTextarea.select();
            }
            ToastManager.warning(t('toast_copy_error'));
        }
    };

    const downloadResultTxt = () => {
        const text = resultTextarea?.value || '';
        if (!text.trim()) {
            ToastManager.warning(
                AppState.lang === 'en'
                    ? 'There is no extracted text to download yet.'
                    : 'No hay texto extraído para descargar todavía.'
            );
            return;
        }

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const filename = buildOutputName({
            originalName: state.fileName || 'documento',
            suffix: 'ocr',
            ext: 'txt',
        });
        BlobRegistry.downloadBlob(blob, filename);
    };

    bindDropzone(dropzone, fileInput, {
        multiple: false,
        onFiles: handleSelectedFiles,
    });

    prevPageBtn?.addEventListener('click', () => {
        if (state.currentPage > 1) {
            void renderPdfPreview(state.currentPage - 1);
        }
    });

    nextPageBtn?.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            void renderPdfPreview(state.currentPage + 1);
        }
    });

    startBtn?.addEventListener('click', () => {
        void runOcr();
    });

    resetBtn?.addEventListener('click', () => {
        void resetWorkspace();
    });

    copyBtn?.addEventListener('click', () => {
        void copyResultText();
    });

    downloadTxtBtn?.addEventListener('click', downloadResultTxt);

    AppState.registerTool('ocr', {
        reset: resetWorkspace,
    });
}
