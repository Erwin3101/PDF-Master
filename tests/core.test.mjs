import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PAPER_SIZES,
    clampPdfRenderScale,
    computeContainRect,
    computeDuplicate2x1Layout,
    computePosterLayout,
} from '../src/core/geometry.js';
import { buildOutputName, formatFileSize, sanitizeBaseName } from '../src/core/fileNaming.js';
import { AppState } from '../src/core/state.js';
import { TRANSLATIONS, t } from '../src/core/i18n.js';

test('PAPER_SIZES includes all required formats for Poster, Img2PDF, and N-Up', () => {
    for (const key of ['letter', 'legal', 'a4', 'a3', 'tabloid', 'a9', 'a10']) {
        assert.ok(PAPER_SIZES[key], `Missing paper size: ${key}`);
        assert.ok(PAPER_SIZES[key].w > 0 && PAPER_SIZES[key].h > 0);
    }
});

test('computeContainRect preserves aspect ratio inside target box', () => {
    const rect = computeContainRect(1920, 1080, 10, 20, 100, 100);
    assert.equal(rect.w, 100);
    assert.ok(Math.abs(rect.h - 56.25) < 0.01);
    assert.equal(rect.x, 10);
    assert.ok(Math.abs(rect.y - (20 + (100 - 56.25) / 2)) < 0.01);
});

test('computePosterLayout (contain) guarantees zero distortion and integer pixel crops', () => {
    const layout = computePosterLayout({
        imgW: 3000,
        imgH: 1500,
        cols: 3,
        rows: 2,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'contain',
        overlapMm: 6,
        marginMm: 8,
    });

    assert.equal(layout.totalPages, 6);
    assert.equal(layout.tiles.length, 6);
    assert.equal(layout.orientation, 'l'); // Landscape sheets better fit 2:1 image in 3x2 grid

    for (const tile of layout.tiles) {
        assert.ok(tile.srcRect, `Tile ${tile.pageNum} should contain part of the image`);
        assert.ok(Number.isInteger(tile.srcRect.sx));
        assert.ok(Number.isInteger(tile.srcRect.sy));
        assert.ok(Number.isInteger(tile.srcRect.sw));
        assert.ok(Number.isInteger(tile.srcRect.sh));
        assert.ok(tile.srcRect.sx >= 0 && tile.srcRect.sx + tile.srcRect.sw <= 3000);
        assert.ok(tile.srcRect.sy >= 0 && tile.srcRect.sy + tile.srcRect.sh <= 1500);

        const srcAspect = tile.srcRect.sw / tile.srcRect.sh;
        const destAspect = tile.destRectMm.w / tile.destRectMm.h;
        assert.ok(
            Math.abs(srcAspect - destAspect) < 0.02,
            `Aspect mismatch on tile ${tile.pageNum}: src=${srcAspect}, dest=${destAspect}`
        );
    }
});

test('computePosterLayout (cover) fills entire printable tile grid cleanly', () => {
    const layout = computePosterLayout({
        imgW: 2000,
        imgH: 2000,
        cols: 2,
        rows: 2,
        paperKey: 'a4',
        orientation: 'p',
        fitMode: 'cover',
        overlapMm: 10,
        marginMm: 5,
    });

    assert.equal(layout.totalPages, 4);
    assert.equal(layout.tiles[0].label, 'F1-C1 · Pág 1/4');
    assert.equal(layout.tiles[3].label, 'F2-C2 · Pág 4/4');
    // Cover fills full printable area on every tile
    for (const tile of layout.tiles) {
        assert.ok(Math.abs(tile.destRectMm.w - layout.printableW) < 0.01);
        assert.ok(Math.abs(tile.destRectMm.h - layout.printableH) < 0.01);
    }
    // Check physical dimensions reflect overlap deduction
    const expectedTotalW = layout.printableW * 2 - 10;
    assert.ok(Math.abs(layout.totalW - expectedTotalW) < 0.01);

    // Overlap > 0: only leading sheets (right/bottom edges) are cut; trailing sheets use glue tabs
    assert.deepEqual(layout.tiles[0].cutEdges, { top: false, right: true, bottom: true, left: false });
    assert.deepEqual(layout.tiles[0].glueEdges, { top: false, left: false });
    assert.deepEqual(layout.tiles[1].cutEdges, { top: false, right: false, bottom: true, left: false });
    assert.deepEqual(layout.tiles[1].glueEdges, { top: false, left: true });
    assert.deepEqual(layout.tiles[2].cutEdges, { top: false, right: true, bottom: false, left: false });
    assert.deepEqual(layout.tiles[2].glueEdges, { top: true, left: false });
    assert.deepEqual(layout.tiles[3].cutEdges, { top: false, right: false, bottom: false, left: false });
    assert.deepEqual(layout.tiles[3].glueEdges, { top: true, left: true });
});

