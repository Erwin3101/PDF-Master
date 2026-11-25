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
const MAX_PREVIEW_CANVAS_PX = 760;
const MAX_PREVIEW_SOURCE_PX = 1100;
const MAX_PDF_RENDER_DIM = 4096;
const MAX_PDF_RENDER_PIXELS = 16_000_000;
const TARGET_PDF_RENDER_SCALE = 2.5;
const MAX_EXPORT_TILE_DIM = 4500;
const POSTER_MARGIN_MM = 8;

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
        overlap: document.getElementById('poster-overlap'),
        overlapVal: document.getElementById('poster-overlap-val'),
        cropMarks: document.getElementById('poster-crop-marks'),
        tileLabels: document.getElementById('poster-tile-labels'),
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
 *   fitMode: 'contain'|'cover',
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
    const fitMode = dom.fitMode?.value === 'cover' ? 'cover' : 'contain';
    const cols = clamp(Math.round(toFiniteNumber(dom.cols?.value, 2)), 1, 10);
    const rows = clamp(Math.round(toFiniteNumber(dom.rows?.value, 2)), 1, 10);
    const quality = clamp(toFiniteNumber(dom.quality?.value, 0.92), 0.5, 1.0);
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
        marginMm: POSTER_MARGIN_MM,
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
 * Draws the live assembled poster preview and updates all summary statistics.
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
    });

    // Update live stats
    const fileCount = state.items.length;
    if (dom.statPages) {
        dom.statPages.textContent =
            fileCount > 1
                ? `${layout.totalPages} × ${fileCount} = ${layout.totalPages * fileCount}`
                : String(layout.totalPages);
    }
    if (dom.statGrid) {
        dom.statGrid.textContent = `${layout.cols} × ${layout.rows}`;
    }
    if (dom.statDims) {
        dom.statDims.textContent = `${layout.assembledWidthCm} × ${layout.assembledHeightCm} cm`;
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
        dom.previewCaption.textContent = `${prefix}${item.displayName} (${item.width}×${item.height} px)${overlapText}`;
    }

    // Scale assembled poster world cleanly to <= 760px
    const margin = layout.marginMm;
    const worldW = layout.totalW + margin * 2;
    const worldH = layout.totalH + margin * 2;
    const pxPerMm = Math.min(MAX_PREVIEW_CANVAS_PX / worldW, MAX_PREVIEW_CANVAS_PX / worldH);

    const canvas = dom.previewCanvas;
    canvas.width = Math.max(1, Math.round(worldW * pxPerMm));
    canvas.height = Math.max(1, Math.round(worldH * pxPerMm));

    const ctx = canvas.getContext('2d');
    const previewBitmap = getRetouchedPreviewBitmap(item);
    const bmpScaleX = previewBitmap.width / item.width;
    const bmpScaleY = previewBitmap.height / item.height;

    const stepX = layout.printableW - layout.overlapMm;
    const stepY = layout.printableH - layout.overlapYMm;

    // 1. Paper backdrop
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle tint on outer trim margin frame
    ctx.fillStyle = 'rgba(241, 245, 249, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
        margin * pxPerMm,
        margin * pxPerMm,
        layout.totalW * pxPerMm,
        layout.totalH * pxPerMm
    );

    // 2. Draw each tile's exact distortion-free image slice
    for (const tile of layout.tiles) {
        if (!tile.srcRect || !tile.destRectMm) continue;
        const dx = (tile.col * stepX + tile.destRectMm.x) * pxPerMm;
        const dy = (tile.row * stepY + tile.destRectMm.y) * pxPerMm;
        const dw = tile.destRectMm.w * pxPerMm;
        const dh = tile.destRectMm.h * pxPerMm;

        const sx = tile.srcRect.sx * bmpScaleX;
        const sy = tile.srcRect.sy * bmpScaleY;
        const sw = Math.max(0.5, tile.srcRect.sw * bmpScaleX);
        const sh = Math.max(0.5, tile.srcRect.sh * bmpScaleY);

        ctx.drawImage(previewBitmap, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    // 3. Draw overlap / glue tab zones when overlap > 0
    if (layout.cols > 1 && layout.overlapMm > 0) {
        ctx.fillStyle = settings.showCropMarks
            ? 'rgba(2, 132, 199, 0.14)'
            : 'rgba(236, 72, 153, 0.14)';
        for (let c = 1; c < layout.cols; c++) {
            const bx = (margin + c * stepX) * pxPerMm;
            const bw = layout.overlapMm * pxPerMm;
            ctx.fillRect(bx, margin * pxPerMm, bw, layout.totalH * pxPerMm);
        }
    }
    if (layout.rows > 1 && layout.overlapYMm > 0) {
        ctx.fillStyle = settings.showCropMarks
            ? 'rgba(2, 132, 199, 0.14)'
            : 'rgba(236, 72, 153, 0.14)';
        for (let r = 1; r < layout.rows; r++) {
            const by = (margin + r * stepY) * pxPerMm;
            const bh = layout.overlapYMm * pxPerMm;
            ctx.fillRect(margin * pxPerMm, by, layout.totalW * pxPerMm, bh);
        }
    }

    // 4. Draw each sheet's subtle printable boundary
    ctx.save();
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.28)';
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

    // 5. Draw clean red scissor badges on cut seams (without heavy cut lines or corner ticks)
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

    if (dom.cutLegend) {
        dom.cutLegend.classList.toggle('hidden', !(settings.showCropMarks && layout.totalPages > 1));
        const glueLegendItem = dom.cutLegend.querySelector('[data-i18n="poster_legend_glue"]')?.closest('.poster-legend-item');
        if (glueLegendItem) {
            glueLegendItem.classList.toggle('hidden', layout.overlapMm <= 0 && layout.overlapYMm <= 0);
        }
    }

    // 6. Draw subtle tile badge if enabled
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

        for (const tile of layout.tiles) {
            const px = (margin + tile.col * stepX) * pxPerMm;
            const py = (margin + tile.row * stepY) * pxPerMm;
            const text = micro
                ? `${tile.pageNum}`
                : compact
                    ? `F${tile.row + 1}-C${tile.col + 1}`
                    : tile.label;

            const padX = micro ? 4 : 6;
            const badgeH = fontSize + 7;
            const maxBadgeW = Math.max(16, tilePxW - 8);
            const metrics = ctx.measureText(text);
            const badgeW = Math.min(maxBadgeW, metrics.width + padX * 2);
            const bx = px + 4;
            const by = py + 4;

            ctx.fillStyle = 'rgba(15, 23, 42, 0.74)';
            fillRoundedRect(ctx, bx, by, badgeW, badgeH, 4);

            ctx.save();
            ctx.beginPath();
            ctx.rect(bx + 2, by, Math.max(1, badgeW - 4), badgeH);
            ctx.clip();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, bx + padX, by + badgeH / 2 + 0.5);
            ctx.restore();
        }
        ctx.restore();
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
 * Draws only the red "RECORTAR AQUÍ" / "CUT HERE" indicator with vector scissors
 * in the outer margin of a cut edge (no long cut lines or corner ticks).
 */
