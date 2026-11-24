import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { clampPdfRenderScale } from '../core/geometry.js';
import { buildOutputName, formatFileSize } from '../core/fileNaming.js';
import { detectFileKind, openPdfFile, loadPdfLibDocument, renderPdfPageToCanvas } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const PT_TO_MM = 25.4 / 72;

const COMPRESS_PRESETS = Object.freeze({
    standard: Object.freeze({ mode: 'structural' }),
    medium: Object.freeze({ mode: 'raster', scale: 1.35, quality: 0.72 }),
    strong: Object.freeze({ mode: 'raster', scale: 1.05, quality: 0.52 }),
});

/**
 * Creates a standardized AbortError for user-cancelled async loops.
 * @returns {Error}
 */
function createAbortError() {
    const err = new Error('Operation aborted');
    err.name = 'AbortError';
    return err;
}

/**
 * Yields to the browser event loop so progress UI and cancel clicks stay responsive.
 * @returns {Promise<void>}
 */
function yieldFrame() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Returns localized UI text for compression status messages not covered by global i18n keys.
 * @param {'progress_title'|'progress_structural'|'progress_page'|'progress_saving'|'suggest_raster'|'no_gain_raster'|'invalid_pdf'|'missing_jspdf'|'error_generic'} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
function msg(key, params = {}) {
    const isEn = AppState.lang === 'en';
    const table = {
        progress_title: isEn ? 'Compressing PDF...' : 'Comprimiendo PDF...',
        progress_structural: isEn ? 'Rebuilding object streams...' : 'Optimizando estructura de objetos...',
        progress_page: isEn
            ? `Optimizing page ${params.current} of ${params.total}...`
            : `Optimizando página ${params.current} de ${params.total}...`,
        progress_saving: isEn ? 'Finalizing PDF...' : 'Generando archivo final...',
        suggest_raster: isEn
            ? 'Standard compression did not shrink this file further. Try "Equilibrada" or "Fuerte" for greater savings.'
            : 'La compresión Estándar no redujo más el peso. Prueba "Equilibrada" o "Fuerte" para mayor ahorro.',
        no_gain_raster: isEn
            ? 'The compressed file was not smaller than the original (try "Estándar" for pure-text PDFs).'
            : 'El archivo resultante no fue menor que el original (prueba "Estándar" en PDFs de solo texto).',
        invalid_pdf: isEn ? 'Please select a valid PDF file.' : 'Por favor, selecciona un archivo PDF válido.',
        missing_jspdf: isEn ? 'jsPDF library failed to load.' : 'La librería jsPDF no se cargó correctamente.',
        error_generic: isEn ? 'Error compressing PDF.' : 'Error al comprimir el PDF.',
    };
    return table[key] || '';
}

/**
 * Compresses a PDF structurally via pdf-lib object streams without rasterizing text.
 * @param {ArrayBuffer} pdfBytes
 * @param {string} fileName
 * @param {AbortSignal} signal
 * @returns {Promise<Blob>}
 */
async function compressStructural(pdfBytes, fileName, signal) {
    if (signal.aborted) throw createAbortError();
    ProgressModal.update({ percent: 25, detail: msg('progress_structural') });

    const pdfDoc = await loadPdfLibDocument(pdfBytes.slice(0), fileName);
    if (signal.aborted) throw createAbortError();

    // Strip redundant document metadata while preserving pages and selectable text
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer('');
    pdfDoc.setCreator('');

    ProgressModal.update({ percent: 70, detail: msg('progress_saving') });
    await yieldFrame();
    if (signal.aborted) throw createAbortError();

    const outBytes = await pdfDoc.save({ useObjectStreams: true });
    if (signal.aborted) throw createAbortError();

    ProgressModal.update({ percent: 100 });
    return new Blob([outBytes], { type: 'application/pdf' });
}

/**
 * Rasterizes PDF pages at a controlled scale and JPEG quality while preserving exact page dimensions in mm.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfjsDoc
 * @param {{ scale: number, quality: number }} preset
 * @param {AbortSignal} signal
 * @returns {Promise<Blob>}
 */