test('computePosterLayout marks all interior seams as cutEdges when overlap is 0', () => {
    const layout = computePosterLayout({
        imgW: 2000,
        imgH: 2000,
        cols: 2,
        rows: 2,
        paperKey: 'letter',
        orientation: 'p',
        fitMode: 'cover',
        overlapMm: 0,
        marginMm: 8,
    });

    assert.deepEqual(layout.tiles[0].cutEdges, { top: false, right: true, bottom: true, left: false });
    assert.deepEqual(layout.tiles[1].cutEdges, { top: false, right: false, bottom: true, left: true });
    assert.deepEqual(layout.tiles[2].cutEdges, { top: true, right: true, bottom: false, left: false });
    assert.deepEqual(layout.tiles[3].cutEdges, { top: true, right: false, bottom: false, left: true });
    for (const tile of layout.tiles) {
        assert.deepEqual(tile.glueEdges, { top: false, left: false });
    }
});

test('computePosterLayout exactSrcRect has zero seam drift and zero distortion at any image or grid size', () => {
    for (const [imgW, imgH] of [[50, 50], [80, 80], [120, 90], [400, 300], [500, 2000], [5000, 500], [1920, 1080]]) {
        for (const [cols, rows] of [[1, 1], [2, 2], [3, 5], [8, 8], [10, 10]]) {
            for (const fitMode of ['contain', 'cover', 'proportional']) {
                for (const overlapMm of [0, 5, 10]) {
                    for (const marginMm of [0, 8]) {
                        const layout = computePosterLayout({
                            imgW,
                            imgH,
                            cols,
                            rows,
                            paperKey: 'letter',
                            orientation: 'auto',
                            fitMode,
                            overlapMm,
                            marginMm,
                        });
                        assert.equal(layout.marginMm, marginMm);
                        const pxPerMmX = layout.cropSrcRect.sw / layout.placedRectMm.w;
                        const pxPerMmY = layout.cropSrcRect.sh / layout.placedRectMm.h;
                        assert.ok(Math.abs(pxPerMmX - pxPerMmY) < 1e-6, 'Global placed scale must be isotropic');

                        for (const tile of layout.tiles) {
                            assert.ok(tile.exactSrcRect, `Missing exactSrcRect on tile ${tile.pageNum}`);
                            assert.ok(tile.srcRect, `Empty tile emitted for ${imgW}x${imgH} ${cols}x${rows} ${fitMode}`);
                            assert.ok(tile.srcRect.sx >= 0 && tile.srcRect.sx + tile.srcRect.sw <= imgW);
                            assert.ok(tile.srcRect.sy >= 0 && tile.srcRect.sy + tile.srcRect.sh <= imgH);
                            assert.ok(tile.exactSrcRect.sx >= 0 && tile.exactSrcRect.sx + tile.exactSrcRect.sw <= imgW + 1e-6);
                            assert.ok(tile.exactSrcRect.sy >= 0 && tile.exactSrcRect.sy + tile.exactSrcRect.sh <= imgH + 1e-6);

                            const exactAspect = tile.exactSrcRect.sw / tile.exactSrcRect.sh;
                            const destAspect = tile.destRectMm.w / tile.destRectMm.h;
                            assert.ok(
                                Math.abs(exactAspect - destAspect) < 1e-5,
                                `Exact aspect mismatch (${imgW}x${imgH} ${cols}x${rows} ${fitMode}): ${exactAspect} vs ${destAspect}`
                            );
                        }

                        // Verify adjacent horizontal & vertical seams align to exact source pixel coordinates
                        for (let r = 0; r < layout.rows; r++) {
                            for (let c = 0; c < layout.cols - 1; c++) {
                                const left = layout.tiles[r * layout.cols + c];
                                const right = layout.tiles[r * layout.cols + c + 1];
                                const leftRightEdgePx = left.exactSrcRect.sx + left.exactSrcRect.sw;
                                const expectedOverlapPx = layout.overlapMm * pxPerMmX;
                                const actualOverlapPx = leftRightEdgePx - right.exactSrcRect.sx;
                                assert.ok(
                                    Math.abs(actualOverlapPx - expectedOverlapPx) < 1e-4,
                                    `Seam X mismatch (${imgW}x${imgH} ${cols}x${rows} ${fitMode}): ${actualOverlapPx} vs ${expectedOverlapPx}`
                                );
                            }
                        }
                    }
                }
            }
        }
    }
});

