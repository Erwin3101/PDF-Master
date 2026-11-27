import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import { PAPER_SIZES, clamp, computePosterLayout } from '../core/geometry.js';
import { detectFileKind, decodeImageFile, openPdfFile, renderPdfPageToCanvas } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { drawScissorsToCtx, drawScissorsToPdf } from '../core/cutMarks.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const POSTER_BLOB_SCOPE = 'poster';
const MAX_POSTER_GRID = 20;
const MAX_PREVIEW_CANVAS_PX = 760;
const MAX_PREVIEW_SOURCE_PX = 1100;
const MAX_PDF_RENDER_DIM = 4096;
const MAX_PDF_RENDER_PIXELS = 16_000_000;
const TARGET_PDF_RENDER_SCALE = 4.0;
const MAX_EXPORT_TILE_DIM = 3600;
const MOBILE_MAX_EXPORT_TILE_DIM = 2800;
const MIN_PRINT_PX_PER_MM = 9.5;
const MOBILE_MIN_PRINT_PX_PER_MM = 7.5;
const MAX_PRINT_PX_PER_MM = 11.81;
const MOBILE_MAX_PRINT_PX_PER_MM = 10.5;
const MAX_TOTAL_EXPORT_PIXELS = 180_000_000;
const MOBILE_MAX_TOTAL_EXPORT_PIXELS = 90_000_000;
const DEFAULT_POSTER_MARGIN_MM = 8;

/**
 * Detects memory-constrained mobile / touch environments so export tile buffers
 * stay crisp (~190-267 DPI) without exceeding iOS/Android canvas RAM caps.
 * @returns {boolean}
 */
function isConstrainedMobile() {
    if (typeof window === 'undefined') return false;
    const nav = globalThis.navigator;
    if (nav && typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
    const smallViewport = window.innerWidth <= 768;
    const coarsePointer =
        typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    return smallViewport && coarsePointer;
}

const POSTER_PRESETS = Object.freeze({
    original: Object.freeze({ brightness: 0, contrast: 0, saturation: 100, temperature: 0, cleanMode: false }),
    bw: Object.freeze({ brightness: 0, contrast: 15, saturation: 0, temperature: 0, cleanMode: false }),
    contrast: Object.freeze({ brightness: 0, contrast: 30, saturation: 110, temperature: 0, cleanMode: false }),
    clean: Object.freeze({ brightness: 14, contrast: 26, saturation: 105, temperature: 0, cleanMode: true }),
});

const PAPER_SHORT_NAMES = Object.freeze({
    es: Object.freeze({
        letter: 'Carta',
        legal: 'Legal',
        a4: 'A4',
        a3: 'A3',
        tabloid: 'Tabloide',
    }),
    en: Object.freeze({
        letter: 'Letter',
        legal: 'Legal',
        a4: 'A4',
        a3: 'A3',
        tabloid: 'Tabloid',
    }),
});

const state = {
    initialized: false,
    nextId: 1,
    /** @type {Array<{ id: number, name: string, displayName: string, image: HTMLImageElement, width: number, height: number, objectUrl: string | null }>} */
    items: [],
    currentIndex: 0,
    previewMode: 'assembled',
    manualCols: 2,
    manualRows: 2,
    filters: {
        preset: 'original',
        brightness: 0,
        contrast: 0,
        saturation: 100,
        temperature: 0,
        cleanMode: false,
    },
    previewCache: {
        itemId: null,
        rawCanvas: null,
        rawImageData: null,
        retouchedCanvas: null,
        filterSignature: '',
    },
    rafId: 0,
    unbindDropzone: null,
};

/**
 * Returns localized Spanish or English text based on current `AppState.lang`.
 * @param {string} esText
 * @param {string} enText
 * @returns {string}
 */
function msg(esText, enText) {
    return AppState.lang === 'en' ? enText : esText;
}

/**
 * Yields a single animation frame / macrotask so progress UI remains responsive.
 * @returns {Promise<void>}
 */
function yieldToUi() {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve());
        } else {
            setTimeout(resolve, 0);
        }
    });
}

/**
 * Queries all DOM elements belonging to `#section-poster`.
 * @returns {Record<string, HTMLElement | null>}
 */
function getDom() {
    return {
        uploadArea: document.getElementById('poster-upload-area'),
        dropzone: document.getElementById('poster-dropzone'),
        fileInput: document.getElementById('file-input-poster'),
        workspace: document.getElementById('poster-workspace'),
        nav: document.getElementById('poster-nav'),
        prevBtn: document.getElementById('poster-prev-btn'),
        counter: document.getElementById('poster-counter'),
        nextBtn: document.getElementById('poster-next-btn'),
        paperSize: document.getElementById('poster-paper-size'),
        orientation: document.getElementById('poster-orientation'),
        fitMode: document.getElementById('poster-fit-mode'),
        cols: document.getElementById('poster-cols'),
        rows: document.getElementById('poster-rows'),
        quality: document.getElementById('poster-quality'),
        margin: document.getElementById('poster-margin'),
        overlap: document.getElementById('poster-overlap'),
        overlapVal: document.getElementById('poster-overlap-val'),
        cropMarks: document.getElementById('poster-crop-marks'),
        tileLabels: document.getElementById('poster-tile-labels'),
        viewAssembledBtn: document.getElementById('poster-view-assembled-btn'),
        viewSheetsBtn: document.getElementById('poster-view-sheets-btn'),
        brightness: document.getElementById('poster-brightness'),
        brightnessVal: document.getElementById('poster-brightness-val'),
        contrast: document.getElementById('poster-contrast'),
        contrastVal: document.getElementById('poster-contrast-val'),
        saturation: document.getElementById('poster-saturation'),
        saturationVal: document.getElementById('poster-saturation-val'),
        temperature: document.getElementById('poster-temperature'),
        temperatureVal: document.getElementById('poster-temperature-val'),
        resetFiltersBtn: document.getElementById('poster-reset-filters-btn'),
        statPages: document.getElementById('poster-stat-pages'),
        statGrid: document.getElementById('poster-stat-grid'),
        statDims: document.getElementById('poster-stat-dims'),
        statPaper: document.getElementById('poster-stat-paper'),
        previewCanvas: document.getElementById('poster-preview-canvas'),
        cutLegend: document.getElementById('poster-cut-legend'),
        previewCaption: document.getElementById('poster-preview-caption'),
        downloadBtn: document.getElementById('poster-download-btn'),
        printBtn: document.getElementById('poster-print-btn'),
        resetBtn: document.getElementById('poster-reset-btn'),
    };
}

/**
 * Reads current poster layout & export settings from the DOM with safe bounds.
 * @returns {{
 *   paperKey: string,
 *   orientation: 'auto'|'p'|'l',
 *   fitMode: 'stretch'|'contain'|'proportional'|'proportional-height'|'cover',
 *   cols: number,
 *   rows: number,
 *   quality: number,
 *   overlapMm: number,
 *   marginMm: number,
 *   showCropMarks: boolean,
 *   showTileLabels: boolean,
 * }}
 */
function readPosterSettings() {
    const dom = getDom();
    const rawPaper = dom.paperSize?.value || 'letter';
    const paperKey = PAPER_SIZES[rawPaper] ? rawPaper : 'letter';
    const rawOrient = dom.orientation?.value || 'auto';
    const orientation = rawOrient === 'p' || rawOrient === 'l' ? rawOrient : 'auto';
    const rawFit = dom.fitMode?.value || 'stretch';
    const fitMode =
        rawFit === 'stretch' ||
        rawFit === 'contain' ||
        rawFit === 'cover' ||
        rawFit === 'proportional' ||
        rawFit === 'proportional-height'
            ? rawFit
            : 'stretch';
    const colsSource = dom.cols?.disabled ? state.manualCols : dom.cols?.value;
    const rowsSource = dom.rows?.disabled ? state.manualRows : dom.rows?.value;
    const cols = clamp(Math.round(toFiniteNumber(colsSource, state.manualCols)), 1, MAX_POSTER_GRID);
    const rows = clamp(Math.round(toFiniteNumber(rowsSource, state.manualRows)), 1, MAX_POSTER_GRID);
    const quality = clamp(toFiniteNumber(dom.quality?.value, 0.95), 0.5, 1.0);
    const marginMm = clamp(toFiniteNumber(dom.margin?.value, DEFAULT_POSTER_MARGIN_MM), 0, 20);
    const overlapMm = clamp(toFiniteNumber(dom.overlap?.value, 5), 0, 15);
    const showCropMarks = dom.cropMarks ? Boolean(dom.cropMarks.checked) : false;
    const showTileLabels = dom.tileLabels ? Boolean(dom.tileLabels.checked) : false;

    return {
        paperKey,
        orientation,
        fitMode,
        cols,
        rows,
        quality,
        overlapMm,
        marginMm,
        showCropMarks,
        showTileLabels,
    };
}

/**
 * Formats signed integer slider readouts (e.g. `+14`, `0`, `-10`).
 * @param {number} val
 * @returns {string}
 */
function formatSigned(val) {
    const rounded = Math.round(val);
    return rounded > 0 ? `+${rounded}` : String(rounded);
}

/**
 * Parses a finite number with fallback when non-finite or missing.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toFiniteNumber(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

/**
 * Checks whether active retouch filters modify pixels relative to neutral defaults.
 * @param {object} filters
 * @returns {boolean}
 */
function needsRetouch(filters) {
    if (!filters) return false;
    const brightness = clamp(toFiniteNumber(filters.brightness, 0), -50, 50);
    const contrast = clamp(toFiniteNumber(filters.contrast, 0), -50, 50);
    const saturation = clamp(toFiniteNumber(filters.saturation, 100), 0, 200);
    const temperature = clamp(toFiniteNumber(filters.temperature, 0), -50, 50);
    const cleanMode = Boolean(filters.cleanMode ?? filters.preset === 'clean');
    return brightness !== 0 || contrast !== 0 || saturation !== 100 || temperature !== 0 || cleanMode;
}

