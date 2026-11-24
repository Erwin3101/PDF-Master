import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import { computeContainRect } from '../core/geometry.js';
import { decodeImageFile } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { ToastManager } from '../ui/toastManager.js';
import { bindDropzone } from '../ui/dropzone.js';

const PREVIEW_MAX_DIM = 1200;
const DEFAULT_MODE = 'adaptive';
const DEFAULT_THRESHOLD = 160;
const DEFAULT_CONTRAST = 20;

/**
 * Clamps a numeric value between `min` and `max`.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min = 0, max = 255) {
    return val < min ? min : val > max ? max : val;
}

/**
 * Converts an HTMLCanvasElement into a Blob asynchronously.
 * @param {HTMLCanvasElement} canvas
 * @param {string} mime
 * @param {number} [quality]
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, mime = 'image/jpeg', quality = 0.92) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('No se pudo generar el archivo de imagen.'));
                }
            },
            mime,
            quality
        );
    });
}

/**
 * Applies adaptive integral-image local illumination normalization and contrast enhancement
 * so uneven shadows become pure white while preserving crisp dark document ink.
 * @param {Uint8ClampedArray} src
 * @param {Uint8ClampedArray} dst
 * @param {number} width
 * @param {number} height
 * @param {number} threshold
 * @param {number} contrast
 */
function applyAdaptiveEnhancement(src, dst, width, height, threshold, contrast) {
    const pixelCount = width * height;
    const gray = new Uint8Array(pixelCount);

    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
        gray[i] = (77 * src[p] + 150 * src[p + 1] + 29 * src[p + 2]) >> 8;
    }

    const stride = width + 1;
    const IntegralArray = pixelCount * 255 < 0xffffffff ? Uint32Array : Float64Array;
    const sat = new IntegralArray(stride * (height + 1));

    for (let y = 0; y < height; y++) {
        let rowSum = 0;
        const rowOffset = y * width;
        const satPrevRow = y * stride;
        const satCurrRow = (y + 1) * stride;

        for (let x = 0; x < width; x++) {
            rowSum += gray[rowOffset + x];
            sat[satCurrRow + x + 1] = sat[satPrevRow + x + 1] + rowSum;
        }
    }

    const radius = Math.max(8, Math.round(Math.max(width, height) * 0.025));
    const whitePoint = 0.68 + ((clamp(threshold, 40, 235) - 40) / 195) * 0.29;
    const gain = 1 + (clamp(contrast, -40, 80) + 40) / 25;
    const slope = gain * 2.2;

    for (let y = 0; y < height; y++) {
        const y0 = y - radius < 0 ? 0 : y - radius;
        const y1 = y + radius >= height ? height - 1 : y + radius;
        const boxH = y1 - y0 + 1;
        const satTop = y0 * stride;
        const satBottom = (y1 + 1) * stride;
        const rowOffset = y * width;

        for (let x = 0; x < width; x++) {
            const x0 = x - radius < 0 ? 0 : x - radius;
            const x1 = x + radius >= width ? width - 1 : x + radius;
            const area = (x1 - x0 + 1) * boxH;

            const sum =
                sat[satBottom + x1 + 1] -
                sat[satTop + x1 + 1] -
                sat[satBottom + x0] +
                sat[satTop + x0];

            const localMean = sum / area;
            const effectiveRef = localMean < 48 ? 48 : localMean;
            const lum = gray[rowOffset + x];
            const ratio = lum / effectiveRef;

            let out;
            if (ratio >= whitePoint) {
                out = 255;
            } else {
                const raw = Math.round(255 * (1 - (whitePoint - ratio) * slope));
                out = raw < 0 ? 0 : raw > 255 ? 255 : raw;
            }

            const p = (rowOffset + x) << 2;
            dst[p] = out;
            dst[p + 1] = out;
            dst[p + 2] = out;
            dst[p + 3] = 255;
        }
    }
}

/**
 * Applies global contrast adjustment followed by hard threshold binarization.
 * @param {Uint8ClampedArray} src
 * @param {Uint8ClampedArray} dst
 * @param {number} pixelCount
 * @param {number} threshold
 * @param {number} contrast
 */