function drawPdfCutEdge(doc, { x0, y0, x1, y1, margin, side }) {
    const isVertical = side === 'left' || side === 'right';
    const label = msg('RECORTAR AQUÍ', 'CUT HERE');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(POSTER_CUT_RGB.r, POSTER_CUT_RGB.g, POSTER_CUT_RGB.b);

    const textW = doc.getTextWidth(label);
    const iconScale = 0.85;
    const iconW = 3.4;
    const gap = 1.5;
    const groupW = iconW + gap + textW;

    if (isVertical) {
        const cx = side === 'right' ? x1 + margin * 0.54 : x0 - margin * 0.46;
        const cy = (y0 + y1) / 2;
        const iconCy = cy + groupW / 2 - iconW / 2;
        drawScissorsToPdf(doc, cx, iconCy, iconScale, true, POSTER_CUT_RGB);
        const textStartY = cy + groupW / 2 - iconW - gap;
        doc.text(label, cx + 0.85, textStartY, { angle: 90 });
    } else {
        const cx = (x0 + x1) / 2;
        const cy = side === 'bottom' ? y1 + margin * 0.56 : y0 - margin * 0.44;
        const iconCx = cx - groupW / 2 + iconW / 2;
        drawScissorsToPdf(doc, iconCx, cy, iconScale, false, POSTER_CUT_RGB);
        const textStartX = cx - groupW / 2 + iconW + gap;
        doc.text(label, textStartX, cy + 0.85);
    }
}

/**
 * Draws only the blue "PEGAR AQUÍ" / "GLUE HERE" indicator in the margin
 * of a glue overlap edge (no long guide lines or corner ticks).
 */
function drawPdfGlueEdge(doc, { x0, y0, x1, y1, margin, side, neighborLabel }) {
    const isVertical = side === 'left';
    const label = msg(
        `PEGAR AQUÍ · ${neighborLabel}`,
        `GLUE HERE · ${neighborLabel}`
    );
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(POSTER_GLUE_RGB.r, POSTER_GLUE_RGB.g, POSTER_GLUE_RGB.b);
    const textW = doc.getTextWidth(label);

    if (isVertical) {
        const cx = x0 - margin * 0.46;
        const cy = (y0 + y1) / 2;
        doc.text(label, cx + 0.8, cy + textW / 2, { angle: 90 });
    } else {
        const cx = (x0 + x1) / 2;
        const cy = y0 - margin * 0.44;
        doc.text(label, cx - textW / 2, cy + 0.8);
    }
}