test('computePosterLayout (contain) eliminates blank pages and overlap-only sliver pages', () => {
    const tallOnWide = computePosterLayout({
        imgW: 600,
        imgH: 1800,
        cols: 3,
        rows: 2,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'contain',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(tallOnWide.cols, 1);
    assert.equal(tallOnWide.rows, 2);
    assert.equal(tallOnWide.totalPages, 2);

    const tallSliverCase = computePosterLayout({
        imgW: 500,
        imgH: 2000,
        cols: 3,
        rows: 3,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'contain',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(tallSliverCase.cols, 1);
    assert.equal(tallSliverCase.rows, 3);
    assert.equal(tallSliverCase.totalPages, 3);

    const wideOnColumn = computePosterLayout({
        imgW: 1920,
        imgH: 1080,
        cols: 1,
        rows: 5,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'contain',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(wideOnColumn.cols, 1);
    assert.equal(wideOnColumn.rows, 1);
    assert.equal(wideOnColumn.totalPages, 1);
});

test('computePosterLayout (proportional) auto-computes rows to cover image cleanly without cropping', () => {
    const wide = computePosterLayout({
        imgW: 1920,
        imgH: 1080,
        cols: 3,
        rows: 1,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'proportional',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(wide.cols, 3);
    assert.ok(wide.rows >= 2);
    assert.equal(wide.cropSrcRect.sx, 0);
    assert.equal(wide.cropSrcRect.sy, 0);
    assert.equal(wide.cropSrcRect.sw, 1920);
    assert.equal(wide.cropSrcRect.sh, 1080);
    assert.ok(Math.abs(wide.placedRectMm.w - wide.totalW) < 0.01);
});

test('computePosterLayout (stretch) always honors exact cols x rows (2x1, 3x1, 1x2, 1x3, NxM) with full image and zero seam drift', () => {
    const images = [
        [900, 1200],   // portrait 3:4
        [1080, 1920],  // tall phone 9:16
        [1000, 1000],  // square 1:1
        [1920, 1080],  // landscape 16:9
        [3000, 600],   // panoramic 5:1
        [600, 3000],   // tall banner 1:5
    ];
    const grids = [
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
        [1, 2],
        [1, 3],
        [1, 4],
        [2, 2],
        [3, 2],
        [2, 3],
        [5, 3],
        [10, 10],
        [20, 1],
        [1, 20],
    ];

    for (const [imgW, imgH] of images) {
        for (const [cols, rows] of grids) {
            for (const overlapMm of [0, 5, 10]) {
                const layout = computePosterLayout({
                    imgW,
                    imgH,
                    cols,
                    rows,
                    paperKey: 'letter',
                    orientation: 'auto',
                    fitMode: 'stretch',
                    overlapMm,
                    marginMm: 8,
                });

                assert.equal(layout.fitMode, 'stretch');
                assert.equal(layout.cols, cols, `Expected cols=${cols} for ${imgW}x${imgH} ${cols}x${rows}`);
                assert.equal(layout.rows, rows, `Expected rows=${rows} for ${imgW}x${imgH} ${cols}x${rows}`);
                assert.equal(layout.totalPages, cols * rows);
                assert.equal(layout.tiles.length, cols * rows);

                // Full image without cropping, covering full assembled grid
                assert.equal(layout.cropSrcRect.sx, 0);
                assert.equal(layout.cropSrcRect.sy, 0);
                assert.equal(layout.cropSrcRect.sw, imgW);
                assert.equal(layout.cropSrcRect.sh, imgH);
                assert.equal(layout.placedRectMm.x, 0);
                assert.equal(layout.placedRectMm.y, 0);
                assert.ok(Math.abs(layout.placedRectMm.w - layout.totalW) < 1e-6);
                assert.ok(Math.abs(layout.placedRectMm.h - layout.totalH) < 1e-6);

                const pxPerMmX = imgW / layout.totalW;
                const pxPerMmY = imgH / layout.totalH;

                for (const tile of layout.tiles) {
                    assert.ok(tile.exactSrcRect, `Missing exactSrcRect on tile ${tile.pageNum}`);
                    assert.ok(tile.destRectMm, `Missing destRectMm on tile ${tile.pageNum}`);
                    assert.ok(Math.abs(tile.destRectMm.x - layout.marginMm) < 1e-6);
                    assert.ok(Math.abs(tile.destRectMm.y - layout.marginMm) < 1e-6);
                    assert.ok(Math.abs(tile.destRectMm.w - layout.printableW) < 1e-6);
                    assert.ok(Math.abs(tile.destRectMm.h - layout.printableH) < 1e-6);
                }

                // Exact horizontal seam alignment
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols - 1; c++) {
                        const left = layout.tiles[r * cols + c];
                        const right = layout.tiles[r * cols + c + 1];
                        const actualOverlapPx = (left.exactSrcRect.sx + left.exactSrcRect.sw) - right.exactSrcRect.sx;
                        const expectedOverlapPx = layout.overlapMm * pxPerMmX;
                        assert.ok(
                            Math.abs(actualOverlapPx - expectedOverlapPx) < 1e-4,
                            `Stretch seam X mismatch (${imgW}x${imgH} ${cols}x${rows} ov=${overlapMm}): ${actualOverlapPx} vs ${expectedOverlapPx}`
                        );
                    }
                }

                // Exact vertical seam alignment
                for (let r = 0; r < rows - 1; r++) {
                    for (let c = 0; c < cols; c++) {
                        const top = layout.tiles[r * cols + c];
                        const bottom = layout.tiles[(r + 1) * cols + c];
                        const actualOverlapPx = (top.exactSrcRect.sy + top.exactSrcRect.sh) - bottom.exactSrcRect.sy;
                        const expectedOverlapPx = layout.overlapYMm * pxPerMmY;
                        assert.ok(
                            Math.abs(actualOverlapPx - expectedOverlapPx) < 1e-4,
                            `Stretch seam Y mismatch (${imgW}x${imgH} ${cols}x${rows} ov=${overlapMm}): ${actualOverlapPx} vs ${expectedOverlapPx}`
                        );
                    }
                }

                // At overlap 0, slices must be exact equal fractions of the image
                if (overlapMm === 0) {
                    const expectedTileSrcW = imgW / cols;
                    const expectedTileSrcH = imgH / rows;
                    for (const tile of layout.tiles) {
                        assert.ok(Math.abs(tile.exactSrcRect.sw - expectedTileSrcW) < 1e-4);
                        assert.ok(Math.abs(tile.exactSrcRect.sh - expectedTileSrcH) < 1e-4);
                    }
                }
            }
        }
    }
});

test('computePosterLayout (stretch) auto-orientation minimizes aspect ratio distortion', () => {
    // Portrait 3:4 at 2x2: Portrait sheets (ratio ~0.76) match 0.75 far better than Landscape (~1.32)
    const p2x2 = computePosterLayout({
        imgW: 900,
        imgH: 1200,
        cols: 2,
        rows: 2,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'stretch',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(p2x2.orientation, 'p');

    // Portrait 3:4 at 1x2: Landscape sheets (ratio ~0.67) match 0.75 far better than Portrait (~0.38)
    const p1x2 = computePosterLayout({
        imgW: 900,
        imgH: 1200,
        cols: 1,
        rows: 2,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'stretch',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(p1x2.orientation, 'l');

    // Landscape 16:9 at 2x1: Portrait sheets (ratio ~1.50) match 1.78 closer than Landscape (~2.61)
    const l2x1 = computePosterLayout({
        imgW: 1920,
        imgH: 1080,
        cols: 2,
        rows: 1,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'stretch',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(l2x1.orientation, 'p');

    // Panoramic 3:1 at 2x1: Landscape sheets (~2.61) match 3.0 closer than Portrait (~1.50)
    const pano2x1 = computePosterLayout({
        imgW: 3000,
        imgH: 1000,
        cols: 2,
        rows: 1,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'stretch',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(pano2x1.orientation, 'l');
});

test('computePosterLayout (proportional-height) auto-computes cols symmetrically without cropping or distortion', () => {
    const tall = computePosterLayout({
        imgW: 1920,
        imgH: 1080,
        cols: 1,
        rows: 2,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'proportional-height',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(tall.fitMode, 'proportional-height');
    assert.equal(tall.rows, 2);
    assert.ok(tall.cols >= 3, `Expected >= 3 cols for 16:9 at 2 rows, got ${tall.cols}`);
    assert.equal(tall.cropSrcRect.sx, 0);
    assert.equal(tall.cropSrcRect.sy, 0);
    assert.equal(tall.cropSrcRect.sw, 1920);
    assert.equal(tall.cropSrcRect.sh, 1080);
    assert.ok(Math.abs(tall.placedRectMm.h - tall.totalH) < 0.01);
    for (const tile of tall.tiles) {
        assert.ok(tile.exactSrcRect && tile.destRectMm, `Tile ${tile.pageNum} must not be empty`);
        const srcAspect = tile.exactSrcRect.sw / tile.exactSrcRect.sh;
        const destAspect = tile.destRectMm.w / tile.destRectMm.h;
        assert.ok(Math.abs(srcAspect - destAspect) < 1e-5);
    }
});

test('computePosterLayout (proportional) fits 1x1 square on single Portrait sheet and never emits blank outer columns', () => {
    const sq = computePosterLayout({
        imgW: 1000,
        imgH: 1000,
        cols: 1,
        rows: 1,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'proportional',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.equal(sq.orientation, 'p');
    assert.equal(sq.cols, 1);
    assert.equal(sq.rows, 1);
    assert.equal(sq.totalPages, 1);

    // Extreme tall image with many cols must never emit blank tiles
    const extremeTall = computePosterLayout({
        imgW: 1000,
        imgH: 4000,
        cols: 8,
        rows: 1,
        paperKey: 'letter',
        orientation: 'l',
        fitMode: 'proportional',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.ok(extremeTall.tiles.length > 0);
    for (const tile of extremeTall.tiles) {
        assert.ok(tile.exactSrcRect && tile.destRectMm, `Blank tile emitted at F${tile.row + 1}-C${tile.col + 1}`);
    }
});

test('computePosterLayout (contain) trimming never shrinks placed image dimensions', () => {
    // Regression from 12,000-case audit: 1900x850 at 3x2 Portrait previously shrank placedW from 589.7 to 588.78 mm
    const layout = computePosterLayout({
        imgW: 1900,
        imgH: 850,
        cols: 3,
        rows: 2,
        paperKey: 'letter',
        orientation: 'p',
        fitMode: 'contain',
        overlapMm: 5,
        marginMm: 8,
    });
    assert.ok(
        layout.placedRectMm.w >= 589.69,
        `Placed width shrank unexpectedly to ${layout.placedRectMm.w}`
    );
    for (const tile of layout.tiles) {
        assert.ok(tile.exactSrcRect && tile.destRectMm, `Blank tile emitted at ${tile.pageNum}`);
    }
});

test('computePosterLayout localizes tile labels for Spanish and English', () => {
    const es = computePosterLayout({
        imgW: 1000,
        imgH: 1000,
        cols: 2,
        rows: 1,
        fitMode: 'stretch',
        lang: 'es',
    });
    assert.equal(es.tiles[0].label, 'F1-C1 · Pág 1/2');
    assert.equal(es.tiles[1].label, 'F1-C2 · Pág 2/2');

    const en = computePosterLayout({
        imgW: 1000,
        imgH: 1000,
        cols: 2,
        rows: 1,
        fitMode: 'stretch',
        lang: 'en',
    });
    assert.equal(en.tiles[0].label, 'R1-C1 · Page 1/2');
    assert.equal(en.tiles[1].label, 'R1-C2 · Page 2/2');
});

test('computePosterLayout exhaustive 5-mode stress sweep guarantees zero blank tiles, in-bounds rects, and seam accuracy', () => {
    const dims = [[60, 60], [500, 2000], [900, 1200], [1000, 1000], [1920, 1080], [3000, 500]];
    const grids = [[1, 1], [2, 1], [3, 1], [1, 2], [1, 3], [2, 2], [4, 3], [8, 5]];
    const modes = ['stretch', 'contain', 'cover', 'proportional', 'proportional-height'];

    for (const [imgW, imgH] of dims) {
        for (const [cols, rows] of grids) {
            for (const fitMode of modes) {
                for (const overlapMm of [0, 5, 12]) {
                    for (const marginMm of [0, 5, 8]) {
                        const layout = computePosterLayout({
                            imgW,
                            imgH,
                            cols,
                            rows,
                            paperKey: 'letter',
                            orientation: 'auto',
                            fitMode,
                            overlapMm,
                            marginMm,
                        });

                        assert.equal(layout.tiles.length, layout.cols * layout.rows);
                        assert.equal(layout.totalPages, layout.cols * layout.rows);
                        if (fitMode === 'stretch' || fitMode === 'cover') {
                            assert.equal(layout.cols, cols);
                            assert.equal(layout.rows, rows);
                        }

                        const pxPerMmX = layout.cropSrcRect.sw / layout.placedRectMm.w;
                        const pxPerMmY = layout.cropSrcRect.sh / layout.placedRectMm.h;

                        for (const tile of layout.tiles) {
                            assert.ok(tile.exactSrcRect && tile.srcRect && tile.destRectMm);
                            assert.ok(tile.exactSrcRect.sx >= 0);
                            assert.ok(tile.exactSrcRect.sy >= 0);
                            assert.ok(tile.exactSrcRect.sx + tile.exactSrcRect.sw <= imgW + 1e-6);
                            assert.ok(tile.exactSrcRect.sy + tile.exactSrcRect.sh <= imgH + 1e-6);
                        }

                        // Horizontal seams
                        for (let r = 0; r < layout.rows; r++) {
                            for (let c = 0; c < layout.cols - 1; c++) {
                                const left = layout.tiles[r * layout.cols + c];
                                const right = layout.tiles[r * layout.cols + c + 1];
                                const actual = (left.exactSrcRect.sx + left.exactSrcRect.sw) - right.exactSrcRect.sx;
                                const expected = layout.overlapMm * pxPerMmX;
                                assert.ok(Math.abs(actual - expected) < 1e-3);
                            }
                        }
                        // Vertical seams
                        for (let r = 0; r < layout.rows - 1; r++) {
                            for (let c = 0; c < layout.cols; c++) {
                                const top = layout.tiles[r * layout.cols + c];
                                const bottom = layout.tiles[(r + 1) * layout.cols + c];
                                const actual = (top.exactSrcRect.sy + top.exactSrcRect.sh) - bottom.exactSrcRect.sy;
                                const expected = layout.overlapYMm * pxPerMmY;
                                assert.ok(Math.abs(actual - expected) < 1e-3);
                            }
                        }
                    }
                }
            }
        }
    }
});

test('computePosterLayout handles A4 scan tolerances, zero-overlap boundaries, and extreme aspect ratios without blank tiles', () => {
    // 300-DPI A4 scan (2480x3508) & 72-DPI A4 PDF (595x842) on borderless A4 proportional
    for (const [imgW, imgH] of [[2480, 3508], [595, 842]]) {
        const one = computePosterLayout({
            imgW,
            imgH,
            cols: 1,
            rows: 1,
            paperKey: 'a4',
            orientation: 'auto',
            fitMode: 'proportional',
            overlapMm: 0,
            marginMm: 0,
        });
        assert.equal(one.orientation, 'p', `${imgW}x${imgH} cols=1 should pick Portrait A4`);
        assert.equal(one.cols, 1);
        assert.equal(one.rows, 1);
        assert.equal(one.totalPages, 1);

        const two = computePosterLayout({
            imgW,
            imgH,
            cols: 2,
            rows: 1,
            paperKey: 'a4',
            orientation: 'auto',
            fitMode: 'proportional',
            overlapMm: 0,
            marginMm: 0,
        });
        assert.equal(two.orientation, 'p', `${imgW}x${imgH} cols=2 should pick Portrait A4`);
        assert.equal(two.cols, 2);
        assert.equal(two.rows, 2);
        assert.equal(two.totalPages, 4);
    }

    // Boundary cases that previously emitted null tiles due to 1e-3 vs 0.05 mm mismatch
    const propBoundary = computePosterLayout({
        imgW: 1000,
        imgH: 759,
        cols: 2,
        rows: 1,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'proportional',
        overlapMm: 0,
        marginMm: 8,
    });
    for (const tile of propBoundary.tiles) {
        assert.ok(tile.exactSrcRect && tile.destRectMm, `Null tile in 1000x759 proportional at page ${tile.pageNum}`);
    }

    const propHeightBoundary = computePosterLayout({
        imgW: 800,
        imgH: 1054,
        cols: 1,
        rows: 2,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'proportional-height',
        overlapMm: 0,
        marginMm: 8,
    });
    for (const tile of propHeightBoundary.tiles) {
        assert.ok(tile.exactSrcRect && tile.destRectMm, `Null tile in 800x1054 proportional-height at page ${tile.pageNum}`);
    }

    // Extreme aspect ratio (5000x1 on 1x1) and proportional-height 30-col cap trimming
    const needle = computePosterLayout({
        imgW: 5000,
        imgH: 1,
        cols: 1,
        rows: 1,
        paperKey: 'letter',
        orientation: 'auto',
        fitMode: 'contain',
        overlapMm: 0,
        marginMm: 8,
    });
    assert.ok(needle.tiles[0].exactSrcRect && needle.tiles[0].destRectMm, '5000x1 on 1x1 must not emit a null tile');

    const cappedWide = computePosterLayout({
        imgW: 5000,
        imgH: 100,
        cols: 1,
        rows: 8,
        paperKey: 'letter',
        orientation: 'p',
        fitMode: 'proportional-height',
        overlapMm: 5,
        marginMm: 8,
    });
    for (const tile of cappedWide.tiles) {
        assert.ok(tile.exactSrcRect && tile.destRectMm, `Blank tile emitted on capped proportional-height at page ${tile.pageNum}`);
    }

    // aspectDistortion invariants across modes
    for (const mode of ['contain', 'cover', 'proportional', 'proportional-height']) {
        const l = computePosterLayout({ imgW: 900, imgH: 1200, cols: 2, rows: 1, fitMode: mode });
        assert.ok(Math.abs(l.aspectDistortion - 1) < 1e-6, `${mode} must have aspectDistortion=1`);
    }
    const stretched = computePosterLayout({ imgW: 900, imgH: 1200, cols: 2, rows: 1, fitMode: 'stretch' });
    assert.ok(stretched.aspectDistortion > 1.5, 'stretch 2x1 on 3:4 portrait should report >1.5 distortion');
    assert.equal(stretched.cols, 2);
    assert.equal(stretched.rows, 1);

    // 20x1, 1x20, 20x20 max manual grid support
    for (const [cols, rows] of [[20, 1], [1, 20], [20, 20]]) {
        const maxStretch = computePosterLayout({ imgW: 1200, imgH: 800, cols, rows, fitMode: 'stretch' });
        assert.equal(maxStretch.cols, cols);
        assert.equal(maxStretch.rows, rows);
        assert.equal(maxStretch.totalPages, cols * rows);
    }
});

test('computeDuplicate2x1Layout respects small margins and center gap without 30mm waste', () => {
    const layout = computeDuplicate2x1Layout({
        paperKey: 'letter',
        orientation: 'auto',
        marginMm: 2,
        centerGapMm: 4,
        imgW: 1600,
        imgH: 1000,
    });

    // Portrait paper stacking two 16:10 boxes vertically yields ~211.9 x 135.7 slots (much bigger than landscape side-by-side 103 x 211)
    assert.equal(layout.orientation, 'p');
    assert.equal(layout.cutLine.isVertical, false);
    assert.equal(layout.cutLine.x1, 0);
    assert.equal(layout.cutLine.x2, layout.pageW);

    // Slot heights: (279.4 - 4 - 4) / 2 = 135.7 mm
    assert.ok(Math.abs(layout.slot1.box.h - 135.7) < 0.05);
    assert.equal(layout.slot1.image.w, layout.slot2.image.w);
    assert.equal(layout.slot1.image.h, layout.slot2.image.h);
    // Verify image fills nearly full slot width (~211.9 mm)
    assert.ok(layout.slot1.image.w > 205);
});

test('clampPdfRenderScale prevents oversized blueprint canvases from exceeding memory caps', () => {
    // Normal Letter page (612x792 pt) preserves desired scale 2.0
    assert.equal(clampPdfRenderScale(612, 792, 2.0), 2.0);
    // Huge CAD sheet (5000x4000 pt) caps below edge limit (4096) and area limit (16MP)
    const clamped = clampPdfRenderScale(5000, 4000, 2.0);
    assert.ok(clamped <= 4096 / 5000 + 1e-9);
    assert.ok(5000 * clamped * (4000 * clamped) <= 16_777_216 + 1);
});

test('fileNaming builds descriptive and sanitized filenames', () => {
    assert.equal(sanitizeBaseName('Mi Archivo: Prueba <1>.pdf'), 'Mi_Archivo_Prueba_1');
    assert.equal(
        buildOutputName({ originalName: 'Cartel Escolar.png', suffix: 'poster', pageCount: 6, ext: 'pdf' }),
        'Cartel_Escolar_poster_6pags.pdf'
    );
    assert.equal(
        buildOutputName({ originalName: 'Recibo.jpg', suffix: 'duplicado_2x1', ext: 'pdf' }),
        'Recibo_duplicado_2x1.pdf'
    );
    assert.equal(formatFileSize(512000), '500.0 KB');
    assert.equal(formatFileSize(2 * 1024 * 1024), '2.00 MB');
});

test('AppState tracks tool navigation and calls lifecycle hooks', () => {
    let activated = 0;
    let deactivated = 0;
    AppState.registerTool('mock-a', {
        onActivate: () => {
            activated += 1;
        },
        onDeactivate: () => {
            deactivated += 1;
        },
    });
    AppState.setActiveTool('mock-a');
    assert.equal(AppState.activeTool, 'mock-a');
    assert.equal(activated, 1);

    AppState.setActiveTool('home');
    assert.equal(deactivated, 1);
});

test('i18n ES and EN dictionaries contain matching keys and interpolation works', () => {
    const esKeys = Object.keys(TRANSLATIONS.es).sort();
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    assert.deepEqual(esKeys, enKeys);

    AppState.setLang('es');
    assert.equal(t('toast_poster_done', { pages: 6, cols: 3, rows: 2 }), 'Póster generado: 6 páginas (3×2)');
    AppState.setLang('en');
    assert.equal(t('toast_poster_done', { pages: 6, cols: 3, rows: 2 }), 'Poster exported: 6 pages (3×2)');
    AppState.setLang('es');
});
