import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import { openPdfFile, loadPdfLibDocument } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const msg = (es, en) => (AppState.lang === 'en' ? en : es);

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

function yieldToUi() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Formats a page number label according to selected format and active UI language.
 * @param {'n'|'p-n'|'n-of-total'} format
 * @param {number} currentNum
 * @param {number} totalNum
 * @returns {string}
 */
function formatPageLabel(format, currentNum, totalNum) {
    const isEn = AppState.lang === 'en';
    if (format === 'n') {
        return `${currentNum}`;
    }
    if (format === 'p-n') {
        return isEn ? `Page ${currentNum}` : `Página ${currentNum}`;
    }
    return isEn ? `${currentNum} of ${totalNum}` : `${currentNum} de ${totalNum}`;
}

/**
 * Initializes the PDF Page Numbers tool (`#section-pagenumbers`).
 */
export function initPageNumbersTool() {
    const uploadArea = document.getElementById('pagenum-upload-area');
    const dropzone = document.getElementById('pagenum-dropzone');
    const fileInput = document.getElementById('file-input-pagenum');
    const workspace = document.getElementById('pagenum-workspace');

    const positionSelect = document.getElementById('pn-position');
    const formatSelect = document.getElementById('pn-format');
    const startInput = document.getElementById('pn-start');
    const sizeInput = document.getElementById('pn-size');
    const skipFirstCheckbox = document.getElementById('pn-skip-first');

    const downloadBtn = document.getElementById('pn-download-btn');
    const printBtn = document.getElementById('pn-print-btn');
    const resetBtn = document.getElementById('pn-reset-btn');

    if (!dropzone || !fileInput || !workspace) return;

    const state = {
        pdfBytes: null,
        fileName: '',
        pageCount: 0,
        busy: false,
    };

    const normalizeNumericInputs = () => {
        if (startInput) {
            const parsedStart = Math.max(1, parseInt(startInput.value, 10) || 1);
            startInput.value = String(parsedStart);
        }
        if (sizeInput) {
            const parsedSize = clamp(parseInt(sizeInput.value, 10) || 11, 7, 36);
            sizeInput.value = String(parsedSize);
        }
    };

    const resetWorkspace = () => {
        state.pdfBytes = null;
        state.fileName = '';
        state.pageCount = 0;
        fileInput.value = '';
        workspace.classList.add('hidden');
        uploadArea?.classList.remove('hidden');
    };

    const handleSelectedFile = async (files) => {
        const file = files?.[0];
        if (!file || state.busy) return;
        state.busy = true;
        AppState.setBusy(true);

        const signal = ProgressModal.open({
            title: msg('Validando PDF...', 'Validating PDF...'),
            detail: file.name,
            cancellable: true,
        });

        let pdfjsDoc = null;
        try {
            const opened = await openPdfFile(file);
            pdfjsDoc = opened.pdfjsDoc;

            if (signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
                return;
            }

            state.pdfBytes = opened.bytes;
            state.fileName = file.name;
            state.pageCount = pdfjsDoc.numPages;

            uploadArea?.classList.add('hidden');
            workspace.classList.remove('hidden');
            ToastManager.info(
                msg(
                    `PDF listo (${state.pageCount} página${state.pageCount === 1 ? '' : 's'}).`,
                    `PDF ready (${state.pageCount} page${state.pageCount === 1 ? '' : 's'}).`
                )
            );
        } catch (err) {
            ToastManager.error(err?.message || msg('No se pudo abrir el PDF.', 'Could not open the PDF.'));
        } finally {
            if (pdfjsDoc) {
                try {
                    await pdfjsDoc.destroy();
                } catch {
                    // Ignore cleanup errors
                }
            }
            ProgressModal.close();
            state.busy = false;
            AppState.setBusy(false);
        }
    };

    const buildNumberedPdfBlob = async (signal) => {
        normalizeNumericInputs();

        const position = positionSelect?.value || 'bottom-center';
        const format = formatSelect?.value || 'n-of-total';
        const startNum = Math.max(1, parseInt(startInput?.value, 10) || 1);
        const fontSize = clamp(parseInt(sizeInput?.value, 10) || 11, 7, 36);
        const skipFirst = Boolean(skipFirstCheckbox?.checked);

        const doc = await loadPdfLibDocument(state.pdfBytes, state.fileName);
        const pages = doc.getPages();
        const pageTotal = pages.length;

        if (pageTotal === 0) {
            ToastManager.error(t('toast_no_pages'));
            return null;
        }

        if (skipFirst && pageTotal <= 1) {
            ToastManager.warning(
                msg(
                    'El documento solo tiene 1 página y marcaste omitir la primera.',
                    'The document has only 1 page and "skip first page" is enabled.'
                )
            );
            return null;
        }

        const font = await doc.embedFont(window.PDFLib.StandardFonts.Helvetica);
        const numberedCount = skipFirst ? pageTotal - 1 : pageTotal;
        const totalLabelNum = startNum + numberedCount - 1;
        const textHeight = font.heightAtSize(fontSize);

        for (let idx = 0; idx < pageTotal; idx++) {
            if (signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            if (skipFirst && idx === 0) {
                continue;
            }

            const page = pages[idx];
            const box = page.getCropBox();
            const pageRot = ((page.getRotation().angle % 360) + 360) % 360;
            const swapDims = pageRot === 90 || pageRot === 270;
            const visW = swapDims ? box.height : box.width;
            const visH = swapDims ? box.width : box.height;

            const sequenceIndex = skipFirst ? idx - 1 : idx;
            const currentNum = startNum + sequenceIndex;
            const label = formatPageLabel(format, currentNum, totalLabelNum);

            const textWidth = font.widthOfTextAtSize(label, fontSize);
            const marginX = Math.min(28, Math.max(8, visW * 0.05));
            const marginY = Math.min(22, Math.max(8, visH * 0.04));

            let vx;
            if (position.endsWith('left')) {
                vx = marginX;
            } else if (position.endsWith('center')) {
                vx = (visW - textWidth) / 2;
            } else {
                vx = visW - textWidth - marginX;
            }

            let vy;
            if (position.startsWith('top')) {
                vy = visH - marginY - textHeight * 0.72;
            } else {
                vy = marginY;
            }

            vx = clamp(vx, 4, Math.max(4, visW - textWidth - 4));
            vy = clamp(vy, 4, Math.max(4, visH - textHeight - 4));

            let x;
            let y;
            if (pageRot === 90) {
                x = box.x + box.width - vy;
                y = box.y + vx;
            } else if (pageRot === 180) {
                x = box.x + box.width - vx;
                y = box.y + box.height - vy;
            } else if (pageRot === 270) {
                x = box.x + vy;
                y = box.y + box.height - vx;
            } else {
                x = box.x + vx;
                y = box.y + vy;
            }

            page.drawText(label, {
                x,
                y,
                size: fontSize,
                font,
                color: window.PDFLib.rgb(0, 0, 0),
                rotate: window.PDFLib.degrees(pageRot),
            });

            if (idx % 12 === 0 || idx === pageTotal - 1) {
                ProgressModal.update({
                    percent: Math.round(((idx + 1) / pageTotal) * 85),
                    detail: msg(`Numerando página ${idx + 1} de ${pageTotal}...`, `Numbering page ${idx + 1} of ${pageTotal}...`),
                });
                await yieldToUi();
            }
        }

        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        ProgressModal.update({ percent: 95, detail: msg('Guardando PDF...', 'Saving PDF...') });
        const pdfBytes = await doc.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    };

    const runExport = async (forPrint) => {
        if (!state.pdfBytes || state.busy) return;
        state.busy = true;
        AppState.setBusy(true);

        const signal = ProgressModal.open({
            title: forPrint
                ? msg('Preparando impresión...', 'Preparing print...')
                : msg('Numerando páginas...', 'Numbering pages...'),
            detail: state.fileName,
            cancellable: true,
        });

        try {
            const blob = await buildNumberedPdfBlob(signal);
            if (!blob) return;

            if (forPrint) {
                PrintService.printPdfBlob(blob);
            } else {
                const outputName = buildOutputName({
                    originalName: state.fileName,
                    suffix: 'numerado',
                });
                BlobRegistry.downloadBlob(blob, outputName);
                ToastManager.success(t('toast_saved_pdf', { name: outputName }));
            }
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
            } else {
                ToastManager.error(err?.message || msg('Error al numerar el PDF.', 'Error numbering PDF.'));
            }
        } finally {
            ProgressModal.close();
            state.busy = false;
            AppState.setBusy(false);
        }
    };

    bindDropzone(dropzone, fileInput, {
        multiple: false,
        onFiles: handleSelectedFile,
    });

    startInput?.addEventListener('change', normalizeNumericInputs);
    sizeInput?.addEventListener('change', normalizeNumericInputs);

    downloadBtn?.addEventListener('click', () => runExport(false));
    printBtn?.addEventListener('click', () => runExport(true));
    resetBtn?.addEventListener('click', resetWorkspace);

    AppState.registerTool('pagenumbers', {});
}
