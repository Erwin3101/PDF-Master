/**
 * Pure geometric calculations shared identically between live Canvas previews
 * and PDF generation (Poster 2.0, Img2PDF + Duplicate 2x1, N-Up, Compression).
 */

export const PAPER_SIZES = Object.freeze({
    a0: { w: 841, h: 1189, label: 'A0 (841×1189 mm)' },
    a1: { w: 594, h: 841, label: 'A1 (594×841 mm)' },
    a2: { w: 420, h: 594, label: 'A2 (420×594 mm)' },
    a3: { w: 297, h: 420, label: 'A3 (297×420 mm)' },
    a4: { w: 210, h: 297, label: 'A4 (210×297 mm)' },
    a5: { w: 148.5, h: 210, label: 'A5 (148.5×210 mm)' },
    a6: { w: 105, h: 148.5, label: 'A6 (105×148.5 mm)' },
    a7: { w: 74, h: 105, label: 'A7 (74×105 mm)' },
    a8: { w: 52, h: 74, label: 'A8 (52×74 mm)' },
    a9: { w: 37, h: 52, label: 'A9 (37×52 mm)' },
    a10: { w: 26, h: 37, label: 'A10 (26×37 mm)' },
    letter: { w: 215.9, h: 279.4, label: 'Carta / Letter (215.9×279.4 mm)' },
    legal: { w: 215.9, h: 355.6, label: 'Legal / Oficio (215.9×355.6 mm)' },
    tabloid: { w: 279.4, h: 431.8, label: 'Tabloide (279.4×431.8 mm)' },
});

export function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

/**
 * Clamps a PDF render scale factor so neither edge exceeds `maxEdge` nor area exceeds `maxPixels`.
 * Prevents OOM/canvas allocation failures on oversized blueprint/CAD PDFs.
 */
export function clampPdfRenderScale(
    pageWidthPt,
    pageHeightPt,
    desiredScale = 1.5,
    maxEdge = 4096,
    maxPixels = 16_777_216
) {
    const w = Math.max(1, Number(pageWidthPt) || 1);
    const h = Math.max(1, Number(pageHeightPt) || 1);
    const target = Math.max(0.1, Number(desiredScale) || 1);
    const maxEdgeScale = maxEdge / Math.max(w, h);
    const maxAreaScale = Math.sqrt(maxPixels / (w * h));
    return Math.min(target, maxEdgeScale, maxAreaScale);
}

/**
 * Resolves sheet dimensions in mm given a paper key and orientation ('p' | 'l' | 'auto').
 */
export function resolveSheetSizeMm(paperKey, orientation = 'p', contentRatio = 1) {
    const spec = PAPER_SIZES[paperKey] || PAPER_SIZES.a4;
    const minDim = Math.min(spec.w, spec.h);
    const maxDim = Math.max(spec.w, spec.h);

    let resolvedOrient = orientation;
    if (orientation === 'auto') {
        resolvedOrient = contentRatio > 1 ? 'l' : 'p';
    }
    return resolvedOrient === 'l'
        ? { w: maxDim, h: minDim, orientation: 'l' }
        : { w: minDim, h: maxDim, orientation: 'p' };
}

/**
 * Computes aspect-preserving containment box inside (boxX, boxY, boxW, boxH).
 */
export function computeContainRect(srcW, srcH, boxX, boxY, boxW, boxH) {
    if (srcW <= 0 || srcH <= 0 || boxW <= 0 || boxH <= 0) {
        return { x: boxX, y: boxY, w: Math.max(0, boxW), h: Math.max(0, boxH) };
    }
    const srcRatio = srcW / srcH;
    const boxRatio = boxW / boxH;
    let w, h;
    if (srcRatio > boxRatio) {
        w = boxW;
        h = w / srcRatio;
    } else {
        h = boxH;
        w = h * srcRatio;
    }
    return {
        x: boxX + (boxW - w) / 2,
        y: boxY + (boxH - h) / 2,
        w,
        h,
    };
}

/**
 * Computes exact layout for "Duplicar 2x1" shared 1:1 between Canvas preview and jsPDF export.
 * Eliminates the old 30mm fixed gap and double-margin bugs.
 */