/**
 * Shared pixel retouching pipeline applied identically to both the cached
 * live-preview offscreen canvas and every exported PDF tile canvas.
 *
 * @param {ImageData} imageData
 * @param {object} [filters]
 * @param {number} [filters.brightness=0] Range -50..50
 * @param {number} [filters.contrast=0] Range -50..50
 * @param {number} [filters.saturation=100] Range 0..200
 * @param {number} [filters.temperature=0] Range -50..50
 * @param {'original'|'bw'|'contrast'|'clean'|'custom'} [filters.preset='original']
 * @param {boolean} [filters.cleanMode]
 * @returns {ImageData}
 */
export function applyRetouchToImageData(imageData, filters = {}) {
    if (!imageData || !imageData.data) return imageData;

    const brightness = clamp(toFiniteNumber(filters.brightness, 0), -50, 50);
    const contrast = clamp(toFiniteNumber(filters.contrast, 0), -50, 50);
    const saturation = clamp(toFiniteNumber(filters.saturation, 100), 0, 200);
    const temperature = clamp(toFiniteNumber(filters.temperature, 0), -50, 50);
    const cleanMode = Boolean(filters.cleanMode ?? filters.preset === 'clean');

    if (brightness === 0 && contrast === 0 && saturation === 100 && temperature === 0 && !cleanMode) {
        return imageData;
    }

    const data = imageData.data;
    const len = data.length;
    const brightnessOffset = brightness * 2.55;
    const c = contrast * 2;
    const contrastFactor = (259 * (c + 255)) / (255 * (259 - c));
    const satFactor = saturation / 100;
    const tempShift = temperature * 1.1;

    const adjustTone = brightness !== 0 || contrast !== 0 || temperature !== 0;
    const adjustSat = saturation !== 100;

    for (let i = 0; i < len; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        if (adjustTone) {
            if (brightness !== 0) {
                r += brightnessOffset;
                g += brightnessOffset;
                b += brightnessOffset;
            }
            if (contrast !== 0) {
                r = (r - 128) * contrastFactor + 128;
                g = (g - 128) * contrastFactor + 128;
                b = (b - 128) * contrastFactor + 128;
            }
            if (temperature !== 0) {
                r += tempShift;
                b -= tempShift;
            }
            r = r < 0 ? 0 : r > 255 ? 255 : r;
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            b = b < 0 ? 0 : b > 255 ? 255 : b;
        }

        if (adjustSat) {
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            r = lum + (r - lum) * satFactor;
            g = lum + (g - lum) * satFactor;
            b = lum + (b - lum) * satFactor;
            r = r < 0 ? 0 : r > 255 ? 255 : r;
            g = g < 0 ? 0 : g > 255 ? 255 : g;
            b = b < 0 ? 0 : b > 255 ? 255 : b;
        }

        if (cleanMode) {
            const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            if (lum > 195) {
                const maxCh = r > g ? (r > b ? r : b) : g > b ? g : b;
                const minCh = r < g ? (r < b ? r : b) : g < b ? g : b;
                const spread = maxCh - minCh;
                if (spread < 38) {
                    const tLum = lum >= 238 ? 1 : (lum - 195) / 43;
                    const neutrality = 1 - spread / 38;
                    const lift = tLum * tLum * neutrality;
                    r += (255 - r) * lift;
                    g += (255 - g) * lift;
                    b += (255 - b) * lift;
                }
            }
        }

        data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
        data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }

    return imageData;
}

/**
 * Releases offscreen preview bitmap buffers to keep memory tidy.
 */
function clearPreviewCache() {
    const cache = state.previewCache;
    if (cache.rawCanvas) {
        cache.rawCanvas.width = 0;
        cache.rawCanvas.height = 0;
    }
    if (cache.retouchedCanvas) {
        cache.retouchedCanvas.width = 0;
        cache.retouchedCanvas.height = 0;
    }
    cache.itemId = null;
    cache.rawCanvas = null;
    cache.rawImageData = null;
    cache.retouchedCanvas = null;
    cache.filterSignature = '';
}

/**
 * Returns the cached downscaled (<= 1100px) retouched preview canvas for an item.
 * Rebuilds the downscaled raw buffer only when the active item changes, and
 * re-runs pixel retouching only when filter parameters change.
 *
 * @param {{ id: number, image: HTMLImageElement, width: number, height: number }} item
 * @returns {HTMLCanvasElement}
 */
function getRetouchedPreviewBitmap(item) {
    const cache = state.previewCache;

    if (cache.itemId !== item.id || !cache.rawCanvas || !cache.rawImageData) {
        clearPreviewCache();
        const scale = Math.min(1, MAX_PREVIEW_SOURCE_PX / Math.max(item.width, item.height));
        const pw = Math.max(1, Math.round(item.width * scale));
        const ph = Math.max(1, Math.round(item.height * scale));

        const rawCanvas = document.createElement('canvas');
        rawCanvas.width = pw;
        rawCanvas.height = ph;
        const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
        rawCtx.fillStyle = '#ffffff';
        rawCtx.fillRect(0, 0, pw, ph);
        rawCtx.drawImage(item.image, 0, 0, item.width, item.height, 0, 0, pw, ph);

        cache.itemId = item.id;
        cache.rawCanvas = rawCanvas;
        cache.rawImageData = rawCtx.getImageData(0, 0, pw, ph);
        cache.retouchedCanvas = document.createElement('canvas');
        cache.retouchedCanvas.width = pw;
        cache.retouchedCanvas.height = ph;
        cache.filterSignature = '';
    }

    if (!needsRetouch(state.filters)) {
        return cache.rawCanvas;
    }

    const sig = [
        state.filters.brightness,
        state.filters.contrast,
        state.filters.saturation,
        state.filters.temperature,
        state.filters.cleanMode ? 1 : 0,
    ].join('|');

    if (cache.filterSignature !== sig) {
        const { width, height, data } = cache.rawImageData;
        const working = new ImageData(new Uint8ClampedArray(data), width, height);
        applyRetouchToImageData(working, state.filters);
        const retCtx = cache.retouchedCanvas.getContext('2d');
        retCtx.putImageData(working, 0, 0);
        cache.filterSignature = sig;
    }

    return cache.retouchedCanvas;
}

/**
 * Syncs filter controls, badge readouts, and preset pill active states from `state.filters`.
 */
function syncFilterControls() {
    const dom = getDom();
    const f = state.filters;

    if (dom.brightness) dom.brightness.value = String(f.brightness);
    if (dom.brightnessVal) dom.brightnessVal.textContent = formatSigned(f.brightness);
    if (dom.contrast) dom.contrast.value = String(f.contrast);
    if (dom.contrastVal) dom.contrastVal.textContent = formatSigned(f.contrast);
    if (dom.saturation) dom.saturation.value = String(f.saturation);
    if (dom.saturationVal) dom.saturationVal.textContent = `${Math.round(f.saturation)}%`;
    if (dom.temperature) dom.temperature.value = String(f.temperature);
    if (dom.temperatureVal) dom.temperatureVal.textContent = formatSigned(f.temperature);

    document.querySelectorAll('.poster-preset-btn').forEach((btn) => {
        const active = btn.dataset.preset === f.preset;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
}

/**
 * Applies a named retouch preset and refreshes the preview.
 * @param {'original'|'bw'|'contrast'|'clean'} presetName
 */
function applyPreset(presetName) {
    const spec = POSTER_PRESETS[presetName] || POSTER_PRESETS.original;
    state.filters = {
        preset: POSTER_PRESETS[presetName] ? presetName : 'original',
        brightness: spec.brightness,
        contrast: spec.contrast,
        saturation: spec.saturation,
        temperature: spec.temperature,
        cleanMode: spec.cleanMode,
    };
    syncFilterControls();
    schedulePreviewRender();
}

/**
 * Updates multi-file navigation bar visibility, counter, and prev/next button states.
 */
function updateNavUi() {
    const dom = getDom();
    const count = state.items.length;
    if (dom.nav) {
        dom.nav.classList.toggle('hidden', count <= 1);
    }
    if (dom.counter) {
        dom.counter.textContent = count > 0 ? `${state.currentIndex + 1} / ${count}` : '0 / 0';
    }
    if (dom.prevBtn) {
        dom.prevBtn.disabled = state.currentIndex <= 0;
    }
    if (dom.nextBtn) {
        dom.nextBtn.disabled = state.currentIndex >= count - 1;
    }
}

/**
 * Formats the paper size + resolved orientation label for `#poster-stat-paper`.
 * @param {string} paperKey
 * @param {'p'|'l'} orientation
 * @returns {string}
 */
function formatPaperStat(paperKey, orientation) {
    const lang = AppState.lang === 'en' ? 'en' : 'es';
    const names = PAPER_SHORT_NAMES[lang];
    const paperName = names[paperKey] || PAPER_SIZES[paperKey]?.label || paperKey.toUpperCase();
    const orientName =
        orientation === 'l'
            ? msg('Horizontal', 'Landscape')
            : msg('Vertical', 'Portrait');
    return `${paperName} · ${orientName}`;
}

/**
 * Draws rounded pill badge onto a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function fillRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

/**
 * Syncs view mode segmented tab buttons (`assembled` vs `sheets`).
 */
function syncPreviewModeUi() {
    const dom = getDom();
    const isSheets = state.previewMode === 'sheets';
    if (dom.viewAssembledBtn) {
        dom.viewAssembledBtn.classList.toggle('is-active', !isSheets);
        dom.viewAssembledBtn.setAttribute('aria-selected', String(!isSheets));
    }
    if (dom.viewSheetsBtn) {
        dom.viewSheetsBtn.classList.toggle('is-active', isSheets);
        dom.viewSheetsBtn.setAttribute('aria-selected', String(isSheets));
    }
}

/**
 * Draws a centered label pill inside a tile on a 2D canvas.
 */
function drawCanvasTileBadge(ctx, text, bx, by, maxBadgeW, fontSize, compactPad) {
    const padX = compactPad ? 4 : 6;
    const badgeH = fontSize + 7;
    const metrics = ctx.measureText(text);
    const badgeW = Math.min(maxBadgeW, metrics.width + padX * 2);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    fillRoundedRect(ctx, bx, by, badgeW, badgeH, 4);

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx + 2, by, Math.max(1, badgeW - 4), badgeH);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, bx + padX, by + badgeH / 2 + 0.5);
    ctx.restore();
}

