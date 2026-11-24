import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import { openPdfFile, loadPdfLibDocument, renderPdfPageToCanvas } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const msg = (es, en) => (AppState.lang === 'en' ? en : es);

/**
 * Parses a #RRGGBB hex string into normalized [0..1] RGB components.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgbUnit(hex) {
    const clean = /^#?[0-9a-f]{6}$/i.test(String(hex || ''))
        ? String(hex).replace('#', '')
        : 'dc2626';
    return {
        r: parseInt(clean.slice(0, 2), 16) / 255,
        g: parseInt(clean.slice(2, 4), 16) / 255,
        b: parseInt(clean.slice(4, 6), 16) / 255,
    };
}

/**
 * Normalizes and filters text so every character is encodable in pdf-lib WinAnsi,
 * attempting diacritic-stripped ASCII fallbacks before removing unsupported symbols.
 * @param {string} rawText
 * @param {import('pdf-lib').PDFFont} font
 * @returns {{ safeText: string, hadStripped: boolean }}
 */
function sanitizeWinAnsiText(rawText, font) {
    const normalized = String(rawText ?? '').normalize('NFC');
    let safeText = '';
    let hadStripped = false;

    for (const ch of normalized) {
        if (ch === '\n' || ch === '\r' || ch === '\t') {
            safeText += ' ';
            continue;
        }
        try {
            font.encodeText(ch);
            safeText += ch;
        } catch {
            const asciiFallback = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            let replaced = '';
            for (const bCh of asciiFallback) {
                try {
                    font.encodeText(bCh);
                    replaced += bCh;
                } catch {
                    // Unsupported symbol
                }
            }
            if (replaced) {
                safeText += replaced;
            } else {
                hadStripped = true;
            }
        }
    }

    return { safeText, hadStripped };
}

function yieldToUi() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Initializes the PDF Watermark tool (`#section-watermark`).
 */
