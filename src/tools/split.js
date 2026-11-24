import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { DragSortManager } from '../core/dragSortManager.js';
import { buildOutputName } from '../core/fileNaming.js';
import { openPdfFile, loadPdfLibDocument, renderPdfPageToCanvas } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const TOOL_SCOPE = 'split';
const MAX_UNDO_SNAPSHOTS = 30;
const THUMB_RENDER_SCALE = 0.4;
const THUMB_JPEG_QUALITY = 0.82;
const msg = (es, en) => (AppState.lang === 'en' ? en : es);

let idSequence = 0;
let initialized = false;

/**
 * Generates a collision-free identifier for page cards.
 * @param {string} [prefix='split']
 * @returns {string}
 */
function createUniqueId(prefix = TOOL_SCOPE) {
    idSequence += 1;
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return `${prefix}-${idSequence}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${idSequence}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Yields briefly to the browser main thread so UI updates and abort clicks remain responsive.
 * @returns {Promise<void>}
 */
function yieldToMain() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Converts a rendered canvas into a compressed JPEG Blob.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
function canvasToJpegBlob(canvas) {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(
                (blob) => {
                    canvas.width = 0;
                    canvas.height = 0;
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('No se pudo generar la miniatura de la página.'));
                    }
                },
                'image/jpeg',
                THUMB_JPEG_QUALITY
            );
        } catch (err) {
            canvas.width = 0;
            canvas.height = 0;
            reject(err);
        }
    });
}

/**
 * Checks whether keyboard focus is inside an editable element where Ctrl/Cmd+Z
 * should preserve native text undo behavior.
 * @returns {boolean}
 */
function isFocusInTextControl() {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || active.isContentEditable === true;
}

/**
 * Checks whether a File looks like a PDF before reading its header.
 * @param {File} file
 * @returns {boolean}
 */
function isPdfCandidate(file) {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();
    return name.endsWith('.pdf') || mime === 'application/pdf';
}

/**
 * Parses a 1-based page range expression such as `"1-3, 5, 8-10"` against
 * the current visual page count (`maxVisualPos`).
 *
 * @param {string} expr
 * @param {number} maxVisualPos
 * @returns {{
 *   valid: boolean,
 *   positions: number[],
 *   indices: number[],
 *   invalidTokens: string[],
 *   outOfBounds: string[],
 *   clamped: boolean,
 *   reason?: 'EMPTY'|'NO_PAGES'|'INVALID_SYNTAX'|'OUT_OF_RANGE'
 * }}
 */
export function parsePageRange(expr, maxVisualPos) {
    const maxPos = Number.isInteger(maxVisualPos) && maxVisualPos > 0 ? maxVisualPos : 0;
    const raw = String(expr ?? '').trim();

    if (maxPos === 0) {
        return {
            valid: false,
            positions: [],
            indices: [],
            invalidTokens: [],
            outOfBounds: [],
            clamped: false,
            reason: 'NO_PAGES',
        };
    }

    if (!raw) {
        return {
            valid: false,
            positions: [],
            indices: [],
            invalidTokens: [],
            outOfBounds: [],
            clamped: false,
            reason: 'EMPTY',
        };
    }

    const rawTokens = raw.split(',');
    const nonEmptyTokens = rawTokens.map((tok) => tok.trim()).filter(Boolean);
    if (nonEmptyTokens.length === 0) {
        return {
            valid: false,
            positions: [],
            indices: [],
            invalidTokens: [raw],
            outOfBounds: [],
            clamped: false,
            reason: 'INVALID_SYNTAX',
        };
    }

    const matchedPositions = new Set();
    const invalidTokens = [];
    const outOfBounds = [];
    let clamped = false;

    for (const token of nonEmptyTokens) {
        const rangeMatch = token.match(/^(\d+)\s*-\s*(\d+)$/);
        if (rangeMatch) {
            const start = Number.parseInt(rangeMatch[1], 10);
            const end = Number.parseInt(rangeMatch[2], 10);
            if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1 || start > end) {
                invalidTokens.push(token);
                continue;
            }
            if (start > maxPos) {
                clamped = true;
                outOfBounds.push(token);
                continue;
            }
            const boundedEnd = Math.min(end, maxPos);
            if (boundedEnd < end) {
                clamped = true;
                outOfBounds.push(`${boundedEnd + 1}-${end}`);
            }
            for (let pos = start; pos <= boundedEnd; pos += 1) {
                matchedPositions.add(pos);
            }
            continue;
        }

        if (/^\d+$/.test(token)) {
            const single = Number.parseInt(token, 10);
            if (!Number.isFinite(single) || single < 1) {
                invalidTokens.push(token);
                continue;
            }
            if (single > maxPos) {
                clamped = true;
                outOfBounds.push(token);
                continue;
            }
            matchedPositions.add(single);
            continue;
        }

        invalidTokens.push(token);
    }

    if (invalidTokens.length > 0) {
        return {
            valid: false,
            positions: [],
            indices: [],
            invalidTokens,
            outOfBounds,
            clamped,
            reason: 'INVALID_SYNTAX',
        };
    }

    if (matchedPositions.size === 0) {
        return {
            valid: false,
            positions: [],
            indices: [],
            invalidTokens: [],
            outOfBounds,
            clamped,
            reason: 'OUT_OF_RANGE',
        };
    }

    const positions = Array.from(matchedPositions).sort((a, b) => a - b);
    const indices = positions.map((pos) => pos - 1);

    return {
        valid: true,
        positions,
        indices,
        invalidTokens: [],
        outOfBounds,
        clamped,
    };
}

/**
 * Builds a single overlay action button (`rotate`, `duplicate`, `delete`).
 * @param {'rotate'|'duplicate'|'delete'} action
 * @param {string} iconName
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function createOverlayActionButton(action, iconName, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.action = action;
    btn.setAttribute('aria-label', label);
    btn.title = label;

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    icon.style.pointerEvents = 'none';
    btn.appendChild(icon);

    return btn;
}

/**
 * Renders the check icon inside `.thumb-select-box` based on `selected`.
 * @param {HTMLElement} card
 * @param {boolean} selected
 */
function syncCardSelectionDom(card, selected) {
    card.classList.toggle('is-selected', selected);
    const selectBtn = card.querySelector('.thumb-select-box');
    if (!selectBtn) return;

    selectBtn.classList.toggle('is-checked', selected);
    selectBtn.setAttribute('aria-pressed', String(selected));

    if (selected) {
        if (!selectBtn.querySelector('svg, [data-lucide="check"]')) {
            const checkIcon = document.createElement('i');
            checkIcon.setAttribute('data-lucide', 'check');
            checkIcon.style.width = '14px';
            checkIcon.style.height = '14px';
            checkIcon.style.pointerEvents = 'none';
            selectBtn.replaceChildren(checkIcon);
        }
    } else {
        selectBtn.replaceChildren();
    }
}

/**
 * Updates the optional rotation indicator inside a card's footer.
 * @param {HTMLElement} card
 * @param {number} rotation
 */
function syncCardRotationDom(card, rotation) {
    const imgEl = card.querySelector('.thumb-media img');
    if (imgEl) {
        const swapScale = rotation % 180 !== 0 ? ' scale(0.76)' : '';
        imgEl.style.transform = `rotate(${rotation}deg)${swapScale}`;
    }
    const rotEl = card.querySelector('.thumb-rot-label');
    if (rotEl) {
        rotEl.textContent = rotation !== 0 ? `${rotation}°` : '';
    }
}

/**
 * Builds a `.thumb-card` DOM node purely via `document.createElement` & `textContent`.
 * @param {{ id: string, index: number, originalNum: number, rotation: number, selected: boolean, thumbUrl: string }} item
 * @param {number} visualIdx
 * @returns {HTMLDivElement}
 */
function createSplitPageCard(item, visualIdx) {
    const card = document.createElement('div');
    card.className = item.selected ? 'thumb-card is-selected' : 'thumb-card';
    card.dataset.id = item.id;

    const media = document.createElement('div');
    media.className = 'thumb-media';

    const badge = document.createElement('span');
    badge.className = 'thumb-badge';
    badge.textContent = `#${visualIdx + 1}`;

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = item.selected ? 'thumb-select-box is-checked' : 'thumb-select-box';
    selectBtn.dataset.action = 'select';
    selectBtn.setAttribute('aria-pressed', String(Boolean(item.selected)));
    selectBtn.setAttribute('aria-label', msg(`Seleccionar página ${visualIdx + 1}`, `Select page ${visualIdx + 1}`));
    selectBtn.title = msg('Seleccionar', 'Select');
    if (item.selected) {
        const checkIcon = document.createElement('i');
        checkIcon.setAttribute('data-lucide', 'check');
        checkIcon.style.width = '14px';
        checkIcon.style.height = '14px';
        checkIcon.style.pointerEvents = 'none';
        selectBtn.appendChild(checkIcon);
    }

    const img = document.createElement('img');
    img.src = item.thumbUrl;
    img.alt = `${msg('Página original', 'Original page')} ${item.originalNum}`;
    img.draggable = false;
    img.decoding = 'async';
    img.style.transform = `rotate(${item.rotation}deg)${item.rotation % 180 !== 0 ? ' scale(0.76)' : ''}`;

    const actions = document.createElement('div');
    actions.className = 'thumb-actions';
    actions.append(
        createOverlayActionButton('rotate', 'rotate-cw', msg('Rotar 90°', 'Rotate 90°')),
        createOverlayActionButton('duplicate', 'copy-plus', msg('Duplicar página', 'Duplicate page')),
        createOverlayActionButton('delete', 'trash-2', msg('Eliminar página', 'Delete page'))
    );

    media.append(badge, selectBtn, img, actions);

    const footer = document.createElement('div');
    footer.className = 'thumb-footer';

    const origSpan = document.createElement('span');
    origSpan.textContent = `${msg('Pág. orig', 'Orig. pg')} ${item.originalNum}`;

    const rotSpan = document.createElement('span');
    rotSpan.className = 'thumb-rot-label';
    rotSpan.style.flexShrink = '0';
    rotSpan.style.fontFamily = 'var(--font-mono)';
    rotSpan.style.fontSize = '0.7rem';
    rotSpan.textContent = item.rotation !== 0 ? `${item.rotation}°` : '';

    footer.append(origSpan, rotSpan);
    card.append(media, footer);

    return card;
}

