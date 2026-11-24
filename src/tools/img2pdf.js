import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { DragSortManager } from '../core/dragSortManager.js';
import { buildOutputName } from '../core/fileNaming.js';
import {
    PAPER_SIZES,
    clampPdfRenderScale,
    computeContainRect,
    computeDuplicate2x1Layout,
} from '../core/geometry.js';
import {
    detectFileKind,
    decodeImageFile,
    openPdfFile,
    renderPdfPageToCanvas,
    rotateImageDataUrl,
} from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const STANDARD_MARGINS_MM = Object.freeze({
    none: 0,
    small: 8,
    normal: 16,
});

const getCutLabel = () => (AppState.lang === 'en' ? '- Cut here -' : '- Recortar aquí -');
const CUT_FONT_PT = 8.5;
const PT_TO_MM = 25.4 / 72;
const CUT_FONT_MM = CUT_FONT_PT * PT_TO_MM;
const PREVIEW_MAX_PX = 900;
const THUMB_MAX_PX = 320;

let idCounter = 0;

/**
 * Generates a collision-free item identifier.
 * @returns {string}
 */
function createItemId() {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    idCounter += 1;
    return `img_${Date.now()}_${idCounter}`;
}

/**
 * Strips the trailing file extension from a filename.
 * @param {string} fileName
 * @returns {string}
 */
function stripExtension(fileName) {
    if (!fileName || typeof fileName !== 'string') return 'documento';
    const base = fileName.replace(/\.[^/.]+$/, '').trim();
    return base || 'documento';
}

/**
 * Parses a hex color string (`#RRGGBB` or `#RGB`) into RGB integers.
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function parseHexRgb(hex) {
    const clean = String(hex || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(clean)) {
        return {
            r: parseInt(clean[0] + clean[0], 16),
            g: parseInt(clean[1] + clean[1], 16),
            b: parseInt(clean[2] + clean[2], 16),
        };
    }
    if (/^[0-9a-f]{6}$/i.test(clean)) {
        return {
            r: parseInt(clean.slice(0, 2), 16),
            g: parseInt(clean.slice(2, 4), 16),
            b: parseInt(clean.slice(4, 6), 16),
        };
    }
    return { r: 51, g: 65, b: 85 };
}

/**
 * Loads an HTMLImageElement from a DataURL.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (!img.naturalWidth || !img.naturalHeight) {
                reject(new Error('Imagen con dimensiones inválidas.'));
                return;
            }
            resolve(img);
        };
        img.onerror = () => reject(new Error('No se pudo cargar la imagen renderizada.'));
        img.src = src;
    });
}

/**
 * Yields briefly to keep progress UI and abort signals responsive.
 * @returns {Promise<void>}
 */
function yieldToMain() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Returns normalized rotation and effective width/height after rotation.
 * @param {{ width: number, height: number, rotation: number }} item
 * @returns {{ w: number, h: number, rotation: number }}
 */
function getEffectiveDimensions(item) {
    const rot = ((Number(item.rotation) || 0) % 360 + 360) % 360;
    const swap = rot === 90 || rot === 270;
    return {
        w: swap ? item.height : item.width,
        h: swap ? item.width : item.height,
        rotation: rot,
    };
}

/**
 * Computes exact page & contained image geometry in mm for Standard mode.
 * Shared 1:1 between Canvas preview and jsPDF export.
 * @param {object} params
 * @param {string} params.pageSizeOpt
 * @param {'auto'|'p'|'l'} params.orientationOpt
 * @param {'none'|'small'|'normal'} params.marginOpt
 * @param {number} params.imgW
 * @param {number} params.imgH
 */
function computeStandardPageLayout({
    pageSizeOpt = 'letter',
    orientationOpt = 'auto',
    marginOpt = 'small',
    imgW,
    imgH,
}) {
    const safeW = Math.max(1, Number(imgW) || 1);
    const safeH = Math.max(1, Number(imgH) || 1);
    const requestedMargin = STANDARD_MARGINS_MM[marginOpt] ?? STANDARD_MARGINS_MM.small;

    let pageW;
    let pageH;
    let resolvedOrient;

    if (pageSizeOpt === 'fit') {
        const baseW = (safeW * 25.4) / 96;
        const baseH = (safeH * 25.4) / 96;
        const minSide = Math.min(baseW, baseH);
        const maxSide = Math.max(baseW, baseH);

        if (orientationOpt === 'p') {
            pageW = minSide;
            pageH = maxSide;
            resolvedOrient = 'p';
        } else if (orientationOpt === 'l') {
            pageW = maxSide;
            pageH = minSide;
            resolvedOrient = 'l';
        } else {
            pageW = baseW;
            pageH = baseH;
            resolvedOrient = baseW > baseH ? 'l' : 'p';
        }
    } else {
        const spec = PAPER_SIZES[pageSizeOpt] || PAPER_SIZES.letter;
        const shortDim = Math.min(spec.w, spec.h);
        const longDim = Math.max(spec.w, spec.h);
        resolvedOrient = orientationOpt === 'auto' ? (safeW > safeH ? 'l' : 'p') : orientationOpt;
        pageW = resolvedOrient === 'l' ? longDim : shortDim;
        pageH = resolvedOrient === 'l' ? shortDim : longDim;
    }

    const safeMargin = Math.min(requestedMargin, Math.max(0, Math.min(pageW, pageH) / 2 - 1));
    const innerW = Math.max(1, pageW - safeMargin * 2);
    const innerH = Math.max(1, pageH - safeMargin * 2);
    const imageRect = computeContainRect(safeW, safeH, safeMargin, safeMargin, innerW, innerH);

    return {
        pageW,
        pageH,
        orientation: resolvedOrient,
        marginMm: safeMargin,
        imageRect,
        paperKey: pageSizeOpt,
    };
}

