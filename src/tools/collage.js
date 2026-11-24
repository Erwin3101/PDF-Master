import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import { computeContainRect } from '../core/geometry.js';
import { decodeImageFile } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { bindDropzone } from '../ui/dropzone.js';

const CANVAS_SIZE = 1600;
const DEFAULT_TEMPLATE = 'grid';
const DEFAULT_GAP = 10;
const DEFAULT_BG = '#ffffff';

/**
 * Deterministic Mulberry32-style PRNG returning a float in `[0, 1)` for a given integer seed.
 * @param {number} seed
 * @returns {number}
 */
function seededUnit(seed) {
    let x = (seed + 0x6d2b79f5) | 0;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}

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
                    reject(new Error('No se pudo exportar el collage.'));
                }
            },
            mime,
            quality
        );
    });
}

/**
 * Draws an image into `(x, y, w, h)` preserving aspect ratio (contain) and clipping cleanly.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ image: HTMLImageElement, width: number, height: number }} img
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
function drawContain(ctx, img, x, y, w, h) {
    if (!img?.image || w <= 0 || h <= 0) return;
    const rect = computeContainRect(img.width, img.height, x, y, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img.image, rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
}

/**
 * Computes rectangular slots arranged in horizontal rows with optional relative row heights.
 * @param {number} W
 * @param {number} H
 * @param {number} gap
 * @param {number[]} rowCounts
 * @param {number[] | null} [rowWeights=null]
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
function buildRowSlots(W, H, gap, rowCounts, rowWeights = null) {
    const rows = rowCounts.length;
    if (rows === 0) return [];
    const weights = rowWeights && rowWeights.length === rows ? rowWeights : Array(rows).fill(1);
    const weightSum = weights.reduce((acc, val) => acc + val, 0) || 1;
    const availH = Math.max(10, H - gap * (rows + 1));

    const slots = [];
    let curY = gap;

    for (let r = 0; r < rows; r++) {
        const cols = Math.max(1, rowCounts[r]);
        const rowH = (availH * weights[r]) / weightSum;
        const cellW = Math.max(10, (W - gap * (cols + 1)) / cols);

        for (let c = 0; c < cols; c++) {
            slots.push({
                x: gap + c * (cellW + gap),
                y: curY,
                w: cellW,
                h: rowH,
            });
        }
        curY += rowH + gap;
    }

    return slots;
}

/**
 * Computes rectangular slots arranged in vertical columns with optional relative column widths.
 * @param {number} W
 * @param {number} H
 * @param {number} gap
 * @param {number[]} colCounts
 * @param {number[] | null} [colWeights=null]
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
function buildColSlots(W, H, gap, colCounts, colWeights = null) {
    const cols = colCounts.length;
    if (cols === 0) return [];
    const weights = colWeights && colWeights.length === cols ? colWeights : Array(cols).fill(1);
    const weightSum = weights.reduce((acc, val) => acc + val, 0) || 1;
    const availW = Math.max(10, W - gap * (cols + 1));

    const slots = [];
    let curX = gap;

    for (let c = 0; c < cols; c++) {
        const rows = Math.max(1, colCounts[c]);
        const colW = (availW * weights[c]) / weightSum;
        const cellH = Math.max(10, (H - gap * (rows + 1)) / rows);

        for (let r = 0; r < rows; r++) {
            slots.push({
                x: curX,
                y: gap + r * (cellH + gap),
                w: colW,
                h: cellH,
            });
        }
        curX += colW + gap;
    }

    return slots;
}

/**
 * Builds balanced automatic grid row counts for `count` images.
 * @param {number} count
 * @returns {number[]}
 */
function computeAutoGridRows(count) {
    if (count <= 1) return [1];
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const base = Math.floor(count / rows);
    const rem = count % rows;
    return Array.from({ length: rows }, (_, idx) => base + (idx < rem ? 1 : 0));
}