/**
 * Generates a PDF Blob from `targetPages` loaded from `sourceBytes`, copying
 * duplicate occurrences in separate passes so each page keeps independent rotation.
 * @param {ArrayBuffer} sourceBytes
 * @param {string} sourceFileName
 * @param {Array<{ index: number, rotation: number }>} targetPages
 * @param {AbortSignal} signal
 * @returns {Promise<Blob>}
 */
async function buildSplitPdfBlob(sourceBytes, sourceFileName, targetPages, signal) {
    const srcDoc = await loadPdfLibDocument(sourceBytes, sourceFileName);
    const outDoc = await window.PDFLib.PDFDocument.create();

    const occurrenceCounts = new Map();
    const passBuckets = [];

    targetPages.forEach((item, outIdx) => {
        const count = occurrenceCounts.get(item.index) || 0;
        occurrenceCounts.set(item.index, count + 1);
        if (!passBuckets[count]) {
            passBuckets[count] = [];
        }
        passBuckets[count].push({ outIdx, pageIndex: item.index });
    });

    const copiedByOutIdx = new Array(targetPages.length);
    let processed = 0;

    for (const bucket of passBuckets) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        const indices = bucket.map((entry) => entry.pageIndex);
        const copiedPages = await outDoc.copyPages(srcDoc, indices);

        for (let i = 0; i < bucket.length; i += 1) {
            copiedByOutIdx[bucket[i].outIdx] = copiedPages[i];
            processed += 1;
        }

        ProgressModal.update({
            percent: Math.round((processed / targetPages.length) * 65),
            detail: msg(
                `Preparando páginas (${processed}/${targetPages.length})...`,
                `Preparing pages (${processed}/${targetPages.length})...`
            ),
        });
        await yieldToMain();
    }

    for (let i = 0; i < targetPages.length; i += 1) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        const page = copiedByOutIdx[i];
        const addedRot = targetPages[i].rotation;
        const currentRot = page.getRotation().angle || 0;
        const nextRot = (((currentRot + addedRot) % 360) + 360) % 360;
        page.setRotation(window.PDFLib.degrees(nextRot));
        outDoc.addPage(page);

        if ((i + 1) % 12 === 0 || i === targetPages.length - 1) {
            ProgressModal.update({
                percent: 65 + Math.round(((i + 1) / targetPages.length) * 25),
                detail: msg(
                    `Ensamblando página ${i + 1} de ${targetPages.length}...`,
                    `Assembling page ${i + 1} of ${targetPages.length}...`
                ),
            });
            await yieldToMain();
        }
    }

    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    ProgressModal.update({ percent: 94, detail: msg('Guardando archivo PDF...', 'Saving PDF file...') });
    const pdfBytes = await outDoc.save();
    ProgressModal.update({ percent: 100 });
    return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Initializes the Organize / Split PDF tool (`#section-split`) and registers it with `AppState`.
 */