/**
 * Formats localized tile coordinate code (`F1-C2` in ES, `R1-C2` in EN).
 * @param {number} row1Based
 * @param {number} col1Based
 * @returns {string}
 */
function formatTileCoord(row1Based, col1Based) {
    const prefix = AppState.lang === 'en' ? 'R' : 'F';
    return `${prefix}${row1Based}-C${col1Based}`;
}

/**
 * Computes strictly in-bounds Canvas 2D `drawImage` source rectangle for a bitmap
 * so Safari/WebKit never throws `IndexSizeError` on tiny edge slivers.
 */
function clampSourceDrawRect(src, bmpScaleX, bmpScaleY, bmpW, bmpH) {
    const rawSx = src.sx * bmpScaleX;
    const rawSy = src.sy * bmpScaleY;
    const rawSw = src.sw * bmpScaleX;
    const rawSh = src.sh * bmpScaleY;
    const minDim = 0.25;
    const sx = clamp(rawSx, 0, Math.max(0, bmpW - minDim));
    const sy = clamp(rawSy, 0, Math.max(0, bmpH - minDim));
    const sw = Math.min(bmpW - sx, Math.max(minDim, rawSw));
    const sh = Math.min(bmpH - sy, Math.max(minDim, rawSh));
    return { sx, sy, sw, sh };
}

/**
 * Draws clean outer-margin cut ("✂ RECORTAR AQUÍ") and glue ("PEGAR AQUÍ") indicators
 * on a Canvas 2D sheet, matching the exported PDF 1:1 without corner ticks or arrows.
 */
function drawCanvasMarginMarks(ctx, { ox, oy, x0, y0, x1, y1, margin, cutEdges, glueEdges, pxPerMm }) {
    if (margin < 3) return;
    const sx0 = (ox + x0) * pxPerMm;
    const sy0 = (oy + y0) * pxPerMm;
    const sx1 = (ox + x1) * pxPerMm;
    const sy1 = (oy + y1) * pxPerMm;
    const marginPx = margin * pxPerMm;
    if (marginPx < 3.5) return;

    const cutColor = '#dc2626';
    const glueColor = '#0284c7';
    const cutText = msg('RECORTAR AQUÍ', 'CUT HERE');
    const glueText = msg('PEGAR AQUÍ', 'GLUE HERE');
    const showText = marginPx >= 6.5;
    const fontSize = Math.max(5.5, Math.min(8.5, marginPx * 0.62));
    const iconScale = Math.min(1.65, marginPx / 4.4);

    ctx.save();
    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const drawCutLabel = (side) => {
        const isVert = side === 'left' || side === 'right';
        const spanPx = isVert ? sy1 - sy0 : sx1 - sx0;
        const cx = side === 'right' ? sx1 + marginPx * 0.5 : side === 'left' ? sx0 - marginPx * 0.5 : (sx0 + sx1) / 2;
        const cy = side === 'bottom' ? sy1 + marginPx * 0.5 : side === 'top' ? sy0 - marginPx * 0.5 : (sy0 + sy1) / 2;
        const textW = showText ? ctx.measureText(cutText).width : 0;
        const iconW = 3.8 * iconScale;
        const gap = 3;
        const fitText = showText && iconW + gap + textW <= spanPx - 6;

        if (fitText) {
            const totalW = iconW + gap + textW;
            if (isVert) {
                const iconCy = cy + totalW / 2 - iconW / 2;
                drawScissorsToCtx(ctx, cx / iconScale, iconCy / iconScale, iconScale, true, cutColor);
                ctx.save();
                ctx.translate(cx, cy - iconW / 2 - gap / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillStyle = cutColor;
                ctx.fillText(cutText, 0, 0);
                ctx.restore();
            } else {
                const iconCx = cx - totalW / 2 + iconW / 2;
                drawScissorsToCtx(ctx, iconCx / iconScale, cy / iconScale, iconScale, false, cutColor);
                ctx.fillStyle = cutColor;
                ctx.fillText(cutText, cx + iconW / 2 + gap / 2, cy);
            }
        } else {
            drawScissorsToCtx(ctx, cx / iconScale, cy / iconScale, iconScale, isVert, cutColor);
        }
    };

    const drawGlueLabel = (side) => {
        const isVert = side === 'left';
        const spanPx = isVert ? sy1 - sy0 : sx1 - sx0;
        const cx = isVert ? sx0 - marginPx * 0.5 : (sx0 + sx1) / 2;
        const cy = isVert ? (sy0 + sy1) / 2 : sy0 - marginPx * 0.5;
        const textW = showText ? ctx.measureText(glueText).width : 0;

        ctx.fillStyle = glueColor;
        if (showText && textW <= spanPx - 6) {
            if (isVert) {
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(glueText, 0, 0);
                ctx.restore();
            } else {
                ctx.fillText(glueText, cx, cy);
            }
        } else {
            // Compact blue bar accent when dense sheet grid leaves < 6.5px margin
            const barLen = Math.min(spanPx * 0.45, Math.max(8, marginPx * 2.5));
            const barThick = Math.max(1.5, marginPx * 0.28);
            if (isVert) {
                ctx.fillRect(cx - barThick / 2, cy - barLen / 2, barThick, barLen);
            } else {
                ctx.fillRect(cx - barLen / 2, cy - barThick / 2, barLen, barThick);
            }
        }
    };

    for (const side of ['top', 'right', 'bottom', 'left']) {
        if (cutEdges[side]) drawCutLabel(side);
    }
    if (glueEdges.left) drawGlueLabel('left');
    if (glueEdges.top) drawGlueLabel('top');
    ctx.restore();
}

/**
 * Draws the assembled poster live preview onto the preview canvas.
 */
function drawAssembledPreview(canvas, layout, previewBitmap, item, settings) {
    const margin = layout.marginMm;
    const worldW = layout.totalW + margin * 2;
    const worldH = layout.totalH + margin * 2;
    const pxPerMm = Math.min(MAX_PREVIEW_CANVAS_PX / worldW, MAX_PREVIEW_CANVAS_PX / worldH);

    canvas.width = Math.max(1, Math.round(worldW * pxPerMm));
    canvas.height = Math.max(1, Math.round(worldH * pxPerMm));

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const bmpScaleX = previewBitmap.width / item.width;
    const bmpScaleY = previewBitmap.height / item.height;
    const stepX = layout.printableW - layout.overlapMm;
    const stepY = layout.printableH - layout.overlapYMm;

    // 1. Outer trim margin backdrop + white printable canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (margin > 0) {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
            margin * pxPerMm,
            margin * pxPerMm,
            layout.totalW * pxPerMm,
            layout.totalH * pxPerMm
        );
    }

    // 2. Draw each tile's exact continuous image slice (pixel-snapped when overlap = 0 to prevent hairlines)
    const snapX = layout.overlapMm <= 0;
    const snapY = layout.overlapYMm <= 0;
    for (const tile of layout.tiles) {
        const src = tile.exactSrcRect || tile.srcRect;
        if (!src || !tile.destRectMm) continue;
        const rawX0 = (tile.col * stepX + tile.destRectMm.x) * pxPerMm;
        const rawY0 = (tile.row * stepY + tile.destRectMm.y) * pxPerMm;
        const rawX1 = rawX0 + tile.destRectMm.w * pxPerMm;
        const rawY1 = rawY0 + tile.destRectMm.h * pxPerMm;

        const dx = snapX ? Math.round(rawX0) : rawX0;
        const dy = snapY ? Math.round(rawY0) : rawY0;
        const dw = snapX ? Math.max(1, Math.round(rawX1) - dx) : rawX1 - rawX0;
        const dh = snapY ? Math.max(1, Math.round(rawY1) - dy) : rawY1 - rawY0;

        const clamped = clampSourceDrawRect(src, bmpScaleX, bmpScaleY, previewBitmap.width, previewBitmap.height);
        ctx.drawImage(previewBitmap, clamped.sx, clamped.sy, clamped.sw, clamped.sh, dx, dy, dw, dh);
    }

    // 3. Draw overlap / glue tab zones clipped to the placed image bounds
    const placed = layout.placedRectMm;
    if (layout.cols > 1 && layout.overlapMm > 0) {
        ctx.fillStyle = settings.showCropMarks
            ? 'rgba(2, 132, 199, 0.14)'
            : 'rgba(236, 72, 153, 0.14)';
        for (let c = 1; c < layout.cols; c++) {
            const ox0 = Math.max(c * stepX, placed.x);
            const ox1 = Math.min(c * stepX + layout.overlapMm, placed.x + placed.w);
            if (ox1 > ox0 + 0.05) {
                ctx.fillRect(
                    (margin + ox0) * pxPerMm,
                    (margin + placed.y) * pxPerMm,
                    (ox1 - ox0) * pxPerMm,
                    placed.h * pxPerMm
                );
            }
        }
    }
    if (layout.rows > 1 && layout.overlapYMm > 0) {
        ctx.fillStyle = settings.showCropMarks
            ? 'rgba(2, 132, 199, 0.14)'
            : 'rgba(236, 72, 153, 0.14)';
        for (let r = 1; r < layout.rows; r++) {
            const oy0 = Math.max(r * stepY, placed.y);
            const oy1 = Math.min(r * stepY + layout.overlapYMm, placed.y + placed.h);
            if (oy1 > oy0 + 0.05) {
                ctx.fillRect(
                    (margin + placed.x) * pxPerMm,
                    (margin + oy0) * pxPerMm,
                    placed.w * pxPerMm,
                    (oy1 - oy0) * pxPerMm
                );
            }
        }
    }

    // 4. Draw each sheet's subtle printable boundary
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.32)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (const tile of layout.tiles) {
        const px = (margin + tile.col * stepX) * pxPerMm;
        const py = (margin + tile.row * stepY) * pxPerMm;
        const pw = layout.printableW * pxPerMm;
        const ph = layout.printableH * pxPerMm;
        ctx.strokeRect(px, py, pw, ph);
    }
    ctx.restore();

    // 5. Draw clean red scissor badges on cut seams
    if (settings.showCropMarks && (layout.cols > 1 || layout.rows > 1)) {
        const drawPreviewScissorsBadge = (cxPx, cyPx, isVertical) => {
            const badgeScale = Math.max(2.2, Math.min(3.3, pxPerMm * 1.15));
            const badgeR = 2.6 * badgeScale;
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 1.25;
            ctx.beginPath();
            ctx.arc(cxPx, cyPx, badgeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            drawScissorsToCtx(ctx, cxPx / badgeScale, cyPx / badgeScale, badgeScale, isVertical, '#dc2626');
        };

        const topY = margin * pxPerMm;
        const botY = (margin + layout.totalH) * pxPerMm;
        const leftX = margin * pxPerMm;
        const rightX = (margin + layout.totalW) * pxPerMm;
        const tilePxW = layout.printableW * pxPerMm;
        const tilePxH = layout.printableH * pxPerMm;

        for (let c = 0; c < layout.cols - 1; c++) {
            const seamX = (margin + c * stepX + layout.printableW) * pxPerMm;
            if (tilePxH >= 54) {
                for (let r = 0; r < layout.rows; r++) {
                    const rowMidY = (margin + r * stepY + layout.printableH / 2) * pxPerMm;
                    drawPreviewScissorsBadge(seamX, rowMidY, true);
                }
            } else {
                drawPreviewScissorsBadge(seamX, (topY + botY) / 2, true);
            }
        }
        for (let r = 0; r < layout.rows - 1; r++) {
            const seamY = (margin + r * stepY + layout.printableH) * pxPerMm;
            if (tilePxW >= 54) {
                for (let c = 0; c < layout.cols; c++) {
                    const colMidX = (margin + c * stepX + layout.printableW / 2) * pxPerMm;
                    drawPreviewScissorsBadge(colMidX, seamY, false);
                }
            } else {
                drawPreviewScissorsBadge((leftX + rightX) / 2, seamY, false);
            }
        }
    }

    // 6. Draw subtle tile badge at bottom-right (consistent with Sheets Preview & PDF export)
    if (settings.showTileLabels) {
        ctx.save();
        const tilePxW = layout.printableW * pxPerMm;
        const tilePxH = layout.printableH * pxPerMm;
        const compact = tilePxW < 115 || tilePxH < 40;
        const micro = tilePxW < 52 || tilePxH < 24;
        const fontSize = micro ? 8 : compact ? 9.5 : 10.5;
        ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        const padX = micro ? 4 : 6;
        const badgeH = fontSize + 7;
        for (const tile of layout.tiles) {
            const px = (margin + tile.col * stepX) * pxPerMm;
            const py = (margin + tile.row * stepY) * pxPerMm;
            const text = micro
                ? `${tile.pageNum}`
                : compact
                    ? tile.shortLabel || formatTileCoord(tile.row + 1, tile.col + 1)
                    : tile.label;
            const maxBadgeW = Math.max(16, tilePxW - 8);
            const badgeW = Math.min(maxBadgeW, ctx.measureText(text).width + padX * 2);
            const bx = px + tilePxW - badgeW - 4;
            const by = py + tilePxH - badgeH - 4;
            drawCanvasTileBadge(ctx, text, bx, by, maxBadgeW, fontSize, micro);
        }
        ctx.restore();
    }
}