export function initWatermarkTool() {
    const uploadArea = document.getElementById('watermark-upload-area');
    const dropzone = document.getElementById('watermark-dropzone');
    const fileInput = document.getElementById('file-input-watermark');
    const workspace = document.getElementById('watermark-workspace');

    const textInput = document.getElementById('wm-text');
    const colorInput = document.getElementById('wm-color');
    const opacityInput = document.getElementById('wm-opacity');
    const opacityVal = document.getElementById('wm-opacity-val');
    const rotationInput = document.getElementById('wm-rotation');
    const rotationVal = document.getElementById('wm-rotation-val');
    const sizeInput = document.getElementById('wm-size');
    const sizeVal = document.getElementById('wm-size-val');

    const previewCanvas = document.getElementById('wm-preview-canvas');
    const downloadBtn = document.getElementById('wm-download-btn');
    const printBtn = document.getElementById('wm-print-btn');
    const resetBtn = document.getElementById('wm-reset-btn');

    if (!dropzone || !fileInput || !workspace || !previewCanvas) return;

    const state = {
        pdfBytes: null,
        pdfjsDoc: null,
        fileName: '',
        basePageCanvas: null,
        previewScale: 1,
        busy: false,
    };

    const syncControlBadges = () => {
        if (opacityVal && opacityInput) {
            opacityVal.textContent = Number(opacityInput.value).toFixed(2);
        }
        if (rotationVal && rotationInput) {
            rotationVal.textContent = `${rotationInput.value}°`;
        }
        if (sizeVal && sizeInput) {
            sizeVal.textContent = `${sizeInput.value} pt`;
        }
    };

    const renderPreview = () => {
        if (!state.basePageCanvas) return;
        const ctx = previewCanvas.getContext('2d');
        if (!ctx) return;

        if (
            previewCanvas.width !== state.basePageCanvas.width ||
            previewCanvas.height !== state.basePageCanvas.height
        ) {
            previewCanvas.width = state.basePageCanvas.width;
            previewCanvas.height = state.basePageCanvas.height;
        }

        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.drawImage(state.basePageCanvas, 0, 0);

        const text = textInput?.value ?? '';
        if (!text.trim()) return;

        const colorHex = colorInput?.value || '#dc2626';
        const opacity = Math.min(1, Math.max(0.05, Number(opacityInput?.value) || 0.35));
        const rotation = Number(rotationInput?.value) || 0;
        const sizePt = Math.min(120, Math.max(16, Number(sizeInput?.value) || 54));

        ctx.save();
        ctx.translate(previewCanvas.width / 2, previewCanvas.height / 2);
        // Canvas +Y points down, whereas PDF +Y points up; negate angle so preview matches PDF rotation direction
        ctx.rotate((-rotation * Math.PI) / 180);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = colorHex;
        ctx.font = `700 ${sizePt * state.previewScale}px Helvetica, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        ctx.restore();
    };

    const cleanupDocument = async () => {
        if (state.pdfjsDoc) {
            try {
                await state.pdfjsDoc.destroy();
            } catch {
                // Ignore cleanup failure
            }
            state.pdfjsDoc = null;
        }
        if (state.basePageCanvas) {
            state.basePageCanvas.width = 0;
            state.basePageCanvas.height = 0;
            state.basePageCanvas = null;
        }
        state.pdfBytes = null;
        state.fileName = '';
    };

    const resetWorkspace = async () => {
        await cleanupDocument();
        fileInput.value = '';
        const ctx = previewCanvas.getContext('2d');
        ctx?.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        workspace.classList.add('hidden');
        uploadArea?.classList.remove('hidden');
    };

    const handleSelectedFile = async (files) => {
        const file = files?.[0];
        if (!file || state.busy) return;
        state.busy = true;
        AppState.setBusy(true);

        const signal = ProgressModal.open({
            title: msg('Cargando PDF...', 'Loading PDF...'),
            detail: file.name,
            cancellable: true,
        });

        try {
            const { bytes, pdfjsDoc } = await openPdfFile(file);
            if (signal.aborted) {
                await pdfjsDoc.destroy();
                ToastManager.info(t('toast_cancelled'));
                return;
            }

            ProgressModal.update({
                percent: 55,
                detail: msg('Renderizando vista previa de página 1...', 'Rendering page 1 preview...'),
            });

            const page1 = await pdfjsDoc.getPage(1);
            const vp1 = page1.getViewport({ scale: 1 });
            const maxDim = 760;
            const previewScale = Math.min(2, Math.max(0.5, maxDim / Math.max(vp1.width, vp1.height)));
            page1.cleanup();

            const { canvas: baseCanvas } = await renderPdfPageToCanvas(pdfjsDoc, 1, previewScale);
            if (signal.aborted) {
                await pdfjsDoc.destroy();
                ToastManager.info(t('toast_cancelled'));
                return;
            }

            await cleanupDocument();
            state.pdfBytes = bytes;
            state.pdfjsDoc = pdfjsDoc;
            state.fileName = file.name;
            state.basePageCanvas = baseCanvas;
            state.previewScale = previewScale;

            uploadArea?.classList.add('hidden');
            workspace.classList.remove('hidden');
            syncControlBadges();
            renderPreview();
        } catch (err) {
            ToastManager.error(err?.message || msg('No se pudo abrir el PDF.', 'Could not open the PDF.'));
        } finally {
            ProgressModal.close();
            state.busy = false;
            AppState.setBusy(false);
        }
    };

    const buildWatermarkedPdfBlob = async (signal) => {
        const rawText = textInput?.value ?? '';
        if (!rawText.trim()) {
            ToastManager.warning(msg('Escribe un texto para la marca de agua.', 'Enter watermark text first.'));
            textInput?.focus();
            return null;
        }

        const doc = await loadPdfLibDocument(state.pdfBytes, state.fileName);
        const font = await doc.embedFont(window.PDFLib.StandardFonts.HelveticaBold);
        const { safeText, hadStripped } = sanitizeWinAnsiText(rawText, font);

        if (hadStripped) {
            ToastManager.warning(
                msg(
                    'Algunos símbolos no compatibles con WinAnsi fueron omitidos en la marca de agua.',
                    'Some symbols unsupported by WinAnsi were stripped from the watermark.'
                )
            );
        }

        if (!safeText.trim()) {
            ToastManager.warning(
                msg(
                    'El texto quedó vacío tras filtrar símbolos no compatibles.',
                    'Watermark text became empty after filtering unsupported symbols.'
                )
            );
            textInput?.focus();
            return null;
        }

        const colorHex = colorInput?.value || '#dc2626';
        const { r, g, b } = hexToRgbUnit(colorHex);
        const opacity = Math.min(1, Math.max(0.05, Number(opacityInput?.value) || 0.35));
        const rotation = Number(rotationInput?.value) || 0;
        const size = Math.min(120, Math.max(16, Number(sizeInput?.value) || 54));

        const textWidth = font.widthOfTextAtSize(safeText, size);
        const textHeight = font.heightAtSize(size);
        const dx = textWidth / 2;
        const dy = textHeight * 0.35;

        const pages = doc.getPages();
        const total = pages.length;

        for (let i = 0; i < total; i++) {
            if (signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }
            const page = pages[i];
            const cropBox = page.getCropBox();
            const pageRot = ((page.getRotation().angle % 360) + 360) % 360;
            const rawRot = rotation + pageRot;
            const rawRad = (rawRot * Math.PI) / 180;
            const cx = cropBox.x + cropBox.width / 2;
            const cy = cropBox.y + cropBox.height / 2;

            const x = cx - (dx * Math.cos(rawRad) - dy * Math.sin(rawRad));
            const y = cy - (dx * Math.sin(rawRad) + dy * Math.cos(rawRad));

            page.drawText(safeText, {
                x,
                y,
                size,
                font,
                color: window.PDFLib.rgb(r, g, b),
                opacity,
                rotate: window.PDFLib.degrees(rawRot),
            });

            if (i % 8 === 0 || i === total - 1) {
                ProgressModal.update({
                    percent: Math.round(((i + 1) / total) * 85),
                    detail: msg(`Aplicando marca en página ${i + 1} de ${total}...`, `Stamping page ${i + 1} of ${total}...`),
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
                : msg('Aplicando Marca de Agua...', 'Applying Watermark...'),
            detail: state.fileName,
            cancellable: true,
        });

        try {
            const blob = await buildWatermarkedPdfBlob(signal);
            if (!blob) return;

            if (forPrint) {
                PrintService.printPdfBlob(blob);
            } else {
                const outputName = buildOutputName({
                    originalName: state.fileName,
                    suffix: 'marca_agua',
                });
                BlobRegistry.downloadBlob(blob, outputName);
                ToastManager.success(t('toast_saved_pdf', { name: outputName }));
            }
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
            } else {
                ToastManager.error(err?.message || msg('Error al generar el PDF.', 'Error generating PDF.'));
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

    const onControlInput = () => {
        syncControlBadges();
        renderPreview();
    };

    textInput?.addEventListener('input', onControlInput);
    colorInput?.addEventListener('input', onControlInput);
    opacityInput?.addEventListener('input', onControlInput);
    rotationInput?.addEventListener('input', onControlInput);
    sizeInput?.addEventListener('input', onControlInput);

    downloadBtn?.addEventListener('click', () => runExport(false));
    printBtn?.addEventListener('click', () => runExport(true));
    resetBtn?.addEventListener('click', () => {
        resetWorkspace();
    });

    syncControlBadges();

    AppState.registerTool('watermark', {
        onActivate: () => {
            if (state.basePageCanvas) {
                renderPreview();
            }
        },
    });
}