async function compressRaster(pdfjsDoc, preset, signal) {
    const JsPDF = window.jspdf?.jsPDF;
    if (!JsPDF) {
        throw new Error(msg('missing_jspdf'));
    }

    const totalPages = pdfjsDoc.numPages;
    if (totalPages <= 0) {
        throw new Error(t('toast_no_pages'));
    }

    let doc = null;

    for (let i = 1; i <= totalPages; i += 1) {
        if (signal.aborted) throw createAbortError();

        ProgressModal.update({
            percent: ((i - 1) / totalPages) * 92,
            detail: msg('progress_page', { current: i, total: totalPages }),
        });

        const page = await pdfjsDoc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        page.cleanup();
        const wMm = Math.max(1, vp.width * PT_TO_MM);
        const hMm = Math.max(1, vp.height * PT_TO_MM);
        const orientation = wMm > hMm ? 'l' : 'p';

        const safeScale = clampPdfRenderScale(vp.width, vp.height, preset.scale);
        const { canvas } = await renderPdfPageToCanvas(pdfjsDoc, i, safeScale);
        if (signal.aborted) {
            canvas.width = 0;
            canvas.height = 0;
            throw createAbortError();
        }

        const imgData = canvas.toDataURL('image/jpeg', preset.quality);
        // Free canvas backing store immediately to prevent memory spikes on large documents
        canvas.width = 0;
        canvas.height = 0;

        if (!doc) {
            doc = new JsPDF({
                orientation,
                unit: 'mm',
                format: [wMm, hMm],
                compress: true,
            });
        } else {
            doc.addPage([wMm, hMm], orientation);
        }
        doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);

        if (i % 3 === 0) {
            await yieldFrame();
        }
    }

    if (signal.aborted) throw createAbortError();
    ProgressModal.update({ percent: 96, detail: msg('progress_saving') });
    await yieldFrame();
    if (signal.aborted) throw createAbortError();

    const blob = doc.output('blob');
    ProgressModal.update({ percent: 100 });
    return blob;
}

/**
 * Formats comparison stats for the compression result banner.
 * @param {number} origBytes
 * @param {number} newBytes
 * @returns {{ badgeText: string, improved: boolean }}
 */
function formatCompressionDiff(origBytes, newBytes) {
    if (origBytes <= 0) {
        return { badgeText: '0%', improved: false };
    }
    if (newBytes < origBytes) {
        const pct = (((origBytes - newBytes) / origBytes) * 100).toFixed(1);
        return { badgeText: pct === '0.0' ? '0%' : `-${pct}%`, improved: pct !== '0.0' };
    }
    if (newBytes === origBytes) {
        return { badgeText: '0%', improved: false };
    }
    const incPct = (((newBytes - origBytes) / origBytes) * 100).toFixed(1);
    return {
        badgeText: incPct === '0.0' ? '0%' : `+${incPct}% (${AppState.lang === 'en' ? 'larger' : 'sin ahorro'})`,
        improved: false,
    };
}

/**
 * Initializes the Compress PDF tool inside `#section-compress`.
 */