/**
 * Draws each individual PDF sheet side-by-side so the user can inspect margins,
 * overlap tabs, and cut/glue alignment marks 1:1 before printing.
 */
function drawSheetsPreview(canvas, layout, previewBitmap, item, settings) {
    const gapMm = Math.max(8, Math.min(layout.sheetW, layout.sheetH) * 0.05);
    const worldW = layout.cols * layout.sheetW + (layout.cols + 1) * gapMm;
    const worldH = layout.rows * layout.sheetH + (layout.rows + 1) * gapMm;
    const pxPerMm = Math.min(MAX_PREVIEW_CANVAS_PX / worldW, MAX_PREVIEW_CANVAS_PX / worldH);

    canvas.width = Math.max(1, Math.round(worldW * pxPerMm));
    canvas.height = Math.max(1, Math.round(worldH * pxPerMm));

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bmpScaleX = previewBitmap.width / item.width;
    const bmpScaleY = previewBitmap.height / item.height;
    const margin = layout.marginMm;

    for (const tile of layout.tiles) {
        const ox = gapMm + tile.col * (layout.sheetW + gapMm);
        const oy = gapMm + tile.row * (layout.sheetH + gapMm);
        const sxPx = ox * pxPerMm;
        const syPx = oy * pxPerMm;
        const swPx = layout.sheetW * pxPerMm;
        const shPx = layout.sheetH * pxPerMm;

        // Sheet card
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sxPx, syPx, swPx, shPx);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sxPx, syPx, swPx, shPx);

        // Tile image slice
        const src = tile.exactSrcRect || tile.srcRect;
        if (src && tile.destRectMm) {
            const clamped = clampSourceDrawRect(src, bmpScaleX, bmpScaleY, previewBitmap.width, previewBitmap.height);
            ctx.drawImage(
                previewBitmap,
                clamped.sx,
                clamped.sy,
                clamped.sw,
                clamped.sh,
                (ox + tile.destRectMm.x) * pxPerMm,
                (oy + tile.destRectMm.y) * pxPerMm,
                tile.destRectMm.w * pxPerMm,
                tile.destRectMm.h * pxPerMm
            );
        }

        const { x: x0, y: y0, w: pw, h: ph } = tile.printableRectMm;
        const x1 = x0 + pw;
        const y1 = y0 + ph;

        // Overlap strip indicator on glue edges (clipped to actual image destRectMm)
        if (tile.destRectMm) {
            const d = tile.destRectMm;
            if (tile.glueEdges?.left && layout.overlapMm > 0) {
                const gx0 = Math.max(x0, d.x);
                const gx1 = Math.min(x0 + layout.overlapMm, d.x + d.w);
                if (gx1 > gx0 + 0.05) {
                    ctx.fillStyle = 'rgba(2, 132, 199, 0.16)';
                    ctx.fillRect((ox + gx0) * pxPerMm, (oy + d.y) * pxPerMm, (gx1 - gx0) * pxPerMm, d.h * pxPerMm);
                }
            }
            if (tile.glueEdges?.top && layout.overlapYMm > 0) {
                const gy0 = Math.max(y0, d.y);
                const gy1 = Math.min(y0 + layout.overlapYMm, d.y + d.h);
                if (gy1 > gy0 + 0.05) {
                    ctx.fillStyle = 'rgba(2, 132, 199, 0.16)';
                    ctx.fillRect((ox + d.x) * pxPerMm, (oy + gy0) * pxPerMm, d.w * pxPerMm, (gy1 - gy0) * pxPerMm);
                }
            }
        }

        // Subtle printable boundary
        if (margin > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.28)';
            ctx.lineWidth = 0.75;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect((ox + x0) * pxPerMm, (oy + y0) * pxPerMm, pw * pxPerMm, ph * pxPerMm);
            ctx.restore();
        }

        // Margin cut ("✂ RECORTAR AQUÍ") and glue ("PEGAR AQUÍ") labels (matching PDF 1:1)
        if (settings.showCropMarks && layout.totalPages > 1) {
            drawCanvasMarginMarks(ctx, {
                ox,
                oy,
                x0,
                y0,
                x1,
                y1,
                margin,
                cutEdges: tile.cutEdges || {},
                glueEdges: tile.glueEdges || {},
                pxPerMm,
            });
        }

        if (settings.showTileLabels) {
            ctx.save();
            const tilePxW = layout.sheetW * pxPerMm;
            const tilePxH = layout.sheetH * pxPerMm;
            const micro = tilePxW < 64 || tilePxH < 48;
            const fontSize = micro ? 7.5 : 9;
            ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            const text = micro
                ? `${tile.pageNum}`
                : tile.shortLabel || formatTileCoord(tile.row + 1, tile.col + 1);
            const padX = micro ? 4 : 6;
            const badgeH = fontSize + 7;
            const maxBadgeW = Math.max(16, tilePxW - 8);
            const badgeW = Math.min(maxBadgeW, ctx.measureText(text).width + padX * 2);
            const bx = sxPx + tilePxW - badgeW - 4;
            const by = syPx + tilePxH - badgeH - 4;
            drawCanvasTileBadge(ctx, text, bx, by, maxBadgeW, fontSize, micro);
            ctx.restore();
        }
    }
}

/**
 * Syncs quick-grid preset button active states with current `(cols, rows)`.
 * @param {number} cols
 * @param {number} rows
 */
