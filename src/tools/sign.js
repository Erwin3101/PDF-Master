import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import { openPdfFile, loadPdfLibDocument, decodeImageFile } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { bindDropzone } from '../ui/dropzone.js';

const msg = (es, en) => (AppState.lang === 'en' ? en : es);

const SIGNATURE_FONTS = ['Great Vibes', 'Dancing Script', 'Sacramento', 'Allura'];

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

/**
 * Decodes a base64 DataURL into raw Uint8Array bytes for pdf-lib embedding.
 * @param {string} dataUrl
 * @returns {Uint8Array}
 */
function dataUrlToUint8Array(dataUrl) {
    const base64 = String(dataUrl).split(',')[1] || '';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/**
 * Trims empty transparent margins from a canvas while keeping uniform padding.
 * Returns null if the canvas contains no visible non-transparent pixels.
 * @param {HTMLCanvasElement} sourceCanvas
 * @param {number} [padding=10]
 * @returns {{ dataUrl: string, width: number, height: number } | null}
 */
function trimTransparentCanvas(sourceCanvas, padding = 10) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || w === 0 || h === 0) return null;

    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
        const rowOffset = y * w * 4;
        for (let x = 0; x < w; x++) {
            if (data[rowOffset + x * 4 + 3] > 2) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (maxX < minX || maxY < minY) {
        return null;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const out = document.createElement('canvas');
    try {
        out.width = cropW + padding * 2;
        out.height = cropH + padding * 2;
        const outCtx = out.getContext('2d');
        outCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, padding, padding, cropW, cropH);

        return {
            dataUrl: out.toDataURL('image/png'),
            width: out.width,
            height: out.height,
        };
    } finally {
        out.width = 0;
        out.height = 0;
    }
}

/**
 * Normalizes any decoded image (PNG, JPG, WebP, HEIC, TIFF) into a PNG DataURL via canvas.
 * @param {HTMLImageElement} img
 * @returns {{ dataUrl: string, width: number, height: number }}
 */
