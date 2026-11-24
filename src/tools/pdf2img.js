import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { DragSortManager } from '../core/dragSortManager.js';
import { buildOutputName, sanitizeBaseName } from '../core/fileNaming.js';
import { openPdfFile, renderPdfPageToCanvas, rotateImageDataUrl, detectFileKind } from '../core/fileLoader.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const BLOB_SCOPE = 'pdf2img';
const VALID_SCALES = new Set([1.5, 2, 3]);

/**
 * Creates a standardized AbortError for user-cancelled operations.
 * @returns {Error}
 */
function createAbortError() {
    const err = new Error('Operation aborted');
    err.name = 'AbortError';
    return err;
}

/**
 * Yields to the event loop so UI updates and cancel clicks remain responsive.
 * @returns {Promise<void>}
 */
function yieldFrame() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Returns localized UI text for the PDF-to-Images tool.
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
function msg(key, params = {}) {
    const isEn = AppState.lang === 'en';
    const table = {
        progress_render: isEn ? 'Extracting PDF pages...' : 'Extrayendo páginas del PDF...',
        progress_render_page: isEn
            ? `Rendering page ${params.current} of ${params.total}...`
            : `Renderizando página ${params.current} de ${params.total}...`,
        progress_zip: isEn ? 'Building ZIP archive...' : 'Empaquetando archivo ZIP...',
        progress_zip_item: isEn
            ? `Processing image ${params.current} of ${params.total}...`
            : `Procesando imagen ${params.current} de ${params.total}...`,
        progress_zip_compress: isEn ? 'Compressing ZIP...' : 'Comprimiendo ZIP...',
        zip_ready: isEn
            ? `ZIP ready with ${params.count} image(s).`
            : `ZIP generado con ${params.count} imagen(es).`,
        empty_grid: isEn
            ? 'No images left. Reset to load another PDF.'
            : 'No quedan imágenes. Reinicia para cargar otro PDF.',
        invalid_pdf: isEn ? 'Please select a valid PDF file.' : 'Por favor, selecciona un archivo PDF válido.',
        missing_jszip: isEn ? 'JSZip library failed to load.' : 'La librería JSZip no se cargó correctamente.',
        error_render: isEn ? 'Could not extract images from PDF.' : 'No se pudieron extraer las imágenes del PDF.',
        error_zip: isEn ? 'Could not generate ZIP archive.' : 'Error al generar el archivo ZIP.',
        act_rotate_left: isEn ? 'Rotate -90°' : 'Rotar -90°',
        act_rotate_right: isEn ? 'Rotate +90°' : 'Rotar +90°',
        act_duplicate: isEn ? 'Duplicate image' : 'Duplicar imagen',
        act_delete: isEn ? 'Remove image' : 'Eliminar imagen',
        page_label: isEn ? `Page ${params.page}` : `Pág ${params.page}`,
    };
    return table[key] || '';
}

/**
 * Encodes an HTMLCanvasElement into a Blob asynchronously.
 * @param {HTMLCanvasElement} canvas
 * @param {string} mime
 * @param {number | undefined} quality
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas image encoding failed.'));
                }
            },
            mime,
            quality
        );
    });
}

/**
 * Applies CSS rotation transform (and slight scale on quarter turns to avoid clipping).
 * @param {HTMLImageElement} imgEl
 * @param {number} rotation
 */
function applyImageTransform(imgEl, rotation) {
    const norm = ((rotation % 360) + 360) % 360;
    imgEl.style.transform = norm % 180 !== 0 ? `rotate(${norm}deg) scale(0.76)` : `rotate(${norm}deg)`;
}

/**
 * Creates a thumbnail action icon button with drag filtering enabled.
 * @param {string} action
 * @param {string} iconName
 * @param {string} label
 * @returns {HTMLButtonElement}
 */
function createActionButton(action, iconName, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-action', action);
    btn.setAttribute('data-no-drag', '');
    btn.title = label;
    btn.setAttribute('aria-label', label);

    const icon = document.createElement('i');
    icon.setAttribute('data-lucide', iconName);
    btn.appendChild(icon);
    return btn;
}