function syncGridPresetsUi(cols, rows) {
    document.querySelectorAll('.poster-grid-preset').forEach((btn) => {
        const active =
            Number(btn.dataset.cols) === cols && Number(btn.dataset.rows) === rows;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
}

/**
 * Syncs mobile-friendly `-` / `+` stepper button disabled states with current bounds and fit mode.
 * @param {boolean} colsDisabled
 * @param {boolean} rowsDisabled
 */
function syncStepperButtonsUi(colsDisabled, rowsDisabled) {
    document.querySelectorAll('.poster-stepper-btn').forEach((btn) => {
        const target = btn.dataset.target;
        const delta = Number(btn.dataset.delta);
        const isCols = target === 'cols';
        const locked = isCols ? colsDisabled : rowsDisabled;
        const val = isCols ? state.manualCols : state.manualRows;
        const atLimit = (delta < 0 && val <= 1) || (delta > 0 && val >= MAX_POSTER_GRID);
        btn.disabled = locked || atLimit;
    });
}

/**
 * Draws the live poster preview and updates all summary statistics.
 */
export function renderPosterPreview() {
    const dom = getDom();
    const item = state.items[state.currentIndex];
    if (!item || !dom.previewCanvas) return;

    const settings = readPosterSettings();
    if (dom.overlapVal) {
        dom.overlapVal.textContent = `${settings.overlapMm} mm`;
    }

    const layout = computePosterLayout({
        imgW: item.width,
        imgH: item.height,
        cols: settings.cols,
        rows: settings.rows,
        paperKey: settings.paperKey,
        orientation: settings.orientation,
        fitMode: settings.fitMode,
        overlapMm: settings.overlapMm,
        marginMm: settings.marginMm,
        lang: AppState.lang,
    });

    const isPropWidth = layout.fitMode === 'proportional';
    const isPropHeight = layout.fitMode === 'proportional-height';

    if (dom.cols) {
        const wasDisabled = dom.cols.disabled;
        dom.cols.disabled = isPropHeight;
        if (isPropHeight) {
            dom.cols.value = String(layout.cols);
        } else if (wasDisabled) {
            dom.cols.value = String(state.manualCols);
        }
    }
    if (dom.rows) {
        const wasDisabled = dom.rows.disabled;
        dom.rows.disabled = isPropWidth;
        if (isPropWidth) {
            dom.rows.value = String(layout.rows);
        } else if (wasDisabled) {
            dom.rows.value = String(state.manualRows);
        }
    }

    syncGridPresetsUi(layout.cols, layout.rows);
    syncStepperButtonsUi(isPropHeight, isPropWidth);
    syncPreviewModeUi();

    // Update live stats (compute exact sum across all loaded items for multi-file accuracy)
    const fileCount = state.items.length;
    if (dom.statPages) {
        if (fileCount > 1) {
            let sumPages = 0;
            for (let i = 0; i < fileCount; i++) {
                if (i === state.currentIndex) {
                    sumPages += layout.totalPages;
                } else {
                    const other = state.items[i];
                    const otherLayout = computePosterLayout({
                        imgW: other.width,
                        imgH: other.height,
                        cols: settings.cols,
                        rows: settings.rows,
                        paperKey: settings.paperKey,
                        orientation: settings.orientation,
                        fitMode: settings.fitMode,
                        overlapMm: settings.overlapMm,
                        marginMm: settings.marginMm,
                        lang: AppState.lang,
                    });
                    sumPages += otherLayout.totalPages;
                }
            }
            dom.statPages.textContent = `${sumPages} (${fileCount} ${msg('arch.', 'files')})`;
        } else {
            dom.statPages.textContent = String(layout.totalPages);
        }
    }
    if (dom.statGrid) {
        dom.statGrid.textContent = `${layout.cols} × ${layout.rows}`;
    }
    if (dom.statDims) {
        dom.statDims.textContent = `${layout.imageWidthCm} × ${layout.imageHeightCm} cm`;
    }
    if (dom.statPaper) {
        dom.statPaper.textContent = formatPaperStat(layout.paperKey, layout.orientation);
    }
    if (dom.previewCaption) {
        const prefix = fileCount > 1 ? `${state.currentIndex + 1}/${fileCount} · ` : '';
        const overlapText =
            layout.overlapMm > 0 || layout.overlapYMm > 0
                ? msg(` · Solape ${settings.overlapMm} mm`, ` · Overlap ${settings.overlapMm} mm`)
                : '';
        let modeNote = '';
        if (
            layout.fitMode === 'contain' &&
            (layout.cols < layout.requestedCols || layout.rows < layout.requestedRows)
        ) {
            modeNote = msg(
                ` · Sin hojas vacías: ${layout.cols}×${layout.rows} (usa "Ajustar a cuadrícula exacta" para ${layout.requestedCols}×${layout.requestedRows})`,
                ` · Trimmed blank sheets to ${layout.cols}×${layout.rows} (use "Exact grid" for ${layout.requestedCols}×${layout.requestedRows})`
            );
        }
        dom.previewCaption.textContent = `${prefix}${item.displayName} (${item.width}×${item.height} px)${overlapText}${modeNote}`;
    }

    const previewBitmap = getRetouchedPreviewBitmap(item);
    if (state.previewMode === 'sheets') {
        drawSheetsPreview(dom.previewCanvas, layout, previewBitmap, item, settings);
    } else {
        drawAssembledPreview(dom.previewCanvas, layout, previewBitmap, item, settings);
    }

    if (dom.cutLegend) {
        const showLegend = settings.showCropMarks && layout.totalPages > 1;
        dom.cutLegend.classList.toggle('hidden', !showLegend);
        const hasMargin = layout.marginMm >= 3;
        const cutLegendItem = dom.cutLegend.querySelector('[data-i18n="poster_legend_cut"]')?.closest('.poster-legend-item');
        const glueLegendItem = dom.cutLegend.querySelector('[data-i18n="poster_legend_glue"]')?.closest('.poster-legend-item');
        const marginHint = document.getElementById('poster-margin-marks-hint');
        if (cutLegendItem) {
            cutLegendItem.classList.toggle('hidden', !hasMargin);
        }
        if (glueLegendItem) {
            glueLegendItem.classList.toggle('hidden', !hasMargin || (layout.overlapMm <= 0 && layout.overlapYMm <= 0));
        }
        if (marginHint) {
            marginHint.classList.toggle('hidden', hasMargin);
        }
    }
}

/**
 * Coalesces rapid UI slider/input updates onto the next animation frame.
 */
function schedulePreviewRender() {
    if (state.rafId) {
        cancelAnimationFrame(state.rafId);
    }
    state.rafId = requestAnimationFrame(() => {
        state.rafId = 0;
        renderPosterPreview();
    });
}

/**
 * Loads an HTMLImageElement from a Blob/ObjectURL or DataURL.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageFromSrc(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(msg('No se pudo decodificar la página renderizada.', 'Could not decode rendered page.')));
        img.src = src;
    });
}

/**
 * Converts a rendered PDF page canvas into a lightweight Blob-backed image entry
 * and releases the temporary canvas backing store immediately.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<{ image: HTMLImageElement, objectUrl: string | null }>}
 */
async function canvasToLoadedImage(canvas) {
    try {
        if (typeof canvas.toBlob === 'function') {
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (blob) {
                const objectUrl = BlobRegistry.create(blob, POSTER_BLOB_SCOPE);
                try {
                    const image = await loadImageFromSrc(objectUrl);
                    return { image, objectUrl };
                } catch (err) {
                    BlobRegistry.revokeUrl(objectUrl);
                    throw err;
                }
            }
        }
        const dataUrl = canvas.toDataURL('image/png');
        const image = await loadImageFromSrc(dataUrl);
        return { image, objectUrl: null };
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * Computes a memory-safe PDF rasterization scale targeting 2.5x while capping
 * extreme page dimensions so huge architectural PDFs never exhaust memory.
 * @param {number} widthPt
 * @param {number} heightPt
 * @returns {number}
 */
function computeSafePdfScale(widthPt, heightPt) {
    const safeW = Math.max(1, Number(widthPt) || 1);
    const safeH = Math.max(1, Number(heightPt) || 1);
    const maxDim = Math.max(safeW, safeH);
    const dimCapScale = MAX_PDF_RENDER_DIM / maxDim;
    const pixelCapScale = Math.sqrt(MAX_PDF_RENDER_PIXELS / (safeW * safeH));
    return clamp(Math.min(TARGET_PDF_RENDER_SCALE, dimCapScale, pixelCapScale), 0.25, TARGET_PDF_RENDER_SCALE);
}

/**
 * Strips extension from a file name safely.
 * @param {string} fileName
 * @returns {string}
 */
function stripExtension(fileName) {
    return String(fileName || 'documento').replace(/\.[^/.]+$/, '') || 'documento';
}

/**
 * Revokes any temporary ObjectURLs held by a list of poster items.
 * @param {Array<{ objectUrl: string | null }>} entries
 */
function revokeItemUrls(entries) {
    for (const entry of entries) {
        if (entry?.objectUrl) {
            BlobRegistry.revokeUrl(entry.objectUrl);
        }
    }
}

/**
 * Processes dropped/selected image and PDF files with progress reporting and cancellation.
 * @param {File[]} files
 */
async function handlePosterFiles(files) {
    if (!files || files.length === 0 || AppState.busy) return;

    const dom = getDom();
    const loadedBatch = [];
    const signal = ProgressModal.open({
        title: msg('Cargando archivos para póster...', 'Loading poster files...'),
        detail: files[0]?.name || '',
        cancellable: true,
    });
    AppState.setBusy(true);

    let cancelled = false;
    try {
        for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
            if (signal.aborted) {
                cancelled = true;
                break;
            }
            const file = files[fileIdx];
            const kind = detectFileKind(file);
            const basePct = (fileIdx / files.length) * 100;
            const fileSpan = 100 / files.length;

            ProgressModal.update({
                percent: basePct,
                detail: `${file.name} (${fileIdx + 1}/${files.length})`,
            });

            if (kind === 'unknown') {
                ToastManager.warning(
                    t('toast_file_skipped', {
                        name: file.name,
                        reason: msg('Formato no soportado.', 'Unsupported format.'),
                    })
                );
                continue;
            }

            if (kind === 'pdf') {
                let pdfjsDoc = null;
                try {
                    const opened = await openPdfFile(file);
                    pdfjsDoc = opened.pdfjsDoc;
                    const numPages = pdfjsDoc.numPages || 0;
                    const baseName = stripExtension(file.name);

                    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                        if (signal.aborted) {
                            cancelled = true;
                            break;
                        }
                        const pagePct = basePct + ((pageNum - 1) / Math.max(1, numPages)) * fileSpan;
                        ProgressModal.update({
                            percent: pagePct,
                            detail: `${file.name} · ${msg('Página', 'Page')} ${pageNum}/${numPages}`,
                        });

                        const page = await pdfjsDoc.getPage(pageNum);
                        const baseVp = page.getViewport({ scale: 1 });
                        page.cleanup();
                        const safeScale = computeSafePdfScale(baseVp.width, baseVp.height);
                        const { canvas } = await renderPdfPageToCanvas(pdfjsDoc, pageNum, safeScale);

                        if (signal.aborted) {
                            canvas.width = 0;
                            canvas.height = 0;
                            cancelled = true;
                            break;
                        }

                        const width = canvas.width;
                        const height = canvas.height;
                        const { image, objectUrl } = await canvasToLoadedImage(canvas);

                        loadedBatch.push({
                            id: state.nextId++,
                            name: numPages > 1 ? `${baseName}_p${pageNum}.pdf` : file.name,
                            displayName: numPages > 1 ? `${file.name} (${pageNum}/${numPages})` : file.name,
                            image,
                            width,
                            height,
                            objectUrl,
                        });

                        await yieldToUi();
                    }
                } catch (err) {
                    if (signal.aborted) {
                        cancelled = true;
                        break;
                    }
                    ToastManager.warning(
                        t('toast_file_skipped', {
                            name: file.name,
                            reason: err?.message || msg('Error al leer PDF.', 'Failed to read PDF.'),
                        })
                    );
                } finally {
                    await pdfjsDoc?.destroy?.();
                }
            } else {
                try {
                    const decoded = await decodeImageFile(file);
                    if (signal.aborted) {
                        cancelled = true;
                        break;
                    }
                    loadedBatch.push({
                        id: state.nextId++,
                        name: decoded.name || file.name,
                        displayName: decoded.name || file.name,
                        image: decoded.image,
                        width: decoded.width,
                        height: decoded.height,
                        objectUrl: null,
                    });
                } catch (err) {
                    if (signal.aborted) {
                        cancelled = true;
                        break;
                    }
                    ToastManager.warning(
                        t('toast_file_skipped', {
                            name: file.name,
                            reason: err?.message || msg('Imagen inválida.', 'Invalid image.'),
                        })
                    );
                }
            }

            if (cancelled) break;
        }

        if (cancelled || signal.aborted) {
            revokeItemUrls(loadedBatch);
            ToastManager.info(t('toast_cancelled'));
            return;
        }

        if (loadedBatch.length === 0) {
            return;
        }

        ProgressModal.update({ percent: 100 });

        // Commit batch and free any prior items cleanly
        revokeItemUrls(state.items);
        clearPreviewCache();
        state.items = loadedBatch;
        state.currentIndex = 0;

        if (dom.uploadArea) dom.uploadArea.classList.add('hidden');
        if (dom.workspace) dom.workspace.classList.remove('hidden');

        updateNavUi();
        syncFilterControls();
        renderPosterPreview();
        globalThis.lucide?.createIcons?.();
    } finally {
        ProgressModal.close();
        AppState.setBusy(false);
    }
}

const POSTER_CUT_RGB = Object.freeze({ r: 220, g: 38, b: 38 });
const POSTER_GLUE_RGB = Object.freeze({ r: 2, g: 132, b: 199 });

/**
 * Draws the red "RECORTAR AQUÍ" / "CUT HERE" indicator with vector scissors
 * strictly inside the outer margin of a cut edge.
 */
function drawPdfCutEdge(doc, { x0, y0, x1, y1, margin, side }) {
    const isVertical = side === 'left' || side === 'right';
    const compact = margin < 6.5;
    const label = msg('RECORTAR AQUÍ', 'CUT HERE');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 5.2 : 6.8);
    doc.setTextColor(POSTER_CUT_RGB.r, POSTER_CUT_RGB.g, POSTER_CUT_RGB.b);

    const textW = doc.getTextWidth(label);
    const iconScale = compact ? 0.6 : 0.8;
    const iconW = 4.0 * iconScale;
    const gap = compact ? 1.0 : 1.5;
    const groupW = iconW + gap + textW;

    if (isVertical) {
        const cx = side === 'right' ? x1 + margin * 0.5 : x0 - margin * 0.5;
        const cy = (y0 + y1) / 2;
        const iconCy = cy + groupW / 2 - iconW / 2;
        drawScissorsToPdf(doc, cx, iconCy, iconScale, true, POSTER_CUT_RGB);
        const textStartY = cy + groupW / 2 - iconW - gap;
        doc.text(label, cx + (compact ? 0.55 : 0.8), textStartY, { angle: 90 });
    } else {
        const cx = (x0 + x1) / 2;
        const cy = side === 'bottom' ? y1 + margin * 0.5 : y0 - margin * 0.5;
        const iconCx = cx - groupW / 2 + iconW / 2;
        drawScissorsToPdf(doc, iconCx, cy, iconScale, false, POSTER_CUT_RGB);
        const textStartX = cx - groupW / 2 + iconW + gap;
        doc.text(label, textStartX, cy + (compact ? 0.55 : 0.8));
    }
}

/**
 * Draws the clean blue "PEGAR AQUÍ" / "GLUE HERE" indicator strictly inside
 * the outer margin of a glue overlap edge (no coordinate codes or arrows).
 */
function drawPdfGlueEdge(doc, { x0, y0, x1, y1, margin, side }) {
    const isVertical = side === 'left';
    const compact = margin < 6.5;
    const label = msg('PEGAR AQUÍ', 'GLUE HERE');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 5.2 : 6.8);
    doc.setTextColor(POSTER_GLUE_RGB.r, POSTER_GLUE_RGB.g, POSTER_GLUE_RGB.b);
    const textW = doc.getTextWidth(label);

    if (isVertical) {
        const cx = x0 - margin * 0.5;
        const cy = (y0 + y1) / 2;
        doc.text(label, cx + (compact ? 0.55 : 0.78), cy + textW / 2, { angle: 90 });
    } else {
        const cx = (x0 + x1) / 2;
        const cy = y0 - margin * 0.5;
        doc.text(label, cx - textW / 2, cy + (compact ? 0.55 : 0.78));
    }
}