export function computeDuplicate2x1Layout({
    paperKey = 'letter',
    orientation = 'auto',
    marginMm = 5,
    centerGapMm = 4,
    imgW,
    imgH,
}) {
    const safeW = Math.max(1, Number(imgW) || 1);
    const safeH = Math.max(1, Number(imgH) || 1);
    const spec = PAPER_SIZES[paperKey === 'fit' ? 'a4' : paperKey] || PAPER_SIZES.letter;
    const shortDim = Math.min(spec.w, spec.h);
    const longDim = Math.max(spec.w, spec.h);
    const margin = Math.max(0, Number(marginMm) || 0);
    const gap = Math.max(0, Number(centerGapMm) || 0);

    const calcSlotScale = (pageW, pageH) => {
        const isLand = pageW > pageH;
        const innerW = Math.max(1, pageW - margin * 2);
        const innerH = Math.max(1, pageH - margin * 2);
        const slotW = isLand ? Math.max(1, (innerW - gap) / 2) : innerW;
        const slotH = isLand ? innerH : Math.max(1, (innerH - gap) / 2);
        return Math.min(slotW / safeW, slotH / safeH);
    };

    let resolvedOrient = orientation;
    if (orientation === 'auto') {
        const pScale = calcSlotScale(shortDim, longDim);
        const lScale = calcSlotScale(longDim, shortDim);
        resolvedOrient = lScale > pScale ? 'l' : 'p';
    }

    const pageW = resolvedOrient === 'l' ? longDim : shortDim;
    const pageH = resolvedOrient === 'l' ? shortDim : longDim;
    const isLandscapePage = pageW > pageH;

    const innerW = Math.max(1, pageW - margin * 2);
    const innerH = Math.max(1, pageH - margin * 2);

    let box1, box2, cutLine;
    if (isLandscapePage) {
        // Vertical split: Left | Gap | Right
        const slotW = Math.max(1, (innerW - gap) / 2);
        const slotH = innerH;
        box1 = { x: margin, y: margin, w: slotW, h: slotH };
        box2 = { x: margin + slotW + gap, y: margin, w: slotW, h: slotH };
        const cutX = margin + slotW + gap / 2;
        cutLine = {
            x1: cutX,
            y1: 0,
            x2: cutX,
            y2: pageH,
            textX: cutX,
            textY: pageH / 2,
            angleDeg: 90,
            isVertical: true,
        };
    } else {
        // Horizontal split: Top / Gap / Bottom
        const slotW = innerW;
        const slotH = Math.max(1, (innerH - gap) / 2);
        box1 = { x: margin, y: margin, w: slotW, h: slotH };
        box2 = { x: margin, y: margin + slotH + gap, w: slotW, h: slotH };
        const cutY = margin + slotH + gap / 2;
        cutLine = {
            x1: 0,
            y1: cutY,
            x2: pageW,
            y2: cutY,
            textX: pageW / 2,
            textY: cutY,
            angleDeg: 0,
            isVertical: false,
        };
    }

    return {
        pageW,
        pageH,
        orientation: resolvedOrient,
        isLandscapePage,
        marginMm: margin,
        centerGapMm: gap,
        slot1: { box: box1, image: computeContainRect(safeW, safeH, box1.x, box1.y, box1.w, box1.h) },
        slot2: { box: box2, image: computeContainRect(safeW, safeH, box2.x, box2.y, box2.w, box2.h) },
        cutLine,
    };
}

/**
 * Computes exact distortion-free tile geometry for Poster.
 * Provides continuous `exactSrcRect` for sub-pixel-accurate Canvas/PDF rendering
 * (zero seam drift or aspect distortion across any image/grid size) alongside
 * strictly in-bounds integer `srcRect` bounds, trims empty/sliver sheets in
 * `contain` mode, and supports `proportional` auto-row sizing.
 */