function normalizeImageToPng(img) {
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    const maxEdge = 1200;
    const scale = Math.max(natW, natH) > maxEdge ? maxEdge / Math.max(natW, natH) : 1;

    const canvas = document.createElement('canvas');
    try {
        canvas.width = Math.max(1, Math.round(natW * scale));
        canvas.height = Math.max(1, Math.round(natH * scale));
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
        };
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * Renders typed cursive signature onto a generously padded transparent canvas and trims cleanly.
 * @param {string} text
 * @param {string} fontFamily
 * @param {string} color
 * @returns {Promise<{ dataUrl: string, width: number, height: number } | null>}
 */
async function renderTypedSignaturePng(text, fontFamily, color) {
    const fontSize = 72;
    const fontSpec = `${fontSize}px "${fontFamily}", cursive`;

    try {
        await document.fonts?.load(fontSpec, text);
        await document.fonts?.ready;
    } catch {
        // Proceed with loaded/fallback font if font loader rejects
    }

    const measureCanvas = document.createElement('canvas');
    const mCtx = measureCanvas.getContext('2d');
    mCtx.font = fontSpec;
    const metrics = mCtx.measureText(text);

    const overhangLeft = Math.max(0, metrics.actualBoundingBoxLeft || 0);
    const overhangRight = Math.max(metrics.width, metrics.actualBoundingBoxRight || metrics.width);
    const ascent = Math.max(fontSize * 0.85, metrics.actualBoundingBoxAscent || fontSize * 0.85);
    const descent = Math.max(fontSize * 0.35, metrics.actualBoundingBoxDescent || fontSize * 0.35);

    const padX = Math.round(fontSize * 0.9);
    const padY = Math.round(fontSize * 0.7);

    const canvas = document.createElement('canvas');
    try {
        canvas.width = Math.max(120, Math.ceil(overhangLeft + overhangRight + padX * 2));
        canvas.height = Math.max(100, Math.ceil(ascent + descent + padY * 2));

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = fontSpec;
        ctx.fillStyle = color;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(text, padX + overhangLeft, padY + ascent);

        const trimmed = trimTransparentCanvas(canvas, 12);
        if (trimmed) return trimmed;

        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
        };
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * Computes normalized signature box dimensions [0..1] relative to the visual page size,
 * preserving natural aspect ratio cleanly across preview and PDF export.
 */
function computeSignatureFractions(pageVisW, pageVisH, sigW, sigH, scaleFactor) {
    const safePageW = Math.max(1, pageVisW);
    const safePageH = Math.max(1, pageVisH);
    const sigAspect = Math.max(0.15, sigW / Math.max(1, sigH));

    const maxBaseW = safePageW * 0.28;
    const maxBaseH = safePageH * 0.14;
    let baseW = maxBaseW;
    let baseH = baseW / sigAspect;

    if (baseH > maxBaseH) {
        baseH = maxBaseH;
        baseW = baseH * sigAspect;
    }

    const drawW = baseW * scaleFactor;
    const drawH = baseH * scaleFactor;

    return {
        fracW: clamp(drawW / safePageW, 0.04, 0.92),
        fracH: clamp(drawH / safePageH, 0.02, 0.92),
    };
}

/**
 * Computes exact pdf-lib drawImage coordinates & rotation angle accounting for CropBox and page rotation.
 */
function mapPlacementToPdfPage(page, placement, sigW, sigH) {
    const box = page.getCropBox();
    const pageRot = ((page.getRotation().angle % 360) + 360) % 360;
    const swapDims = pageRot === 90 || pageRot === 270;
    const visW = swapDims ? box.height : box.width;
    const visH = swapDims ? box.width : box.height;

    const { fracW, fracH } = computeSignatureFractions(
        visW,
        visH,
        sigW,
        sigH,
        placement.scaleFactor
    );

    const drawW = fracW * visW;
    const drawH = fracH * visH;
    const nx = clamp(placement.nx, fracW / 2, Math.max(fracW / 2, 1 - fracW / 2));
    const ny = clamp(placement.ny, fracH / 2, Math.max(fracH / 2, 1 - fracH / 2));

    if (pageRot === 90) {
        const cx = box.x + ny * box.width;
        const cy = box.y + nx * box.height;
        return {
            x: cx + drawH / 2,
            y: cy - drawW / 2,
            width: drawW,
            height: drawH,
            rotateDeg: 90,
        };
    }

    if (pageRot === 180) {
        const cx = box.x + (1 - nx) * box.width;
        const cy = box.y + ny * box.height;
        return {
            x: cx + drawW / 2,
            y: cy + drawH / 2,
            width: drawW,
            height: drawH,
            rotateDeg: 180,
        };
    }

    if (pageRot === 270) {
        const cx = box.x + (1 - ny) * box.width;
        const cy = box.y + (1 - nx) * box.height;
        return {
            x: cx - drawH / 2,
            y: cy + drawW / 2,
            width: drawW,
            height: drawH,
            rotateDeg: 270,
        };
    }

    const cx = box.x + nx * box.width;
    const cy = box.y + (1 - ny) * box.height;
    return {
        x: cx - drawW / 2,
        y: cy - drawH / 2,
        width: drawW,
        height: drawH,
        rotateDeg: 0,
    };
}

/**
 * Initializes the PDF Signing tool (`#section-sign`).
 */
export function initSignTool() {
    const uploadArea = document.getElementById('sign-upload-area');
    const dropzone = document.getElementById('sign-dropzone');
    const fileInput = document.getElementById('file-input-sign');
    const workspace = document.getElementById('sign-workspace');

    const tabDraw = document.getElementById('tab-sign-draw');
    const tabType = document.getElementById('tab-sign-type');
    const tabUpload = document.getElementById('tab-sign-upload');
    const contentDraw = document.getElementById('sign-content-draw');
    const contentType = document.getElementById('sign-content-type');
    const contentUpload = document.getElementById('sign-content-upload');

    const sigCanvas = document.getElementById('sig-canvas');
    const drawColorInput = document.getElementById('sig-draw-color');
    const clearPadBtn = document.getElementById('sig-clear-btn');

    const textInput = document.getElementById('sign-text-input');
    const colorSwatches = Array.from(document.querySelectorAll('.sign-color-swatch'));
    const colorValInput = document.getElementById('sign-color-val');
    const typePreviewsEl = document.getElementById('type-previews');

    const signUploadDropzone = document.getElementById('sign-upload-dropzone');
    const signUploadInput = document.getElementById('sign-upload-input');
    const signUploadPreview = document.getElementById('sign-upload-preview');

    const saveSigBtn = document.getElementById('sig-save-btn');
    const actionsCard = document.getElementById('sig-actions');
    const scaleSlider = document.getElementById('sig-scale');
    const scaleBadge = document.getElementById('sig-scale-val');
    const clearPageBtn = document.getElementById('sig-clear-page-btn');
    const downloadBtn = document.getElementById('sig-download-btn');
    const printBtn = document.getElementById('sig-print-btn');
    const resetBtn = document.getElementById('sig-reset-btn');

    const prevPageBtn = document.getElementById('sign-prev-page-btn');
    const pageIndicator = document.getElementById('sign-page-indicator');
    const nextPageBtn = document.getElementById('sign-next-page-btn');
    const pdfContainer = document.getElementById('sign-pdf-container');
    const pdfCanvas = document.getElementById('sign-pdf-canvas');

    if (!dropzone || !fileInput || !workspace || !sigCanvas || !pdfContainer || !pdfCanvas) return;

    const sigCtx = sigCanvas.getContext('2d');

    const state = {
        mode: 'draw',
        selectedFont: SIGNATURE_FONTS[0],
        hasDrawnInk: false,
        uploadedSignature: null,
        signature: null, // { dataUrl, width, height }
        pdfBytes: null,
        pdfjsDoc: null,
        fileName: '',
        numPages: 0,
        currentPage: 1,
        currentPageVisWidth: 612,
        currentPageVisHeight: 792,
        scaleFactor: 1,
        /** @type {Map<number, { nx: number, ny: number, scaleFactor: number }>} */
        placementsByPage: new Map(),
        activeRenderTask: null,
        renderToken: 0,
        overlayEl: null,
        busy: false,
    };

    // --- Signature Pad (Pointer Events with coordinate scaling) ---
    let isDrawing = false;
    let activePointerId = null;
    let lastPt = null;

    const getCanvasPoint = (e) => {
        const rect = sigCanvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? sigCanvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? sigCanvas.height / rect.height : 1;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    sigCanvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        isDrawing = true;
        activePointerId = e.pointerId;
        try {
            sigCanvas.setPointerCapture(e.pointerId);
        } catch {
            // Ignore capture errors on synthetic events
        }

        const pt = getCanvasPoint(e);
        lastPt = pt;
        state.hasDrawnInk = true;

        if (sigCtx) {
            sigCtx.fillStyle = drawColorInput?.value || '#0f172a';
            sigCtx.beginPath();
            sigCtx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
            sigCtx.fill();
        }
    });

    sigCanvas.addEventListener('pointermove', (e) => {
        if (!isDrawing || (activePointerId !== null && e.pointerId !== activePointerId)) return;
        e.preventDefault();
        const pt = getCanvasPoint(e);
        if (sigCtx && lastPt) {
            sigCtx.strokeStyle = drawColorInput?.value || '#0f172a';
            sigCtx.lineWidth = 3;
            sigCtx.lineCap = 'round';
            sigCtx.lineJoin = 'round';
            sigCtx.beginPath();
            sigCtx.moveTo(lastPt.x, lastPt.y);
            sigCtx.lineTo(pt.x, pt.y);
            sigCtx.stroke();
        }
        lastPt = pt;
        state.hasDrawnInk = true;
    });

    const endDrawStroke = (e) => {
        if (!isDrawing) return;
        if (activePointerId !== null && e.pointerId !== undefined && e.pointerId !== activePointerId) return;
        isDrawing = false;
        lastPt = null;
        if (activePointerId !== null) {
            try {
                if (sigCanvas.hasPointerCapture(activePointerId)) {
                    sigCanvas.releasePointerCapture(activePointerId);
                }
            } catch {
                // Ignore
            }
        }
        activePointerId = null;
    };

    sigCanvas.addEventListener('pointerup', endDrawStroke);
    sigCanvas.addEventListener('pointercancel', endDrawStroke);

    clearPadBtn?.addEventListener('click', () => {
        sigCtx?.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        state.hasDrawnInk = false;
    });

    // --- Typed Signature Previews ---
    const renderTypePreviews = () => {
        if (!typePreviewsEl) return;
        const text = textInput?.value.trim() || msg('Tu Firma', 'Your Signature');
        const color = colorValInput?.value || '#0f172a';

        typePreviewsEl.replaceChildren();
        for (const font of SIGNATURE_FONTS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sign-font-item';
            if (state.selectedFont === font) {
                btn.classList.add('is-selected');
            }

            const previewSpan = document.createElement('span');
            previewSpan.textContent = text;
            previewSpan.style.fontFamily = `"${font}", cursive`;
            previewSpan.style.color = color;
            previewSpan.style.fontSize = '26px';
            previewSpan.style.lineHeight = '1.25';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'badge';
            nameSpan.textContent = font;

            btn.appendChild(previewSpan);
            btn.appendChild(nameSpan);
            btn.addEventListener('click', () => {
                state.selectedFont = font;
                renderTypePreviews();
            });
            typePreviewsEl.appendChild(btn);
        }
    };

    const setSignMode = (mode) => {
        state.mode = mode;
        const map = [
            ['draw', tabDraw, contentDraw],
            ['type', tabType, contentType],
            ['upload', tabUpload, contentUpload],
        ];
        for (const [key, tabBtn, panel] of map) {
            const active = key === mode;
            tabBtn?.classList.toggle('is-active', active);
            panel?.classList.toggle('hidden', !active);
        }
        if (mode === 'type') {
            renderTypePreviews();
        }
    };

    tabDraw?.addEventListener('click', () => setSignMode('draw'));
    tabType?.addEventListener('click', () => setSignMode('type'));
    tabUpload?.addEventListener('click', () => setSignMode('upload'));

    textInput?.addEventListener('input', renderTypePreviews);

    for (const swatch of colorSwatches) {
        swatch.addEventListener('click', () => {
            const color = swatch.dataset.color || '#0f172a';
            if (colorValInput) colorValInput.value = color;
            for (const item of colorSwatches) {
                item.classList.toggle('is-active', item === swatch);
            }
            renderTypePreviews();
        });
    }

    // --- Uploaded Signature Normalization ---
    const restoreUploadPreviewPlaceholder = () => {
        if (!signUploadPreview) return;
        signUploadPreview.replaceChildren();
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'image-up');
        const label = document.createElement('span');
        label.style.fontSize = '0.82rem';
        label.style.color = 'var(--text-secondary)';
        label.textContent = msg('Sube PNG, JPG o WebP de tu firma', 'Upload PNG, JPG or WebP signature');
        signUploadPreview.appendChild(icon);
        signUploadPreview.appendChild(label);
        window.lucide?.createIcons?.();
    };

    const handleSignatureUpload = async (files) => {
        const file = files?.[0];
        if (!file) return;

        try {
            const decoded = await decodeImageFile(file);
            const normalized = normalizeImageToPng(decoded.image);
            state.uploadedSignature = normalized;

            if (signUploadPreview) {
                signUploadPreview.replaceChildren();
                const img = document.createElement('img');
                img.src = normalized.dataUrl;
                img.alt = file.name;
                img.style.maxHeight = '100px';
                img.style.maxWidth = '100%';
                img.style.objectFit = 'contain';
                const caption = document.createElement('span');
                caption.style.fontSize = '0.75rem';
                caption.style.color = 'var(--text-muted)';
                caption.textContent = file.name;
                signUploadPreview.appendChild(img);
                signUploadPreview.appendChild(caption);
            }
        } catch (err) {
            ToastManager.error(
                err?.message || msg('No se pudo cargar la imagen de firma.', 'Could not load signature image.')
            );
        }
    };

    bindDropzone(signUploadDropzone, signUploadInput, {
        multiple: false,
        onFiles: handleSignatureUpload,
    });

    // --- Overlay Box Management ---
    const removeOverlay = () => {
        if (state.overlayEl) {
            state.overlayEl.remove();
            state.overlayEl = null;
        }
    };

    const syncOverlayGeometry = (box, placement) => {
        if (!box || !state.signature) return;
        const { fracW, fracH } = computeSignatureFractions(
            state.currentPageVisWidth,
            state.currentPageVisHeight,
            state.signature.width,
            state.signature.height,
            placement.scaleFactor
        );

        placement.nx = clamp(placement.nx, fracW / 2, Math.max(fracW / 2, 1 - fracW / 2));
        placement.ny = clamp(placement.ny, fracH / 2, Math.max(fracH / 2, 1 - fracH / 2));

        box.style.left = `${(placement.nx - fracW / 2) * 100}%`;
        box.style.top = `${(placement.ny - fracH / 2) * 100}%`;
        box.style.width = `${fracW * 100}%`;
        box.style.height = `${fracH * 100}%`;
    };

    const renderOverlayForCurrentPage = () => {
        removeOverlay();
        if (!state.signature) return;
        const placement = state.placementsByPage.get(state.currentPage);
        if (!placement) return;

        const box = document.createElement('div');
        box.className = 'sig-overlay-box';

        const img = document.createElement('img');
        img.src = state.signature.dataUrl;
        img.alt = msg('Firma colocada', 'Placed signature');
        img.draggable = false;
        box.appendChild(img);

        syncOverlayGeometry(box, placement);

        let dragging = false;
        let dragPointerId = null;
        let grabOffsetNx = 0;
        let grabOffsetNy = 0;

        box.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 && e.pointerType === 'mouse') return;
            e.stopPropagation();
            e.preventDefault();

            const rect = pdfCanvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            dragging = true;
            dragPointerId = e.pointerId;
            box.classList.add('is-active');
            try {
                box.setPointerCapture(e.pointerId);
            } catch {
                // Ignore
            }

            const pointerNx = (e.clientX - rect.left) / rect.width;
            const pointerNy = (e.clientY - rect.top) / rect.height;
            grabOffsetNx = placement.nx - pointerNx;
            grabOffsetNy = placement.ny - pointerNy;
        });

        box.addEventListener('pointermove', (e) => {
            if (!dragging || (dragPointerId !== null && e.pointerId !== dragPointerId)) return;
            e.preventDefault();

            const rect = pdfCanvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            placement.nx = (e.clientX - rect.left) / rect.width + grabOffsetNx;
            placement.ny = (e.clientY - rect.top) / rect.height + grabOffsetNy;
            syncOverlayGeometry(box, placement);
        });

        const endDrag = (e) => {
            if (!dragging) return;
            if (dragPointerId !== null && e.pointerId !== undefined && e.pointerId !== dragPointerId) return;
            dragging = false;
            box.classList.remove('is-active');
            if (dragPointerId !== null) {
                try {
                    if (box.hasPointerCapture(dragPointerId)) {
                        box.releasePointerCapture(dragPointerId);
                    }
                } catch {
                    // Ignore
                }
            }
            dragPointerId = null;
        };

        box.addEventListener('pointerup', endDrag);
        box.addEventListener('pointercancel', endDrag);

        pdfContainer.appendChild(box);
        state.overlayEl = box;
    };

    // Click on PDF canvas to place/move signature
    pdfCanvas.addEventListener('click', (e) => {
        if (!state.pdfjsDoc) return;
        if (!state.signature) {
            ToastManager.info(
                msg(
                    'Primero crea y confirma tu firma con "Usar esta Firma".',
                    'Create and save your signature with "Use this Signature" first.'
                )
            );
            return;
        }
        const rect = pdfCanvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const nx = clamp((e.clientX - rect.left) / rect.width, 0, 1);
        const ny = clamp((e.clientY - rect.top) / rect.height, 0, 1);

        state.placementsByPage.set(state.currentPage, {
            nx,
            ny,
            scaleFactor: state.scaleFactor,
        });
        renderOverlayForCurrentPage();
    });

    // Save signature button
    saveSigBtn?.addEventListener('click', async () => {
        let normalized = null;

        if (state.mode === 'draw') {
            normalized = state.hasDrawnInk ? trimTransparentCanvas(sigCanvas, 10) : null;
            if (!normalized) {
                ToastManager.warning(msg('Dibuja tu firma primero.', 'Draw your signature first.'));
                return;
            }
        } else if (state.mode === 'type') {
            const text = textInput?.value.trim() || '';
            if (!text) {
                ToastManager.warning(msg('Escribe tu nombre primero.', 'Type your name first.'));
                textInput?.focus();
                return;
            }
            const color = colorValInput?.value || '#0f172a';
            normalized = await renderTypedSignaturePng(text, state.selectedFont, color);
        } else if (state.mode === 'upload') {
            if (!state.uploadedSignature) {
                ToastManager.warning(msg('Sube una imagen de firma primero.', 'Upload a signature image first.'));
                return;
            }
            normalized = state.uploadedSignature;
        }

        if (!normalized) return;

        state.signature = normalized;
        actionsCard?.classList.remove('hidden');

        if (state.placementsByPage.has(state.currentPage)) {
            renderOverlayForCurrentPage();
        }
        ToastManager.success(
            msg(
                'Firma lista. Haz clic sobre cualquier página del PDF para colocarla o arrástrala.',
                'Signature ready. Click any PDF page to place it or drag to reposition.'
            )
        );
    });

    // Scale slider
    const syncScaleDisplay = (pctValue) => {
        const pct = clamp(Number(pctValue) || 100, 40, 240);
        state.scaleFactor = pct / 100;
        if (scaleSlider) scaleSlider.value = String(pct);
        if (scaleBadge) scaleBadge.textContent = `${pct}%`;
    };

    scaleSlider?.addEventListener('input', () => {
        syncScaleDisplay(scaleSlider.value);
        const currentPlacement = state.placementsByPage.get(state.currentPage);
        if (currentPlacement) {
            currentPlacement.scaleFactor = state.scaleFactor;
            syncOverlayGeometry(state.overlayEl, currentPlacement);
        }
    });

    clearPageBtn?.addEventListener('click', () => {
        if (state.placementsByPage.delete(state.currentPage)) {
            removeOverlay();
            ToastManager.info(msg('Firma quitada de esta página.', 'Signature removed from this page.'));
        }
    });

    // --- Page Rendering (Cached pdfjsDoc) ---
    const updatePageControls = () => {
        if (pageIndicator) {
            pageIndicator.textContent = msg(
                `Pág ${state.currentPage} / ${state.numPages || 1}`,
                `Page ${state.currentPage} / ${state.numPages || 1}`
            );
        }
        if (prevPageBtn) prevPageBtn.disabled = state.currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = state.currentPage >= state.numPages;

        const existing = state.placementsByPage.get(state.currentPage);
        if (existing) {
            syncScaleDisplay(Math.round(existing.scaleFactor * 100));
        }
    };

    const renderCurrentPage = async () => {
        if (!state.pdfjsDoc) return;

        const token = ++state.renderToken;
        if (state.activeRenderTask) {
            try {
                state.activeRenderTask.cancel();
            } catch {
                // Ignore
            }
            state.activeRenderTask = null;
        }

        const pageNum = state.currentPage;
        const page = await state.pdfjsDoc.getPage(pageNum);
        if (token !== state.renderToken || !state.pdfjsDoc) {
            page.cleanup();
            return;
        }

        const unscaledVp = page.getViewport({ scale: 1 });
        state.currentPageVisWidth = unscaledVp.width;
        state.currentPageVisHeight = unscaledVp.height;

        const renderScale = Math.min(2, Math.max(1, 760 / Math.max(1, unscaledVp.width)));
        const viewport = page.getViewport({ scale: renderScale });

        pdfCanvas.width = Math.max(1, Math.round(viewport.width));
        pdfCanvas.height = Math.max(1, Math.round(viewport.height));

        const ctx = pdfCanvas.getContext('2d', { alpha: false });
        if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pdfCanvas.width, pdfCanvas.height);
            const task = page.render({ canvasContext: ctx, viewport });
            state.activeRenderTask = task;
            try {
                await task.promise;
            } catch (err) {
                if (err?.name === 'RenderingCancelledException') return;
                throw err;
            } finally {
                if (state.activeRenderTask === task) {
                    state.activeRenderTask = null;
                }
                page.cleanup();
            }
        } else {
            page.cleanup();
        }

        if (token !== state.renderToken) return;
        updatePageControls();
        renderOverlayForCurrentPage();
    };

    prevPageBtn?.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage -= 1;
            renderCurrentPage().catch((err) => ToastManager.error(err?.message || 'Error'));
        }
    });

    nextPageBtn?.addEventListener('click', () => {
        if (state.currentPage < state.numPages) {
            state.currentPage += 1;
            renderCurrentPage().catch((err) => ToastManager.error(err?.message || 'Error'));
        }
    });

    const cleanupPdf = async () => {
        if (state.activeRenderTask) {
            try {
                state.activeRenderTask.cancel();
            } catch {
                // Ignore
            }
            state.activeRenderTask = null;
        }
        if (state.pdfjsDoc) {
            try {
                await state.pdfjsDoc.destroy();
            } catch {
                // Ignore
            }
            state.pdfjsDoc = null;
        }
        state.pdfBytes = null;
        state.fileName = '';
        state.numPages = 0;
        state.currentPage = 1;
        state.placementsByPage.clear();
        removeOverlay();
    };

    const resetWorkspace = async () => {
        await cleanupPdf();
        sigCtx?.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        state.hasDrawnInk = false;
        state.uploadedSignature = null;
        state.signature = null;
        syncScaleDisplay(100);
        restoreUploadPreviewPlaceholder();
        actionsCard?.classList.add('hidden');
        fileInput.value = '';
        signUploadInput && (signUploadInput.value = '');
        const pCtx = pdfCanvas.getContext('2d');
        pCtx?.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);
        workspace.classList.add('hidden');
        uploadArea?.classList.remove('hidden');
    };

    const handlePdfSelected = async (files) => {
        const file = files?.[0];
        if (!file || state.busy) return;
        state.busy = true;
        AppState.setBusy(true);

        const signal = ProgressModal.open({
            title: msg('Abriendo PDF...', 'Opening PDF...'),
            detail: file.name,
            cancellable: true,
        });

        try {
            const { bytes, pdfjsDoc } = await openPdfFile(file);
            if (signal.aborted) {
                await pdfjsDoc.destroy();
                ToastManager.info(t('toast_cancelled'));
                return;
            }

            await cleanupPdf();
            state.pdfBytes = bytes;
            state.pdfjsDoc = pdfjsDoc;
            state.fileName = file.name;
            state.numPages = pdfjsDoc.numPages;
            state.currentPage = 1;

            await renderCurrentPage();
            uploadArea?.classList.add('hidden');
            workspace.classList.remove('hidden');
            renderOverlayForCurrentPage();
        } catch (err) {
            await cleanupPdf();
            workspace.classList.add('hidden');
            uploadArea?.classList.remove('hidden');
            ToastManager.error(err?.message || msg('No se pudo abrir el PDF.', 'Could not open the PDF.'));
        } finally {
            ProgressModal.close();
            state.busy = false;
            AppState.setBusy(false);
        }
    };

    const buildSignedPdfBlob = async (signal) => {
        if (!state.signature) {
            ToastManager.warning(msg('Crea y guarda tu firma primero.', 'Create and save your signature first.'));
            return null;
        }
        if (state.placementsByPage.size === 0) {
            ToastManager.warning(
                msg(
                    'Haz clic sobre al menos una página del PDF para colocar tu firma.',
                    'Click on at least one PDF page to place your signature.'
                )
            );
            return null;
        }

        const doc = await loadPdfLibDocument(state.pdfBytes, state.fileName);
        const pngBytes = dataUrlToUint8Array(state.signature.dataUrl);
        const pngImage = await doc.embedPng(pngBytes);
        const pages = doc.getPages();

        for (const [pageNum, placement] of state.placementsByPage.entries()) {
            if (signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }
            const page = pages[pageNum - 1];
            if (!page) continue;

            const mapped = mapPlacementToPdfPage(
                page,
                placement,
                state.signature.width,
                state.signature.height
            );

            page.drawImage(pngImage, {
                x: mapped.x,
                y: mapped.y,
                width: mapped.width,
                height: mapped.height,
                rotate: mapped.rotateDeg ? window.PDFLib.degrees(mapped.rotateDeg) : undefined,
            });
        }

        ProgressModal.update({ percent: 90, detail: msg('Guardando PDF firmado...', 'Saving signed PDF...') });
        const pdfBytes = await doc.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    };

    const runExport = async (forPrint) => {
        if (!state.pdfBytes || state.busy) return;
        state.busy = true;
        AppState.setBusy(true);

        const signal = ProgressModal.open({
            title: forPrint
                ? msg('Preparando impresión...', 'Preparing print...')
                : msg('Firmando PDF...', 'Signing PDF...'),
            detail: state.fileName,
            cancellable: true,
        });

        try {
            const blob = await buildSignedPdfBlob(signal);
            if (!blob) return;

            if (forPrint) {
                PrintService.printPdfBlob(blob);
            } else {
                const outputName = buildOutputName({
                    originalName: state.fileName,
                    suffix: 'firmado',
                });
                BlobRegistry.downloadBlob(blob, outputName);
                ToastManager.success(t('toast_saved_pdf', { name: outputName }));
            }
        } catch (err) {
            if (err?.name === 'AbortError' || signal.aborted) {
                ToastManager.info(t('toast_cancelled'));
            } else {
                ToastManager.error(err?.message || msg('Error al firmar el PDF.', 'Error signing PDF.'));
            }
        } finally {
            ProgressModal.close();
            state.busy = false;
            AppState.setBusy(false);
        }
    };

    bindDropzone(dropzone, fileInput, {
        multiple: false,
        onFiles: handlePdfSelected,
    });

    downloadBtn?.addEventListener('click', () => runExport(false));
    printBtn?.addEventListener('click', () => runExport(true));
    resetBtn?.addEventListener('click', () => {
        resetWorkspace();
    });

    AppState.on('lang:changed', () => {
        if (state.mode === 'type') {
            renderTypePreviews();
        }
        if (state.pdfjsDoc) {
            updatePageControls();
        }
        if (!state.uploadedSignature) {
            restoreUploadPreviewPlaceholder();
        }
    });

    AppState.registerTool('sign', {
        onActivate: () => {
            if (state.mode === 'type') {
                renderTypePreviews();
            }
            if (state.pdfjsDoc) {
                renderOverlayForCurrentPage();
            }
        },
    });
}