/**
 * Builds an adaptive asymmetric mosaic layout matching `count` images.
 * @param {number} W
 * @param {number} H
 * @param {number} gap
 * @param {number} count
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
function buildMosaicSlots(W, H, gap, count) {
    if (count <= 1) return buildRowSlots(W, H, gap, [1]);
    if (count === 2) return buildColSlots(W, H, gap, [1, 1], [1.3, 1]);
    if (count === 3) return buildColSlots(W, H, gap, [1, 2], [1.25, 1]);
    if (count === 4) return buildRowSlots(W, H, gap, [1, 3], [1.3, 1]);
    if (count === 5) return buildRowSlots(W, H, gap, [2, 3], [1.2, 1]);

    const rowCounts = [];
    const rowWeights = [];
    let remaining = count;
    let rowIdx = 0;

    while (remaining > 0) {
        const target = rowIdx % 2 === 0 ? 2 : 3;
        const take = remaining <= 3 ? remaining : Math.min(target, remaining);
        rowCounts.push(take);
        rowWeights.push(take === 2 ? 1.2 : 1);
        remaining -= take;
        rowIdx += 1;
    }

    return buildRowSlots(W, H, gap, rowCounts, rowWeights);
}

/**
 * Computes slots for `1l4r` (1 large column on the left + 2x2 grid on the right).
 * @param {number} W
 * @param {number} H
 * @param {number} gap
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
function build1L4RSlots(W, H, gap) {
    const availW = Math.max(20, W - gap * 3);
    const leftW = availW * 0.48;
    const rightW = availW - leftW;
    const rightX = gap * 2 + leftW;
    const subW = Math.max(10, (rightW - gap) / 2);
    const subH = Math.max(10, (H - gap * 3) / 2);

    return [
        { x: gap, y: gap, w: leftW, h: Math.max(10, H - gap * 2) },
        { x: rightX, y: gap, w: subW, h: subH },
        { x: rightX + subW + gap, y: gap, w: subW, h: subH },
        { x: rightX, y: gap * 2 + subH, w: subW, h: subH },
        { x: rightX + subW + gap, y: gap * 2 + subH, w: subW, h: subH },
    ];
}

/**
 * Renders the deterministic scattered photo pile template (`pile`).
 * Positions and rotation angles use deterministic seeded PRNG per image index
 * so adjusting `gap` or background color never causes photos to jump.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ image: HTMLImageElement, width: number, height: number }>} images
 * @param {number} W
 * @param {number} H
 * @param {number} gap
 */
function renderPileTemplate(ctx, images, W, H, gap) {
    const n = images.length;
    if (n === 0) return;

    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const padX = W * 0.14;
    const padY = H * 0.14;
    const usableW = W - padX * 2;
    const usableH = H - padY * 2;
    const cellW = usableW / cols;
    const cellH = usableH / rows;

    const cardW = Math.min(W * 0.56, Math.max(260, cellW * 1.12));
    const cardH = Math.min(H * 0.56, Math.max(260, cellH * 1.12));
    const framePad = Math.max(8, Math.round(10 + gap * 0.35));

    for (let i = 0; i < n; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);

        const rx = seededUnit(i * 101 + 17);
        const ry = seededUnit(i * 211 + 43);
        const rAngle = seededUnit(i * 307 + 89);

        const baseCx = padX + (col + 0.5) * cellW;
        const baseCy = padY + (row + 0.5) * cellH;
        const jitterX = (rx - 0.5) * cellW * 0.36;
        const jitterY = (ry - 0.5) * cellH * 0.36;

        const cx = Math.max(cardW * 0.38, Math.min(W - cardW * 0.38, baseCx + jitterX));
        const cy = Math.max(cardH * 0.38, Math.min(H - cardH * 0.38, baseCy + jitterY));
        const angleRad = (rAngle - 0.5) * 0.56; // Deterministic [-16°, +16°]

        const img = images[i];
        const innerMaxW = Math.max(40, cardW - framePad * 2);
        const innerMaxH = Math.max(40, cardH - framePad * 2);
        const rect = computeContainRect(
            img.width,
            img.height,
            -innerMaxW / 2,
            -innerMaxH / 2,
            innerMaxW,
            innerMaxH
        );

        const outerX = rect.x - framePad;
        const outerY = rect.y - framePad;
        const outerW = rect.w + framePad * 2;
        const outerH = rect.h + framePad * 2;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angleRad);

        ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
        ctx.shadowBlur = 22;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(outerX, outerY, outerW, outerH);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.drawImage(img.image, rect.x, rect.y, rect.w, rect.h);

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
        ctx.lineWidth = 2;
        ctx.strokeRect(outerX, outerY, outerW, outerH);
        ctx.restore();
    }
}

