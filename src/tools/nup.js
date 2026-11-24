import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import { PAPER_SIZES, computeContainRect } from '../core/geometry.js';
import { openPdfFile, loadPdfLibDocument, detectFileKind } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const MM_TO_PT = 72 / 25.4;
const MARGIN_PT = 20;
const GAP_PT = 10;
const VALID_COUNTS = new Set([2, 4, 6, 9]);

/**
 * Creates a standardized AbortError for user-cancelled operations.
 * @returns {Error}
 */
function createAbortError() {
    const err = new Error('Operation aborted');
    err.name = 'AbortError';
    return err;
}

/**
 * Yields control back to the browser event loop.
 * @returns {Promise<void>}
 */
function yieldFrame() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Returns localized status strings for the N-Up tool.
 * @param {'progress_title'|'progress_loading'|'progress_page'|'progress_saving'|'invalid_pdf'|'missing_pdflib'|'error_generic'} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
function msg(key, params = {}) {
    const isEn = AppState.lang === 'en';
    const table = {
        progress_title: isEn ? 'Generating N-Up PDF...' : 'Resumiendo PDF (N-Up)...',
        progress_loading: isEn ? 'Embedding source pages...' : 'Preparando páginas de origen...',
        progress_page: isEn
            ? `Laying out page ${params.current} of ${params.total}...`
            : `Componiendo página ${params.current} de ${params.total}...`,
        progress_saving: isEn ? 'Building output PDF...' : 'Generando PDF final...',
        invalid_pdf: isEn ? 'Please select a valid PDF file.' : 'Por favor, selecciona un archivo PDF válido.',
        missing_pdflib: isEn ? 'pdf-lib library failed to load.' : 'La librería pdf-lib no se cargó correctamente.',
        error_generic: isEn ? 'Error creating N-Up PDF.' : 'Error al generar el PDF resumido.',
    };
    return table[key] || '';
}

/**
 * Normalizes a rotation angle to 0, 90, 180, or 270 degrees.
 * @param {number | undefined} angle
 * @returns {0 | 90 | 180 | 270}
 */
function normalizeRightAngle(angle) {
    const snapped = Math.round((Number(angle) || 0) / 90) * 90;
    const mod = ((snapped % 360) + 360) % 360;
    if (mod === 90 || mod === 180 || mod === 270) return mod;
    return 0;
}

/**
 * Returns grid column/row counts for a given N-Up count and sheet orientation.
 * @param {number} pagesPerSheet
 * @param {'p'|'l'} orient
 * @returns {{ cols: number, rows: number }}
 */
function getNupGrid(pagesPerSheet, orient) {
    if (pagesPerSheet === 2) {
        return orient === 'l' ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 };
    }
    if (pagesPerSheet === 4) {
        return { cols: 2, rows: 2 };
    }
    if (pagesPerSheet === 6) {
        return orient === 'l' ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
    }
    return { cols: 3, rows: 3 };
}

/**
 * Resolves sheet dimensions in PDF points and optimal grid arrangement.
 * When `orientation === 'auto'`, picks portrait or landscape to maximize embedded scale.
 * @param {object} opts
 * @param {number} opts.pagesPerSheet
 * @param {string} opts.paperKey
 * @param {'auto'|'p'|'l'} opts.orientation
 * @param {number} opts.firstVisW
 * @param {number} opts.firstVisH
 */
function resolveNupLayout({ pagesPerSheet, paperKey, orientation, firstVisW, firstVisH }) {
    const spec = PAPER_SIZES[paperKey] || PAPER_SIZES.letter;
    const shortPt = Math.min(spec.w, spec.h) * MM_TO_PT;
    const longPt = Math.max(spec.w, spec.h) * MM_TO_PT;
    const safeW = Math.max(1, firstVisW);
    const safeH = Math.max(1, firstVisH);

    const evaluate = (orient) => {
        const sheetW = orient === 'l' ? longPt : shortPt;
        const sheetH = orient === 'l' ? shortPt : longPt;
        const { cols, rows } = getNupGrid(pagesPerSheet, orient);
        const cellW = Math.max(1, (sheetW - MARGIN_PT * 2 - GAP_PT * (cols - 1)) / cols);
        const cellH = Math.max(1, (sheetH - MARGIN_PT * 2 - GAP_PT * (rows - 1)) / rows);
        const scale = Math.min(cellW / safeW, cellH / safeH);
        return { orient, sheetW, sheetH, cols, rows, cellW, cellH, scale };
    };

    if (orientation === 'p' || orientation === 'l') {
        return evaluate(orientation);
    }

    const portrait = evaluate('p');
    const landscape = evaluate('l');
    return landscape.scale > portrait.scale ? landscape : portrait;
}

/**
 * Draws an embedded PDF page inside `(rect.x, rect.y, rect.w, rect.h)` while respecting
 * the source page's `/Rotate` attribute so rotated pages never draw sideways.
 * @param {import('pdf-lib').PDFPage} targetPage
 * @param {import('pdf-lib').PDFEmbeddedPage} embeddedPage
 * @param {0|90|180|270} rotDeg
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {(deg: number) => unknown} degreesFn
 */