/**
 * Draws ONLY the clean red cut labels (✂ RECORTAR AQUÍ) and blue glue labels (PEGAR AQUÍ)
 * strictly inside the outer margin (no corner tick lines, no arrows, no coordinate suffixes),
 * plus optional bottom-right tile reference labels.
 *
 * @param {object} doc jsPDF instance
 * @param {object} layout Computed poster layout
 * @param {object} tile Current tile metadata
 * @param {{ showCropMarks: boolean, showTileLabels: boolean, labelPrefix?: string }} options
 */
function drawPdfTileAnnotations(doc, layout, tile, { showCropMarks, showTileLabels, labelPrefix = '' }) {
    const { x: x0, y: y0, w: pw, h: ph } = tile.printableRectMm;
    const x1 = x0 + pw;
    const y1 = y0 + ph;
    const margin = layout.marginMm;
    const hasMarginSpace = margin >= 3;
    const bottomLabelY = Math.min(layout.sheetH - 1.6, y1 + Math.max(2.6, margin * 0.54));

    if (showCropMarks && hasMarginSpace && layout.totalPages > 1) {
        const cut = tile.cutEdges || {};
        for (const side of ['top', 'right', 'bottom', 'left']) {
            if (cut[side]) {
                drawPdfCutEdge(doc, { x0, y0, x1, y1, margin, side });
            }
        }

        const glue = tile.glueEdges || {};
        if (glue.left) {
            drawPdfGlueEdge(doc, { x0, y0, x1, y1, margin, side: 'left' });
        }
        if (glue.top) {
            drawPdfGlueEdge(doc, { x0, y0, x1, y1, margin, side: 'top' });
        }
    }

    if (showTileLabels) {
        const displayLabel = labelPrefix ? `${labelPrefix}${tile.label}` : tile.label;
        if (hasMarginSpace) {
            const labelX = Math.max(x0 + 2, x1 - 2);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(margin < 6.5 ? 5.8 : 7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(displayLabel, labelX, bottomLabelY, { align: 'right' });
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            const txtW = doc.getTextWidth(displayLabel);
            const bx = Math.max(2, layout.sheetW - txtW - 7);
            const by = Math.max(2, layout.sheetH - 7);
            doc.setFillColor(15, 23, 42);
            doc.roundedRect(bx, by, txtW + 4, 4.8, 1, 1, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(displayLabel, bx + 2, by + 3.4);
        }
    }
}

/**
 * Computes a consistent, high-DPI print pixel-per-mm density across all tiles
 * of a poster layout (240-300 DPI on desktop, 190-267 DPI mobile-safe), using
 * the denser axis so stretched posters retain full print sharpness while
 * respecting a batch-wide memory budget.
 *
 * @param {object} layout
 * @param {number} [batchAreaMm2=0]
 * @returns {number}
 */
function computeExportPxPerMm(layout, batchAreaMm2 = 0) {
    const mobile = isConstrainedMobile();
    const minPx = mobile ? MOBILE_MIN_PRINT_PX_PER_MM : MIN_PRINT_PX_PER_MM;
    const maxPx = mobile ? MOBILE_MAX_PRINT_PX_PER_MM : MAX_PRINT_PX_PER_MM;
    const maxTileDim = mobile ? MOBILE_MAX_EXPORT_TILE_DIM : MAX_EXPORT_TILE_DIM;
    const maxBatchPixels = mobile ? MOBILE_MAX_TOTAL_EXPORT_PIXELS : MAX_TOTAL_EXPORT_PIXELS;

    const placedW = Math.max(1, layout.placedRectMm?.w || layout.totalW);
    const placedH = Math.max(1, layout.placedRectMm?.h || layout.totalH);
    const nativePxPerMmX = (layout.cropSrcRect?.sw || 1) / placedW;
    const nativePxPerMmY = (layout.cropSrcRect?.sh || 1) / placedH;
    const nativePxPerMm = Math.max(nativePxPerMmX, nativePxPerMmY);
    let pxPerMm = clamp(nativePxPerMm, minPx, maxPx);

    const activeTiles = layout.tiles.filter((t) => t.destRectMm && (t.exactSrcRect || t.srcRect));
    if (activeTiles.length > 0) {
        const maxTileMm = Math.max(
            1,
            ...activeTiles.map((t) => Math.max(t.destRectMm.w, t.destRectMm.h))
        );
        pxPerMm = Math.min(pxPerMm, maxTileDim / maxTileMm);

        const itemAreaMm2 = activeTiles.reduce(
            (sum, t) => sum + t.destRectMm.w * t.destRectMm.h,
            0
        );
        const effectiveAreaMm2 = Math.max(itemAreaMm2, batchAreaMm2);
        if (effectiveAreaMm2 > 0) {
            pxPerMm = Math.min(pxPerMm, Math.sqrt(maxBatchPixels / effectiveAreaMm2));
        }
    }

    return Math.max(1.5, pxPerMm);
}

/**
 * Generates the multi-page poster PDF across all loaded items using jsPDF,
 * applying exact sub-pixel cropping, high-DPI print resampling, and shared retouching.
 *
 * @param {object} [options]
 * @param {boolean} [options.forPrint=false]
 * @returns {Promise<Blob | null>}
 */
export async function generatePosterPDF({ forPrint = false } = {}) {
    if (AppState.busy) return null;
    if (state.items.length === 0) {
        ToastManager.warning(t('toast_no_pages'));
        return null;
    }

    const JsPdfCtor = window.jspdf?.jsPDF;
    if (typeof JsPdfCtor !== 'function') {
        ToastManager.error(msg('Librería jsPDF no disponible.', 'jsPDF library is not available.'));
        return null;
    }

    const settings = readPosterSettings();
    const layouts = state.items.map((item) =>
        computePosterLayout({
            imgW: item.width,
            imgH: item.height,
            cols: settings.cols,
            rows: settings.rows,
            paperKey: settings.paperKey,
            orientation: settings.orientation,
            fitMode: settings.fitMode,
            overlapMm: settings.overlapMm,
            marginMm: settings.marginMm,
            lang: AppState.lang,
        })
    );

    const exportTilesByItem = layouts.map((layout) => {
        const nonEmpty = layout.tiles.filter((tile) => (tile.exactSrcRect || tile.srcRect) && tile.destRectMm);
        return nonEmpty.length > 0 ? nonEmpty : layout.tiles.slice(0, 1);
    });

    const totalExportedPages = exportTilesByItem.reduce((acc, list) => acc + list.length, 0);
    if (totalExportedPages <= 0) {
        ToastManager.warning(t('toast_no_pages'));
        return null;
    }

    const signal = ProgressModal.open({
        title: msg('Generando póster en alta calidad...', 'Generating high-quality poster...'),
        detail: `0 / ${totalExportedPages}`,
        cancellable: true,
    });
    AppState.setBusy(true);
    let progressClosed = false;
    const closeProgressOnce = () => {
        if (!progressClosed) {
            progressClosed = true;
            ProgressModal.close();
        }
    };

    const tileCanvas = document.createElement('canvas');
    const tileCtx = tileCanvas.getContext('2d', { willReadFrequently: true });
    const retouchCacheCanvas = document.createElement('canvas');
    const retouchNeeded = needsRetouch(state.filters);

    try {
        const firstLayout = layouts[0];
        const doc = new JsPdfCtor({
            orientation: firstLayout.orientation,
            unit: 'mm',
            format: [firstLayout.sheetW, firstLayout.sheetH],
            compress: true,
        });

        let processedPages = 0;
        const totalBatchAreaMm2 = exportTilesByItem.reduce(
            (sum, tiles) =>
                sum + tiles.reduce((s, tile) => s + (tile.destRectMm ? tile.destRectMm.w * tile.destRectMm.h : 0), 0),
            0
        );

        for (let itemIdx = 0; itemIdx < state.items.length; itemIdx++) {
            const item = state.items[itemIdx];
            const layout = layouts[itemIdx];
            const tilesToExport = exportTilesByItem[itemIdx];
            const exportPxPerMm = computeExportPxPerMm(layout, totalBatchAreaMm2);

            // Fast consistent path: retouch source once when <= 4 MP so seams are identical
            let sourceDrawable = item.image;
            let preRetouched = false;
            if (retouchNeeded && item.width * item.height <= 4_000_000) {
                retouchCacheCanvas.width = item.width;
                retouchCacheCanvas.height = item.height;
                const rCtx = retouchCacheCanvas.getContext('2d', { willReadFrequently: true });
                rCtx.fillStyle = '#ffffff';
                rCtx.fillRect(0, 0, item.width, item.height);
                rCtx.drawImage(item.image, 0, 0, item.width, item.height);
                const fullImgData = rCtx.getImageData(0, 0, item.width, item.height);
                applyRetouchToImageData(fullImgData, state.filters);
                rCtx.putImageData(fullImgData, 0, 0);
                sourceDrawable = retouchCacheCanvas;
                preRetouched = true;
            }

            for (const tile of tilesToExport) {
                if (signal.aborted) {
                    ToastManager.info(t('toast_cancelled'));
                    return null;
                }

                if (processedPages > 0) {
                    doc.addPage([layout.sheetW, layout.sheetH], layout.orientation);
                }

                ProgressModal.update({
                    percent: (processedPages / totalExportedPages) * 100,
                    detail: `${tile.label} (${processedPages + 1}/${totalExportedPages})`,
                });

                const src = tile.exactSrcRect || tile.srcRect;
                if (src && tile.destRectMm) {
                    const tw = Math.max(1, Math.round(tile.destRectMm.w * exportPxPerMm));
                    const th = Math.max(1, Math.round(tile.destRectMm.h * exportPxPerMm));

                    tileCanvas.width = tw;
                    tileCanvas.height = th;
                    tileCtx.fillStyle = '#ffffff';
                    tileCtx.fillRect(0, 0, tw, th);
                    tileCtx.imageSmoothingEnabled = true;
                    tileCtx.imageSmoothingQuality = 'high';
                    const clampedSrc = clampSourceDrawRect(src, 1, 1, item.width, item.height);
                    tileCtx.drawImage(
                        sourceDrawable,
                        clampedSrc.sx,
                        clampedSrc.sy,
                        clampedSrc.sw,
                        clampedSrc.sh,
                        0,
                        0,
                        tw,
                        th
                    );

                    if (retouchNeeded && !preRetouched) {
                        const imgData = tileCtx.getImageData(0, 0, tw, th);
                        applyRetouchToImageData(imgData, state.filters);
                        tileCtx.putImageData(imgData, 0, 0);
                    }

                    const useLosslessPng = settings.quality >= 0.995;
                    if (useLosslessPng) {
                        const pngDataUrl = tileCanvas.toDataURL('image/png');
                        doc.addImage(
                            pngDataUrl,
                            'PNG',
                            tile.destRectMm.x,
                            tile.destRectMm.y,
                            tile.destRectMm.w,
                            tile.destRectMm.h,
                            undefined,
                            'FAST'
                        );
                    } else {
                        const jpegDataUrl = tileCanvas.toDataURL('image/jpeg', settings.quality);
                        doc.addImage(
                            jpegDataUrl,
                            'JPEG',
                            tile.destRectMm.x,
                            tile.destRectMm.y,
                            tile.destRectMm.w,
                            tile.destRectMm.h,
                            undefined,
                            'NONE'
                        );
                    }
                }

                drawPdfTileAnnotations(doc, layout, tile, {
                    showCropMarks: settings.showCropMarks,
                    showTileLabels: settings.showTileLabels,
                    labelPrefix: state.items.length > 1 ? `#${itemIdx + 1} · ` : '',
                });

                processedPages += 1;
                await yieldToUi();
            }

            if (preRetouched) {
                retouchCacheCanvas.width = 0;
                retouchCacheCanvas.height = 0;
            }
        }

        if (signal.aborted) {
            ToastManager.info(t('toast_cancelled'));
            return null;
        }

        ProgressModal.update({ percent: 100 });
        const pdfBlob = doc.output('blob');
        closeProgressOnce();

        if (forPrint) {
            PrintService.printPdfBlob(pdfBlob);
        } else {
            const filename = buildOutputName({
                originalName: state.items[0].name,
                suffix: 'poster',
                pageCount: totalExportedPages,
                ext: 'pdf',
            });
            BlobRegistry.downloadBlob(pdfBlob, filename);
            const uniformGrid = layouts.every(
                (l) => l.cols === firstLayout.cols && l.rows === firstLayout.rows
            );
            if (state.items.length === 1) {
                ToastManager.success(
                    t('toast_poster_done', {
                        pages: totalExportedPages,
                        cols: firstLayout.cols,
                        rows: firstLayout.rows,
                    })
                );
            } else if (uniformGrid) {
                ToastManager.success(
                    msg(
                        `Póster generado: ${totalExportedPages} páginas (${state.items.length} archivos · ${firstLayout.cols}×${firstLayout.rows})`,
                        `Poster exported: ${totalExportedPages} pages (${state.items.length} files · ${firstLayout.cols}×${firstLayout.rows})`
                    )
                );
            } else {
                ToastManager.success(
                    msg(
                        `Póster generado: ${totalExportedPages} páginas (${state.items.length} archivos)`,
                        `Poster exported: ${totalExportedPages} pages (${state.items.length} files)`
                    )
                );
            }
        }

        return pdfBlob;
    } catch (err) {
        if (signal.aborted) {
            ToastManager.info(t('toast_cancelled'));
            return null;
        }
        console.error('[Poster] PDF generation failed:', err);
        ToastManager.error(
            err?.message || msg('Error al generar el PDF del póster.', 'Failed to generate poster PDF.')
        );
        return null;
    } finally {
        tileCanvas.width = 0;
        tileCanvas.height = 0;
        retouchCacheCanvas.width = 0;
        retouchCacheCanvas.height = 0;
        closeProgressOnce();
        AppState.setBusy(false);
    }
}

/**
 * Resets loaded files, clears preview buffers, revokes scoped ObjectURLs,
 * and restores the initial dropzone view.
 */
function resetPoster() {
    if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = 0;
    }

    revokeItemUrls(state.items);
    BlobRegistry.revokeScope(POSTER_BLOB_SCOPE);
    clearPreviewCache();

    state.items = [];
    state.currentIndex = 0;
    state.previewMode = 'assembled';
    state.filters = {
        preset: 'original',
        ...POSTER_PRESETS.original,
    };
    syncPreviewModeUi();
    syncFilterControls();

    const dom = getDom();
    if (dom.cols) {
        dom.cols.disabled = false;
        dom.cols.value = String(state.manualCols);
    }
    if (dom.rows) {
        dom.rows.disabled = false;
        dom.rows.value = String(state.manualRows);
    }
    syncGridPresetsUi(state.manualCols, state.manualRows);
    syncStepperButtonsUi(false, false);
    if (dom.fileInput) dom.fileInput.value = '';
    if (dom.previewCanvas) {
        const ctx = dom.previewCanvas.getContext('2d');
        ctx?.clearRect(0, 0, dom.previewCanvas.width, dom.previewCanvas.height);
        dom.previewCanvas.width = 0;
        dom.previewCanvas.height = 0;
    }
    if (dom.previewCaption) dom.previewCaption.textContent = '';
    if (dom.nav) dom.nav.classList.add('hidden');
    if (dom.workspace) dom.workspace.classList.add('hidden');
    if (dom.uploadArea) dom.uploadArea.classList.remove('hidden');
}

/**
 * Binds retouch slider & preset controls cleanly.
 */
function bindRetouchControls() {
    const dom = getDom();

    document.querySelectorAll('.poster-preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            applyPreset(btn.dataset.preset || 'original');
        });
    });

    const sliderMap = [
        { el: dom.brightness, key: 'brightness', min: -50, max: 50 },
        { el: dom.contrast, key: 'contrast', min: -50, max: 50 },
        { el: dom.saturation, key: 'saturation', min: 0, max: 200 },
        { el: dom.temperature, key: 'temperature', min: -50, max: 50 },
    ];

    for (const { el, key, min, max } of sliderMap) {
        if (!el) continue;
        el.addEventListener('input', () => {
            const fallback = key === 'saturation' ? 100 : 0;
            state.filters[key] = clamp(toFiniteNumber(el.value, fallback), min, max);
            if (
                state.filters.brightness === 0 &&
                state.filters.contrast === 0 &&
                state.filters.saturation === 100 &&
                state.filters.temperature === 0
            ) {
                state.filters.cleanMode = false;
            }
            const matchedPreset = findMatchingPreset(state.filters);
            state.filters.preset = matchedPreset || 'custom';
            syncFilterControls();
            schedulePreviewRender();
        });
    }

    dom.resetFiltersBtn?.addEventListener('click', () => {
        applyPreset('original');
    });
}