/**
 * Resolves rectangular slots for non-special template IDs.
 * @param {string} template
 * @param {number} W
 * @param {number} H
 * @param {number} gap
 * @param {number} imageCount
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
function getTemplateSlots(template, W, H, gap, imageCount) {
    switch (template) {
        case 'grid':
            return buildRowSlots(W, H, gap, computeAutoGridRows(imageCount));
        case 'mosaic':
            return buildMosaicSlots(W, H, gap, imageCount);
        case 'strip':
            return buildRowSlots(W, H, gap, Array(Math.max(1, imageCount)).fill(1));
        case '2v':
            return buildColSlots(W, H, gap, [1, 1]);
        case '2h':
            return buildRowSlots(W, H, gap, [1, 1]);
        case '3v':
            return buildColSlots(W, H, gap, [1, 1, 1]);
        case '1u2d':
            return buildRowSlots(W, H, gap, [1, 2], [1.2, 1]);
        case '2u1d':
            return buildRowSlots(W, H, gap, [2, 1], [1, 1.2]);
        case '1l2r':
            return buildColSlots(W, H, gap, [1, 2], [1.2, 1]);
        case '2l1r':
            return buildColSlots(W, H, gap, [2, 1], [1, 1.2]);
        case '2x2':
            return buildRowSlots(W, H, gap, [2, 2]);
        case '1u3d':
            return buildRowSlots(W, H, gap, [1, 3], [1.3, 1]);
        case '3u1d':
            return buildRowSlots(W, H, gap, [3, 1], [1, 1.3]);
        case '1l3r':
            return buildColSlots(W, H, gap, [1, 3], [1.3, 1]);
        case '3l1r':
            return buildColSlots(W, H, gap, [3, 1], [1, 1.3]);
        case '2u3d':
            return buildRowSlots(W, H, gap, [2, 3], [1.15, 1]);
        case '3u2d':
            return buildRowSlots(W, H, gap, [3, 2], [1, 1.15]);
        case '1l4r':
            return build1L4RSlots(W, H, gap);
        case '2x3':
            return buildRowSlots(W, H, gap, [2, 2, 2]);
        case '3x2':
            return buildRowSlots(W, H, gap, [3, 3]);
        case '1u5d':
            return buildRowSlots(W, H, gap, [1, 2, 3], [1.35, 1, 1]);
        case '4x2':
            return buildRowSlots(W, H, gap, [4, 4]);
        case '3x3':
            return buildRowSlots(W, H, gap, [3, 3, 3]);
        default:
            return buildRowSlots(W, H, gap, computeAutoGridRows(imageCount));
    }
}

/**
 * Initializes the Collage Studio tool (`#section-collage`).
 * Supports 25 layout templates, HEIC/TIFF decoding, extra image addition,
 * live rAF-coalesced gap & background controls, PNG download, and printing.
 */