/**
 * Builds a single `.thumb-card` DOM node safely via `createElement` + `textContent`.
 * @param {{ id: string, pageNum: number, url: string, rotation: number, format: 'jpeg'|'png', width: number, height: number }} item
 * @param {number} index
 * @returns {HTMLDivElement}
 */
function createThumbCard(item, index) {
    const card = document.createElement('div');
    card.className = 'thumb-card';
    card.setAttribute('data-id', item.id);

    const media = document.createElement('div');
    media.className = 'thumb-media';

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = msg('page_label', { page: item.pageNum });
    img.loading = 'lazy';
    img.draggable = false;
    applyImageTransform(img, item.rotation);

    const badge = document.createElement('span');
    badge.className = 'thumb-badge';
    badge.textContent = `#${index + 1}`;

    const actions = document.createElement('div');
    actions.className = 'thumb-actions';
    actions.appendChild(createActionButton('rotate-ccw', 'rotate-ccw', msg('act_rotate_left')));
    actions.appendChild(createActionButton('rotate-cw', 'rotate-cw', msg('act_rotate_right')));
    actions.appendChild(createActionButton('duplicate', 'copy', msg('act_duplicate')));
    actions.appendChild(createActionButton('delete', 'trash-2', msg('act_delete')));

    media.appendChild(img);
    media.appendChild(badge);
    media.appendChild(actions);

    const footer = document.createElement('div');
    footer.className = 'thumb-footer';

    const titleSpan = document.createElement('span');
    titleSpan.textContent = msg('page_label', { page: item.pageNum });

    const metaSpan = document.createElement('span');
    metaSpan.textContent = item.rotation ? `${item.rotation}°` : item.format === 'png' ? 'PNG' : 'JPG';

    footer.appendChild(titleSpan);
    footer.appendChild(metaSpan);

    card.appendChild(media);
    card.appendChild(footer);
    return card;
}

/**
 * Initializes the PDF-to-Images tool inside `#section-pdf2img`.
 */