function applyThresholdEnhancement(src, dst, pixelCount, threshold, contrast) {
    const c = clamp(contrast, -40, 80) * 2;
    const factor = (259 * (c + 255)) / (255 * (259 - c));
    const cutoff = clamp(threshold, 40, 235);

    for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
        const lum = (77 * src[p] + 150 * src[p + 1] + 29 * src[p + 2]) >> 8;
        const adjusted = (lum - 128) * factor + 128;
        const out = adjusted >= cutoff ? 255 : 0;
        dst[p] = out;
        dst[p + 1] = out;
        dst[p + 2] = out;
        dst[p + 3] = 255;
    }
}

/**
 * Dispatches the selected scan enhancement filter onto pixel buffers.
 * @param {Uint8ClampedArray} src
 * @param {Uint8ClampedArray} dst
 * @param {number} width
 * @param {number} height
 * @param {{ mode: string, threshold: number, contrast: number }} params
 */
function enhanceImagePixels(src, dst, width, height, { mode, threshold, contrast }) {
    if (mode === 'threshold') {
        applyThresholdEnhancement(src, dst, width * height, threshold, contrast);
    } else {
        applyAdaptiveEnhancement(src, dst, width, height, threshold, contrast);
    }
}

/**
 * Initializes the Scan Enhancer tool (`#section-scan-enhancer`).
 * Provides fast downscaled live preview (<= 1200px, rAF-coalesced) and full-resolution
 * JPG, A4 mm PDF, and print export.
 */