export function initCollageTool() {
    const section = document.getElementById('section-collage');
    if (!section || section.dataset.collageInitialized === 'true') return;
    section.dataset.collageInitialized = 'true';

    const uploadArea = document.getElementById('collage-upload-area');
    const dropzone = document.getElementById('collage-dropzone');
    const fileInput = document.getElementById('file-input-collage');
    const workspace = document.getElementById('collage-workspace');
    const templatesContainer = document.getElementById('collage-templates');
    const addBtn = document.getElementById('collage-add-btn');
    const addInput = document.getElementById('collage-add-input');
    const gapSlider = document.getElementById('collage-gap');
    const gapValBadge = document.getElementById('gap-val');
    const bgInput = document.getElementById('collage-bg');
    const colorSwatches = Array.from(section.querySelectorAll('.color-swatch[data-color]'));
    const downloadBtn = document.getElementById('collage-download-btn');
    const printBtn = document.getElementById('collage-print-btn');
    const resetBtn = document.getElementById('collage-reset-btn');
    const canvas = document.getElementById('collage-canvas');
    const ctx = canvas?.getContext('2d', { alpha: false });

    const state = {
        images: [],
        template: DEFAULT_TEMPLATE,
        gap: DEFAULT_GAP,
        bgColor: DEFAULT_BG,
        rafId: 0,
    };

    const syncTemplateSelection = () => {
        if (!templatesContainer) return;
        const buttons = templatesContainer.querySelectorAll('.template-option[data-template]');
        for (const btn of buttons) {
            btn.classList.toggle('selected', btn.dataset.template === state.template);
        }
    };

    const syncBackgroundUi = () => {
        const normalized = String(state.bgColor || DEFAULT_BG).toLowerCase();
        if (bgInput && bgInput.value.toLowerCase() !== normalized) {
            bgInput.value = normalized;
        }
        for (const swatch of colorSwatches) {
            const swatchColor = String(swatch.dataset.color || '').toLowerCase();
            const isMatch = swatchColor === normalized;
            swatch.classList.toggle('selected', isMatch);
            swatch.classList.toggle('is-active', isMatch);
        }
    };

    const syncGapBadge = () => {
        if (gapValBadge) {
            gapValBadge.textContent = `${state.gap}px`;
        }
    };

    const renderCollage = () => {
        if (!canvas || !ctx) return;

        const count = state.images.length;
        const isStrip = state.template === 'strip';
        const W = isStrip ? 1000 : CANVAS_SIZE;
        const H = isStrip
            ? Math.min(4096, Math.max(1400, count * 520 + state.gap * (count + 1)))
            : CANVAS_SIZE;

        if (canvas.width !== W || canvas.height !== H) {
            canvas.width = W;
            canvas.height = H;
        }

        ctx.fillStyle = state.bgColor;
        ctx.fillRect(0, 0, W, H);

        if (count === 0) return;

        if (state.template === 'pile') {
            renderPileTemplate(ctx, state.images, W, H, state.gap);
            return;
        }

        if (state.template === '3h') {
            const gap = state.gap;
            const w = W - gap * 2;
            const h = (H - gap * 4) / 3;
            for (let i = 0; i < Math.min(3, count); i++) {
                drawContain(ctx, state.images[i], gap, gap + i * (h + gap), w, h);
            }
            return;
        }

        const slots = getTemplateSlots(state.template, W, H, state.gap, count);
        const drawCount = Math.min(count, slots.length);
        for (let i = 0; i < drawCount; i++) {
            const slot = slots[i];
            drawContain(ctx, state.images[i], slot.x, slot.y, slot.w, slot.h);
        }
    };

    const scheduleRender = () => {
        if (state.rafId) return;
        state.rafId = requestAnimationFrame(() => {
            state.rafId = 0;
            renderCollage();
        });
    };

    const decodeAndAppendFiles = async (files) => {
        if (!files || files.length === 0) return;
        if (AppState.busy) {
            ToastManager.warning(
                AppState.lang === 'en'
                    ? 'Please wait until the current task finishes.'
                    : 'Espera a que termine la operación actual.'
            );
            return;
        }

        AppState.setBusy(true);
        let addedCount = 0;

        try {
            for (const file of files) {
                try {
                    const decoded = await decodeImageFile(file);
                    state.images.push(decoded);
                    addedCount += 1;
                } catch (err) {
                    ToastManager.warning(
                        t('toast_file_skipped', {
                            name: file?.name || 'archivo',
                            reason: err?.message || 'Formato no soportado',
                        })
                    );
                }
            }

            if (state.images.length > 0 && addedCount > 0) {
                uploadArea?.classList.add('hidden');
                workspace?.classList.remove('hidden');
                syncTemplateSelection();
                syncGapBadge();
                syncBackgroundUi();
                renderCollage();
            }
        } finally {
            if (addInput) addInput.value = '';
            AppState.setBusy(false);
        }
    };

    const resetWorkspace = () => {
        if (AppState.busy) return;
        if (state.rafId) {
            cancelAnimationFrame(state.rafId);
            state.rafId = 0;
        }

        state.images = [];
        state.template = DEFAULT_TEMPLATE;
        state.gap = DEFAULT_GAP;
        state.bgColor = DEFAULT_BG;

        if (gapSlider) gapSlider.value = String(DEFAULT_GAP);
        if (bgInput) bgInput.value = DEFAULT_BG;
        syncTemplateSelection();
        syncGapBadge();
        syncBackgroundUi();

        if (canvas) {
            canvas.width = 0;
            canvas.height = 0;
        }

        workspace?.classList.add('hidden');
        uploadArea?.classList.remove('hidden');
    };

    const downloadPng = async () => {
        if (!canvas || state.images.length === 0 || AppState.busy) return;

        AppState.setBusy(true);
        try {
            renderCollage();
            const blob = await canvasToBlob(canvas, 'image/png');
            const filename = buildOutputName({
                originalName: state.images[0]?.name || 'collage',
                suffix: `collage_${state.template}`,
                ext: 'png',
            });
            BlobRegistry.downloadBlob(blob, filename);
            ToastManager.success(
                AppState.lang === 'en'
                    ? `Collage saved: ${filename}`
                    : `Collage guardado: ${filename}`
            );
        } catch (err) {
            ToastManager.error(err?.message || 'No se pudo descargar el collage PNG.');
        } finally {
            AppState.setBusy(false);
        }
    };

    const printCollage = () => {
        if (!canvas || state.images.length === 0 || AppState.busy) return;
        renderCollage();
        PrintService.printCanvas(canvas, 'Collage');
    };

    bindDropzone(dropzone, fileInput, {
        multiple: true,
        onFiles: decodeAndAppendFiles,
    });

    addBtn?.addEventListener('click', () => {
        if (!AppState.busy) {
            addInput?.click();
        }
    });

    addInput?.addEventListener('change', () => {
        const files = Array.from(addInput.files || []);
        addInput.value = '';
        if (files.length > 0) {
            void decodeAndAppendFiles(files);
        }
    });

    templatesContainer?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest('.template-option[data-template]');
        if (!btn) return;
        const templateId = btn.getAttribute('data-template');
        if (!templateId || templateId === state.template) return;
        state.template = templateId;
        syncTemplateSelection();
        scheduleRender();
    });

    gapSlider?.addEventListener('input', () => {
        state.gap = Math.max(0, Math.min(50, Number(gapSlider.value) || 0));
        syncGapBadge();
        scheduleRender();
    });

    bgInput?.addEventListener('input', () => {
        state.bgColor = bgInput.value || DEFAULT_BG;
        syncBackgroundUi();
        scheduleRender();
    });

    for (const swatch of colorSwatches) {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color;
            if (!color) return;
            state.bgColor = color;
            syncBackgroundUi();
            scheduleRender();
        });
    }

    downloadBtn?.addEventListener('click', () => {
        void downloadPng();
    });
    printBtn?.addEventListener('click', printCollage);
    resetBtn?.addEventListener('click', resetWorkspace);

    syncTemplateSelection();
    syncGapBadge();
    syncBackgroundUi();

    AppState.registerTool('collage', {
        reset: resetWorkspace,
    });
}