export function initPdf2ImgTool() {
    const uploadArea = document.getElementById('p2i-upload-area');
    const dropzoneEl = document.getElementById('p2i-dropzone');
    const fileInputEl = document.getElementById('file-input-p2i');
    const workspaceEl = document.getElementById('p2i-workspace');
    const countEl = document.getElementById('p2i-count');
    const formatSelect = document.getElementById('p2i-format');
    const scaleSelect = document.getElementById('p2i-scale');
    const resetBtn = document.getElementById('p2i-reset-btn');
    const downloadZipBtn = document.getElementById('p2i-download-zip-btn');
    const gridEl = document.getElementById('p2i-grid');

    if (!uploadArea || !dropzoneEl || !fileInputEl || !workspaceEl || !gridEl) return;

    let idSeq = 0;
    const nextId = () => `p2i-${++idSeq}-${Date.now().toString(36)}`;

    /** @type {File | null} */
    let currentFile = null;
    /** @type {import('pdfjs-dist').PDFDocumentProxy | null} */
    let currentPdfDoc = null;
    /** @type {Array<{ id: string, pageNum: number, blob: Blob, url: string, rotation: number, format: 'jpeg'|'png', width: number, height: number }>} */
    let items = [];

    const getRenderOptions = () => {
        const format = formatSelect?.value === 'png' ? 'png' : 'jpeg';
        const rawScale = Number.parseFloat(scaleSelect?.value || '2');
        const scale = VALID_SCALES.has(rawScale) ? rawScale : 2;
        return { format, scale };
    };

    const syncCountAndButtons = () => {
        if (countEl) {
            countEl.textContent = String(items.length);
        }
        if (downloadZipBtn) {
            downloadZipBtn.disabled = items.length === 0;
            downloadZipBtn.setAttribute('aria-disabled', String(items.length === 0));
        }
    };

    const refreshOrderBadges = () => {
        const cards = gridEl.querySelectorAll('.thumb-card[data-id]');
        cards.forEach((card, index) => {
            const badge = card.querySelector('.thumb-badge');
            if (badge) {
                badge.textContent = `#${index + 1}`;
            }
        });
        syncCountAndButtons();
    };

    const renderGrid = () => {
        gridEl.replaceChildren();
        syncCountAndButtons();

        if (items.length === 0) {
            DragSortManager.destroy(gridEl);
            const emptyBox = document.createElement('div');
            emptyBox.style.gridColumn = '1 / -1';
            emptyBox.style.textAlign = 'center';
            emptyBox.style.padding = '36px 16px';
            emptyBox.style.color = 'var(--text-muted)';
            emptyBox.style.fontSize = '0.9rem';
            emptyBox.textContent = msg('empty_grid');
            gridEl.appendChild(emptyBox);
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach((item, index) => {
            fragment.appendChild(createThumbCard(item, index));
        });
        gridEl.appendChild(fragment);

        DragSortManager.attach(gridEl, {
            getItems: () => items,
            setItems: (reordered) => {
                items = reordered;
            },
            onReorder: () => {
                refreshOrderBadges();
            },
        });

        window.lucide?.createIcons?.();
    };

    const cleanupPdfDoc = async () => {
        if (currentPdfDoc) {
            try {
                await currentPdfDoc.destroy();
            } catch {
                // Ignore cleanup errors
            }
            currentPdfDoc = null;
        }
    };

    const resetTool = async () => {
        if (AppState.busy) return;
        DragSortManager.destroy(gridEl);
        BlobRegistry.revokeScope(BLOB_SCOPE);
        items = [];
        currentFile = null;
        await cleanupPdfDoc();
        fileInputEl.value = '';
        gridEl.replaceChildren();
        syncCountAndButtons();
        workspaceEl.classList.add('hidden');
        uploadArea.classList.remove('hidden');
    };

    /**
     * Renders a list of `{ pageNum, rotation }` descriptors from `currentPdfDoc`.
     * Always revokes existing `'pdf2img'` Blob URLs before generating replacements.
     * @param {Array<{ pageNum: number, rotation: number }>} descriptors
     * @param {boolean} isInitialLoad
     */
    const renderDescriptors = async (descriptors, isInitialLoad) => {
        if (!currentPdfDoc || AppState.busy) return;

        const { format, scale } = getRenderOptions();
        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'jpeg' ? 0.92 : undefined;

        if (isInitialLoad) {
            DragSortManager.destroy(gridEl);
            BlobRegistry.revokeScope(BLOB_SCOPE);
            items = [];
            renderGrid();
        }

        if (!descriptors.length) {
            DragSortManager.destroy(gridEl);
            BlobRegistry.revokeScope(BLOB_SCOPE);
            items = [];
            renderGrid();
            return;
        }

        const signal = ProgressModal.open({
            title: msg('progress_render'),
            detail: '',
            cancellable: true,
        });
        AppState.setBusy(true);

        const nextItems = [];
        const tempUrls = [];
        /** @type {Map<number, { blob: Blob, width: number, height: number }>} */
        const pageCache = new Map();

        try {
            const total = descriptors.length;
            for (let i = 0; i < total; i += 1) {
                if (signal.aborted) throw createAbortError();

                const desc = descriptors[i];
                ProgressModal.update({
                    percent: (i / total) * 96,
                    detail: msg('progress_render_page', { current: i + 1, total }),
                });

                let rendered = pageCache.get(desc.pageNum);
                if (!rendered) {
                    const { canvas } = await renderPdfPageToCanvas(currentPdfDoc, desc.pageNum, scale);
                    if (signal.aborted) {
                        canvas.width = 0;
                        canvas.height = 0;
                        throw createAbortError();
                    }
                    const width = canvas.width;
                    const height = canvas.height;
                    const blob = await canvasToBlob(canvas, mime, quality);
                    canvas.width = 0;
                    canvas.height = 0;

                    rendered = { blob, width, height };
                    pageCache.set(desc.pageNum, rendered);
                }

                if (signal.aborted) throw createAbortError();

                const url = BlobRegistry.create(rendered.blob, BLOB_SCOPE);
                tempUrls.push(url);
                nextItems.push({
                    id: nextId(),
                    pageNum: desc.pageNum,
                    blob: rendered.blob,
                    url,
                    rotation: desc.rotation,
                    format,
                    width: rendered.width,
                    height: rendered.height,
                });

                if ((i + 1) % 3 === 0) {
                    await yieldFrame();
                }
            }

            const prevUrls = items.map((item) => item.url);
            items = nextItems;
            for (const oldUrl of prevUrls) {
                BlobRegistry.revokeUrl(oldUrl);
            }
            ProgressModal.update({ percent: 100 });
            renderGrid();
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) {
                for (const url of tempUrls) {
                    BlobRegistry.revokeUrl(url);
                }
                if (isInitialLoad) {
                    DragSortManager.destroy(gridEl);
                    BlobRegistry.revokeScope(BLOB_SCOPE);
                    items = [];
                    await cleanupPdfDoc();
                    currentFile = null;
                    workspaceEl.classList.add('hidden');
                    uploadArea.classList.remove('hidden');
                }
                ToastManager.info(t('toast_cancelled'));
            } else {
                for (const url of tempUrls) {
                    BlobRegistry.revokeUrl(url);
                }
                if (isInitialLoad) {
                    DragSortManager.destroy(gridEl);
                    BlobRegistry.revokeScope(BLOB_SCOPE);
                    items = [];
                    renderGrid();
                }
                console.error('[pdf2img] Render error:', err);
                ToastManager.error(err?.message || msg('error_render'));
            }
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
        }
    };

    const handleFiles = async (files) => {
        const file = files?.[0];
        if (!file || AppState.busy) return;

        if (detectFileKind(file) !== 'pdf') {
            ToastManager.error(msg('invalid_pdf'));
            return;
        }

        try {
            const { pdfjsDoc } = await openPdfFile(file);
            if (pdfjsDoc.numPages <= 0) {
                await pdfjsDoc.destroy();
                ToastManager.warning(t('toast_no_pages'));
                return;
            }

            await cleanupPdfDoc();
            BlobRegistry.revokeScope(BLOB_SCOPE);
            currentFile = file;
            currentPdfDoc = pdfjsDoc;

            uploadArea.classList.add('hidden');
            workspaceEl.classList.remove('hidden');

            const descriptors = Array.from({ length: pdfjsDoc.numPages }, (_, idx) => ({
                pageNum: idx + 1,
                rotation: 0,
            }));
            await renderDescriptors(descriptors, true);
        } catch (err) {
            console.error('[pdf2img] Load error:', err);
            ToastManager.error(err?.message || msg('invalid_pdf'));
        }
    };

    const handleGridClick = (event) => {
        if (AppState.busy) return;
        const actionBtn = event.target instanceof Element ? event.target.closest('button[data-action]') : null;
        if (!actionBtn) return;

        const card = actionBtn.closest('.thumb-card[data-id]');
        const itemId = card?.getAttribute('data-id');
        if (!itemId) return;

        const index = items.findIndex((item) => item.id === itemId);
        if (index === -1) return;

        const action = actionBtn.getAttribute('data-action');
        const targetItem = items[index];

        if (action === 'rotate-cw' || action === 'rotate-ccw') {
            const delta = action === 'rotate-cw' ? 90 : -90;
            targetItem.rotation = (targetItem.rotation + delta + 360) % 360;
            const imgEl = card.querySelector('.thumb-media img');
            if (imgEl instanceof HTMLImageElement) {
                applyImageTransform(imgEl, targetItem.rotation);
            }
            const metaSpan = card.querySelector('.thumb-footer span:last-child');
            if (metaSpan) {
                metaSpan.textContent = targetItem.rotation
                    ? `${targetItem.rotation}°`
                    : targetItem.format === 'png'
                      ? 'PNG'
                      : 'JPG';
            }
            return;
        }

        if (action === 'duplicate') {
            const clonedUrl = BlobRegistry.create(targetItem.blob, BLOB_SCOPE);
            const clonedItem = {
                ...targetItem,
                id: nextId(),
                url: clonedUrl,
            };
            items.splice(index + 1, 0, clonedItem);
            const newCard = createThumbCard(clonedItem, index + 1);
            card.after(newCard);
            refreshOrderBadges();
            window.lucide?.createIcons?.();
            return;
        }

        if (action === 'delete') {
            const [removed] = items.splice(index, 1);
            if (removed) {
                BlobRegistry.revokeUrl(removed.url);
            }
            card.remove();
            if (items.length === 0) {
                renderGrid();
            } else {
                refreshOrderBadges();
            }
        }
    };

    const downloadZip = async () => {
        if (AppState.busy) return;
        if (!items.length) {
            ToastManager.warning(t('toast_no_pages'));
            return;
        }

        const JSZipCtor = window.JSZip;
        if (!JSZipCtor) {
            ToastManager.error(msg('missing_jszip'));
            return;
        }

        const signal = ProgressModal.open({
            title: msg('progress_zip'),
            detail: '',
            cancellable: true,
        });
        AppState.setBusy(true);

        try {
            const zip = new JSZipCtor();
            const baseName = sanitizeBaseName(currentFile?.name || 'documento', 'documento');
            const padLen = Math.max(2, String(items.length).length);
            const total = items.length;

            for (let i = 0; i < total; i += 1) {
                if (signal.aborted) throw createAbortError();

                const item = items[i];
                const isPng = item.format === 'png';
                const ext = isPng ? 'png' : 'jpg';
                const mime = isPng ? 'image/png' : 'image/jpeg';
                const quality = isPng ? 1 : 0.92;
                const entryName = `${baseName}_pag_${String(i + 1).padStart(padLen, '0')}.${ext}`;

                ProgressModal.update({
                    percent: (i / total) * 78,
                    detail: msg('progress_zip_item', { current: i + 1, total }),
                });

                if (item.rotation === 0) {
                    zip.file(entryName, item.blob);
                } else {
                    const rotated = await rotateImageDataUrl(item.url, item.rotation, mime, quality);
                    if (signal.aborted) throw createAbortError();
                    const base64Data = rotated.dataUrl.split(',')[1] || '';
                    zip.file(entryName, base64Data, { base64: true });
                }

                if ((i + 1) % 4 === 0) {
                    await yieldFrame();
                }
            }

            if (signal.aborted) throw createAbortError();
            ProgressModal.update({ percent: 82, detail: msg('progress_zip_compress') });

            const zipBlob = await zip.generateAsync(
                { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
                (meta) => {
                    if (signal.aborted) return;
                    ProgressModal.update({ percent: 82 + (meta.percent || 0) * 0.18 });
                }
            );

            if (signal.aborted) throw createAbortError();
            ProgressModal.update({ percent: 100 });

            const zipName = buildOutputName({
                originalName: currentFile?.name || 'documento.pdf',
                suffix: 'imagenes',
                pageCount: total,
                ext: 'zip',
            });
            BlobRegistry.downloadBlob(zipBlob, zipName);
            ToastManager.success(msg('zip_ready', { count: total }));
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
            } else {
                console.error('[pdf2img] ZIP export error:', err);
                ToastManager.error(err?.message || msg('error_zip'));
            }
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
        }
    };

    const handleRenderSettingsChange = () => {
        if (!currentPdfDoc || AppState.busy) return;
        const descriptors = items.map((item) => ({
            pageNum: item.pageNum,
            rotation: item.rotation,
        }));
        void renderDescriptors(descriptors, false);
    };

    bindDropzone(dropzoneEl, fileInputEl, {
        multiple: false,
        onFiles: handleFiles,
    });

    gridEl.addEventListener('click', handleGridClick);
    formatSelect?.addEventListener('change', handleRenderSettingsChange);
    scaleSelect?.addEventListener('change', handleRenderSettingsChange);
    downloadZipBtn?.addEventListener('click', () => {
        void downloadZip();
    });
    resetBtn?.addEventListener('click', () => {
        void resetTool();
    });

    AppState.on('lang:changed', () => {
        if (!workspaceEl.classList.contains('hidden')) {
            renderGrid();
        }
    });

    AppState.registerTool('pdf2img', {
        reset: () => void resetTool(),
    });
}