function drawOrientedEmbeddedPage(targetPage, embeddedPage, rotDeg, rect, degreesFn) {
    if (rotDeg === 90) {
        targetPage.drawPage(embeddedPage, {
            x: rect.x,
            y: rect.y + rect.h,
            width: rect.h,
            height: rect.w,
            rotate: degreesFn(-90),
        });
        return;
    }
    if (rotDeg === 180) {
        targetPage.drawPage(embeddedPage, {
            x: rect.x + rect.w,
            y: rect.y + rect.h,
            width: rect.w,
            height: rect.h,
            rotate: degreesFn(180),
        });
        return;
    }
    if (rotDeg === 270) {
        targetPage.drawPage(embeddedPage, {
            x: rect.x + rect.w,
            y: rect.y,
            width: rect.h,
            height: rect.w,
            rotate: degreesFn(90),
        });
        return;
    }
    targetPage.drawPage(embeddedPage, {
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
    });
}

/**
 * Initializes the N-Up PDF tool inside `#section-nup`.
 */
export function initNupTool() {
    const uploadArea = document.getElementById('nup-upload-area');
    const dropzoneEl = document.getElementById('nup-dropzone');
    const fileInputEl = document.getElementById('file-input-nup');
    const optionsEl = document.getElementById('nup-options');
    const fileNameEl = document.getElementById('nup-file-name');
    const pageCountEl = document.getElementById('nup-page-count');
    const countSelect = document.getElementById('nup-count');
    const paperSelect = document.getElementById('nup-paper-size');
    const orientationSelect = document.getElementById('nup-orientation');
    const borderToggle = document.getElementById('nup-border-toggle');
    const downloadBtn = document.getElementById('nup-download-btn');
    const printBtn = document.getElementById('nup-print-btn');
    const resetBtn = document.getElementById('nup-reset-btn');

    if (!uploadArea || !dropzoneEl || !fileInputEl || !optionsEl) return;

    /** @type {{ file: File | null, bytes: ArrayBuffer | null, pageCount: number, cacheKey: string | null, cachedBlob: Blob | null, cachedOutPages: number }} */
    const state = {
        file: null,
        bytes: null,
        pageCount: 0,
        cacheKey: null,
        cachedBlob: null,
        cachedOutPages: 0,
    };

    const getSettings = () => {
        const rawCount = Number.parseInt(countSelect?.value || '6', 10);
        const pagesPerSheet = VALID_COUNTS.has(rawCount) ? rawCount : 6;
        const paperKey = paperSelect?.value && PAPER_SIZES[paperSelect.value] ? paperSelect.value : 'letter';
        const rawOrient = orientationSelect?.value || 'auto';
        const orientation = rawOrient === 'p' || rawOrient === 'l' ? rawOrient : 'auto';
        const drawBorder = Boolean(borderToggle?.checked);
        return { pagesPerSheet, paperKey, orientation, drawBorder };
    };

    const invalidateCache = () => {
        state.cacheKey = null;
        state.cachedBlob = null;
        state.cachedOutPages = 0;
    };

    const resetTool = () => {
        if (AppState.busy) return;
        state.file = null;
        state.bytes = null;
        state.pageCount = 0;
        invalidateCache();
        fileInputEl.value = '';
        if (fileNameEl) fileNameEl.textContent = '—';
        if (pageCountEl) pageCountEl.textContent = '—';
        optionsEl.classList.add('hidden');
        uploadArea.classList.remove('hidden');
    };

    const handleFiles = async (files) => {
        const file = files?.[0];
        if (!file || AppState.busy) return;

        if (detectFileKind(file) !== 'pdf') {
            ToastManager.error(msg('invalid_pdf'));
            return;
        }

        try {
            const { bytes, pdfjsDoc } = await openPdfFile(file);
            const numPages = pdfjsDoc.numPages;
            await pdfjsDoc.destroy().catch(() => {});

            if (numPages <= 0) {
                ToastManager.warning(t('toast_no_pages'));
                return;
            }

            state.file = file;
            state.bytes = bytes;
            state.pageCount = numPages;
            invalidateCache();

            if (fileNameEl) fileNameEl.textContent = file.name;
            if (pageCountEl) pageCountEl.textContent = String(numPages);

            uploadArea.classList.add('hidden');
            optionsEl.classList.remove('hidden');
            window.lucide?.createIcons?.();
        } catch (err) {
            console.error('[nup] Load error:', err);
            ToastManager.error(err?.message || msg('invalid_pdf'));
        }
    };

    const buildNupPdf = async () => {
        if (!state.file || !state.bytes || AppState.busy) return null;

        const settings = getSettings();
        const key = `${settings.pagesPerSheet}|${settings.paperKey}|${settings.orientation}|${settings.drawBorder}`;
        if (state.cachedBlob && state.cacheKey === key) {
            return { blob: state.cachedBlob, outPages: state.cachedOutPages, settings };
        }

        const pdfLib = window.PDFLib;
        if (!pdfLib?.PDFDocument) {
            ToastManager.error(msg('missing_pdflib'));
            return null;
        }

        const { PDFDocument, degrees, rgb } = pdfLib;
        const signal = ProgressModal.open({
            title: msg('progress_title'),
            detail: msg('progress_loading'),
            cancellable: true,
        });
        AppState.setBusy(true);

        try {
            if (signal.aborted) throw createAbortError();

            const srcDoc = await loadPdfLibDocument(state.bytes.slice(0), state.file.name);
            const srcPages = srcDoc.getPages();
            if (!srcPages.length) {
                ToastManager.warning(t('toast_no_pages'));
                return null;
            }

            const newDoc = await PDFDocument.create();
            const embeddedPages = await newDoc.embedPages(srcPages);
            if (signal.aborted) throw createAbortError();

            const firstRot = normalizeRightAngle(srcPages[0].getRotation()?.angle);
            const firstRawW = embeddedPages[0].width;
            const firstRawH = embeddedPages[0].height;
            const firstVisW = firstRot === 90 || firstRot === 270 ? firstRawH : firstRawW;
            const firstVisH = firstRot === 90 || firstRot === 270 ? firstRawW : firstRawH;

            const layout = resolveNupLayout({
                pagesPerSheet: settings.pagesPerSheet,
                paperKey: settings.paperKey,
                orientation: settings.orientation,
                firstVisW,
                firstVisH,
            });

            const itemsPerSheet = layout.cols * layout.rows;
            const total = embeddedPages.length;
            let currentSheet = null;
            let outPages = 0;

            for (let i = 0; i < total; i += 1) {
                if (signal.aborted) throw createAbortError();

                const posIdx = i % itemsPerSheet;
                if (posIdx === 0) {
                    currentSheet = newDoc.addPage([layout.sheetW, layout.sheetH]);
                    outPages += 1;
                }

                ProgressModal.update({
                    percent: 15 + ((i + 1) / total) * 75,
                    detail: msg('progress_page', { current: i + 1, total }),
                });

                const col = posIdx % layout.cols;
                const row = Math.floor(posIdx / layout.cols);
                const cellX = MARGIN_PT + col * (layout.cellW + GAP_PT);
                const cellY = layout.sheetH - MARGIN_PT - (row + 1) * layout.cellH - row * GAP_PT;

                const embedded = embeddedPages[i];
                const rotDeg = normalizeRightAngle(srcPages[i].getRotation()?.angle);
                const visW = rotDeg === 90 || rotDeg === 270 ? embedded.height : embedded.width;
                const visH = rotDeg === 90 || rotDeg === 270 ? embedded.width : embedded.height;

                const rect = computeContainRect(visW, visH, cellX, cellY, layout.cellW, layout.cellH);
                if (visW > 0 && visH > 0) {
                    drawOrientedEmbeddedPage(currentSheet, embedded, rotDeg, rect, degrees);
                }

                if (settings.drawBorder) {
                    currentSheet.drawRectangle({
                        x: rect.x,
                        y: rect.y,
                        width: rect.w,
                        height: rect.h,
                        borderColor: rgb(0.74, 0.77, 0.82),
                        borderWidth: 0.6,
                    });
                }

                if ((i + 1) % 12 === 0) {
                    await yieldFrame();
                }
            }

            if (signal.aborted) throw createAbortError();
            ProgressModal.update({ percent: 94, detail: msg('progress_saving') });
            await yieldFrame();
            if (signal.aborted) throw createAbortError();

            const outBytes = await newDoc.save({ useObjectStreams: true });
            if (signal.aborted) throw createAbortError();

            const blob = new Blob([outBytes], { type: 'application/pdf' });
            state.cacheKey = key;
            state.cachedBlob = blob;
            state.cachedOutPages = outPages;
            ProgressModal.update({ percent: 100 });

            return { blob, outPages, settings };
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
            } else {
                console.error('[nup] Generation error:', err);
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
        onFiles: handleFiles,
    });

    for (const control of [countSelect, paperSelect, orientationSelect, borderToggle]) {
        control?.addEventListener('change', invalidateCache);
    }

    downloadBtn?.addEventListener('click', async () => {
        const result = await buildNupPdf();
        if (!result || !state.file) return;
        const outputName = buildOutputName({
            originalName: state.file.name,
            suffix: `resumido_${result.settings.pagesPerSheet}en1`,
            pageCount: result.outPages,
            ext: 'pdf',
        });
        BlobRegistry.downloadBlob(result.blob, outputName);
        ToastManager.success(t('toast_saved_pdf', { name: outputName }));
    });

    printBtn?.addEventListener('click', async () => {
        const result = await buildNupPdf();
        if (!result) return;
        PrintService.printPdfBlob(result.blob);
    });

    resetBtn?.addEventListener('click', resetTool);

    AppState.registerTool('nup', {
        reset: resetTool,
    });
}