export function initScanEnhancerTool() {
    const section = document.getElementById('section-scan-enhancer');
    if (!section || section.dataset.scanInitialized === 'true') return;
    section.dataset.scanInitialized = 'true';

    const uploadArea = document.getElementById('scan-upload-area');
    const dropzone = document.getElementById('scan-dropzone');
    const fileInput = document.getElementById('file-input-scan');
    const workspace = document.getElementById('scan-workspace');
    const modeSelect = document.getElementById('scan-mode');
    const thresholdSlider = document.getElementById('scan-threshold');
    const thresholdVal = document.getElementById('scan-threshold-val');
    const contrastSlider = document.getElementById('scan-contrast');
    const contrastVal = document.getElementById('scan-contrast-val');
    const resetBtn = document.getElementById('scan-reset-btn');
    const downloadJpgBtn = document.getElementById('scan-download-jpg-btn');
    const downloadPdfBtn = document.getElementById('scan-download-pdf-btn');
    const printBtn = document.getElementById('scan-print-btn');
    const previewCanvas = document.getElementById('scan-canvas');
    const previewCtx = previewCanvas?.getContext('2d', { alpha: false });

    const state = {
        sourceImage: null,
        fullWidth: 0,
        fullHeight: 0,
        fileName: '',
        previewWidth: 0,
        previewHeight: 0,
        previewSrcPixels: null,
        previewOutImageData: null,
        rafId: 0,
    };

    const getParams = () => ({
        mode: modeSelect?.value === 'threshold' ? 'threshold' : 'adaptive',
        threshold: Number(thresholdSlider?.value ?? DEFAULT_THRESHOLD),
        contrast: Number(contrastSlider?.value ?? DEFAULT_CONTRAST),
    });

    const syncSliderBadges = () => {
        if (thresholdVal && thresholdSlider) {
            thresholdVal.textContent = String(thresholdSlider.value);
        }
        if (contrastVal && contrastSlider) {
            contrastVal.textContent = String(contrastSlider.value);
        }
    };

    const renderPreviewFrame = () => {
        if (
            !previewCanvas ||
            !previewCtx ||
            !state.previewSrcPixels ||
            !state.previewOutImageData
        ) {
            return;
        }

        enhanceImagePixels(
            state.previewSrcPixels,
            state.previewOutImageData.data,
            state.previewWidth,
            state.previewHeight,
            getParams()
        );
        previewCtx.putImageData(state.previewOutImageData, 0, 0);
    };

    const schedulePreviewRender = () => {
        if (state.rafId) return;
        state.rafId = requestAnimationFrame(() => {
            state.rafId = 0;
            renderPreviewFrame();
        });
    };

    const buildPreviewBuffer = (image, width, height) => {
        const scale = Math.min(1, PREVIEW_MAX_DIM / Math.max(width, height, 1));
        const pW = Math.max(1, Math.round(width * scale));
        const pH = Math.max(1, Math.round(height * scale));

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = pW;
        srcCanvas.height = pH;
        const srcCtx = srcCanvas.getContext('2d', { alpha: false });
        srcCtx.fillStyle = '#ffffff';
        srcCtx.fillRect(0, 0, pW, pH);
        srcCtx.drawImage(image, 0, 0, pW, pH);

        const srcData = srcCtx.getImageData(0, 0, pW, pH);
        state.previewWidth = pW;
        state.previewHeight = pH;
        state.previewSrcPixels = new Uint8ClampedArray(srcData.data);

        srcCanvas.width = 0;
        srcCanvas.height = 0;

        if (previewCanvas && previewCtx) {
            previewCanvas.width = pW;
            previewCanvas.height = pH;
            state.previewOutImageData = previewCtx.createImageData(pW, pH);
        }
    };

    const renderFullResolutionCanvas = () => {
        if (!state.sourceImage) return null;

        const w = state.fullWidth;
        const h = state.fullHeight;
        const fullCanvas = document.createElement('canvas');
        fullCanvas.width = w;
        fullCanvas.height = h;
        const fullCtx = fullCanvas.getContext('2d', { alpha: false });

        fullCtx.fillStyle = '#ffffff';
        fullCtx.fillRect(0, 0, w, h);
        fullCtx.drawImage(state.sourceImage, 0, 0, w, h);

        const imgData = fullCtx.getImageData(0, 0, w, h);
        const srcCopy = new Uint8ClampedArray(imgData.data);
        enhanceImagePixels(srcCopy, imgData.data, w, h, getParams());
        fullCtx.putImageData(imgData, 0, 0);

        return fullCanvas;
    };

    const resetWorkspace = () => {
        if (AppState.busy) return;
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = 0;
        }

        state.sourceImage = null;
        state.fullWidth = 0;
        state.fullHeight = 0;
        state.fileName = '';
        state.previewWidth = 0;
        state.previewHeight = 0;
        state.previewSrcPixels = null;
        state.previewOutImageData = null;

        if (previewCanvas) {
            previewCanvas.width = 0;
            previewCanvas.height = 0;
        }

        if (modeSelect) modeSelect.value = DEFAULT_MODE;
        if (thresholdSlider) thresholdSlider.value = String(DEFAULT_THRESHOLD);
        if (contrastSlider) contrastSlider.value = String(DEFAULT_CONTRAST);
        syncSliderBadges();

        workspace?.classList.add('hidden');
        uploadArea?.classList.remove('hidden');
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

        AppState.setBusy(true);
        try {
            const decoded = await decodeImageFile(file);
            state.sourceImage = decoded.image;
            state.fullWidth = decoded.width;
            state.fullHeight = decoded.height;
            state.fileName = decoded.name;

            buildPreviewBuffer(decoded.image, decoded.width, decoded.height);
            syncSliderBadges();
            renderPreviewFrame();

            uploadArea?.classList.add('hidden');
            workspace?.classList.remove('hidden');
        } catch (err) {
            ToastManager.error(err?.message || 'No se pudo cargar la imagen.');
        } finally {
            AppState.setBusy(false);
        }
    };

    const exportJpg = async () => {
        if (!state.sourceImage || AppState.busy) return;

        AppState.setBusy(true);
        let fullCanvas = null;
        try {
            await new Promise((resolve) => setTimeout(resolve, 0));
            fullCanvas = renderFullResolutionCanvas();
            if (!fullCanvas) return;

            const blob = await canvasToBlob(fullCanvas, 'image/jpeg', 0.92);
            const filename = buildOutputName({
                originalName: state.fileName || 'escaneo',
                suffix: 'mejorado',
                ext: 'jpg',
            });
            BlobRegistry.downloadBlob(blob, filename);
            ToastManager.success(
                AppState.lang === 'en'
                    ? `JPG saved: ${filename}`
                    : `JPG guardado: ${filename}`
            );
        } catch (err) {
            ToastManager.error(err?.message || 'Error al exportar la imagen JPG.');
        } finally {
            if (fullCanvas) {
                fullCanvas.width = 0;
                fullCanvas.height = 0;
            }
            AppState.setBusy(false);
        }
    };

    const exportPdf = async () => {
        if (!state.sourceImage || AppState.busy) return;

        const jsPDF = window.jspdf?.jsPDF || window.jsPDF;
        if (typeof jsPDF !== 'function') {
            ToastManager.error(
                AppState.lang === 'en'
                    ? 'jsPDF library failed to load.'
                    : 'La librería jsPDF no se cargó correctamente.'
            );
            return;
        }

        AppState.setBusy(true);
        let fullCanvas = null;
        try {
            await new Promise((resolve) => setTimeout(resolve, 0));
            fullCanvas = renderFullResolutionCanvas();
            if (!fullCanvas) return;

            const isLandscape = fullCanvas.width > fullCanvas.height;
            const pageW = isLandscape ? 297 : 210;
            const pageH = isLandscape ? 210 : 297;
            const margin = 6;
            const rect = computeContainRect(
                fullCanvas.width,
                fullCanvas.height,
                margin,
                margin,
                pageW - margin * 2,
                pageH - margin * 2
            );

            const pdf = new jsPDF({
                orientation: isLandscape ? 'l' : 'p',
                unit: 'mm',
                format: 'a4',
                compress: true,
            });

            const jpegDataUrl = fullCanvas.toDataURL('image/jpeg', 0.92);
            pdf.addImage(jpegDataUrl, 'JPEG', rect.x, rect.y, rect.w, rect.h, undefined, 'FAST');

            const pdfBlob = pdf.output('blob');
            const filename = buildOutputName({
                originalName: state.fileName || 'escaneo',
                suffix: 'mejorado',
                ext: 'pdf',
            });
            BlobRegistry.downloadBlob(pdfBlob, filename);
            ToastManager.success(
                AppState.lang === 'en'
                    ? `PDF exported: ${filename}`
                    : `PDF exportado: ${filename}`
            );
        } catch (err) {
            ToastManager.error(err?.message || 'Error al exportar el PDF.');
        } finally {
            if (fullCanvas) {
                fullCanvas.width = 0;
                fullCanvas.height = 0;
            }
            AppState.setBusy(false);
        }
    };

    const printFullScan = async () => {
        if (!state.sourceImage || AppState.busy) return;

        AppState.setBusy(true);
        let fullCanvas = null;
        try {
            await new Promise((resolve) => setTimeout(resolve, 0));
            fullCanvas = renderFullResolutionCanvas();
            if (!fullCanvas) return;

            PrintService.printCanvas(fullCanvas, state.fileName || 'Escaneo mejorado');
        } catch (err) {
            ToastManager.error(err?.message || 'No se pudo preparar la impresión.');
        } finally {
            if (fullCanvas) {
                fullCanvas.width = 0;
                fullCanvas.height = 0;
            }
            AppState.setBusy(false);
        }
    };

    bindDropzone(dropzone, fileInput, {
        multiple: false,
        onFiles: handleSelectedFiles,
    });

    modeSelect?.addEventListener('change', schedulePreviewRender);

    thresholdSlider?.addEventListener('input', () => {
        syncSliderBadges();
        schedulePreviewRender();
    });

    contrastSlider?.addEventListener('input', () => {
        syncSliderBadges();
        schedulePreviewRender();
    });

    resetBtn?.addEventListener('click', resetWorkspace);
    downloadJpgBtn?.addEventListener('click', () => {
        void exportJpg();
    });
    downloadPdfBtn?.addEventListener('click', () => {
        void exportPdf();
    });
    printBtn?.addEventListener('click', () => {
        void printFullScan();
    });

    AppState.registerTool('scan-enhancer', {
        reset: resetWorkspace,
    });
}
