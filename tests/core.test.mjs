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