export function initSplitTool() {
    if (initialized) return;

    const uploadAreaEl = document.getElementById('split-upload-area');
    const dropzoneEl = document.getElementById('split-dropzone');
    const fileInputEl = document.getElementById('file-input-split');
    const workspaceEl = document.getElementById('split-workspace');
    const pageCountEl = document.getElementById('split-page-count');
    const selectedCountEl = document.getElementById('split-selected-count');
    const undoBtn = document.getElementById('split-undo-btn');
    const resetBtn = document.getElementById('split-reset-btn');
    const rangeInputEl = document.getElementById('split-range-input');
    const applyRangeBtn = document.getElementById('split-apply-range-btn');
    const extractRangeBtn = document.getElementById('split-extract-range-btn');
    const selectAllBtn = document.getElementById('split-select-all-btn');
    const deselectBtn = document.getElementById('split-deselect-btn');
    const invertOrderBtn = document.getElementById('split-invert-order-btn');
    const rotateSelectedBtn = document.getElementById('split-rotate-selected-btn');
    const duplicateSelectedBtn = document.getElementById('split-duplicate-selected-btn');
    const deleteSelectedBtn = document.getElementById('split-delete-selected-btn');
    const pagesContainerEl = document.getElementById('pages-container');
    const downloadBtn = document.getElementById('split-download-btn');
    const downloadSelectedBtn = document.getElementById('split-download-selected-btn');
    const printBtn = document.getElementById('split-print-btn');

    if (!dropzoneEl || !fileInputEl || !pagesContainerEl || !workspaceEl) {
        return;
    }

    initialized = true;

    let sourceBytes = null;
    let sourceFileName = 'documento.pdf';
    /** @type {Array<{ id: string, index: number, originalNum: number, rotation: number, selected: boolean, thumbUrl: string }>} */
    let pages = [];
    /** @type {Array<Array<{ id: string, index: number, originalNum: number, rotation: number, selected: boolean, thumbUrl: string }>>} */
    let undoStack = [];
    let isBusy = false;

    const syncCountsAndUndo = () => {
        if (pageCountEl) {
            pageCountEl.textContent = String(pages.length);
        }
        if (selectedCountEl) {
            const selectedTotal = pages.reduce((acc, p) => acc + (p.selected ? 1 : 0), 0);
            selectedCountEl.textContent = String(selectedTotal);
        }
        if (undoBtn) {
            const disabled = undoStack.length === 0;
            undoBtn.disabled = disabled;
            undoBtn.setAttribute('aria-disabled', String(disabled));
        }
    };

    const syncVisualBadgesInPlace = () => {
        const cards = pagesContainerEl.querySelectorAll('.thumb-card[data-id]');
        cards.forEach((card, idx) => {
            const badge = card.querySelector('.thumb-badge');
            if (badge) {
                badge.textContent = `#${idx + 1}`;
            }
            const selectBtn = card.querySelector('.thumb-select-box');
            if (selectBtn) {
                selectBtn.setAttribute('aria-label', `Seleccionar página ${idx + 1}`);
            }
        });
    };

    const renderEmptyState = () => {
        const emptyEl = document.createElement('div');
        emptyEl.style.gridColumn = '1 / -1';
        emptyEl.style.textAlign = 'center';
        emptyEl.style.padding = '36px 16px';
        emptyEl.style.color = 'var(--text-muted)';
        emptyEl.style.fontSize = '0.875rem';
        emptyEl.textContent = msg(
            'No quedan páginas en el editor. Usa Deshacer (Ctrl+Z) o Reiniciar para cargar otro PDF.',
            'No pages left in the editor. Use Undo (Ctrl+Z) or Reset to load another PDF.'
        );
        pagesContainerEl.replaceChildren(emptyEl);
    };

    const renderGrid = () => {
        if (pages.length === 0) {
            renderEmptyState();
            syncCountsAndUndo();
            return;
        }

        const fragment = document.createDocumentFragment();
        pages.forEach((item, idx) => {
            fragment.appendChild(createSplitPageCard(item, idx));
        });
        pagesContainerEl.replaceChildren(fragment);
        globalThis.lucide?.createIcons?.();
        syncCountsAndUndo();
    };

    const createSnapshot = (list) => list.map((p) => ({ ...p }));

    const pushUndoSnapshot = (snapshot = createSnapshot(pages)) => {
        undoStack.push(snapshot);
        if (undoStack.length > MAX_UNDO_SNAPSHOTS) {
            undoStack.shift();
        }
        syncCountsAndUndo();
    };

    const performUndo = () => {
        if (isBusy || undoStack.length === 0) return false;
        const previous = undoStack.pop();
        if (!previous) return false;
        pages = previous.map((p) => ({ ...p }));
        renderGrid();
        return true;
    };

    const attachSortable = () => {
        DragSortManager.attach(pagesContainerEl, {
            getItems: () => pages,
            setItems: (reordered) => {
                const changed =
                    reordered.length === pages.length &&
                    reordered.some((item, idx) => item.id !== pages[idx]?.id);
                if (changed) {
                    pushUndoSnapshot();
                }
                pages = reordered;
            },
            onReorder: () => {
                syncVisualBadgesInPlace();
                syncCountsAndUndo();
            },
        });
    };

    const resetSplit = () => {
        if (isBusy) return;
        DragSortManager.destroy(pagesContainerEl);
        BlobRegistry.revokeScope(TOOL_SCOPE);
        sourceBytes = null;
        sourceFileName = 'documento.pdf';
        pages = [];
        undoStack = [];
        pagesContainerEl.replaceChildren();
        if (rangeInputEl) {
            rangeInputEl.value = '';
        }
        fileInputEl.value = '';
        workspaceEl.classList.add('hidden');
        uploadAreaEl?.classList.remove('hidden');
        syncCountsAndUndo();
    };

    const handleFiles = async (files) => {
        if (isBusy) return;
        const file = files?.[0];
        if (!file) return;

        if (!isPdfCandidate(file)) {
            ToastManager.error(msg(`El archivo "${file.name}" no es un PDF válido.`, `File "${file.name}" is not a valid PDF.`));
            return;
        }

        isBusy = true;
        AppState.setBusy(true);
        const signal = ProgressModal.open({
            title: msg('Cargando documento PDF...', 'Loading PDF document...'),
            detail: file.name,
            cancellable: true,
        });

        let pdfjsDoc = null;
        const prevBytes = sourceBytes;
        const prevName = sourceFileName;
        const prevPages = pages;
        const prevUndo = undoStack;
        const nextThumbUrls = [];

        try {
            const opened = await openPdfFile(file);
            const bytes = opened.bytes;
            pdfjsDoc = opened.pdfjsDoc;

            if (signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            // Validate pdf-lib compatibility immediately before rendering thumbnails
            await loadPdfLibDocument(bytes, file.name);

            const totalPages = pdfjsDoc.numPages;
            const nextPages = [];

            for (let i = 1; i <= totalPages; i += 1) {
                if (signal.aborted) {
                    throw new DOMException('Aborted', 'AbortError');
                }

                ProgressModal.update({
                    percent: Math.round((i / totalPages) * 100),
                    detail: msg(
                        `Renderizando miniatura ${i} de ${totalPages}...`,
                        `Rendering thumbnail ${i} of ${totalPages}...`
                    ),
                });

                const { canvas } = await renderPdfPageToCanvas(pdfjsDoc, i, THUMB_RENDER_SCALE);
                if (signal.aborted) {
                    throw new DOMException('Aborted', 'AbortError');
                }

                const thumbBlob = await canvasToJpegBlob(canvas);
                const thumbUrl = BlobRegistry.create(thumbBlob, TOOL_SCOPE);
                nextThumbUrls.push(thumbUrl);

                nextPages.push({
                    id: createUniqueId(TOOL_SCOPE),
                    index: i - 1,
                    originalNum: i,
                    rotation: 0,
                    selected: false,
                    thumbUrl,
                });

                if (i % 4 === 0) {
                    await yieldToMain();
                }
            }

            const oldUrls = new Set([
                ...prevPages.map((p) => p.thumbUrl),
                ...prevUndo.flat().map((p) => p.thumbUrl),
            ]);
            for (const oldUrl of oldUrls) {
                BlobRegistry.revokeUrl(oldUrl);
            }

            sourceBytes = bytes;
            sourceFileName = file.name;
            pages = nextPages;
            undoStack = [];
            if (rangeInputEl) {
                rangeInputEl.value = '';
            }

            uploadAreaEl?.classList.add('hidden');
            workspaceEl.classList.remove('hidden');
            renderGrid();
            attachSortable();
            ToastManager.success(
                msg(`PDF cargado: ${file.name} (${totalPages} pág.)`, `PDF loaded: ${file.name} (${totalPages} pg.)`)
            );
        } catch (err) {
            for (const url of nextThumbUrls) {
                BlobRegistry.revokeUrl(url);
            }
            sourceBytes = prevBytes;
            sourceFileName = prevName;
            pages = prevPages;
            undoStack = prevUndo;

            if (err?.name === 'AbortError') {
                ToastManager.info(t('toast_cancelled'));
            } else {
                console.error('[split] Error loading PDF:', err);
                ToastManager.error(err?.message || msg('No se pudo abrir el archivo PDF.', 'Could not open PDF file.'));
            }
        } finally {
            try {
                await pdfjsDoc?.destroy?.();
            } catch {
                // Ignore cleanup failure
            }
            ProgressModal.close();
            isBusy = false;
            AppState.setBusy(false);
        }
    };

    const runExport = async (targetPages, { suffix, forPrint = false } = {}) => {
        if (isBusy) return;
        if (!sourceBytes || targetPages.length === 0) {
            ToastManager.warning(t('toast_no_pages'));
            return;
        }

        isBusy = true;
        AppState.setBusy(true);
        const signal = ProgressModal.open({
            title: forPrint ? msg('Preparando impresión...', 'Preparing print...') : msg('Generando PDF...', 'Building PDF...'),
            detail: msg(`${targetPages.length} página(s)`, `${targetPages.length} page(s)`),
            cancellable: true,
        });

        try {
            const blob = await buildSplitPdfBlob(sourceBytes, sourceFileName, targetPages, signal);
            if (signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            if (forPrint) {
                PrintService.printPdfBlob(blob);
            } else {
                const outputName = buildOutputName({
                    originalName: sourceFileName,
                    suffix,
                    pageCount: targetPages.length,
                    ext: 'pdf',
                });
                BlobRegistry.downloadBlob(blob, outputName);
                ToastManager.success(t('toast_saved_pdf', { name: outputName }));
            }
        } catch (err) {
            if (err?.name === 'AbortError') {
                ToastManager.info(t('toast_cancelled'));
            } else {
                console.error('[split] Export error:', err);
                ToastManager.error(err?.message || msg('Error al generar el PDF.', 'Failed to build PDF.'));
            }
        } finally {
            ProgressModal.close();
            isBusy = false;
            AppState.setBusy(false);
        }
    };

    const validateAndParseRange = () => {
        const expr = rangeInputEl?.value ?? '';
        const parsed = parsePageRange(expr, pages.length);

        if (!parsed.valid) {
            if (parsed.reason === 'NO_PAGES') {
                ToastManager.warning(t('toast_no_pages'));
            } else if (parsed.reason === 'EMPTY') {
                ToastManager.warning(
                    msg(
                        'Escribe un rango de páginas (ej. 1-3, 5, 8-10).',
                        'Enter a page range (e.g., 1-3, 5, 8-10).'
                    )
                );
            } else if (parsed.reason === 'INVALID_SYNTAX') {
                ToastManager.warning(
                    msg(
                        `Rango inválido (${parsed.invalidTokens.join(', ')}). Usa números positivos como: 1-3, 5, 8-10.`,
                        `Invalid range (${parsed.invalidTokens.join(', ')}). Use positive numbers like: 1-3, 5, 8-10.`
                    )
                );
            } else {
                ToastManager.warning(
                    msg(
                        `Ninguna página está dentro del rango disponible (1-${pages.length}).`,
                        `No page is inside the available range (1-${pages.length}).`
                    )
                );
            }
            rangeInputEl?.focus();
            return null;
        }

        if (parsed.clamped && parsed.outOfBounds.length > 0) {
            ToastManager.warning(
                msg(
                    `Se omitieron páginas fuera del límite (${pages.length}): ${parsed.outOfBounds.join(', ')}.`,
                    `Skipped out-of-bounds pages (${pages.length}): ${parsed.outOfBounds.join(', ')}.`
                )
            );
        }

        return parsed;
    };

    // Single delegated click listener on #pages-container
    pagesContainerEl.addEventListener('click', (e) => {
        if (isBusy || !(e.target instanceof Element)) return;

        const card = e.target.closest('[data-id]');
        if (!card || !pagesContainerEl.contains(card)) return;

        const actionBtn = e.target.closest('[data-action]');
        const selectBox = e.target.closest('.thumb-select-box');
        const action = actionBtn?.getAttribute('data-action') || (selectBox ? 'select' : null);
        if (!action) return;

        const itemId = card.dataset.id;
        const idx = pages.findIndex((p) => String(p.id) === String(itemId));
        if (idx === -1) return;

        if (action === 'select') {
            const item = pages[idx];
            item.selected = !item.selected;
            syncCardSelectionDom(card, item.selected);
            globalThis.lucide?.createIcons?.();
            syncCountsAndUndo();
            return;
        }

        if (action === 'rotate') {
            pushUndoSnapshot();
            const item = pages[idx];
            item.rotation = (item.rotation + 90) % 360;
            syncCardRotationDom(card, item.rotation);
            return;
        }

        if (action === 'duplicate') {
            pushUndoSnapshot();
            const original = pages[idx];
            const clone = {
                ...original,
                id: createUniqueId(TOOL_SCOPE),
                selected: false,
            };
            pages.splice(idx + 1, 0, clone);
            const cloneCard = createSplitPageCard(clone, idx + 1);
            card.after(cloneCard);
            globalThis.lucide?.createIcons?.();
            syncVisualBadgesInPlace();
            syncCountsAndUndo();
            return;
        }

        if (action === 'delete') {
            pushUndoSnapshot();
            pages.splice(idx, 1);
            card.remove();
            if (pages.length === 0) {
                renderEmptyState();
            } else {
                syncVisualBadgesInPlace();
            }
            syncCountsAndUndo();
        }
    });

    // Range selection & extraction
    applyRangeBtn?.addEventListener('click', () => {
        if (isBusy) return;
        const parsed = validateAndParseRange();
        if (!parsed) return;

        const targetSet = new Set(parsed.indices);
        const changed = pages.some((p, idx) => p.selected !== targetSet.has(idx));
        if (changed) {
            pushUndoSnapshot();
            const cardById = new Map(
                Array.from(pagesContainerEl.querySelectorAll('.thumb-card[data-id]')).map((el) => [
                    el.dataset.id,
                    el,
                ])
            );
            pages.forEach((p, idx) => {
                p.selected = targetSet.has(idx);
                const card = cardById.get(p.id);
                if (card) {
                    syncCardSelectionDom(card, p.selected);
                }
            });
            globalThis.lucide?.createIcons?.();
            syncCountsAndUndo();
        }
        ToastManager.info(msg(`${targetSet.size} página(s) seleccionada(s).`, `${targetSet.size} page(s) selected.`));
    });

    extractRangeBtn?.addEventListener('click', () => {
        if (isBusy) return;
        const parsed = validateAndParseRange();
        if (!parsed) return;

        const targetSet = new Set(parsed.indices);
        if (targetSet.size === pages.length) {
            ToastManager.info(
                msg(
                    'El rango seleccionado ya coincide con todas las páginas actuales.',
                    'Selected range already includes all current pages.'
                )
            );
            return;
        }

        pushUndoSnapshot();
        pages = pages.filter((_, idx) => targetSet.has(idx));
        renderGrid();
        ToastManager.success(
            msg(`Se conservaron ${pages.length} página(s) del rango indicado.`, `Kept ${pages.length} page(s) from the specified range.`)
        );
    });

    rangeInputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyRangeBtn?.click();
        }
    });

    // Multi-selection & bulk toolbar actions
    selectAllBtn?.addEventListener('click', () => {
        if (isBusy || pages.length === 0) return;
        if (pages.every((p) => p.selected)) return;

        pushUndoSnapshot();
        pages.forEach((p) => {
            p.selected = true;
        });
        pagesContainerEl.querySelectorAll('.thumb-card[data-id]').forEach((card) => {
            syncCardSelectionDom(card, true);
        });
        globalThis.lucide?.createIcons?.();
        syncCountsAndUndo();
    });

    deselectBtn?.addEventListener('click', () => {
        if (isBusy || pages.length === 0) return;
        if (!pages.some((p) => p.selected)) return;

        pushUndoSnapshot();
        pages.forEach((p) => {
            p.selected = false;
        });
        pagesContainerEl.querySelectorAll('.thumb-card[data-id]').forEach((card) => {
            syncCardSelectionDom(card, false);
        });
        syncCountsAndUndo();
    });

    invertOrderBtn?.addEventListener('click', () => {
        if (isBusy || pages.length <= 1) return;
        pushUndoSnapshot();
        pages.reverse();
        renderGrid();
    });

    rotateSelectedBtn?.addEventListener('click', () => {
        if (isBusy) return;
        const selectedItems = pages.filter((p) => p.selected);
        if (selectedItems.length === 0) {
            ToastManager.warning(msg('Selecciona al menos una página para rotar.', 'Select at least one page to rotate.'));
            return;
        }

        pushUndoSnapshot();
        const cardById = new Map(
            Array.from(pagesContainerEl.querySelectorAll('.thumb-card[data-id]')).map((el) => [
                el.dataset.id,
                el,
            ])
        );
        pages.forEach((item) => {
            if (item.selected) {
                item.rotation = (item.rotation + 90) % 360;
                const card = cardById.get(item.id);
                if (card) {
                    syncCardRotationDom(card, item.rotation);
                }
            }
        });
    });

    duplicateSelectedBtn?.addEventListener('click', () => {
        if (isBusy) return;
        const selectedCount = pages.reduce((acc, p) => acc + (p.selected ? 1 : 0), 0);
        if (selectedCount === 0) {
            ToastManager.warning(msg('Selecciona al menos una página para duplicar.', 'Select at least one page to duplicate.'));
            return;
        }

        pushUndoSnapshot();
        const expanded = [];
        for (const item of pages) {
            expanded.push(item);
            if (item.selected) {
                expanded.push({
                    ...item,
                    id: createUniqueId(TOOL_SCOPE),
                    selected: false,
                });
            }
        }
        pages = expanded;
        renderGrid();
        ToastManager.info(msg(`Se duplicaron ${selectedCount} página(s).`, `Duplicated ${selectedCount} page(s).`));
    });

    deleteSelectedBtn?.addEventListener('click', () => {
        if (isBusy) return;
        const selectedCount = pages.reduce((acc, p) => acc + (p.selected ? 1 : 0), 0);
        if (selectedCount === 0) {
            ToastManager.warning(msg('Selecciona al menos una página para eliminar.', 'Select at least one page to delete.'));
            return;
        }

        pushUndoSnapshot();
        pages = pages.filter((p) => !p.selected);
        renderGrid();
        ToastManager.info(msg(`${selectedCount} página(s) eliminada(s).`, `Removed ${selectedCount} page(s).`));
    });

    undoBtn?.addEventListener('click', () => {
        performUndo();
    });

    resetBtn?.addEventListener('click', () => {
        resetSplit();
    });

    downloadBtn?.addEventListener('click', () => {
        runExport(pages, { suffix: 'editado', forPrint: false });
    });

    downloadSelectedBtn?.addEventListener('click', () => {
        const selectedPages = pages.filter((p) => p.selected);
        if (selectedPages.length === 0) {
            ToastManager.warning(msg('Selecciona al menos una página para extraer.', 'Select at least one page to extract.'));
            return;
        }
        runExport(selectedPages, { suffix: 'seleccion', forPrint: false });
    });

    printBtn?.addEventListener('click', () => {
        runExport(pages, { suffix: 'imprimir', forPrint: true });
    });

    document.addEventListener('keydown', (e) => {
        if (AppState.activeTool !== 'split' || isBusy) return;
        if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
        if (e.key.toLowerCase() !== 'z') return;
        if (isFocusInTextControl()) return;
        if (document.querySelector('.modal-backdrop.is-open')) return;

        if (undoStack.length > 0) {
            e.preventDefault();
            performUndo();
        }
    });

    bindDropzone(dropzoneEl, fileInputEl, {
        multiple: false,
        onFiles: handleFiles,
    });

    AppState.on('lang:changed', () => {
        if (!workspaceEl.classList.contains('hidden')) {
            renderGrid();
        }
    });

    AppState.registerTool('split', {
        onActivate: () => {
            syncCountsAndUndo();
        },
        onDeactivate: () => {},
    });
}