export function computePosterLayout({
    imgW,
    imgH,
    cols = 2,
    rows = 2,
    paperKey = 'letter',
    orientation = 'auto',
    fitMode = 'contain',
    overlapMm = 5,
    marginMm = 8,
}) {
    const safeImgW = Math.max(1, Math.round(Number(imgW) || 1));
    const safeImgH = Math.max(1, Math.round(Number(imgH) || 1));
    const requestedCols = clamp(Math.round(Number(cols) || 1), 1, 15);
    const requestedRows = clamp(Math.round(Number(rows) || 1), 1, 15);
    const overlap = clamp(Number(overlapMm) || 0, 0, 15);
    const parsedMargin = Number(marginMm);
    const margin = clamp(Number.isFinite(parsedMargin) ? parsedMargin : 8, 0, 20);
    const normalizedFitMode =
        fitMode === 'cover' || fitMode === 'proportional' ? fitMode : 'contain';

    const spec = PAPER_SIZES[paperKey] || PAPER_SIZES.letter;
    const shortDim = Math.min(spec.w, spec.h);
    const longDim = Math.max(spec.w, spec.h);
    const imgRatio = safeImgW / safeImgH;

    const computeGridMetrics = (sheetW, sheetH, colCount, rowCount) => {
        const printableW = Math.max(10, sheetW - margin * 2);
        const printableH = Math.max(10, sheetH - margin * 2);
        const effOx = colCount > 1 ? Math.min(overlap, printableW * 0.35) : 0;
        const effOy = rowCount > 1 ? Math.min(overlap, printableH * 0.35) : 0;
        const stepX = printableW - effOx;
        const stepY = printableH - effOy;
        const totalW = printableW + (colCount - 1) * stepX;
        const totalH = printableH + (rowCount - 1) * stepY;
        return { printableW, printableH, effOx, effOy, stepX, stepY, totalW, totalH };
    };

    const evaluateOrientation = (sheetW, sheetH) => {
        if (normalizedFitMode === 'proportional') {
            const printableW = Math.max(10, sheetW - margin * 2);
            const printableH = Math.max(10, sheetH - margin * 2);
            const effOx = requestedCols > 1 ? Math.min(overlap, printableW * 0.35) : 0;
            const totalW = printableW + (requestedCols - 1) * (printableW - effOx);
            const idealH = totalW / imgRatio;
            // Allow 0.5 mm tolerance before spilling onto an extra row
            let propRows = 1;
            if (idealH > printableH + 0.5) {
                const effOyMulti = Math.min(overlap, printableH * 0.35);
                const stepYMulti = printableH - effOyMulti;
                propRows = clamp(
                    1 + Math.ceil((idealH - printableH - 0.5) / stepYMulti),
                    1,
                    25
                );
            }
            const metrics = computeGridMetrics(sheetW, sheetH, requestedCols, propRows);
            const scale = Math.min(metrics.totalW / safeImgW, metrics.totalH / safeImgH);
            const placedW = safeImgW * scale;
            const placedH = safeImgH * scale;
            const sheetArea = Math.max(1, requestedCols * propRows * sheetW * sheetH);
            const efficiency = (placedW * placedH) / sheetArea;
            return {
                sheetW,
                sheetH,
                propRows,
                areaUsed: placedW * placedH,
                efficiency,
                coverLoss: 0,
            };
        }

        const m = computeGridMetrics(sheetW, sheetH, requestedCols, requestedRows);
        const scaleContain = Math.min(m.totalW / safeImgW, m.totalH / safeImgH);
        const areaUsed = safeImgW * scaleContain * (safeImgH * scaleContain);
        const coverCropRatio = Math.max(m.totalW / safeImgW, m.totalH / safeImgH);
        const coverLoss =
            1 - (m.totalW * m.totalH) / Math.max(1, safeImgW * coverCropRatio * safeImgH * coverCropRatio);
        return { sheetW, sheetH, areaUsed, coverLoss, efficiency: 0 };
    };

    let resolvedOrient = orientation;
    if (orientation === 'auto') {
        const pEval = evaluateOrientation(shortDim, longDim);
        const lEval = evaluateOrientation(longDim, shortDim);
        if (normalizedFitMode === 'cover') {
            resolvedOrient = lEval.coverLoss < pEval.coverLoss ? 'l' : 'p';
        } else if (normalizedFitMode === 'proportional') {
            // Prefer matching image orientation unless the alternate orientation yields substantially better sheet usage
            if (Math.abs(lEval.efficiency - pEval.efficiency) > 0.12) {
                resolvedOrient = lEval.efficiency > pEval.efficiency ? 'l' : 'p';
            } else {
                resolvedOrient = imgRatio >= 1 ? 'l' : 'p';
            }
        } else {
            resolvedOrient = lEval.areaUsed > pEval.areaUsed ? 'l' : 'p';
        }
    }

    const sheetW = resolvedOrient === 'l' ? longDim : shortDim;
    const sheetH = resolvedOrient === 'l' ? shortDim : longDim;
    const basePrintableW = Math.max(10, sheetW - margin * 2);
    const basePrintableH = Math.max(10, sheetH - margin * 2);

    let cCount = requestedCols;
    let rCount = requestedRows;

    if (normalizedFitMode === 'proportional') {
        const effOx = cCount > 1 ? Math.min(overlap, basePrintableW * 0.35) : 0;
        const baseTotalW = basePrintableW + (cCount - 1) * (basePrintableW - effOx);
        const idealH = baseTotalW / imgRatio;
        if (idealH <= basePrintableH + 0.5) {
            rCount = 1;
        } else {
            const effOyMulti = Math.min(overlap, basePrintableH * 0.35);
            const stepYMulti = basePrintableH - effOyMulti;
            rCount = clamp(
                1 + Math.ceil((idealH - basePrintableH - 0.5) / stepYMulti),
                1,
                25
            );
        }
    }

    let metrics = computeGridMetrics(sheetW, sheetH, cCount, rCount);

    // Trim completely blank / overlap-sliver sheets in contain mode so every sheet carries real image content
    if (normalizedFitMode === 'contain') {
        const initialRatio = metrics.totalW / metrics.totalH;
        const initPlacedW = imgRatio > initialRatio ? metrics.totalW : metrics.totalH * imgRatio;
        const initPlacedH = imgRatio > initialRatio ? metrics.totalW / imgRatio : metrics.totalH;

        const minCols =
            initPlacedW <= basePrintableW + 0.5
                ? 1
                : clamp(
                      1 + Math.ceil((initPlacedW - basePrintableW - 0.5) / Math.max(1, metrics.stepX)),
                      1,
                      cCount
                  );
        const minRows =
            initPlacedH <= basePrintableH + 0.5
                ? 1
                : clamp(
                      1 + Math.ceil((initPlacedH - basePrintableH - 0.5) / Math.max(1, metrics.stepY)),
                      1,
                      rCount
                  );

        if (minCols < cCount || minRows < rCount) {
            cCount = minCols;
            rCount = minRows;
            metrics = computeGridMetrics(sheetW, sheetH, cCount, rCount);
        }
    }

    const {
        printableW,
        printableH,
        effOx: effectiveOverlapX,
        effOy: effectiveOverlapY,
        stepX,
        stepY,
        totalW,
        totalH,
    } = metrics;

    const posterRatio = totalW / totalH;

    // Virtual full-image placement in assembled poster mm coordinates
    let placedW, placedH, placedX, placedY;
    let cropSrcX = 0;
    let cropSrcY = 0;
    let cropSrcW = safeImgW;
    let cropSrcH = safeImgH;

    if (normalizedFitMode === 'cover') {
        placedX = 0;
        placedY = 0;
        placedW = totalW;
        placedH = totalH;
        if (imgRatio > posterRatio) {
            cropSrcH = safeImgH;
            cropSrcW = safeImgH * posterRatio;
            cropSrcX = (safeImgW - cropSrcW) / 2;
        } else {
            cropSrcW = safeImgW;
            cropSrcH = safeImgW / posterRatio;
            cropSrcY = (safeImgH - cropSrcH) / 2;
        }
    } else {
        // contain & proportional: never distort or crop
        if (imgRatio > posterRatio) {
            placedW = totalW;
            placedH = totalW / imgRatio;
            placedX = 0;
            placedY = normalizedFitMode === 'proportional' ? 0 : (totalH - placedH) / 2;
        } else {
            placedH = totalH;
            placedW = totalH * imgRatio;
            placedY = 0;
            placedX = (totalW - placedW) / 2;
        }
    }

    const totalPages = cCount * rCount;
    const tiles = [];

    for (let r = 0; r < rCount; r++) {
        for (let c = 0; c < cCount; c++) {
            const pageNum = r * cCount + c + 1;
            const tilePlaneX0 = c * stepX;
            const tilePlaneY0 = r * stepY;
            const tilePlaneX1 = tilePlaneX0 + printableW;
            const tilePlaneY1 = tilePlaneY0 + printableH;

            // Intersect tile printable plane with placed image rect
            const ix0 = Math.max(tilePlaneX0, placedX);
            const iy0 = Math.max(tilePlaneY0, placedY);
            const ix1 = Math.min(tilePlaneX1, placedX + placedW);
            const iy1 = Math.min(tilePlaneY1, placedY + placedH);

            let srcRect = null;
            let exactSrcRect = null;
            let destRectMm = null;

            if (ix1 > ix0 + 0.05 && iy1 > iy0 + 0.05) {
                const u0 = clamp((ix0 - placedX) / placedW, 0, 1);
                const v0 = clamp((iy0 - placedY) / placedH, 0, 1);
                const u1 = clamp((ix1 - placedX) / placedW, 0, 1);
                const v1 = clamp((iy1 - placedY) / placedH, 0, 1);

                const esx0 = clamp(cropSrcX + u0 * cropSrcW, 0, safeImgW);
                const esy0 = clamp(cropSrcY + v0 * cropSrcH, 0, safeImgH);
                const esx1 = clamp(cropSrcX + u1 * cropSrcW, esx0, safeImgW);
                const esy1 = clamp(cropSrcY + v1 * cropSrcH, esy0, safeImgH);

                exactSrcRect = {
                    sx: esx0,
                    sy: esy0,
                    sw: Math.max(1e-4, esx1 - esx0),
                    sh: Math.max(1e-4, esy1 - esy0),
                };

                const px0 = clamp(Math.floor(esx0 + 1e-6), 0, Math.max(0, safeImgW - 1));
                const py0 = clamp(Math.floor(esy0 + 1e-6), 0, Math.max(0, safeImgH - 1));
                const px1 = clamp(Math.ceil(esx1 - 1e-6), Math.min(safeImgW, px0 + 1), safeImgW);
                const py1 = clamp(Math.ceil(esy1 - 1e-6), Math.min(safeImgH, py0 + 1), safeImgH);

                srcRect = {
                    sx: px0,
                    sy: py0,
                    sw: Math.max(1, px1 - px0),
                    sh: Math.max(1, py1 - py0),
                };

                destRectMm = {
                    x: margin + (ix0 - tilePlaneX0),
                    y: margin + (iy0 - tilePlaneY0),
                    w: ix1 - ix0,
                    h: iy1 - iy0,
                };
            }

            tiles.push({
                row: r,
                col: c,
                pageNum,
                totalPages,
                label: `F${r + 1}-C${c + 1} · Pág ${pageNum}/${totalPages}`,
                srcRect,
                exactSrcRect,
                destRectMm,
                printableRectMm: { x: margin, y: margin, w: printableW, h: printableH },
                overlapGuides: {
                    left: c > 0 && effectiveOverlapX > 0 ? margin + effectiveOverlapX : null,
                    top: r > 0 && effectiveOverlapY > 0 ? margin + effectiveOverlapY : null,
                },
                trimEdges: {
                    top: r > 0,
                    right: c < cCount - 1,
                    bottom: r < rCount - 1,
                    left: c > 0,
                },
                cutEdges: {
                    top: r > 0 && effectiveOverlapY <= 0,
                    right: c < cCount - 1,
                    bottom: r < rCount - 1,
                    left: c > 0 && effectiveOverlapX <= 0,
                },
                glueEdges: {
                    top: r > 0 && effectiveOverlapY > 0,
                    left: c > 0 && effectiveOverlapX > 0,
                },
            });
        }
    }

    return {
        sheetW,
        sheetH,
        orientation: resolvedOrient,
        paperKey,
        fitMode: normalizedFitMode,
        cols: cCount,
        rows: rCount,
        requestedCols,
        requestedRows,
        totalPages,
        marginMm: margin,
        overlapMm: effectiveOverlapX,
        overlapYMm: effectiveOverlapY,
        printableW,
        printableH,
        totalW,
        totalH,
        assembledWidthCm: Math.round((totalW / 10) * 10) / 10,
        assembledHeightCm: Math.round((totalH / 10) * 10) / 10,
        imageWidthCm: Math.round((placedW / 10) * 10) / 10,
        imageHeightCm: Math.round((placedH / 10) * 10) / 10,
        placedRectMm: { x: placedX, y: placedY, w: placedW, h: placedH },
        cropSrcRect: { sx: cropSrcX, sy: cropSrcY, sw: cropSrcW, sh: cropSrcH },
        tiles,
    };
}