/**
 * Checks whether current numeric slider values match a built-in preset exactly.
 * @param {object} filters
 * @returns {string | null}
 */
function findMatchingPreset(filters) {
    for (const [key, spec] of Object.entries(POSTER_PRESETS)) {
        if (
            filters.brightness === spec.brightness &&
            filters.contrast === spec.contrast &&
            filters.saturation === spec.saturation &&
            filters.temperature === spec.temperature &&
            Boolean(filters.cleanMode) === spec.cleanMode
        ) {
            return key;
        }
    }
    return null;
}

/**
 * Initializes the Poster 2.0 tool module, binds DOM events, and registers with `AppState`.
 */
export function initPosterTool() {
    if (state.initialized) return;
    state.initialized = true;

    const dom = getDom();
    state.manualCols = clamp(Math.round(toFiniteNumber(dom.cols?.value, 2)), 1, MAX_POSTER_GRID);
    state.manualRows = clamp(Math.round(toFiniteNumber(dom.rows?.value, 2)), 1, MAX_POSTER_GRID);
    syncGridPresetsUi(state.manualCols, state.manualRows);
    syncStepperButtonsUi(false, false);

    state.unbindDropzone = bindDropzone(dom.dropzone, dom.fileInput, {
        multiple: true,
        onFiles: handlePosterFiles,
    });

    // Multi-file navigation
    dom.prevBtn?.addEventListener('click', () => {
        if (state.currentIndex > 0) {
            state.currentIndex -= 1;
            updateNavUi();
            renderPosterPreview();
        }
    });

    dom.nextBtn?.addEventListener('click', () => {
        if (state.currentIndex < state.items.length - 1) {
            state.currentIndex += 1;
            updateNavUi();
            renderPosterPreview();
        }
    });

    // Layout & sheet settings
    const immediateRenderControls = [
        dom.paperSize,
        dom.orientation,
        dom.fitMode,
        dom.quality,
        dom.margin,
        dom.cropMarks,
        dom.tileLabels,
    ];
    for (const ctrl of immediateRenderControls) {
        ctrl?.addEventListener('change', () => schedulePreviewRender());
    }

    dom.viewAssembledBtn?.addEventListener('click', () => {
        state.previewMode = 'assembled';
        syncPreviewModeUi();
        renderPosterPreview();
    });

    dom.viewSheetsBtn?.addEventListener('click', () => {
        state.previewMode = 'sheets';
        syncPreviewModeUi();
        renderPosterPreview();
    });

    for (const [numInput, stateKey] of [
        [dom.cols, 'manualCols'],
        [dom.rows, 'manualRows'],
    ]) {
        if (!numInput) continue;
        numInput.addEventListener('input', () => {
            const parsed = Number(numInput.value);
            if (Number.isFinite(parsed) && parsed >= 1) {
                state[stateKey] = clamp(Math.round(parsed), 1, MAX_POSTER_GRID);
            }
            schedulePreviewRender();
        });
        numInput.addEventListener('change', () => {
            const clamped = clamp(Math.round(toFiniteNumber(numInput.value, state[stateKey])), 1, MAX_POSTER_GRID);
            state[stateKey] = clamped;
            numInput.value = String(clamped);
            schedulePreviewRender();
        });
    }

    document.querySelectorAll('.poster-stepper-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            const delta = Number(btn.dataset.delta);
            if (!Number.isFinite(delta) || (target !== 'cols' && target !== 'rows')) return;
            const input = target === 'cols' ? dom.cols : dom.rows;
            const stateKey = target === 'cols' ? 'manualCols' : 'manualRows';
            if (!input || input.disabled) return;
            const nextVal = clamp(state[stateKey] + delta, 1, MAX_POSTER_GRID);
            state[stateKey] = nextVal;
            input.value = String(nextVal);
            schedulePreviewRender();
        });
    });

    document.querySelectorAll('.poster-grid-preset').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetCols = clamp(Math.round(toFiniteNumber(btn.dataset.cols, 2)), 1, MAX_POSTER_GRID);
            const targetRows = clamp(Math.round(toFiniteNumber(btn.dataset.rows, 2)), 1, MAX_POSTER_GRID);
            state.manualCols = targetCols;
            state.manualRows = targetRows;
            if (dom.fitMode && (dom.fitMode.value === 'proportional' || dom.fitMode.value === 'proportional-height')) {
                dom.fitMode.value = 'stretch';
            }
            if (dom.cols) {
                dom.cols.disabled = false;
                dom.cols.value = String(targetCols);
            }
            if (dom.rows) {
                dom.rows.disabled = false;
                dom.rows.value = String(targetRows);
            }
            syncGridPresetsUi(targetCols, targetRows);
            schedulePreviewRender();
        });
    });

    dom.overlap?.addEventListener('input', () => {
        const val = clamp(toFiniteNumber(dom.overlap.value, 5), 0, 15);
        if (dom.overlapVal) dom.overlapVal.textContent = `${val} mm`;
        schedulePreviewRender();
    });

    bindRetouchControls();

    // Actions
    dom.downloadBtn?.addEventListener('click', () => {
        generatePosterPDF({ forPrint: false });
    });

    dom.printBtn?.addEventListener('click', () => {
        generatePosterPDF({ forPrint: true });
    });

    dom.resetBtn?.addEventListener('click', () => {
        resetPoster();
    });

    // React to language/theme switches when items are loaded
    AppState.on('lang:changed', () => {
        if (state.items.length > 0 && AppState.activeTool === 'poster') {
            renderPosterPreview();
        }
    });

    AppState.registerTool('poster', {
        onActivate: () => {
            if (state.items.length > 0) {
                updateNavUi();
                renderPosterPreview();
            }
        },
        onDeactivate: () => {
            if (state.rafId) {
                cancelAnimationFrame(state.rafId);
                state.rafId = 0;
            }
        },
        reset: resetPoster,
    });
}