/**
 * Draws an HTMLImageElement onto a 2D canvas context with the given rotation
 * fitted into the already-rotated destination rectangle `(x, y, w, h)`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} rotation
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 */
function drawRotatedImageToCtx(ctx, img, rotation, x, y, w, h) {
    const rot = ((rotation % 360) + 360) % 360;
    if (rot === 0) {
        ctx.drawImage(img, x, y, w, h);
        return;
    }
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((rot * Math.PI) / 180);
    if (rot === 90 || rot === 270) {
        ctx.drawImage(img, -h / 2, -w / 2, h, w);
    } else {
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
}

/**
 * Generates a lightweight rotated JPEG thumbnail DataURL for grid cards.
 * Keeps original `item.dataUrl` untouched to avoid quality loss on repeated rotations.
 * @param {HTMLImageElement} image
 * @param {number} rotation
 * @returns {string}
 */
function createThumbDataUrl(image, rotation) {
    const rot = ((rotation % 360) + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const srcW = image.naturalWidth || image.width || 1;
    const srcH = image.naturalHeight || image.height || 1;
    const effW = swap ? srcH : srcW;
    const effH = swap ? srcW : srcH;
    const scale = Math.min(1, THUMB_MAX_PX / Math.max(effW, effH));
    const w = Math.max(1, Math.round(effW * scale));
    const h = Math.max(1, Math.round(effH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    drawRotatedImageToCtx(ctx, image, rot, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
}

/**
 * Prepares a jsPDF-compatible image DataURL and dimensions with item rotation baked in.
 * @param {{ dataUrl: string, width: number, height: number, rotation: number }} item
 * @returns {Promise<{ dataUrl: string, width: number, height: number, format: 'JPEG'|'PNG' }>}
 */
async function preparePdfImage(item) {
    const eff = getEffectiveDimensions(item);
    const isPng = item.dataUrl.startsWith('data:image/png');
    const isJpeg = item.dataUrl.startsWith('data:image/jpeg') || item.dataUrl.startsWith('data:image/jpg');

    if (eff.rotation === 0 && (isPng || isJpeg)) {
        return {
            dataUrl: item.dataUrl,
            width: eff.w,
            height: eff.h,
            format: isPng ? 'PNG' : 'JPEG',
        };
    }

    const targetMime = isPng ? 'image/png' : 'image/jpeg';
    const rotated = await rotateImageDataUrl(item.dataUrl, eff.rotation, targetMime, 0.92);
    return {
        dataUrl: rotated.dataUrl,
        width: rotated.width,
        height: rotated.height,
        format: isPng ? 'PNG' : 'JPEG',
    };
}

/**
 * Draws a crisp vector scissors icon onto Canvas 2D in mm units scaled by `scale`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cxMm
 * @param {number} cyMm
 * @param {number} scale
 * @param {boolean} isVertical
 * @param {string} color
 */
function drawScissorsToCtx(ctx, cxMm, cyMm, scale, isVertical, color) {
    ctx.save();
    ctx.translate(cxMm * scale, cyMm * scale);
    if (isVertical) {
        ctx.rotate(-Math.PI / 2);
    }
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 0.32;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Handle loops
    ctx.beginPath();
    ctx.arc(-1.25, -0.82, 0.58, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-1.25, 0.82, 0.58, 0, Math.PI * 2);
    ctx.stroke();

    // Crossing blades
    ctx.beginPath();
    ctx.moveTo(-0.72, -0.52);
    ctx.lineTo(1.78, 0.82);
    ctx.moveTo(-0.72, 0.52);
    ctx.lineTo(1.78, -0.82);
    ctx.stroke();

    // Pivot screw
    ctx.beginPath();
    ctx.arc(0.05, 0, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/**
 * Draws a crisp vector scissors icon in jsPDF in mm units matching Canvas 1:1.
 * @param {any} doc
 * @param {number} cxMm
 * @param {number} cyMm
 * @param {number} iconScale
 * @param {boolean} isVertical
 * @param {{ r: number, g: number, b: number }} rgb
 */
function drawScissorsToPdf(doc, cxMm, cyMm, iconScale, isVertical, rgb) {
    const mapPt = (lx, ly) =>
        isVertical
            ? { x: cxMm + ly * iconScale, y: cyMm - lx * iconScale }
            : { x: cxMm + lx * iconScale, y: cyMm + ly * iconScale };

    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(0.32 * iconScale);

    const h1 = mapPt(-1.25, -0.82);
    const h2 = mapPt(-1.25, 0.82);
    doc.circle(h1.x, h1.y, 0.58 * iconScale, 'S');
    doc.circle(h2.x, h2.y, 0.58 * iconScale, 'S');

    const b1a = mapPt(-0.72, -0.52);
    const b1b = mapPt(1.78, 0.82);
    doc.line(b1a.x, b1a.y, b1b.x, b1b.y);

    const b2a = mapPt(-0.72, 0.52);
    const b2b = mapPt(1.78, -0.82);
    doc.line(b2a.x, b2a.y, b2b.x, b2b.y);

    const pivot = mapPt(0.05, 0);
    doc.circle(pivot.x, pivot.y, 0.2 * iconScale, 'F');
}

/**
 * Traces a rounded rectangle path onto a Canvas 2D context reliably across engines.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function traceRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, w, h, radius);
        return;
    }
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
}

/**
 * Draws the Duplicate 2x1 cut guide (dashed edge-to-edge line, border trim marks,
 * white pill knockout with `- Recortar aquí -`, and optional vector scissors) on Canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof computeDuplicate2x1Layout>} layout
 * @param {number} scale
 * @param {{ cutColor: string, showScissors: boolean }} opts
 */
function drawCutGuideToCtx(ctx, layout, scale, { cutColor, showScissors }) {
    const { cutLine, pageW, pageH } = layout;

    // 1. Edge-to-edge dashed cut line
    ctx.save();
    ctx.strokeStyle = cutColor;
    ctx.lineWidth = Math.max(1, 0.35 * scale);
    ctx.setLineDash([2.5 * scale, 2 * scale]);
    ctx.beginPath();
    ctx.moveTo(cutLine.x1 * scale, cutLine.y1 * scale);
    ctx.lineTo(cutLine.x2 * scale, cutLine.y2 * scale);
    ctx.stroke();

    // 2. Solid border trim marks at both paper edges
    ctx.setLineDash([]);
    ctx.lineWidth = Math.max(1, 0.45 * scale);
    const tickLen = 4;
    const crossHalf = 1.4;
    ctx.beginPath();
    if (cutLine.isVertical) {
        const cx = cutLine.x1;
        ctx.moveTo(cx * scale, 0);
        ctx.lineTo(cx * scale, tickLen * scale);
        ctx.moveTo((cx - crossHalf) * scale, 0.9 * scale);
        ctx.lineTo((cx + crossHalf) * scale, 0.9 * scale);

        ctx.moveTo(cx * scale, (pageH - tickLen) * scale);
        ctx.lineTo(cx * scale, pageH * scale);
        ctx.moveTo((cx - crossHalf) * scale, (pageH - 0.9) * scale);
        ctx.lineTo((cx + crossHalf) * scale, (pageH - 0.9) * scale);
    } else {
        const cy = cutLine.y1;
        ctx.moveTo(0, cy * scale);
        ctx.lineTo(tickLen * scale, cy * scale);
        ctx.moveTo(0.9 * scale, (cy - crossHalf) * scale);
        ctx.lineTo(0.9 * scale, (cy + crossHalf) * scale);

        ctx.moveTo((pageW - tickLen) * scale, cy * scale);
        ctx.lineTo(pageW * scale, cy * scale);
        ctx.moveTo((pageW - 0.9) * scale, (cy - crossHalf) * scale);
        ctx.lineTo((pageW - 0.9) * scale, (cy + crossHalf) * scale);
    }
    ctx.stroke();
    ctx.restore();

    // 3. White pill knockout + optional vector scissors + localized cut label
    ctx.save();
    const cutLabel = getCutLabel();
    const fontPx = CUT_FONT_MM * scale;
    ctx.font = `700 ${fontPx}px Inter, system-ui, -apple-system, sans-serif`;
    const textWidthMm = ctx.measureText(cutLabel).width / scale;

    const padX = 2.6;
    const pillH = 5.4;
    const iconW = showScissors ? 4.0 : 0;
    const iconGap = showScissors ? 1.8 : 0;
    const rawPillLen = padX * 2 + iconW + iconGap + textWidthMm;
    const maxLineLen = cutLine.isVertical ? pageH : pageW;
    const pillScale = maxLineLen < rawPillLen + 8 ? Math.max(0.55, (maxLineLen - 8) / rawPillLen) : 1;
    const pillLen = rawPillLen * pillScale;
    const effPillH = pillH * pillScale;

    const pillW = cutLine.isVertical ? effPillH : pillLen;
    const pillHeight = cutLine.isVertical ? pillLen : effPillH;
    const pillX = cutLine.textX - pillW / 2;
    const pillY = cutLine.textY - pillHeight / 2;
    const radius = effPillH / 2;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(0.75, 0.22 * scale);
    traceRoundedRect(ctx, pillX * scale, pillY * scale, pillW * scale, pillHeight * scale, radius * scale);
    ctx.fill();
    ctx.stroke();

    const lxStart = (-rawPillLen / 2 + padX) * pillScale;
    if (showScissors) {
        const lxIcon = lxStart + (iconW * pillScale) / 2;
        const iconCx = cutLine.isVertical ? cutLine.textX : cutLine.textX + lxIcon;
        const iconCy = cutLine.isVertical ? cutLine.textY - lxIcon : cutLine.textY;
        drawScissorsToCtx(ctx, iconCx, iconCy, scale * pillScale, cutLine.isVertical, cutColor);
    }

    const lxText = lxStart + (iconW + iconGap) * pillScale + (textWidthMm * pillScale) / 2;
    const textCx = cutLine.isVertical ? cutLine.textX : cutLine.textX + lxText;
    const textCy = cutLine.isVertical ? cutLine.textY - lxText : cutLine.textY;

    ctx.translate(textCx * scale, textCy * scale);
    if (cutLine.isVertical) {
        ctx.rotate(-Math.PI / 2);
    }
    ctx.font = `700 ${fontPx * pillScale}px Inter, system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = cutColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cutLabel, 0, 0);
    ctx.restore();
}

/**
 * Draws the Duplicate 2x1 cut guide in jsPDF using exact 1:1 mm geometry.
 * @param {any} doc
 * @param {ReturnType<typeof computeDuplicate2x1Layout>} layout
 * @param {{ cutColor: string, showScissors: boolean }} opts
 */
function drawCutGuideToPdf(doc, layout, { cutColor, showScissors }) {
    const { cutLine, pageW, pageH } = layout;
    const rgb = parseHexRgb(cutColor);

    // 1. Edge-to-edge dashed cut line
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(0.35);
    doc.setLineDashPattern([2.5, 2], 0);
    doc.line(cutLine.x1, cutLine.y1, cutLine.x2, cutLine.y2);

    // 2. Solid border trim marks at both paper edges
    doc.setLineDashPattern([], 0);
    doc.setLineWidth(0.45);
    const tickLen = 4;
    const crossHalf = 1.4;
    if (cutLine.isVertical) {
        const cx = cutLine.x1;
        doc.line(cx, 0, cx, tickLen);
        doc.line(cx - crossHalf, 0.9, cx + crossHalf, 0.9);
        doc.line(cx, pageH - tickLen, cx, pageH);
        doc.line(cx - crossHalf, pageH - 0.9, cx + crossHalf, pageH - 0.9);
    } else {
        const cy = cutLine.y1;
        doc.line(0, cy, tickLen, cy);
        doc.line(0.9, cy - crossHalf, 0.9, cy + crossHalf);
        doc.line(pageW - tickLen, cy, pageW, cy);
        doc.line(pageW - 0.9, cy - crossHalf, pageW - 0.9, cy + crossHalf);
    }

    // 3. White pill knockout + optional vector scissors + localized cut label (8.5 pt bold)
    const cutLabel = getCutLabel();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(CUT_FONT_PT);
    const textWidthMm = doc.getTextWidth(cutLabel);

    const padX = 2.6;
    const pillH = 5.4;
    const iconW = showScissors ? 4.0 : 0;
    const iconGap = showScissors ? 1.8 : 0;
    const rawPillLen = padX * 2 + iconW + iconGap + textWidthMm;
    const maxLineLen = cutLine.isVertical ? pageH : pageW;
    const pillScale = maxLineLen < rawPillLen + 8 ? Math.max(0.55, (maxLineLen - 8) / rawPillLen) : 1;
    const pillLen = rawPillLen * pillScale;
    const effPillH = pillH * pillScale;

    if (pillScale !== 1) {
        doc.setFontSize(CUT_FONT_PT * pillScale);
    }

    const pillW = cutLine.isVertical ? effPillH : pillLen;
    const pillHeight = cutLine.isVertical ? pillLen : effPillH;
    const pillX = cutLine.textX - pillW / 2;
    const pillY = cutLine.textY - pillHeight / 2;
    const radius = effPillH / 2;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.22);
    doc.roundedRect(pillX, pillY, pillW, pillHeight, radius, radius, 'FD');

    const lxStart = (-rawPillLen / 2 + padX) * pillScale;
    if (showScissors) {
        const lxIcon = lxStart + (iconW * pillScale) / 2;
        const iconCx = cutLine.isVertical ? cutLine.textX : cutLine.textX + lxIcon;
        const iconCy = cutLine.isVertical ? cutLine.textY - lxIcon : cutLine.textY;
        drawScissorsToPdf(doc, iconCx, iconCy, pillScale, cutLine.isVertical, rgb);
    }

    const lxText = lxStart + (iconW + iconGap) * pillScale + (textWidthMm * pillScale) / 2;
    const textCx = cutLine.isVertical ? cutLine.textX : cutLine.textX + lxText;
    const textCy = cutLine.isVertical ? cutLine.textY - lxText : cutLine.textY;

    const cutLabelPdf = getCutLabel();
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    const opticalCenterShift = CUT_FONT_MM * pillScale * 0.32;
    if (cutLine.isVertical) {
        const startX = textCx + opticalCenterShift;
        const startY = textCy + (textWidthMm * pillScale) / 2;
        doc.text(cutLabelPdf, startX, startY, { angle: 90 });
    } else {
        const startX = textCx - (textWidthMm * pillScale) / 2;
        const startY = textCy + opticalCenterShift;
        doc.text(cutLabelPdf, startX, startY);
    }
}

/**
 * Formats a concise paper label for the preview meta badge.
 * @param {string} paperKey
 * @param {number} pageW
 * @param {number} pageH
 * @returns {string}
 */
function formatPaperLabel(paperKey, pageW, pageH) {
    if (paperKey === 'fit') {
        const prefix = AppState.lang === 'en' ? 'Fit' : 'Ajustada';
        return `${prefix} (${Math.round(pageW)}×${Math.round(pageH)} mm)`;
    }
    const labels = {
        letter: AppState.lang === 'en' ? 'Letter' : 'Carta',
        legal: 'Legal',
        tabloid: AppState.lang === 'en' ? 'Tabloid' : 'Tabloide',
    };
    return labels[paperKey] || paperKey.toUpperCase();
}

/**
 * Builds a collision-free `.pdf` filename inside a ZIP archive.
 * @param {string} rawName
 * @param {Set<string>} usedNames
 * @returns {string}
 */
function buildUniqueZipEntryName(rawName, usedNames) {
    const basePdf = buildOutputName({ originalName: rawName, ext: 'pdf' });
    if (!usedNames.has(basePdf)) {
        usedNames.add(basePdf);
        return basePdf;
    }
    const stem = basePdf.replace(/\.pdf$/i, '');
    let idx = 2;
    while (usedNames.has(`${stem}_${idx}.pdf`)) {
        idx += 1;
    }
    const unique = `${stem}_${idx}.pdf`;
    usedNames.add(unique);
    return unique;
}

/**
 * Draws an empty-sheet blueprint preview when no images have been loaded yet.
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 */
function drawEmptyPreview(canvas, { mode, pageSizeOpt, orientOpt, marginOpt, dupMarginMm, dupGapMm, cutColor, showCutline, showScissors }) {
    let pageW;
    let pageH;
    let boxes = [];
    let dupLayout = null;

    if (mode === 'duplicate') {
        dupLayout = computeDuplicate2x1Layout({
            paperKey: pageSizeOpt,
            orientation: orientOpt === 'auto' ? 'p' : orientOpt,
            marginMm: dupMarginMm,
            centerGapMm: dupGapMm,
            imgW: 400,
            imgH: 300,
        });
        pageW = dupLayout.pageW;
        pageH = dupLayout.pageH;
        boxes = [dupLayout.slot1.box, dupLayout.slot2.box];
    } else {
        const stdLayout = computeStandardPageLayout({
            pageSizeOpt: pageSizeOpt === 'fit' ? 'letter' : pageSizeOpt,
            orientationOpt: orientOpt === 'auto' ? 'p' : orientOpt,
            marginOpt,
            imgW: 400,
            imgH: 500,
        });
        pageW = stdLayout.pageW;
        pageH = stdLayout.pageH;
        boxes = [{
            x: stdLayout.marginMm,
            y: stdLayout.marginMm,
            w: Math.max(1, pageW - stdLayout.marginMm * 2),
            h: Math.max(1, pageH - stdLayout.marginMm * 2),
        }];
    }

    const scale = PREVIEW_MAX_PX / Math.max(pageW, pageH);
    canvas.width = Math.max(1, Math.round(pageW * scale));
    canvas.height = Math.max(1, Math.round(pageH * scale));
    const effScale = canvas.width / pageW;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = Math.max(1, 0.35 * effScale);
    ctx.setLineDash([3 * effScale, 2.5 * effScale]);
    ctx.fillStyle = '#f8fafc';
    for (const box of boxes) {
        ctx.fillRect(box.x * effScale, box.y * effScale, box.w * effScale, box.h * effScale);
        ctx.strokeRect(box.x * effScale, box.y * effScale, box.w * effScale, box.h * effScale);
    }
    ctx.restore();

    if (mode === 'duplicate' && dupLayout && showCutline) {
        drawCutGuideToCtx(ctx, dupLayout, effScale, { cutColor, showScissors });
    }

    ctx.save();
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 ${Math.round(4.6 * effScale)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hint = AppState.lang === 'en' ? 'Add images or PDFs to preview' : 'Sube imágenes o PDFs para ver la vista previa';
    if (mode === 'duplicate' && dupLayout) {
        ctx.fillText(
            AppState.lang === 'en' ? 'Copy 1' : 'Copia 1',
            (dupLayout.slot1.box.x + dupLayout.slot1.box.w / 2) * effScale,
            (dupLayout.slot1.box.y + dupLayout.slot1.box.h / 2) * effScale
        );
        ctx.fillText(
            AppState.lang === 'en' ? 'Copy 2' : 'Copia 2',
            (dupLayout.slot2.box.x + dupLayout.slot2.box.w / 2) * effScale,
            (dupLayout.slot2.box.y + dupLayout.slot2.box.h / 2) * effScale
        );
    } else {
        ctx.fillText(hint, canvas.width / 2, canvas.height / 2);
    }
    ctx.restore();
}

/**
 * Initializes the "Imagen a PDF + Duplicar 2×1" workspace tool.
 */
export function initImg2PdfTool() {
    const sectionEl = document.getElementById('section-img2pdf');
    if (!sectionEl || sectionEl.dataset.img2pdfBound === 'true') {
        return;
    }
    sectionEl.dataset.img2pdfBound = 'true';

    const tabStdBtn = document.getElementById('tab-std');
    const tabDupBtn = document.getElementById('tab-dup');

    const pageSizeEl = document.getElementById('img-page-size');
    const orientationEl = document.getElementById('img-orientation');
    const stdMarginGroupEl = document.getElementById('img-std-margin-group');
    const marginEl = document.getElementById('img-margin');
    const separateWrapEl = document.getElementById('img-separate-wrap');
    const separateFilesEl = document.getElementById('img-separate-files');

    const dupOptionsPanelEl = document.getElementById('dup-options-panel');
    const dupMarginPresets = Array.from(sectionEl.querySelectorAll('.dup-margin-preset'));
    const dupMarginInputEl = document.getElementById('img-dup-margin');
    const dupGapPresets = Array.from(sectionEl.querySelectorAll('.dup-gap-preset'));
    const dupGapRangeEl = document.getElementById('img-dup-gap');
    const dupGapValEl = document.getElementById('img-dup-gap-val');
    const dupCutlineEl = document.getElementById('img-dup-cutline');
    const dupScissorsEl = document.getElementById('img-dup-scissors');
    const dupCutcolorEl = document.getElementById('img-dup-cutcolor');

    const dropzoneEl = document.getElementById('drop-zone-img');
    const fileInputEl = document.getElementById('file-input-img');
    const gridEl = document.getElementById('img-grid');

    const previewCanvasEl = document.getElementById('img2pdf-preview-canvas');
    const previewMetaEl = document.getElementById('img2pdf-preview-meta');

    const actionRowEl = document.getElementById('btn-gen-img');
    const downloadBtnEl = document.getElementById('img2pdf-download-btn');
    const printBtnEl = document.getElementById('img2pdf-print-btn');
    const clearBtnEl = document.getElementById('img2pdf-clear-btn');

    /** @type {Array<{ id: string, name: string, dataUrl: string, thumbDataUrl: string, image: HTMLImageElement, width: number, height: number, rotation: number, sourceType: 'image'|'pdf' }>} */
    let imgFiles = [];
    let currentMode = 'standard';
    let isBusy = false;

    const getDupOptions = () => ({
        marginMm: Number(dupMarginInputEl?.value ?? 5) || 0,
        centerGapMm: Number(dupGapRangeEl?.value ?? 4) || 0,
        showCutline: Boolean(dupCutlineEl?.checked ?? true),
        showScissors: Boolean(dupScissorsEl?.checked ?? true),
        cutColor: dupCutcolorEl?.value || '#334155',
    });

    const updateDownloadButtonLabel = () => {
        if (!downloadBtnEl) return;
        const labelSpan = downloadBtnEl.querySelector('span');
        if (!labelSpan) return;
        const isZip = currentMode === 'standard' && Boolean(separateFilesEl?.checked);
        const key = isZip ? 'btn_download_zip' : 'btn_download';
        labelSpan.setAttribute('data-i18n', key);
        labelSpan.textContent = t(key);
    };

    const syncModeUi = () => {
        const isDup = currentMode === 'duplicate';

        tabStdBtn?.classList.toggle('is-active', !isDup);
        tabDupBtn?.classList.toggle('is-active', isDup);
        tabStdBtn?.setAttribute('aria-pressed', String(!isDup));
        tabDupBtn?.setAttribute('aria-pressed', String(isDup));

        stdMarginGroupEl?.classList.toggle('hidden', isDup);
        separateWrapEl?.classList.toggle('hidden', isDup);
        dupOptionsPanelEl?.classList.toggle('hidden', !isDup);

        const fitOption = pageSizeEl?.querySelector('option[value="fit"]');
        if (fitOption) {
            fitOption.disabled = isDup;
            if (isDup && pageSizeEl.value === 'fit') {
                pageSizeEl.value = 'a4';
            }
        }

        updateDownloadButtonLabel();
    };

    const updateVisibility = () => {
        const hasItems = imgFiles.length > 0;
        actionRowEl?.classList.toggle('hidden', !hasItems);
        gridEl?.classList.toggle('hidden', !hasItems);
    };

    const renderPreview = () => {
        if (!previewCanvasEl) return;

        const pageSizeOpt = pageSizeEl?.value || 'letter';
        const orientOpt = orientationEl?.value || 'auto';
        const marginOpt = marginEl?.value || 'small';
        const dupOpts = getDupOptions();

        if (imgFiles.length === 0) {
            drawEmptyPreview(previewCanvasEl, {
                mode: currentMode,
                pageSizeOpt,
                orientOpt,
                marginOpt,
                dupMarginMm: dupOpts.marginMm,
                dupGapMm: dupOpts.centerGapMm,
                cutColor: dupOpts.cutColor,
                showCutline: dupOpts.showCutline,
                showScissors: dupOpts.showScissors,
            });
            if (previewMetaEl) {
                previewMetaEl.textContent = AppState.lang === 'en' ? 'No images' : 'Sin imágenes';
            }
            return;
        }

        const firstItem = imgFiles[0];
        const eff = getEffectiveDimensions(firstItem);

        let pageW;
        let pageH;
        let resolvedOrient;

        if (currentMode === 'duplicate') {
            const layout = computeDuplicate2x1Layout({
                paperKey: pageSizeOpt,
                orientation: orientOpt,
                marginMm: dupOpts.marginMm,
                centerGapMm: dupOpts.centerGapMm,
                imgW: eff.w,
                imgH: eff.h,
            });

            pageW = layout.pageW;
            pageH = layout.pageH;
            resolvedOrient = layout.orientation;

            const targetScale = PREVIEW_MAX_PX / Math.max(pageW, pageH);
            previewCanvasEl.width = Math.max(1, Math.round(pageW * targetScale));
            previewCanvasEl.height = Math.max(1, Math.round(pageH * targetScale));
            const scale = previewCanvasEl.width / pageW;

            const ctx = previewCanvasEl.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, previewCanvasEl.width, previewCanvasEl.height);

            drawRotatedImageToCtx(
                ctx,
                firstItem.image,
                eff.rotation,
                layout.slot1.image.x * scale,
                layout.slot1.image.y * scale,
                layout.slot1.image.w * scale,
                layout.slot1.image.h * scale
            );
            drawRotatedImageToCtx(
                ctx,
                firstItem.image,
                eff.rotation,
                layout.slot2.image.x * scale,
                layout.slot2.image.y * scale,
                layout.slot2.image.w * scale,
                layout.slot2.image.h * scale
            );

            if (dupOpts.showCutline) {
                drawCutGuideToCtx(ctx, layout, scale, {
                    cutColor: dupOpts.cutColor,
                    showScissors: dupOpts.showScissors,
                });
            }
        } else {
            const layout = computeStandardPageLayout({
                pageSizeOpt,
                orientationOpt: orientOpt,
                marginOpt,
                imgW: eff.w,
                imgH: eff.h,
            });

            pageW = layout.pageW;
            pageH = layout.pageH;
            resolvedOrient = layout.orientation;

            const targetScale = PREVIEW_MAX_PX / Math.max(pageW, pageH);
            previewCanvasEl.width = Math.max(1, Math.round(pageW * targetScale));
            previewCanvasEl.height = Math.max(1, Math.round(pageH * targetScale));
            const scale = previewCanvasEl.width / pageW;

            const ctx = previewCanvasEl.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, previewCanvasEl.width, previewCanvasEl.height);

            drawRotatedImageToCtx(
                ctx,
                firstItem.image,
                eff.rotation,
                layout.imageRect.x * scale,
                layout.imageRect.y * scale,
                layout.imageRect.w * scale,
                layout.imageRect.h * scale
            );
        }

        if (previewMetaEl) {
            const paperText = formatPaperLabel(pageSizeOpt, pageW, pageH);
            const orientText =
                resolvedOrient === 'l'
                    ? AppState.lang === 'en' ? 'Landscape' : 'Horizontal'
                    : AppState.lang === 'en' ? 'Portrait' : 'Vertical';
            const modeText =
                currentMode === 'duplicate'
                    ? AppState.lang === 'en' ? 'Duplicate 2×1' : 'Duplicar 2×1'
                    : AppState.lang === 'en' ? 'Standard' : 'Estándar';
            const countSuffix = imgFiles.length > 1 ? ` · ${imgFiles.length} img` : '';
            previewMetaEl.textContent = `${paperText} · ${orientText} · ${modeText}${countSuffix}`;
        }
    };

    const syncGridBadges = () => {
        if (!gridEl) return;
        const byId = new Map(imgFiles.map((item, idx) => [String(item.id), { item, idx }]));
        for (const card of Array.from(gridEl.children)) {
            const id = card.getAttribute('data-id');
            const entry = id ? byId.get(id) : null;
            if (!entry) continue;
            const badgeEl = card.querySelector('.thumb-badge');
            if (badgeEl) {
                badgeEl.textContent = entry.item.rotation
                    ? `#${entry.idx + 1} · ${entry.item.rotation}°`
                    : `#${entry.idx + 1}`;
            }
            const dimsEl = card.querySelector('[data-role="dims"]');
            if (dimsEl) {
                const eff = getEffectiveDimensions(entry.item);
                dimsEl.textContent = `${eff.w}×${eff.h}`;
            }
        }
    };

    const createActionButton = (action, iconName, label) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-action', action);
        btn.title = label;
        btn.setAttribute('aria-label', label);
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);
        btn.appendChild(icon);
        return btn;
    };

    const createThumbCard = (item, index) => {
        const card = document.createElement('div');
        card.className = 'thumb-card';
        card.setAttribute('data-id', String(item.id));

        const media = document.createElement('div');
        media.className = 'thumb-media';

        const badge = document.createElement('span');
        badge.className = 'thumb-badge';
        badge.textContent = item.rotation ? `#${index + 1} · ${item.rotation}°` : `#${index + 1}`;

        const img = document.createElement('img');
        img.src = item.thumbDataUrl || item.dataUrl;
        img.alt = item.name;
        img.draggable = false;
        img.decoding = 'async';

        const actions = document.createElement('div');
        actions.className = 'thumb-actions';
        actions.appendChild(
            createActionButton('rotate', 'rotate-cw', AppState.lang === 'en' ? 'Rotate 90°' : 'Rotar 90°')
        );
        actions.appendChild(
            createActionButton('duplicate', 'copy-plus', AppState.lang === 'en' ? 'Duplicate' : 'Duplicar')
        );
        actions.appendChild(
            createActionButton('delete', 'trash-2', AppState.lang === 'en' ? 'Remove' : 'Eliminar')
        );

        media.appendChild(badge);
        media.appendChild(img);
        media.appendChild(actions);

        const footer = document.createElement('div');
        footer.className = 'thumb-footer';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        nameSpan.title = item.name;

        const eff = getEffectiveDimensions(item);
        const dimsSpan = document.createElement('span');
        dimsSpan.setAttribute('data-role', 'dims');
        dimsSpan.textContent = `${eff.w}×${eff.h}`;

        footer.appendChild(nameSpan);
        footer.appendChild(dimsSpan);

        card.appendChild(media);
        card.appendChild(footer);
        return card;
    };

    const renderGrid = () => {
        if (!gridEl) return;
        const fragment = document.createDocumentFragment();
        imgFiles.forEach((item, index) => {
            fragment.appendChild(createThumbCard(item, index));
        });
        gridEl.replaceChildren(fragment);
        globalThis.lucide?.createIcons?.();
    };

    const handleCardAction = (id, action) => {
        const index = imgFiles.findIndex((entry) => String(entry.id) === String(id));
        if (index === -1) return;

        if (action === 'rotate') {
            const target = imgFiles[index];
            target.rotation = (target.rotation + 90) % 360;
            target.thumbDataUrl = createThumbDataUrl(target.image, target.rotation);

            const cardEl = gridEl
                ? Array.from(gridEl.children).find((el) => el.getAttribute('data-id') === String(id))
                : null;
            const imgEl = cardEl?.querySelector('.thumb-media img');
            if (imgEl) {
                imgEl.src = target.thumbDataUrl;
            }
            syncGridBadges();
            renderPreview();
            return;
        }

        if (action === 'duplicate') {
            const source = imgFiles[index];
            const clone = {
                ...source,
                id: createItemId(),
            };
            imgFiles.splice(index + 1, 0, clone);
            renderGrid();
            updateVisibility();
            renderPreview();
            return;
        }

        if (action === 'delete') {
            imgFiles.splice(index, 1);
            renderGrid();
            updateVisibility();
            renderPreview();
        }
    };

    const handleFiles = async (rawFiles) => {
        const files = Array.from(rawFiles || []);
        if (files.length === 0 || isBusy) return;

        isBusy = true;
        AppState.setBusy(true);
        const signal = ProgressModal.open({
            title: AppState.lang === 'en' ? 'Loading files...' : 'Cargando archivos...',
            detail: files[0].name,
            cancellable: true,
        });

        const addedItems = [];

        try {
            for (let i = 0; i < files.length; i++) {
                if (signal.aborted) break;

                const file = files[i];
                const kind = detectFileKind(file);
                ProgressModal.update({
                    percent: Math.round((i / files.length) * 100),
                    detail: file.name,
                });

                if (kind === 'unknown') {
                    ToastManager.warning(
                        t('toast_file_skipped', {
                            name: file.name,
                            reason: AppState.lang === 'en' ? 'Unsupported format' : 'Formato no compatible',
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
                        if (numPages === 0) {
                            ToastManager.warning(
                                t('toast_file_skipped', {
                                    name: file.name,
                                    reason: AppState.lang === 'en' ? 'Empty PDF' : 'PDF sin páginas',
                                })
                            );
                            continue;
                        }

                        const baseScale = numPages > 20 ? 1.5 : 2.0;
                        const baseName = stripExtension(file.name);

                        for (let p = 1; p <= numPages; p++) {
                            if (signal.aborted) break;
                            const pct = ((i + (p - 1) / numPages) / files.length) * 100;
                            ProgressModal.update({
                                percent: pct,
                                detail: `${file.name} (${p}/${numPages})`,
                            });

                            try {
                                const pdfPage = await pdfjsDoc.getPage(p);
                                const baseVp = pdfPage.getViewport({ scale: 1 });
                                pdfPage.cleanup();
                                const renderScale = clampPdfRenderScale(baseVp.width, baseVp.height, baseScale);
                                const { canvas } = await renderPdfPageToCanvas(pdfjsDoc, p, renderScale);
                                const width = canvas.width;
                                const height = canvas.height;
                                const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
                                canvas.width = 0;
                                canvas.height = 0;

                                const image = await loadImageElement(dataUrl);
                                const thumbDataUrl = createThumbDataUrl(image, 0);
                                const pageName = numPages > 1 ? `${baseName}_pag${p}.jpg` : `${baseName}.jpg`;

                                addedItems.push({
                                    id: createItemId(),
                                    name: pageName,
                                    dataUrl,
                                    thumbDataUrl,
                                    image,
                                    width,
                                    height,
                                    rotation: 0,
                                    sourceType: 'pdf',
                                });
                            } catch (pageErr) {
                                ToastManager.warning(
                                    t('toast_file_skipped', {
                                        name: `${file.name} (pág. ${p})`,
                                        reason:
                                            pageErr?.message ||
                                            (AppState.lang === 'en' ? 'Corrupt page' : 'Página dañada'),
                                    })
                                );
                            }
                        }
                    } catch (err) {
                        ToastManager.warning(
                            t('toast_file_skipped', {
                                name: file.name,
                                reason: err?.message || (AppState.lang === 'en' ? 'Invalid PDF' : 'PDF dañado o inválido'),
                            })
                        );
                    } finally {
                        try {
                            await pdfjsDoc?.destroy?.();
                        } catch {
                            // Ignore cleanup errors
                        }
                    }
                    continue;
                }

                // Regular image, HEIC/HEIF, or TIFF/TIF
                try {
                    const decoded = await decodeImageFile(file);
                    if (signal.aborted) break;
                    const thumbDataUrl = createThumbDataUrl(decoded.image, 0);
                    addedItems.push({
                        id: createItemId(),
                        name: decoded.name || file.name,
                        dataUrl: decoded.dataUrl,
                        thumbDataUrl,
                        image: decoded.image,
                        width: decoded.width,
                        height: decoded.height,
                        rotation: 0,
                        sourceType: 'image',
                    });
                } catch (err) {
                    ToastManager.warning(
                        t('toast_file_skipped', {
                            name: file.name,
                            reason:
                                err?.message ||
                                (AppState.lang === 'en' ? 'Could not decode image' : 'No se pudo decodificar la imagen'),
                        })
                    );
                }
            }

            if (signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
                return;
            }

            if (addedItems.length > 0) {
                imgFiles = imgFiles.concat(addedItems);
                renderGrid();
                updateVisibility();
                renderPreview();
            }
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
            isBusy = false;
        }
    };

    const generateImgPDF = async ({ forPrint = false } = {}) => {
        if (imgFiles.length === 0) {
            ToastManager.warning(t('toast_no_pages'));
            return;
        }
        if (isBusy) return;

        const JsPdfCtor = window.jspdf?.jsPDF;
        if (typeof JsPdfCtor !== 'function') {
            ToastManager.error(
                AppState.lang === 'en'
                    ? 'jsPDF library failed to load.'
                    : 'No se pudo cargar la librería jsPDF.'
            );
            return;
        }

        const pageSizeOpt = pageSizeEl?.value || 'letter';
        const orientOpt = orientationEl?.value || 'auto';
        const marginOpt = marginEl?.value || 'small';
        const separateFiles = Boolean(separateFilesEl?.checked);
        const dupOpts = getDupOptions();

        isBusy = true;
        AppState.setBusy(true);
        const signal = ProgressModal.open({
            title: AppState.lang === 'en' ? 'Generating PDF...' : 'Generando PDF...',
            detail: imgFiles[0].name,
            cancellable: true,
        });

        try {
            if (currentMode === 'standard' && separateFiles && !forPrint) {
                const JSZipCtor = window.JSZip;
                if (typeof JSZipCtor !== 'function') {
                    ToastManager.error(
                        AppState.lang === 'en'
                            ? 'JSZip library failed to load.'
                            : 'No se pudo cargar la librería JSZip.'
                    );
                    return;
                }

                const zip = new JSZipCtor();
                const usedNames = new Set();

                for (let i = 0; i < imgFiles.length; i++) {
                    if (signal.aborted) {
                        ToastManager.info(t('toast_cancelled'));
                        return;
                    }

                    const item = imgFiles[i];
                    ProgressModal.update({
                        percent: Math.round((i / imgFiles.length) * 90),
                        detail: item.name,
                    });

                    const prepared = await preparePdfImage(item);
                    if (signal.aborted) {
                        ToastManager.info(t('toast_cancelled'));
                        return;
                    }

                    const layout = computeStandardPageLayout({
                        pageSizeOpt,
                        orientationOpt: orientOpt,
                        marginOpt,
                        imgW: prepared.width,
                        imgH: prepared.height,
                    });

                    const singleDoc = new JsPdfCtor({
                        orientation: layout.orientation,
                        unit: 'mm',
                        format: [layout.pageW, layout.pageH],
                        compress: true,
                    });
                    singleDoc.addImage(
                        prepared.dataUrl,
                        prepared.format,
                        layout.imageRect.x,
                        layout.imageRect.y,
                        layout.imageRect.w,
                        layout.imageRect.h,
                        undefined,
                        'FAST'
                    );

                    const entryName = buildUniqueZipEntryName(item.name, usedNames);
                    zip.file(entryName, singleDoc.output('arraybuffer'));
                    await yieldToMain();
                }

                if (signal.aborted) {
                    ToastManager.info(t('toast_cancelled'));
                    return;
                }

                ProgressModal.update({ percent: 95, detail: 'ZIP...' });
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                if (signal.aborted) {
                    ToastManager.info(t('toast_cancelled'));
                    return;
                }

                const zipName = buildOutputName({
                    originalName: imgFiles[0].name,
                    suffix: 'imagenes_pdf',
                    ext: 'zip',
                });
                BlobRegistry.downloadBlob(zipBlob, zipName);
                ToastManager.success(t('toast_saved_pdf', { name: zipName }));
                return;
            }

            let doc = null;

            for (let i = 0; i < imgFiles.length; i++) {
                if (signal.aborted) {
                    ToastManager.info(t('toast_cancelled'));
                    return;
                }

                const item = imgFiles[i];
                ProgressModal.update({
                    percent: Math.round((i / imgFiles.length) * 95),
                    detail: item.name,
                });

                const prepared = await preparePdfImage(item);
                if (signal.aborted) {
                    ToastManager.info(t('toast_cancelled'));
                    return;
                }

                if (currentMode === 'duplicate') {
                    const layout = computeDuplicate2x1Layout({
                        paperKey: pageSizeOpt,
                        orientation: orientOpt,
                        marginMm: dupOpts.marginMm,
                        centerGapMm: dupOpts.centerGapMm,
                        imgW: prepared.width,
                        imgH: prepared.height,
                    });

                    if (!doc) {
                        doc = new JsPdfCtor({
                            orientation: layout.orientation,
                            unit: 'mm',
                            format: [layout.pageW, layout.pageH],
                            compress: true,
                        });
                    } else {
                        doc.addPage([layout.pageW, layout.pageH], layout.orientation);
                    }

                    doc.addImage(
                        prepared.dataUrl,
                        prepared.format,
                        layout.slot1.image.x,
                        layout.slot1.image.y,
                        layout.slot1.image.w,
                        layout.slot1.image.h,
                        undefined,
                        'FAST'
                    );
                    doc.addImage(
                        prepared.dataUrl,
                        prepared.format,
                        layout.slot2.image.x,
                        layout.slot2.image.y,
                        layout.slot2.image.w,
                        layout.slot2.image.h,
                        undefined,
                        'FAST'
                    );

                    if (dupOpts.showCutline) {
                        drawCutGuideToPdf(doc, layout, {
                            cutColor: dupOpts.cutColor,
                            showScissors: dupOpts.showScissors,
                        });
                    }
                } else {
                    const layout = computeStandardPageLayout({
                        pageSizeOpt,
                        orientationOpt: orientOpt,
                        marginOpt,
                        imgW: prepared.width,
                        imgH: prepared.height,
                    });

                    if (!doc) {
                        doc = new JsPdfCtor({
                            orientation: layout.orientation,
                            unit: 'mm',
                            format: [layout.pageW, layout.pageH],
                            compress: true,
                        });
                    } else {
                        doc.addPage([layout.pageW, layout.pageH], layout.orientation);
                    }

                    doc.addImage(
                        prepared.dataUrl,
                        prepared.format,
                        layout.imageRect.x,
                        layout.imageRect.y,
                        layout.imageRect.w,
                        layout.imageRect.h,
                        undefined,
                        'FAST'
                    );
                }

                await yieldToMain();
            }

            if (signal.aborted || !doc) {
                if (signal.aborted) {
                    ToastManager.info(t('toast_cancelled'));
                }
                return;
            }

            ProgressModal.update({ percent: 100 });
            const pdfBlob = doc.output('blob');

            if (forPrint) {
                PrintService.printPdfBlob(pdfBlob);
                return;
            }

            const outName =
                currentMode === 'duplicate'
                    ? buildOutputName({
                          originalName: imgFiles[0].name,
                          suffix: 'duplicado_2x1',
                          ext: 'pdf',
                      })
                    : buildOutputName({
                          originalName: imgFiles[0].name,
                          suffix: imgFiles.length > 1 ? 'imagenes' : 'pdf',
                          pageCount: imgFiles.length > 1 ? imgFiles.length : null,
                          ext: 'pdf',
                      });

            BlobRegistry.downloadBlob(pdfBlob, outName);
            ToastManager.success(t('toast_saved_pdf', { name: outName }));
        } catch (err) {
            ToastManager.error(
                err?.message ||
                    (AppState.lang === 'en' ? 'Error generating PDF.' : 'Ocurrió un error al generar el PDF.')
            );
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
            isBusy = false;
        }
    };

    const clearAll = () => {
        imgFiles = [];
        BlobRegistry.revokeScope('img2pdf');
        renderGrid();
        updateVisibility();
        renderPreview();
    };

    // Mode tabs
    const handleModeClick = (mode) => {
        if (mode !== 'standard' && mode !== 'duplicate') return;
        if (currentMode === mode) return;
        currentMode = mode;
        syncModeUi();
        renderPreview();
    };

    tabStdBtn?.addEventListener('click', () => handleModeClick('standard'));
    tabDupBtn?.addEventListener('click', () => handleModeClick('duplicate'));

    // Standard & shared option listeners
    pageSizeEl?.addEventListener('change', renderPreview);
    orientationEl?.addEventListener('change', renderPreview);
    marginEl?.addEventListener('change', renderPreview);
    separateFilesEl?.addEventListener('change', () => {
        updateDownloadButtonLabel();
        renderPreview();
    });

    // Duplicate 2x1 margin presets
    for (const btn of dupMarginPresets) {
        btn.addEventListener('click', () => {
            const val = btn.dataset.margin;
            if (dupMarginInputEl && val !== undefined) {
                dupMarginInputEl.value = val;
            }
            for (const presetBtn of dupMarginPresets) {
                presetBtn.classList.toggle('is-active', presetBtn === btn);
            }
            renderPreview();
        });
    }

    const syncGapPresetsActive = (valStr) => {
        for (const presetBtn of dupGapPresets) {
            presetBtn.classList.toggle('is-active', presetBtn.dataset.gap === String(valStr));
        }
    };

    // Duplicate 2x1 gap presets & range slider
    for (const btn of dupGapPresets) {
        btn.addEventListener('click', () => {
            const val = btn.dataset.gap;
            if (dupGapRangeEl && val !== undefined) {
                dupGapRangeEl.value = val;
            }
            if (dupGapValEl && val !== undefined) {
                dupGapValEl.textContent = `${val} mm`;
            }
            syncGapPresetsActive(val);
            renderPreview();
        });
    }

    dupGapRangeEl?.addEventListener('input', () => {
        const val = dupGapRangeEl.value;
        if (dupGapValEl) {
            dupGapValEl.textContent = `${val} mm`;
        }
        syncGapPresetsActive(val);
        renderPreview();
    });

    dupCutlineEl?.addEventListener('change', renderPreview);
    dupScissorsEl?.addEventListener('change', renderPreview);
    dupCutcolorEl?.addEventListener('change', renderPreview);

    // Event delegation on #img-grid resolving exclusively by item.id
    gridEl?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const btn = target?.closest('button[data-action]');
        if (!btn) return;
        const card = btn.closest('.thumb-card[data-id]');
        if (!card) return;
        const id = card.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        if (id && action) {
            handleCardAction(id, action);
        }
    });

    // Drag & Drop sorting synchronized by unique item.id
    DragSortManager.attach(gridEl, {
        getItems: () => imgFiles,
        setItems: (reordered) => {
            imgFiles = reordered;
        },
        onReorder: () => {
            syncGridBadges();
            renderPreview();
        },
    });

    // Dropzone upload binding
    bindDropzone(dropzoneEl, fileInputEl, {
        multiple: true,
        onFiles: handleFiles,
    });

    // Action buttons
    downloadBtnEl?.addEventListener('click', () => generateImgPDF({ forPrint: false }));
    printBtnEl?.addEventListener('click', () => generateImgPDF({ forPrint: true }));
    clearBtnEl?.addEventListener('click', clearAll);

    // Keep labels and preview synced on language switches
    AppState.on('lang:changed', () => {
        updateDownloadButtonLabel();
        renderGrid();
        renderPreview();
    });

    // Register tool controller
    AppState.registerTool('img2pdf', {
        onActivate: () => {
            syncModeUi();
            renderPreview();
            globalThis.lucide?.createIcons?.();
        },
        onDeactivate: () => {},
        renderPreview,
        generateImgPDF,
        clear: clearAll,
        getItems: () => imgFiles.slice(),
    });

    // Initial render
    syncModeUi();
    updateVisibility();
    renderPreview();
}
