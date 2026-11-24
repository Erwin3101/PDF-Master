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

const TOOL_SCOPE = 'merge';
const MAX_UNDO_SNAPSHOTS = 30;
const THUMB_RENDER_SCALE = 0.4;
const THUMB_JPEG_QUALITY = 0.82;
const msg = (es, en) => (AppState.lang === 'en' ? en : es);

let idSequence = 0;
let initialized = false;

/**
 * Generates a collision-free identifier for files and page cards.
 * @param {string} [prefix='merge']
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
 * Strips control characters from a file name for safe text display.
 * @param {string} rawName
 * @returns {string}
 */
function sanitizeDisplayFileName(rawName) {
    const cleaned = String(rawName ?? 'documento.pdf')
        .replace(/[\x00-\x1f\x7f]/g, '')
        .trim();
    return cleaned || 'documento.pdf';
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
 * Checks whether keyboard focus is inside an editable control where Ctrl/Cmd+Z
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
 * Checks whether a File looks like a PDF before reading its bytes.
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
 * Builds an overlay action button (`rotate`, `duplicate`, `delete`).
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
 * Synchronizes card selection styling, ARIA state, and check icon.
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
 * Updates thumbnail image rotation transform and optional rotation indicator.
 * @param {HTMLElement} card
 * @param {number} rotation
 */
function syncCardRotationDom(card, rotation) {
    const imgEl = card.querySelector('.thumb-media img');
    if (imgEl) {
        const swapScale = rotation % 180 !== 0 ? ' scale(0.76)' : '';
        imgEl.style.transform = `rotate(${rotation}deg)${swapScale}`;
    }
    const pageSpan = card.querySelector('.thumb-page-label');
    if (pageSpan) {
        const baseLabel = pageSpan.dataset.baseLabel || pageSpan.textContent || '';
        pageSpan.textContent = rotation !== 0 ? `${baseLabel} · ${rotation}°` : baseLabel;
    }
}

/**
 * Builds a `.thumb-card` DOM node for Merge using `document.createElement` & `textContent`.
 * @param {{ id: string, fileId: string, fileName: string, pageIndex: number, rotation: number, selected: boolean, thumbUrl: string }} item
 * @param {number} visualIdx
 * @returns {HTMLDivElement}
 */
function createMergePageCard(item, visualIdx) {
    const safeName = sanitizeDisplayFileName(item.fileName);

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
    img.alt = `${safeName} - ${msg('Página', 'Page')} ${item.pageIndex + 1}`;
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

    const nameSpan = document.createElement('span');
    nameSpan.textContent = safeName;
    nameSpan.title = safeName;

    const pageBaseLabel = `${msg('Pág', 'Pg')} ${item.pageIndex + 1}`;
    const pageSpan = document.createElement('span');
    pageSpan.className = 'thumb-page-label';
    pageSpan.dataset.baseLabel = pageBaseLabel;
    pageSpan.style.flexShrink = '0';
    pageSpan.textContent = item.rotation !== 0 ? `${pageBaseLabel} · ${item.rotation}°` : pageBaseLabel;

    footer.append(nameSpan, pageSpan);
    card.append(media, footer);

    return card;
}

/**
 * Merges `targetPages` across `sourceFiles` into a single PDF Blob, copying
 * unique pages per source file together to avoid resource duplication while
 * giving duplicated pages independent PDFPageLeaf instances.
 *
 * @param {Array<{ fileId: string, fileName: string, pageIndex: number, rotation: number }>} targetPages
 * @param {Map<string, { fileName: string, bytes: ArrayBuffer }>} sourceFiles
 * @param {AbortSignal} signal
 * @returns {Promise<Blob>}
 */
async function buildMergedPdfBlob(targetPages, sourceFiles, signal) {
    const outDoc = await window.PDFLib.PDFDocument.create();
    const total = targetPages.length;

    /** @type {Map<string, Array<{ outIdx: number, pageIndex: number }>>} */
    const groupedByFile = new Map();
    targetPages.forEach((item, outIdx) => {
        if (!groupedByFile.has(item.fileId)) {
            groupedByFile.set(item.fileId, []);
        }
        groupedByFile.get(item.fileId).push({ outIdx, pageIndex: item.pageIndex });
    });

    const copiedByOutIdx = new Array(total);
    let preparedCount = 0;

    for (const [fileId, entries] of groupedByFile.entries()) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        const source = sourceFiles.get(fileId);
        if (!source) {
            throw new Error('Faltan datos de uno de los documentos PDF cargados.');
        }

        const srcDoc = await loadPdfLibDocument(source.bytes, source.fileName);

        // Separate duplicate occurrences of the same pageIndex so rotations never collide
        const occurrenceCounts = new Map();
        const passBuckets = [];
        for (const entry of entries) {
            const count = occurrenceCounts.get(entry.pageIndex) || 0;
            occurrenceCounts.set(entry.pageIndex, count + 1);
            if (!passBuckets[count]) {
                passBuckets[count] = [];
            }
            passBuckets[count].push(entry);
        }

        for (const bucket of passBuckets) {
            if (signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }
            const copiedPages = await outDoc.copyPages(
                srcDoc,
                bucket.map((b) => b.pageIndex)
            );
            for (let i = 0; i < bucket.length; i += 1) {
                copiedByOutIdx[bucket[i].outIdx] = copiedPages[i];
                preparedCount += 1;
            }
        }

        ProgressModal.update({
            percent: Math.round((preparedCount / total) * 65),
            detail: `Combinando "${source.fileName}" (${preparedCount}/${total})...`,
        });
        await yieldToMain();
    }

    for (let i = 0; i < total; i += 1) {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        const page = copiedByOutIdx[i];
        const addedRot = targetPages[i].rotation;
        const currentRot = page.getRotation().angle || 0;
        const nextRot = (((currentRot + addedRot) % 360) + 360) % 360;
        page.setRotation(window.PDFLib.degrees(nextRot));
        outDoc.addPage(page);

        if ((i + 1) % 12 === 0 || i === total - 1) {
            ProgressModal.update({
                percent: 65 + Math.round(((i + 1) / total) * 25),
                detail: msg(`Ensamblando página ${i + 1} de ${total}...`, `Assembling page ${i + 1} of ${total}...`),
            });
            await yieldToMain();
        }
    }

    if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    ProgressModal.update({ percent: 94, detail: msg('Guardando archivo PDF unido...', 'Saving merged PDF file...') });
    const pdfBytes = await outDoc.save();
    ProgressModal.update({ percent: 100 });
    return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Initializes the Merge PDFs tool (`#section-merge`) and registers it with `AppState`.
 */
export function initMergeTool() {
    if (initialized) return;

    const dropzoneEl = document.getElementById('merge-dropzone');
    const fileInputEl = document.getElementById('file-input-merge');
    const workspaceEl = document.getElementById('merge-workspace');
    const pageCountEl = document.getElementById('merge-page-count');
    const selectedCountEl = document.getElementById('merge-selected-count');
    const selectAllBtn = document.getElementById('merge-select-all-btn');
    const deselectBtn = document.getElementById('merge-deselect-btn');
    const invertOrderBtn = document.getElementById('merge-invert-order-btn');
    const rotateSelectedBtn = document.getElementById('merge-rotate-selected-btn');
    const duplicateSelectedBtn = document.getElementById('merge-duplicate-selected-btn');
    const deleteSelectedBtn = document.getElementById('merge-delete-selected-btn');
    const undoBtn = document.getElementById('merge-undo-btn');
    const resetBtn = document.getElementById('merge-reset-btn');
    const mergeGridEl = document.getElementById('merge-grid');
    const downloadBtn = document.getElementById('merge-download-btn');
    const printBtn = document.getElementById('merge-print-btn');

    if (!dropzoneEl || !fileInputEl || !mergeGridEl || !workspaceEl) {
        return;
    }

    initialized = true;

    /** @type {Map<string, { fileName: string, bytes: ArrayBuffer }>} */
    const sourceFiles = new Map();
    /** @type {Array<{ id: string, fileId: string, fileName: string, pageIndex: number, rotation: number, selected: boolean, thumbUrl: string }>} */
    let pages = [];
    /** @type {Array<Array<{ id: string, fileId: string, fileName: string, pageIndex: number, rotation: number, selected: boolean, thumbUrl: string }>>} */
    let undoStack = [];
    let isBusy = false;
    let sortableAttached = false;

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
        const cards = mergeGridEl.querySelectorAll('.thumb-card[data-id]');
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
            'No hay páginas. Añade más PDFs arriba o usa Deshacer (Ctrl+Z).',
            'No pages remaining. Add more PDFs above or use Undo (Ctrl+Z).'
        );
        mergeGridEl.replaceChildren(emptyEl);
    };

    const renderGrid = () => {
        if (pages.length === 0) {
            renderEmptyState();
            syncCountsAndUndo();
            return;
        }

        const fragment = document.createDocumentFragment();
        pages.forEach((item, idx) => {
            fragment.appendChild(createMergePageCard(item, idx));
        });
        mergeGridEl.replaceChildren(fragment);
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

    const ensureSortableAttached = () => {
        if (sortableAttached) return;
        sortableAttached = true;
        DragSortManager.attach(mergeGridEl, {
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

    const resetMerge = () => {
        if (isBusy) return;
        DragSortManager.destroy(mergeGridEl);
        sortableAttached = false;
        BlobRegistry.revokeScope(TOOL_SCOPE);
        sourceFiles.clear();
        pages = [];
        undoStack = [];
        mergeGridEl.replaceChildren();
        fileInputEl.value = '';
        workspaceEl.classList.add('hidden');
        syncCountsAndUndo();
    };

    const handleFiles = async (rawFiles) => {
        if (isBusy) return;
        const files = Array.from(rawFiles || []);
        if (files.length === 0) return;

        isBusy = true;
        AppState.setBusy(true);
        const signal = ProgressModal.open({
            title: msg('Cargando documentos PDF...', 'Loading PDF documents...'),
            detail: msg(`${files.length} archivo(s)`, `${files.length} file(s)`),
            cancellable: true,
        });

        const batchPages = [];
        const batchFileEntries = [];
        const batchThumbUrls = [];

        try {
            for (let fileIdx = 0; fileIdx < files.length; fileIdx += 1) {
                if (signal.aborted) {
                    throw new DOMException('Aborted', 'AbortError');
                }

                const file = files[fileIdx];
                if (!isPdfCandidate(file)) {
                    ToastManager.warning(
                        t('toast_file_skipped', {
                            name: file.name,
                            reason: msg('No es un archivo PDF.', 'Not a PDF file.'),
                        })
                    );
                    continue;
                }

                let pdfjsDoc = null;
                try {
                    const opened = await openPdfFile(file);
                    const bytes = opened.bytes;
                    pdfjsDoc = opened.pdfjsDoc;

                    if (signal.aborted) {
                        throw new DOMException('Aborted', 'AbortError');
                    }

                    // Validate pdf-lib readability before rendering thumbnails
                    await loadPdfLibDocument(bytes, file.name);

                    const fileId = createUniqueId('file');
                    const safeName = sanitizeDisplayFileName(file.name);
                    const totalPages = pdfjsDoc.numPages;

                    for (let i = 1; i <= totalPages; i += 1) {
                        if (signal.aborted) {
                            throw new DOMException('Aborted', 'AbortError');
                        }

                        const overallPct = Math.round(
                            ((fileIdx + i / totalPages) / files.length) * 100
                        );
                        ProgressModal.update({
                            percent: overallPct,
                            detail: `${safeName} · Pág. ${i} de ${totalPages}`,
                        });

                        const { canvas } = await renderPdfPageToCanvas(pdfjsDoc, i, THUMB_RENDER_SCALE);
                        if (signal.aborted) {
                            throw new DOMException('Aborted', 'AbortError');
                        }

                        const thumbBlob = await canvasToJpegBlob(canvas);
                        const thumbUrl = BlobRegistry.create(thumbBlob, TOOL_SCOPE);
                        batchThumbUrls.push(thumbUrl);

                        batchPages.push({
                            id: createUniqueId(TOOL_SCOPE),
                            fileId,
                            fileName: safeName,
                            pageIndex: i - 1,
                            rotation: 0,
                            selected: false,
                            thumbUrl,
                        });

                        if (i % 4 === 0) {
                            await yieldToMain();
                        }
                    }

                    batchFileEntries.push({ fileId, fileName: safeName, bytes });
                } catch (fileErr) {
                    if (fileErr?.name === 'AbortError') {
                        throw fileErr;
                    }
                    console.error('[merge] Failed to load file:', file.name, fileErr);
                    ToastManager.warning(
                        t('toast_file_skipped', {
                            name: file.name,
                            reason: fileErr?.message || 'Archivo inválido o dañado.',
                        })
                    );
                } finally {
                    try {
                        await pdfjsDoc?.destroy?.();
                    } catch {
                        // Ignore cleanup failure
                    }
                }
            }

            if (signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            if (batchPages.length > 0) {
                if (pages.length > 0) {
                    pushUndoSnapshot();
                }
                for (const entry of batchFileEntries) {
                    sourceFiles.set(entry.fileId, { fileName: entry.fileName, bytes: entry.bytes });
                }
                pages = pages.concat(batchPages);
                workspaceEl.classList.remove('hidden');
                renderGrid();
                ensureSortableAttached();
                ToastManager.success(msg(`Se añadieron ${batchPages.length} página(s).`, `Added ${batchPages.length} page(s).`));
            }
        } catch (err) {
            for (const url of batchThumbUrls) {
                BlobRegistry.revokeUrl(url);
            }
            if (err?.name === 'AbortError') {
                ToastManager.info(t('toast_cancelled'));
            } else {
                console.error('[merge] Batch load error:', err);
                ToastManager.error(err?.message || msg('Error al cargar los archivos PDF.', 'Failed to load PDF files.'));
            }
        } finally {
            ProgressModal.close();
            isBusy = false;
            AppState.setBusy(false);
        }
    };

    const runExport = async ({ forPrint = false } = {}) => {
        if (isBusy) return;
        if (pages.length === 0) {
            ToastManager.warning(t('toast_no_pages'));
            return;
        }

        isBusy = true;
        AppState.setBusy(true);
        const signal = ProgressModal.open({
            title: forPrint
                ? msg('Preparando impresión...', 'Preparing print...')
                : msg('Uniendo documentos PDF...', 'Merging PDF documents...'),
            detail: msg(`${pages.length} página(s)`, `${pages.length} page(s)`),
            cancellable: true,
        });

        try {
            const blob = await buildMergedPdfBlob(pages, sourceFiles, signal);
            if (signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            if (forPrint) {
                PrintService.printPdfBlob(blob);
            } else {
                const uniqueNames = new Set(pages.map((p) => p.fileName));
                const baseName = uniqueNames.size === 1 ? pages[0].fileName : 'documentos';
                const outputName = buildOutputName({
                    originalName: baseName,
                    suffix: 'unido',
                    pageCount: pages.length,
                    ext: 'pdf',
                });
                BlobRegistry.downloadBlob(blob, outputName);
                ToastManager.success(t('toast_saved_pdf', { name: outputName }));
            }
        } catch (err) {
            if (err?.name === 'AbortError') {
                ToastManager.info(t('toast_cancelled'));
            } else {
                console.error('[merge] Export error:', err);
                ToastManager.error(err?.message || msg('Error al unir los documentos PDF.', 'Error merging PDF documents.'));
            }
        } finally {
            ProgressModal.close();
            isBusy = false;
            AppState.setBusy(false);
        }
    };

    // Single delegated click listener on #merge-grid
    mergeGridEl.addEventListener('click', (e) => {
        if (isBusy || !(e.target instanceof Element)) return;

        const card = e.target.closest('[data-id]');
        if (!card || !mergeGridEl.contains(card)) return;

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
            const cloneCard = createMergePageCard(clone, idx + 1);
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

    // Multi-selection & bulk toolbar actions
    selectAllBtn?.addEventListener('click', () => {
        if (isBusy || pages.length === 0) return;
        if (pages.every((p) => p.selected)) return;

        pushUndoSnapshot();
        pages.forEach((p) => {
            p.selected = true;
        });
        mergeGridEl.querySelectorAll('.thumb-card[data-id]').forEach((card) => {
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
        mergeGridEl.querySelectorAll('.thumb-card[data-id]').forEach((card) => {
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
            ToastManager.warning('Selecciona al menos una página para rotar.');
            return;
        }

        pushUndoSnapshot();
        const cardById = new Map(
            Array.from(mergeGridEl.querySelectorAll('.thumb-card[data-id]')).map((el) => [
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
        resetMerge();
    });

    downloadBtn?.addEventListener('click', () => {
        runExport({ forPrint: false });
    });

    printBtn?.addEventListener('click', () => {
        runExport({ forPrint: true });
    });

    document.addEventListener('keydown', (e) => {
        if (AppState.activeTool !== 'merge' || isBusy) return;
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
        multiple: true,
        onFiles: handleFiles,
    });

    AppState.on('lang:changed', () => {
        if (!workspaceEl.classList.contains('hidden')) {
            renderGrid();
        }
    });

    AppState.registerTool('merge', {
        onActivate: () => {
            syncCountsAndUndo();
        },
        onDeactivate: () => {},
    });
}