/**
 * Draws clean red cut labels (✂ RECORTAR AQUÍ) and blue glue labels (PEGAR AQUÍ)
 * without long cut lines, corner ticks, or colliding edge summaries, plus optional tile labels.
 *
 * @param {object} doc jsPDF instance
 * @param {object} layout Computed poster layout
 * @param {object} tile Current tile metadata
 * @param {{ showCropMarks: boolean, showTileLabels: boolean }} options
 */
function drawPdfTileAnnotations(doc, layout, tile, { showCropMarks, showTileLabels }) {
    const { x: x0, y: y0, w: pw, h: ph } = tile.printableRectMm;
    const x1 = x0 + pw;
    const y1 = y0 + ph;
    const margin = layout.marginMm;
    const bottomLabelY = Math.min(layout.sheetH - 1.8, y1 + Math.max(3.6, margin * 0.58));

    if (showCropMarks) {
        const cut = tile.cutEdges || {};
        for (const side of ['top', 'right', 'bottom', 'left']) {
            if (cut[side]) {
                drawPdfCutEdge(doc, { x0, y0, x1, y1, margin, side });
            }
        }

        const glue = tile.glueEdges || {};
        if (glue.left) {
            drawPdfGlueEdge(doc, {
                x0,
                y0,
                x1,
                y1,
                margin,
                side: 'left',
                neighborLabel: `F${tile.row + 1}-C${tile.col}`,
            });
        }
        if (glue.top) {
            drawPdfGlueEdge(doc, {
                x0,
                y0,
                x1,
                y1,
                margin,
                side: 'top',
                neighborLabel: `F${tile.row}-C${tile.col + 1}`,
            });
        }
    }

    if (showTileLabels) {
        const labelX = Math.max(x0 + 2, x1 - 3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(tile.label, labelX, bottomLabelY, { align: 'right' });
    }
}

/**
 * Generates the multi-page poster PDF across all loaded items using jsPDF,
 * applying the shared retouching pipeline to every tile before JPEG embedding.
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
        })
    );

    const totalExportedPages = layouts.reduce((acc, l) => acc + l.totalPages, 0);
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

        for (let itemIdx = 0; itemIdx < state.items.length; itemIdx++) {
            const item = state.items[itemIdx];
            const layout = layouts[itemIdx];

            for (const tile of layout.tiles) {
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

                if (tile.srcRect && tile.destRectMm) {
                    let tw = tile.srcRect.sw;
                    let th = tile.srcRect.sh;
                    if (tw > MAX_EXPORT_TILE_DIM || th > MAX_EXPORT_TILE_DIM) {
                        const capScale = MAX_EXPORT_TILE_DIM / Math.max(tw, th);
                        tw = Math.max(1, Math.round(tw * capScale));
                        th = Math.max(1, Math.round(th * capScale));
                    }

                    tileCanvas.width = tw;
                    tileCanvas.height = th;
                    tileCtx.fillStyle = '#ffffff';
                    tileCtx.fillRect(0, 0, tw, th);
                    tileCtx.drawImage(
                        item.image,
                        tile.srcRect.sx,
                        tile.srcRect.sy,
                        tile.srcRect.sw,
                        tile.srcRect.sh,
                        0,
                        0,
                        tw,
                        th
                    );

                    if (retouchNeeded) {
                        const imgData = tileCtx.getImageData(0, 0, tw, th);
                        applyRetouchToImageData(imgData, state.filters);
                        tileCtx.putImageData(imgData, 0, 0);
                    }

                    const jpegDataUrl = tileCanvas.toDataURL('image/jpeg', settings.quality);
                    doc.addImage(
                        jpegDataUrl,
                        'JPEG',
                        tile.destRectMm.x,
                        tile.destRectMm.y,
                        tile.destRectMm.w,
                        tile.destRectMm.h
                    );
                }

                drawPdfTileAnnotations(doc, layout, tile, {
                    showCropMarks: settings.showCropMarks,
                    showTileLabels: settings.showTileLabels,
                });

                processedPages += 1;
                await yieldToUi();
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
            ToastManager.success(
                t('toast_poster_done', {
                    pages: totalExportedPages,
                    cols: firstLayout.cols,
                    rows: firstLayout.rows,
                })
            );
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

    const dom = getDom();
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
        dom.cropMarks,
        dom.tileLabels,
    ];
    for (const ctrl of immediateRenderControls) {
        ctrl?.addEventListener('change', () => schedulePreviewRender());
    }

    for (const numInput of [dom.cols, dom.rows]) {
        if (!numInput) continue;
        numInput.addEventListener('input', () => schedulePreviewRender());
        numInput.addEventListener('change', () => {
            const clamped = clamp(Math.round(toFiniteNumber(numInput.value, 2)), 1, 10);
            numInput.value = String(clamped);
            schedulePreviewRender();
        });
    }

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