export function initCompressTool() {
    const uploadArea = document.getElementById('compress-upload-area');
    const dropzoneEl = document.getElementById('compress-dropzone');
    const fileInputEl = document.getElementById('file-input-compress');
    const workspaceEl = document.getElementById('compress-workspace');
    const fileNameEl = document.getElementById('compress-file-name');
    const origSizeEl = document.getElementById('compress-orig-size');
    const pageCountEl = document.getElementById('compress-page-count');
    const resultBannerEl = document.getElementById('compress-result-banner');
    const sizeBeforeEl = document.getElementById('compress-size-before');
    const sizeAfterEl = document.getElementById('compress-size-after');
    const savingsBadgeEl = document.getElementById('compress-savings-badge');
    const downloadBtn = document.getElementById('compress-download-btn');
    const printBtn = document.getElementById('compress-print-btn');
    const resetBtn = document.getElementById('compress-reset-btn');
    const levelRadios = document.querySelectorAll('input[name="compress-level"]');

    if (!uploadArea || !dropzoneEl || !fileInputEl || !workspaceEl) return;

    /** @type {{ file: File | null, bytes: ArrayBuffer | null, pdfjsDoc: import('pdfjs-dist').PDFDocumentProxy | null, cachedLevel: string | null, cachedBlob: Blob | null }} */
    const state = {
        file: null,
        bytes: null,
        pdfjsDoc: null,
        cachedLevel: null,
        cachedBlob: null,
    };

    const getSelectedLevel = () => {
        const checked = document.querySelector('input[name="compress-level"]:checked');
        const val = checked?.value || 'medium';
        return Object.hasOwn(COMPRESS_PRESETS, val) ? val : 'medium';
    };

    const clearResultBanner = () => {
        if (resultBannerEl) resultBannerEl.classList.add('hidden');
        if (sizeBeforeEl) sizeBeforeEl.textContent = '—';
        if (sizeAfterEl) sizeAfterEl.textContent = '—';
        if (savingsBadgeEl) {
            savingsBadgeEl.textContent = '—';
            savingsBadgeEl.classList.remove('badge-warning');
            savingsBadgeEl.classList.add('badge-success');
        }
    };

    const showResultBanner = (origBytes, newBytes, level) => {
        const { badgeText, improved } = formatCompressionDiff(origBytes, newBytes);
        if (sizeBeforeEl) sizeBeforeEl.textContent = formatFileSize(origBytes);
        if (sizeAfterEl) sizeAfterEl.textContent = formatFileSize(newBytes);
        if (savingsBadgeEl) {
            savingsBadgeEl.textContent = badgeText;
            savingsBadgeEl.classList.toggle('badge-success', improved);
            savingsBadgeEl.classList.toggle('badge-warning', !improved);
        }
        if (resultBannerEl) resultBannerEl.classList.remove('hidden');

        if (newBytes >= origBytes) {
            if (level === 'standard') {
                ToastManager.warning(msg('suggest_raster'));
            } else {
                ToastManager.info(msg('no_gain_raster'));
            }
            return;
        }

        ToastManager.success(
            t('toast_compress_done', {
                before: formatFileSize(origBytes),
                after: formatFileSize(newBytes),
                pct: badgeText,
            })
        );
    };

    const cleanupPdfDoc = async () => {
        if (state.pdfjsDoc) {
            try {
                await state.pdfjsDoc.destroy();
            } catch {
                // Ignore cleanup errors
            }
            state.pdfjsDoc = null;
        }
    };

    const resetTool = async () => {
        if (AppState.busy) return;
        await cleanupPdfDoc();
        state.file = null;
        state.bytes = null;
        state.cachedLevel = null;
        state.cachedBlob = null;
        fileInputEl.value = '';
        if (fileNameEl) fileNameEl.textContent = '—';
        if (origSizeEl) origSizeEl.textContent = '—';
        if (pageCountEl) pageCountEl.textContent = '—';
        clearResultBanner();
        workspaceEl.classList.add('hidden');
        uploadArea.classList.remove('hidden');
    };

    const loadFile = async (files) => {
        const file = files?.[0];
        if (!file || AppState.busy) return;

        if (detectFileKind(file) !== 'pdf') {
            ToastManager.error(msg('invalid_pdf'));
            return;
        }

        try {
            const { bytes, pdfjsDoc } = await openPdfFile(file);
            if (pdfjsDoc.numPages <= 0) {
                await pdfjsDoc.destroy();
                ToastManager.warning(t('toast_no_pages'));
                return;
            }

            await cleanupPdfDoc();
            state.file = file;
            state.bytes = bytes;
            state.pdfjsDoc = pdfjsDoc;
            state.cachedLevel = null;
            state.cachedBlob = null;

            if (fileNameEl) fileNameEl.textContent = file.name;
            if (origSizeEl) origSizeEl.textContent = formatFileSize(file.size);
            if (pageCountEl) pageCountEl.textContent = String(pdfjsDoc.numPages);
            clearResultBanner();

            uploadArea.classList.add('hidden');
            workspaceEl.classList.remove('hidden');
            window.lucide?.createIcons?.();
        } catch (err) {
            console.error('[compress] Load error:', err);
            ToastManager.error(err?.message || msg('invalid_pdf'));
        }
    };

    const runCompression = async () => {
        if (!state.file || !state.bytes || !state.pdfjsDoc || AppState.busy) return null;

        const level = getSelectedLevel();
        if (state.cachedBlob && state.cachedLevel === level) {
            return { blob: state.cachedBlob, level, fromCache: true };
        }

        const preset = COMPRESS_PRESETS[level];
        const signal = ProgressModal.open({
            title: msg('progress_title'),
            detail: '',
            cancellable: true,
        });
        AppState.setBusy(true);

        try {
            const blob =
                preset.mode === 'structural'
                    ? await compressStructural(state.bytes, state.file.name, signal)
                    : await compressRaster(state.pdfjsDoc, preset, signal);

            if (signal.aborted) {
                throw createAbortError();
            }

            state.cachedLevel = level;
            state.cachedBlob = blob;
            showResultBanner(state.file.size, blob.size, level);
            return { blob, level, fromCache: false };
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
            } else {
                console.error('[compress] Compression error:', err);
                ToastManager.error(err?.message || msg('error_generic'));
            }
            return null;
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
        }
    };

    bindDropzone(dropzoneEl, fileInputEl, {
        multiple: false,
        onFiles: loadFile,
    });

    for (const radio of levelRadios) {
        radio.addEventListener('change', () => {
            state.cachedBlob = null;
            state.cachedLevel = null;
            clearResultBanner();
        });
    }

    downloadBtn?.addEventListener('click', async () => {
        const result = await runCompression();
        if (!result || !state.file) return;
        const outputName = buildOutputName({
            originalName: state.file.name,
            suffix: 'comprimido',
            ext: 'pdf',
        });
        BlobRegistry.downloadBlob(result.blob, outputName);
    });

    printBtn?.addEventListener('click', async () => {
        const result = await runCompression();
        if (!result) return;
        PrintService.printPdfBlob(result.blob);
    });

    resetBtn?.addEventListener('click', () => {
        void resetTool();
    });

    AppState.registerTool('compress', {
        reset: () => void resetTool(),
    });
}
