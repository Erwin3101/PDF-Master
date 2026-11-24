import { AppState } from '../core/state.js';
import { BlobRegistry } from '../core/blobRegistry.js';
import { buildOutputName } from '../core/fileNaming.js';
import { decodeImageFile, loadImageElement } from '../core/fileLoader.js';
import { PrintService } from '../core/printService.js';
import { t } from '../core/i18n.js';
import { ToastManager } from '../ui/toastManager.js';
import { ProgressModal } from '../ui/progressModal.js';
import { confirmDialog } from '../ui/confirmModal.js';
import { bindDropzone } from '../ui/dropzone.js';
import { trapModalFocus } from '../ui/modalFocus.js';

const msg = (es, en) => (AppState.lang === 'en' ? en : es);

const ID_CARD_RATIO = 1.586; // ISO/IEC 7810 ID-1 (85.6mm / 53.98mm)
const MAX_PROCESS_EDGE = 2200;

const CEDULA_CONFIG = Object.freeze({
    PAGE_FORMATS: {
        a4: { name: 'A4', width: 210, height: 297 },
        letter: { name: 'Carta / Letter', width: 215.9, height: 279.4 },
    },
    CARD_SIZES: {
        standard: { name: 'Estándar Real (85.6 mm)', width: 85.6 },
        large: { name: 'Grande / Legible (105 mm)', width: 105 },
        max: { name: 'Máximo Ajuste (120 mm)', width: 120 },
    },
    DEFAULTS: {
        format: 'letter',
        cardSize: 'standard',
        spacing: 20,
        topMargin: 30,
        maxCardHeight: 90,
        defaultFilter: 'document',
    },
    SCAN_FILTERS: {
        ORIGINAL: 'original',
        DOCUMENT: 'document',
        GRAYSCALE: 'grayscale',
        BW: 'bw',
    },
});

function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
}

function calculateProportionalDimensions(naturalWidth, naturalHeight, targetWidthMm, maxHeightMm) {
    if (!naturalWidth || !naturalHeight) {
        return {
            width: targetWidthMm,
            height: Math.round((targetWidthMm / ID_CARD_RATIO) * 100) / 100,
        };
    }
    const aspectRatio = naturalHeight / naturalWidth;
    let width = targetWidthMm;
    let height = width * aspectRatio;
    if (height > maxHeightMm) {
        height = maxHeightMm;
        width = height / aspectRatio;
    }
    return {
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
    };
}

/**
 * Rotates an HTMLImageElement by `rotation` (degrees) onto a lossless PNG image
 * so the crop modal displays the visually oriented photo before resetting `rotation = 0`.
 * @param {HTMLImageElement} sourceImage
 * @param {number} rotation
 * @returns {Promise<HTMLImageElement>}
 */
async function rotateImageElementForCrop(sourceImage, rotation) {
    const norm = ((Number(rotation) % 360) + 360) % 360;
    if (norm === 0) return sourceImage;

    const natW = sourceImage.naturalWidth || sourceImage.width;
    const natH = sourceImage.naturalHeight || sourceImage.height;
    const swapAxes = norm === 90 || norm === 270;
    const canvas = document.createElement('canvas');
    let dataUrl;
    try {
        canvas.width = swapAxes ? natH : natW;
        canvas.height = swapAxes ? natW : natH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((norm * Math.PI) / 180);
        ctx.drawImage(sourceImage, -natW / 2, -natH / 2, natW, natH);
        dataUrl = canvas.toDataURL('image/png');
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
    return loadImageElement(dataUrl);
}

class CedulaScannerEngine {
    static processImage(sourceImage, options = {}) {
        const filter = options.filter || CEDULA_CONFIG.SCAN_FILTERS.DOCUMENT;
        const brightness = Number(options.brightness) || 0;
        const contrast = Number(options.contrast) || 0;
        const rotation = (((Number(options.rotation) || 0) % 360) + 360) % 360;

        const natW = sourceImage.naturalWidth || sourceImage.width;
        const natH = sourceImage.naturalHeight || sourceImage.height;
        const scale = Math.max(natW, natH) > MAX_PROCESS_EDGE ? MAX_PROCESS_EDGE / Math.max(natW, natH) : 1;
        const srcWidth = Math.max(1, Math.round(natW * scale));
        const srcHeight = Math.max(1, Math.round(natH * scale));

        const swapAxes = rotation === 90 || rotation === 270;
        const canvas = document.createElement('canvas');
        try {
            canvas.width = swapAxes ? srcHeight : srcWidth;
            canvas.height = swapAxes ? srcWidth : srcHeight;

            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.drawImage(sourceImage, -srcWidth / 2, -srcHeight / 2, srcWidth, srcHeight);
            ctx.restore();

            if (filter === CEDULA_CONFIG.SCAN_FILTERS.ORIGINAL && brightness === 0 && contrast === 0) {
                return {
                    dataUrl: canvas.toDataURL('image/jpeg', 0.96),
                    width: canvas.width,
                    height: canvas.height,
                    format: 'JPEG',
                };
            }

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            const brightnessOffset = brightness * 1.5;

            let minLuma = 255;
            let maxLuma = 0;

            if (filter === CEDULA_CONFIG.SCAN_FILTERS.DOCUMENT) {
                for (let i = 0; i < data.length; i += 16) {
                    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    if (luma < minLuma) minLuma = luma;
                    if (luma > maxLuma) maxLuma = luma;
                }
            }

            const whitePoint = Math.max(170, maxLuma - 15);
            const blackPoint = Math.min(60, minLuma + 20);
            const range = Math.max(1, whitePoint - blackPoint);

            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                const luma = 0.299 * r + 0.587 * g + 0.114 * b;

                if (filter === CEDULA_CONFIG.SCAN_FILTERS.DOCUMENT) {
                    if (luma >= whitePoint) {
                        const lift = (luma - whitePoint) / (255 - whitePoint + 0.001);
                        const blend = 0.85 + 0.15 * lift;
                        r = Math.min(255, r + (255 - r) * blend);
                        g = Math.min(255, g + (255 - g) * blend);
                        b = Math.min(255, b + (255 - b) * blend);
                    } else if (luma <= blackPoint) {
                        r *= 0.7;
                        g *= 0.7;
                        b *= 0.7;
                    } else {
                        const normalized = (luma - blackPoint) / range;
                        const curve =
                            normalized < 0.5
                                ? 2 * normalized * normalized
                                : 1 - Math.pow(-2 * normalized + 2, 2) / 2;
                        const factor = 0.8 + 0.4 * curve;
                        r = Math.min(255, Math.max(0, r * factor));
                        g = Math.min(255, Math.max(0, g * factor));
                        b = Math.min(255, Math.max(0, b * factor));
                    }
                } else if (filter === CEDULA_CONFIG.SCAN_FILTERS.GRAYSCALE) {
                    r = luma;
                    g = luma;
                    b = luma;
                } else if (filter === CEDULA_CONFIG.SCAN_FILTERS.BW) {
                    const bw = luma > 135 ? 255 : 0;
                    r = bw;
                    g = bw;
                    b = bw;
                }

                if (brightness !== 0) {
                    r += brightnessOffset;
                    g += brightnessOffset;
                    b += brightnessOffset;
                }

                if (contrast !== 0) {
                    r = contrastFactor * (r - 128) + 128;
                    g = contrastFactor * (g - 128) + 128;
                    b = contrastFactor * (b - 128) + 128;
                }

                data[i] = clamp(Math.round(r), 0, 255);
                data[i + 1] = clamp(Math.round(g), 0, 255);
                data[i + 2] = clamp(Math.round(b), 0, 255);
            }

            ctx.putImageData(imageData, 0, 0);

            return {
                dataUrl: canvas.toDataURL('image/jpeg', 0.95),
                width: canvas.width,
                height: canvas.height,
                format: 'JPEG',
            };
        } finally {
            canvas.width = 0;
            canvas.height = 0;
        }
    }
}

class CedulaCameraService {
    constructor() {
        this.modal = null;
        this.video = null;
        this.loadingOverlay = null;
        this.targetLabel = null;
        this.stream = null;
        this.currentFacingMode = 'environment';
        this.onCaptureCallback = null;
        this.onCancelCallback = null;
        this.targetSide = 'front';
        this._bound = false;
        this._previousFocus = null;
        this._pendingMetadataCleanup = null;
        this._onKeyDown = (e) => {
            if (trapModalFocus(e, this.modal)) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.stopAndClose();
            }
        };
    }

    init() {
        if (this._bound) return;
        this._bound = true;

        this.modal = document.getElementById('camera-modal-cedula');
        this.video = document.getElementById('camera-video-cedula');
        this.loadingOverlay = document.getElementById('camera-loading-cedula');
        this.targetLabel = document.getElementById('camera-target-label-cedula');

        const closeBtn = document.getElementById('camera-close-btn-cedula');
        const cancelBtn = document.getElementById('camera-cancel-btn-cedula');
        const shutterBtn = document.getElementById('camera-shutter-btn-cedula');
        const switchBtn = document.getElementById('camera-switch-btn-cedula');

        closeBtn?.addEventListener('click', () => this.stopAndClose());
        cancelBtn?.addEventListener('click', () => this.stopAndClose());
        shutterBtn?.addEventListener('click', () => this.captureSnapshot());
        switchBtn?.addEventListener('click', () => this.toggleFacingMode());
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.stopAndClose();
            }
        });
    }

    async start(side = 'front', onCapture, onCancel) {
        if (!this._bound) this.init();
        this.targetSide = side;
        this.onCaptureCallback = onCapture;
        this.onCancelCallback = onCancel;

        if (this.targetLabel) {
            this.targetLabel.textContent =
                side === 'front'
                    ? msg('Fotografía el ANVERSO (Frente) de la cédula', 'Capture the FRONT side of the ID card')
                    : msg('Fotografía el REVERSO (Atrás) de la cédula', 'Capture the BACK side of the ID card');
        }

        if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
            ToastManager.warning(
                msg(
                    'La cámara web no está disponible. Se abrirá el selector de archivos.',
                    'Webcam is unavailable. Opening file picker instead.'
                )
            );
            this.fallbackToNativeInput(side);
            return;
        }

        this._previousFocus = document.activeElement;
        this.modal?.classList.remove('hidden');
        this.modal?.classList.add('is-open');
        this.modal?.removeAttribute('hidden');
        this.modal?.setAttribute('aria-hidden', 'false');
        this.loadingOverlay?.classList.remove('hidden');
        document.addEventListener('keydown', this._onKeyDown, true);
        requestAnimationFrame(() => {
            document.getElementById('camera-close-btn-cedula')?.focus({ preventScroll: true });
        });

        try {
            await this.startStream();
        } catch (err) {
            ToastManager.warning(
                msg(
                    `No se pudo acceder a la cámara (${err?.message || 'permiso denegado'}). Se abrirá el selector de archivos.`,
                    `Could not access camera (${err?.message || 'permission denied'}). Opening file picker.`
                )
            );
            this.stopAndClose();
            this.fallbackToNativeInput(side);
        }
    }

    async startStream() {
        if (this.stream) {
            for (const track of this.stream.getTracks()) {
                track.stop();
            }
            this.stream = null;
        }

        const constraints = {
            audio: false,
            video: {
                facingMode: { ideal: this.currentFacingMode },
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
            },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!this.modal || this.modal.classList.contains('hidden')) {
            for (const track of stream.getTracks()) {
                track.stop();
            }
            return;
        }

        this.stream = stream;
        if (this.video) {
            this.video.srcObject = stream;
            await new Promise((resolve) => {
                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    this._pendingMetadataCleanup = null;
                    if (this.video) {
                        this.video.onloadedmetadata = null;
                    }
                    resolve();
                };
                this._pendingMetadataCleanup = finish;
                this.video.onloadedmetadata = () => {
                    this.video?.play().catch(() => {});
                    this.loadingOverlay?.classList.add('hidden');
                    finish();
                };
            });
            if (!this.modal || !this.modal.classList.contains('is-open')) {
                return;
            }
        }
    }

    async toggleFacingMode() {
        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
        this.loadingOverlay?.classList.remove('hidden');
        try {
            await this.startStream();
        } catch {
            ToastManager.warning(msg('No se pudo cambiar de cámara.', 'Could not switch camera.'));
            this.loadingOverlay?.classList.add('hidden');
        }
    }

    captureSnapshot() {
        if (!this.video || !this.stream) return;
        const vW = this.video.videoWidth || 1920;
        const vH = this.video.videoHeight || 1080;

        const canvas = document.createElement('canvas');
        let dataUrl;
        try {
            canvas.width = vW;
            canvas.height = vH;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0, vW, vH);
            dataUrl = canvas.toDataURL('image/jpeg', 0.96);
        } finally {
            canvas.width = 0;
            canvas.height = 0;
        }

        const cb = this.onCaptureCallback;
        const side = this.targetSide;
        this.onCancelCallback = null;
        this.stopAndClose();
        cb?.({ dataUrl, width: vW, height: vH, side });
    }

    stopAndClose() {
        this._pendingMetadataCleanup?.();
        document.removeEventListener('keydown', this._onKeyDown, true);
        if (this.stream) {
            for (const track of this.stream.getTracks()) {
                track.stop();
            }
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
        if (this.modal) {
            this.modal.classList.add('hidden');
            this.modal.classList.remove('is-open');
            this.modal.setAttribute('aria-hidden', 'true');
        }
        if (this._previousFocus && typeof this._previousFocus.focus === 'function' && this._previousFocus.isConnected) {
            this._previousFocus.focus({ preventScroll: true });
        }
        this._previousFocus = null;
        if (this.onCancelCallback) {
            const cancelCb = this.onCancelCallback;
            this.onCancelCallback = null;
            cancelCb();
        }
    }

    fallbackToNativeInput(side) {
        document.getElementById(`file-input-${side}-cedula`)?.click();
    }
}

class CedulaCropService {
    constructor() {
        this.modal = null;
        this.canvas = null;
        this.ctx = null;
        this.presetIdBtn = null;
        this.presetFreeBtn = null;
        this.sourceImage = null;
        this.cropBox = { x: 0, y: 0, width: 0, height: 0 };
        this.isDragging = false;
        this.dragHandle = null;
        this.activePointerId = null;
        this.dragStart = { x: 0, y: 0 };
        this.initialCropBox = null;
        this.onCompleteCallback = null;
        this.onCancelCallback = null;
        this.keepIdRatio = true;
        this._bound = false;
        this._windowListenersAttached = false;
        this._previousFocus = null;

        this._handlePointerMove = this._handlePointerMove.bind(this);
        this._handlePointerUp = this._handlePointerUp.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
    }

    init() {
        if (this._bound) return;
        this._bound = true;

        this.modal = document.getElementById('crop-modal-cedula');
        this.canvas = document.getElementById('crop-canvas-cedula');
        this.ctx = this.canvas?.getContext('2d') || null;
        this.presetIdBtn = document.getElementById('crop-btn-preset-id-cedula');
        this.presetFreeBtn = document.getElementById('crop-btn-preset-free-cedula');

        const closeBtn = document.getElementById('crop-close-btn-cedula');
        const cancelBtn = document.getElementById('crop-cancel-btn-cedula');
        const applyBtn = document.getElementById('crop-apply-btn-cedula');

        closeBtn?.addEventListener('click', () => this.close(false));
        cancelBtn?.addEventListener('click', () => this.close(false));
        applyBtn?.addEventListener('click', () => this.applyCrop());

        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close(false);
            }
        });

        this.presetIdBtn?.addEventListener('click', () => {
            this.keepIdRatio = true;
            this.syncPresetButtons();
            this.adjustCropBoxToRatio();
            this.draw();
        });

        this.presetFreeBtn?.addEventListener('click', () => {
            this.keepIdRatio = false;
            this.syncPresetButtons();
        });

        this.canvas?.addEventListener('pointerdown', (e) => {
            if (!this.sourceImage) return;
            if (e.button !== 0 && e.pointerType === 'mouse') return;

            const coords = this._getCanvasCoords(e);
            const handle = this.getHandleAt(coords.x, coords.y);
            if (!handle) return;

            e.preventDefault();
            this.dragHandle = handle;
            this.isDragging = true;
            this.activePointerId = e.pointerId;
            this.dragStart = coords;
            this.initialCropBox = { ...this.cropBox };

            try {
                this.canvas.setPointerCapture(e.pointerId);
            } catch {
                // Ignore capture failure
            }
        });

        this.canvas?.addEventListener('pointermove', (e) => {
            if (!this.sourceImage || this.isDragging) return;
            const coords = this._getCanvasCoords(e);
            const handle = this.getHandleAt(coords.x, coords.y);
            this.canvas.style.cursor = this.getCursorForHandle(handle);
        });
    }

    syncPresetButtons() {
        this.presetIdBtn?.classList.toggle('active', this.keepIdRatio);
        this.presetFreeBtn?.classList.toggle('active', !this.keepIdRatio);
    }

    _attachWindowListeners() {
        if (this._windowListenersAttached) return;
        this._windowListenersAttached = true;
        window.addEventListener('pointermove', this._handlePointerMove);
        window.addEventListener('pointerup', this._handlePointerUp);
        window.addEventListener('pointercancel', this._handlePointerUp);
        document.addEventListener('keydown', this._handleKeyDown, true);
    }

    _detachWindowListeners() {
        if (!this._windowListenersAttached) return;
        this._windowListenersAttached = false;
        window.removeEventListener('pointermove', this._handlePointerMove);
        window.removeEventListener('pointerup', this._handlePointerUp);
        window.removeEventListener('pointercancel', this._handlePointerUp);
        document.removeEventListener('keydown', this._handleKeyDown, true);
    }

    _handleKeyDown(e) {
        if (trapModalFocus(e, this.modal)) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            this.close(false);
        }
    }

    _getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = rect.width > 0 ? this.canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? this.canvas.height / rect.height : 1;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    }

    _handlePointerMove(e) {
        if (!this.sourceImage || !this.isDragging) return;
        if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;
        const coords = this._getCanvasCoords(e);
        const dx = coords.x - this.dragStart.x;
        const dy = coords.y - this.dragStart.y;
        this.updateCropBox(dx, dy);
        this.draw();
    }

    _handlePointerUp(e) {
        if (!this.isDragging) return;
        if (this.activePointerId !== null && e.pointerId !== undefined && e.pointerId !== this.activePointerId) {
            return;
        }
        this.isDragging = false;
        this.dragHandle = null;
        if (this.activePointerId !== null && this.canvas) {
            try {
                if (this.canvas.hasPointerCapture(this.activePointerId)) {
                    this.canvas.releasePointerCapture(this.activePointerId);
                }
            } catch {
                // Ignore
            }
        }
        this.activePointerId = null;
    }

    open(imageElement, onComplete, onCancel) {
        if (!this._bound) this.init();
        if (!this.modal || !this.canvas) return;

        this.sourceImage = imageElement;
        this.onCompleteCallback = onComplete;
        this.onCancelCallback = onCancel;
        this.keepIdRatio = true;
        this.syncPresetButtons();

        const maxWidth = 800;
        const maxHeight = 500;
        const natW = imageElement.naturalWidth || imageElement.width;
        const natH = imageElement.naturalHeight || imageElement.height;
        const scale = natW > maxWidth || natH > maxHeight ? Math.min(maxWidth / natW, maxHeight / natH) : 1;

        this.canvas.width = Math.max(1, Math.round(natW * scale));
        this.canvas.height = Math.max(1, Math.round(natH * scale));

        let initW = this.canvas.width * 0.85;
        let initH = this.keepIdRatio ? initW / ID_CARD_RATIO : this.canvas.height * 0.85;
        if (initH > this.canvas.height * 0.9) {
            initH = this.canvas.height * 0.9;
            if (this.keepIdRatio) {
                initW = initH * ID_CARD_RATIO;
            }
        }

        this.cropBox = {
            x: (this.canvas.width - initW) / 2,
            y: (this.canvas.height - initH) / 2,
            width: initW,
            height: initH,
        };

        this._previousFocus = document.activeElement;
        this.modal.classList.remove('hidden');
        this.modal.classList.add('is-open');
        this.modal.removeAttribute('hidden');
        this.modal.setAttribute('aria-hidden', 'false');
        this._attachWindowListeners();
        this.draw();
        requestAnimationFrame(() => {
            document.getElementById('crop-apply-btn-cedula')?.focus({ preventScroll: true });
        });
    }

    adjustCropBoxToRatio() {
        if (!this.canvas) return;
        let width = Math.max(40, this.cropBox.width);
        let height = width / ID_CARD_RATIO;

        if (this.cropBox.x + width > this.canvas.width) {
            width = this.canvas.width - this.cropBox.x;
            height = width / ID_CARD_RATIO;
        }
        if (this.cropBox.y + height > this.canvas.height) {
            height = this.canvas.height - this.cropBox.y;
            width = height * ID_CARD_RATIO;
        }

        this.cropBox.width = Math.max(10, width);
        this.cropBox.height = this.cropBox.width / ID_CARD_RATIO;
    }

    getHandleAt(x, y) {
        const handleRadius = 24;
        const { x: bx, y: by, width: bw, height: bh } = this.cropBox;
        if (Math.hypot(x - bx, y - by) <= handleRadius) return 'tl';
        if (Math.hypot(x - (bx + bw), y - by) <= handleRadius) return 'tr';
        if (Math.hypot(x - bx, y - (by + bh)) <= handleRadius) return 'bl';
        if (Math.hypot(x - (bx + bw), y - (by + bh)) <= handleRadius) return 'br';
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return 'move';
        return null;
    }

    getCursorForHandle(handle) {
        switch (handle) {
            case 'tl':
            case 'br':
                return 'nwse-resize';
            case 'tr':
            case 'bl':
                return 'nesw-resize';
            case 'move':
                return 'move';
            default:
                return 'default';
        }
    }

    updateCropBox(dx, dy) {
        if (!this.initialCropBox || !this.canvas) return;
        const b = this.initialCropBox;
        const canvasW = this.canvas.width;
        const canvasH = this.canvas.height;

        if (this.dragHandle === 'move') {
            this.cropBox.x = clamp(b.x + dx, 0, Math.max(0, canvasW - b.width));
            this.cropBox.y = clamp(b.y + dy, 0, Math.max(0, canvasH - b.height));
            return;
        }

        let ax;
        let ay;
        let maxW;
        let maxH;
        let rawW;
        let rawH;

        if (this.dragHandle === 'br') {
            ax = b.x;
            ay = b.y;
            maxW = canvasW - ax;
            maxH = canvasH - ay;
            rawW = b.width + dx;
            rawH = b.height + dy;
        } else if (this.dragHandle === 'tr') {
            ax = b.x;
            ay = b.y + b.height;
            maxW = canvasW - ax;
            maxH = ay;
            rawW = b.width + dx;
            rawH = b.height - dy;
        } else if (this.dragHandle === 'bl') {
            ax = b.x + b.width;
            ay = b.y;
            maxW = ax;
            maxH = canvasH - ay;
            rawW = b.width - dx;
            rawH = b.height + dy;
        } else if (this.dragHandle === 'tl') {
            ax = b.x + b.width;
            ay = b.y + b.height;
            maxW = ax;
            maxH = ay;
            rawW = b.width - dx;
            rawH = b.height - dy;
        } else {
            return;
        }

        let width;
        let height;

        if (this.keepIdRatio) {
            // Clamp against both horizontal and vertical edge limits BEFORE deriving height,
            // guaranteeing exact 1.586:1 ratio even when hitting any canvas boundary.
            const effectiveMaxW = Math.max(10, Math.min(maxW, maxH * ID_CARD_RATIO));
            const minW = Math.min(40, effectiveMaxW);
            const desiredW = Math.abs(dx) >= Math.abs(dy) * ID_CARD_RATIO ? rawW : rawH * ID_CARD_RATIO;
            width = clamp(desiredW, minW, effectiveMaxW);
            height = width / ID_CARD_RATIO;
        } else {
            width = clamp(rawW, Math.min(40, maxW), Math.max(1, maxW));
            height = clamp(rawH, Math.min(30, maxH), Math.max(1, maxH));
        }

        let x = ax;
        let y = ay;
        if (this.dragHandle === 'tr') {
            y = ay - height;
        } else if (this.dragHandle === 'bl') {
            x = ax - width;
        } else if (this.dragHandle === 'tl') {
            x = ax - width;
            y = ay - height;
        }

        this.cropBox = { x, y, width, height };
    }

    draw() {
        if (!this.ctx || !this.sourceImage || !this.canvas) return;
        const { width, height } = this.canvas;
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(this.sourceImage, 0, 0, width, height);

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        this.ctx.fillRect(0, 0, width, height);

        const { x, y, width: bw, height: bh } = this.cropBox;
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(x, y, bw, bh);
        this.ctx.clip();
        this.ctx.drawImage(this.sourceImage, 0, 0, width, height);

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(x + bw / 3, y);
        this.ctx.lineTo(x + bw / 3, y + bh);
        this.ctx.moveTo(x + (bw * 2) / 3, y);
        this.ctx.lineTo(x + (bw * 2) / 3, y + bh);
        this.ctx.moveTo(x, y + bh / 3);
        this.ctx.lineTo(x + bw, y + bh / 3);
        this.ctx.moveTo(x, y + (bh * 2) / 3);
        this.ctx.lineTo(x + bw, y + (bh * 2) / 3);
        this.ctx.stroke();
        this.ctx.restore();

        this.ctx.strokeStyle = '#0284c7';
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeRect(x, y, bw, bh);

        const handleRadius = 7;
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        for (const [hx, hy] of [
            [x, y],
            [x + bw, y],
            [x, y + bh],
            [x + bw, y + bh],
        ]) {
            this.ctx.beginPath();
            this.ctx.arc(hx, hy, handleRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        }
    }

    applyCrop() {
        if (!this.sourceImage || !this.canvas) return;
        const natW = this.sourceImage.naturalWidth || this.sourceImage.width;
        const natH = this.sourceImage.naturalHeight || this.sourceImage.height;
        const scaleX = natW / this.canvas.width;
        const scaleY = natH / this.canvas.height;

        const cropX = clamp(Math.round(this.cropBox.x * scaleX), 0, Math.max(0, natW - 1));
        const cropY = clamp(Math.round(this.cropBox.y * scaleY), 0, Math.max(0, natH - 1));
        const cropW = clamp(Math.round(this.cropBox.width * scaleX), 1, natW - cropX);
        const cropH = clamp(Math.round(this.cropBox.height * scaleY), 1, natH - cropY);

        const outCanvas = document.createElement('canvas');
        let dataUrl;
        try {
            outCanvas.width = cropW;
            outCanvas.height = cropH;
            const outCtx = outCanvas.getContext('2d');
            outCtx.drawImage(this.sourceImage, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            dataUrl = outCanvas.toDataURL('image/jpeg', 0.98);
        } finally {
            outCanvas.width = 0;
            outCanvas.height = 0;
        }
        const completeCb = this.onCompleteCallback;
        this.close(true);
        completeCb?.({ dataUrl, width: cropW, height: cropH });
    }

    close(success = false) {
        this._detachWindowListeners();
        this.isDragging = false;
        this.dragHandle = null;
        this.activePointerId = null;

        if (this.modal) {
            this.modal.classList.add('hidden');
            this.modal.classList.remove('is-open');
            this.modal.setAttribute('aria-hidden', 'true');
        }
        if (this._previousFocus && typeof this._previousFocus.focus === 'function' && this._previousFocus.isConnected) {
            this._previousFocus.focus({ preventScroll: true });
        }
        this._previousFocus = null;
        if (!success && this.onCancelCallback) {
            this.onCancelCallback();
        }
        this.onCompleteCallback = null;
        this.onCancelCallback = null;
    }
}

class CedulaImageHandler {
    constructor() {
        this.documents = [{ front: this.createSideState(), back: this.createSideState() }];
        this.currentIndex = 0;
        this.listeners = [];
    }

    get sides() {
        return this.documents[this.currentIndex];
    }

    createSideState() {
        return {
            isLoaded: false,
            fileName: '',
            rawSource: null,
            rawCropped: null,
            processedDataUrl: null,
            width: 0,
            height: 0,
            format: 'JPEG',
            rotation: 0,
            filter: CEDULA_CONFIG.DEFAULTS.defaultFilter,
            brightness: 0,
            contrast: 0,
        };
    }

    onChange(cb) {
        this.listeners.push(cb);
    }

    notify(side) {
        for (const cb of this.listeners) {
            cb(side, this.sides[side], this.sides);
        }
    }

    notifyAll() {
        this.notify('front');
        this.notify('back');
    }

    addDocument() {
        this.documents.push({ front: this.createSideState(), back: this.createSideState() });
        this.currentIndex = this.documents.length - 1;
        this.notifyAll();
    }

    nextDocument() {
        if (this.currentIndex < this.documents.length - 1) {
            this.currentIndex += 1;
            this.notifyAll();
        }
    }

    prevDocument() {
        if (this.currentIndex > 0) {
            this.currentIndex -= 1;
            this.notifyAll();
        }
    }

    deleteCurrentDocument() {
        if (this.documents.length > 1) {
            this.documents.splice(this.currentIndex, 1);
            if (this.currentIndex >= this.documents.length) {
                this.currentIndex = this.documents.length - 1;
            }
        } else {
            this.documents[0] = { front: this.createSideState(), back: this.createSideState() };
        }
        this.notifyAll();
    }

    async loadFile(file, side) {
        const decoded = await decodeImageFile(file);
        const state = this.sides[side];
        state.isLoaded = true;
        state.fileName = decoded.name || file.name;
        state.rawSource = decoded.image;
        state.rawCropped = decoded.image;
        state.rotation = 0;
        state.brightness = 0;
        state.contrast = 0;
        this.reprocess(side);
    }

    async loadDataUrl(dataUrl, side, fileName = 'imagen.jpg') {
        const imgElement = await loadImageElement(dataUrl);
        const state = this.sides[side];
        state.isLoaded = true;
        state.fileName = fileName;
        state.rawSource = imgElement;
        state.rawCropped = imgElement;
        state.rotation = 0;
        state.brightness = 0;
        state.contrast = 0;
        this.reprocess(side);
    }

    async applyCropResult(side, cropData) {
        const state = this.sides[side];
        const imgElement = await loadImageElement(cropData.dataUrl);
        state.rotation = 0;
        state.rawCropped = imgElement;
        this.reprocess(side);
    }

    rotate(side, deg = 90) {
        const state = this.sides[side];
        if (!state.isLoaded) return;
        state.rotation = (((state.rotation + deg) % 360) + 360) % 360;
        this.reprocess(side);
    }

    setFilter(side, filterName) {
        const state = this.sides[side];
        if (!state.isLoaded) return;
        state.filter = filterName;
        this.reprocess(side);
    }

    setBrightness(side, value) {
        const state = this.sides[side];
        if (!state.isLoaded) return;
        state.brightness = clamp(Number(value) || 0, -50, 50);
        this.reprocess(side);
    }

    setContrast(side, value) {
        const state = this.sides[side];
        if (!state.isLoaded) return;
        state.contrast = clamp(Number(value) || 0, -50, 50);
        this.reprocess(side);
    }

    reprocess(side) {
        const state = this.sides[side];
        if (!state.isLoaded || !state.rawCropped) return;
        const res = CedulaScannerEngine.processImage(state.rawCropped, {
            filter: state.filter,
            brightness: state.brightness,
            contrast: state.contrast,
            rotation: state.rotation,
        });
        state.processedDataUrl = res.dataUrl;
        state.width = res.width;
        state.height = res.height;
        state.format = res.format;
        this.notify(side);
    }

    resetSide(side) {
        this.sides[side] = this.createSideState();
        this.notify(side);
    }

    hasAnySide() {
        return this.documents.some((doc) => doc.front.isLoaded || doc.back.isLoaded);
    }

    getSide(side) {
        return this.sides[side];
    }
}

class CedulaPDFService {
    static buildDocument(imageHandler, customSettings = {}) {
        const jsPDFCtor = window.jspdf?.jsPDF;
        if (!jsPDFCtor) {
            throw new Error(msg('Librería jsPDF no encontrada.', 'jsPDF library is not available.'));
        }

        const formatKey = customSettings.format || CEDULA_CONFIG.DEFAULTS.format;
        const cardSizeKey = customSettings.cardSize || CEDULA_CONFIG.DEFAULTS.cardSize;
        const cardConfig = CEDULA_CONFIG.CARD_SIZES[cardSizeKey] || CEDULA_CONFIG.CARD_SIZES.standard;
        const targetCardWidth = cardConfig.width;

        const doc = new jsPDFCtor({
            orientation: 'portrait',
            unit: 'mm',
            format: formatKey === 'a4' ? 'a4' : 'letter',
            compress: true,
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let pagesAdded = 0;

        for (const docState of imageHandler.documents) {
            const { front, back } = docState;
            if (!front.isLoaded && !back.isLoaded) continue;

            if (pagesAdded > 0) {
                doc.addPage();
            }
            pagesAdded += 1;

            const maxCardHeight = CEDULA_CONFIG.DEFAULTS.maxCardHeight;
            let spacing = CEDULA_CONFIG.DEFAULTS.spacing;
            let topMargin = CEDULA_CONFIG.DEFAULTS.topMargin;

            const frontDim =
                front.isLoaded && front.processedDataUrl
                    ? calculateProportionalDimensions(front.width, front.height, targetCardWidth, maxCardHeight)
                    : null;

            const backDim =
                back.isLoaded && back.processedDataUrl
                    ? calculateProportionalDimensions(back.width, back.height, targetCardWidth, maxCardHeight)
                    : null;

            if (frontDim && backDim) {
                const blockHeight = frontDim.height + spacing + backDim.height;
                if (blockHeight > pageHeight - 40) {
                    spacing = Math.max(12, spacing * 0.7);
                    topMargin = Math.max(15, (pageHeight - (frontDim.height + backDim.height + spacing)) / 2);
                } else {
                    topMargin = (pageHeight - blockHeight) / 2;
                }
            } else if (frontDim) {
                topMargin = (pageHeight - frontDim.height) / 2;
            } else if (backDim) {
                topMargin = (pageHeight - backDim.height) / 2;
            }

            if (frontDim) {
                const xFront = (pageWidth - frontDim.width) / 2;
                doc.addImage(
                    front.processedDataUrl,
                    front.format || 'JPEG',
                    xFront,
                    topMargin,
                    frontDim.width,
                    frontDim.height,
                    undefined,
                    'FAST'
                );
            }

            if (backDim) {
                const xBack = (pageWidth - backDim.width) / 2;
                const yBack = frontDim ? topMargin + frontDim.height + spacing : topMargin;
                doc.addImage(
                    back.processedDataUrl,
                    back.format || 'JPEG',
                    xBack,
                    yBack,
                    backDim.width,
                    backDim.height,
                    undefined,
                    'FAST'
                );
            }
        }

        if (pagesAdded === 0) {
            throw new Error(msg('Carga al menos una cara de la cédula.', 'Load at least one side of the ID card.'));
        }

        return { blob: doc.output('blob'), pagesAdded };
    }
}

class CedulaUIController {
    constructor(imageHandler) {
        this.imageHandler = imageHandler;
        this.cameraService = new CedulaCameraService();
        this.cropService = new CedulaCropService();
        this.currentSettings = {
            format: CEDULA_CONFIG.DEFAULTS.format,
            cardSize: CEDULA_CONFIG.DEFAULTS.cardSize,
        };
        this.dom = {};
        this._sliderTimers = new Map();
    }

    init() {
        this.cacheDom();
        if (this.dom.selectPaperFormat?.value) {
            this.currentSettings.format = this.dom.selectPaperFormat.value;
        }
        if (this.dom.selectCardSize?.value) {
            this.currentSettings.cardSize = this.dom.selectCardSize.value;
        }
        this.bindEvents();
        this.subscribeToState();
        this.updateBatchUI();
        this.updatePaperPreview();
    }

    cacheDom() {
        this.dom = {
            dropzoneFront: document.getElementById('dropzone-front-box-cedula'),
            dropzoneBack: document.getElementById('dropzone-back-box-cedula'),
            fileInputFront: document.getElementById('file-input-front-cedula'),
            fileInputBack: document.getElementById('file-input-back-cedula'),

            btnCameraFront: document.getElementById('btn-camera-front-cedula'),
            btnCameraBack: document.getElementById('btn-camera-back-cedula'),
            btnUploadFront: document.getElementById('btn-upload-front-cedula'),
            btnUploadBack: document.getElementById('btn-upload-back-cedula'),

            emptyStateFront: document.getElementById('empty-state-front-cedula'),
            emptyStateBack: document.getElementById('empty-state-back-cedula'),
            loadedStateFront: document.getElementById('loaded-state-front-cedula'),
            loadedStateBack: document.getElementById('loaded-state-back-cedula'),

            thumbImgFront: document.getElementById('thumb-img-front-cedula'),
            thumbImgBack: document.getElementById('thumb-img-back-cedula'),
            fileNameFront: document.getElementById('filename-front-cedula'),
            fileNameBack: document.getElementById('filename-back-cedula'),

            btnRotateFront: document.getElementById('btn-rotate-front-cedula'),
            btnRotateBack: document.getElementById('btn-rotate-back-cedula'),
            btnCropFront: document.getElementById('btn-crop-front-cedula'),
            btnCropBack: document.getElementById('btn-crop-back-cedula'),
            btnDeleteFront: document.getElementById('btn-delete-front-cedula'),
            btnDeleteBack: document.getElementById('btn-delete-back-cedula'),

            filterSelectFront: document.getElementById('filter-select-front-cedula'),
            filterSelectBack: document.getElementById('filter-select-back-cedula'),
            brightnessSliderFront: document.getElementById('brightness-front-cedula'),
            brightnessSliderBack: document.getElementById('brightness-back-cedula'),
            contrastSliderFront: document.getElementById('contrast-front-cedula'),
            contrastSliderBack: document.getElementById('contrast-back-cedula'),

            selectPaperFormat: document.getElementById('select-paper-format-cedula'),
            selectCardSize: document.getElementById('select-card-size-cedula'),

            paperSheet: document.getElementById('paper-sheet-cedula'),
            previewFrontContainer: document.getElementById('preview-front-container-cedula'),
            previewBackContainer: document.getElementById('preview-back-container-cedula'),
            previewImgFront: document.getElementById('preview-img-front-cedula'),
            previewImgBack: document.getElementById('preview-img-back-cedula'),
            placeholderFront: document.getElementById('placeholder-front-cedula'),
            placeholderBack: document.getElementById('placeholder-back-cedula'),
            watermarkText: document.getElementById('watermark-text-cedula'),

            btnDownload: document.getElementById('btn-download-pdf-cedula'),
            btnPrint: document.getElementById('btn-print-doc-cedula'),
            globalAlert: document.getElementById('global-alert-cedula'),

            btnPrevDoc: document.getElementById('btn-prev-doc-cedula'),
            btnNextDoc: document.getElementById('btn-next-doc-cedula'),
            btnAddDoc: document.getElementById('btn-add-doc-cedula'),
            btnDeleteDoc: document.getElementById('btn-delete-doc-cedula'),
            batchCounter: document.getElementById('batch-counter-cedula'),
        };
    }

    _scheduleSliderReprocess(key, fn) {
        const prev = this._sliderTimers.get(key);
        if (prev) clearTimeout(prev.timerId);
        const timerId = setTimeout(() => {
            this._sliderTimers.delete(key);
            fn();
        }, 35);
        this._sliderTimers.set(key, { timerId, fn });
    }

    _flushPendingSliders() {
        for (const [key, entry] of this._sliderTimers.entries()) {
            clearTimeout(entry.timerId);
            this._sliderTimers.delete(key);
            entry.fn();
        }
    }

    _bindChildActionStopPropagation(btn, handler) {
        if (!btn) return;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handler(e);
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
            }
        });
    }

    bindEvents() {
        bindDropzone(this.dom.dropzoneFront, this.dom.fileInputFront, {
            multiple: false,
            onFiles: (files) => this.processSelectedFile(files[0], 'front'),
        });
        bindDropzone(this.dom.dropzoneBack, this.dom.fileInputBack, {
            multiple: false,
            onFiles: (files) => this.processSelectedFile(files[0], 'back'),
        });

        this._bindChildActionStopPropagation(this.dom.btnCameraFront, () => this.handleCameraCapture('front'));
        this._bindChildActionStopPropagation(this.dom.btnCameraBack, () => this.handleCameraCapture('back'));
        this._bindChildActionStopPropagation(this.dom.btnUploadFront, () => this.dom.fileInputFront?.click());
        this._bindChildActionStopPropagation(this.dom.btnUploadBack, () => this.dom.fileInputBack?.click());

        this.dom.btnRotateFront?.addEventListener('click', () => this.imageHandler.rotate('front', 90));
        this.dom.btnRotateBack?.addEventListener('click', () => this.imageHandler.rotate('back', 90));
        this.dom.btnCropFront?.addEventListener('click', () => this.openCropModal('front'));
        this.dom.btnCropBack?.addEventListener('click', () => this.openCropModal('back'));
        this.dom.btnDeleteFront?.addEventListener('click', () => this.imageHandler.resetSide('front'));
        this.dom.btnDeleteBack?.addEventListener('click', () => this.imageHandler.resetSide('back'));

        this.dom.btnPrevDoc?.addEventListener('click', () => {
            this.imageHandler.prevDocument();
            this.updateBatchUI();
        });
        this.dom.btnNextDoc?.addEventListener('click', () => {
            this.imageHandler.nextDocument();
            this.updateBatchUI();
        });
        this.dom.btnAddDoc?.addEventListener('click', () => {
            this.imageHandler.addDocument();
            this.updateBatchUI();
        });
        this.dom.btnDeleteDoc?.addEventListener('click', async () => {
            const confirmed = await confirmDialog({
                title: msg('Eliminar documento', 'Delete document'),
                message: msg(
                    '¿Eliminar este documento completo (anverso y reverso)?',
                    'Delete this entire ID document (front and back)?'
                ),
                confirmLabel: msg('Eliminar', 'Delete'),
                danger: true,
            });
            if (confirmed) {
                this.imageHandler.deleteCurrentDocument();
                this.updateBatchUI();
                ToastManager.info(msg('Documento eliminado.', 'Document deleted.'));
            }
        });

        this.dom.filterSelectFront?.addEventListener('change', (e) =>
            this.imageHandler.setFilter('front', e.target.value)
        );
        this.dom.filterSelectBack?.addEventListener('change', (e) =>
            this.imageHandler.setFilter('back', e.target.value)
        );

        this.dom.brightnessSliderFront?.addEventListener('input', (e) => {
            const val = e.target.value;
            this._scheduleSliderReprocess('bright-front', () => this.imageHandler.setBrightness('front', val));
        });
        this.dom.brightnessSliderBack?.addEventListener('input', (e) => {
            const val = e.target.value;
            this._scheduleSliderReprocess('bright-back', () => this.imageHandler.setBrightness('back', val));
        });
        this.dom.contrastSliderFront?.addEventListener('input', (e) => {
            const val = e.target.value;
            this._scheduleSliderReprocess('contrast-front', () => this.imageHandler.setContrast('front', val));
        });
        this.dom.contrastSliderBack?.addEventListener('input', (e) => {
            const val = e.target.value;
            this._scheduleSliderReprocess('contrast-back', () => this.imageHandler.setContrast('back', val));
        });

        this.dom.selectPaperFormat?.addEventListener('change', (e) => {
            this.currentSettings.format = e.target.value;
            this.updatePaperPreview();
        });
        this.dom.selectCardSize?.addEventListener('change', (e) => {
            this.currentSettings.cardSize = e.target.value;
            this.updatePaperPreview();
        });

        this.dom.btnDownload?.addEventListener('click', () => this.handleDownload());
        this.dom.btnPrint?.addEventListener('click', () => this.handlePrint());
    }

    async processSelectedFile(file, side) {
        if (!file || AppState.busy) return;
        this.hideAlert();
        AppState.setBusy(true);
        ProgressModal.open({
            title: msg('Procesando imagen...', 'Processing image...'),
            detail: file.name,
            cancellable: false,
        });

        try {
            await this.imageHandler.loadFile(file, side);
            ToastManager.success(
                side === 'front'
                    ? msg('Imagen del anverso cargada.', 'Front image loaded.')
                    : msg('Imagen del reverso cargada.', 'Back image loaded.')
            );
        } catch (err) {
            const message = err?.message || msg('Error al procesar la imagen.', 'Error processing image.');
            this.showAlert(message);
            ToastManager.error(message);
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
        }
    }

    async handleCameraCapture(side) {
        this.hideAlert();
        await this.cameraService.start(
            side,
            async (captureResult) => {
                try {
                    await this.imageHandler.loadDataUrl(
                        captureResult.dataUrl,
                        side,
                        `foto_${side}_${Date.now()}.jpg`
                    );
                    this.openCropModal(side);
                } catch (err) {
                    ToastManager.error(
                        err?.message || msg('No se pudo procesar la foto capturada.', 'Could not process captured photo.')
                    );
                }
            },
            () => {}
        );
    }

    async openCropModal(side) {
        const sideData = this.imageHandler.getSide(side);
        if (!sideData.isLoaded || !sideData.rawSource) return;

        let cropSource = sideData.rawSource;
        try {
            cropSource = await rotateImageElementForCrop(sideData.rawSource, sideData.rotation);
        } catch (err) {
            ToastManager.error(err?.message || msg('Error al preparar recorte.', 'Error preparing crop.'));
            return;
        }

        this.cropService.open(
            cropSource,
            async (cropResult) => {
                try {
                    await this.imageHandler.applyCropResult(side, cropResult);
                    ToastManager.success(msg('Recorte aplicado.', 'Crop applied.'));
                } catch (err) {
                    ToastManager.error(err?.message || msg('Error al aplicar el recorte.', 'Error applying crop.'));
                }
            },
            () => {}
        );
    }

    subscribeToState() {
        this.imageHandler.onChange((side, sideState) => {
            this.updateSideUI(side, sideState);
            this.updatePaperPreview();
        });
    }

    updateBatchUI() {
        const total = this.imageHandler.documents.length;
        const current = this.imageHandler.currentIndex + 1;
        if (this.dom.batchCounter) {
            this.dom.batchCounter.textContent = `Doc ${current} / ${total}`;
        }
        if (this.dom.btnPrevDoc) this.dom.btnPrevDoc.disabled = current === 1;
        if (this.dom.btnNextDoc) this.dom.btnNextDoc.disabled = current === total;
        if (this.dom.btnDeleteDoc) {
            this.dom.btnDeleteDoc.classList.toggle('hidden', total <= 1);
        }

        this.updateSideUI('front', this.imageHandler.sides.front);
        this.updateSideUI('back', this.imageHandler.sides.back);
        this.updatePaperPreview();
    }

    updateSideUI(side, state) {
        const isFront = side === 'front';
        const emptyState = isFront ? this.dom.emptyStateFront : this.dom.emptyStateBack;
        const loadedState = isFront ? this.dom.loadedStateFront : this.dom.loadedStateBack;
        const thumbImg = isFront ? this.dom.thumbImgFront : this.dom.thumbImgBack;
        const fileName = isFront ? this.dom.fileNameFront : this.dom.fileNameBack;
        const filterSelect = isFront ? this.dom.filterSelectFront : this.dom.filterSelectBack;
        const brightnessSlider = isFront ? this.dom.brightnessSliderFront : this.dom.brightnessSliderBack;
        const contrastSlider = isFront ? this.dom.contrastSliderFront : this.dom.contrastSliderBack;

        if (state.isLoaded && state.processedDataUrl) {
            emptyState?.classList.add('hidden');
            loadedState?.classList.remove('hidden');
            if (thumbImg) thumbImg.src = state.processedDataUrl;
            if (fileName) {
                fileName.textContent =
                    state.fileName || (isFront ? msg('Anverso', 'Front') : msg('Reverso', 'Back'));
            }
            if (filterSelect) filterSelect.value = state.filter;
            if (brightnessSlider) brightnessSlider.value = String(state.brightness);
            if (contrastSlider) contrastSlider.value = String(state.contrast);
        } else {
            emptyState?.classList.remove('hidden');
            loadedState?.classList.add('hidden');
            if (thumbImg) thumbImg.removeAttribute('src');
        }
    }

    updatePaperPreview() {
        const formatKey = this.currentSettings.format;
        const pageFormat = CEDULA_CONFIG.PAGE_FORMATS[formatKey] || CEDULA_CONFIG.PAGE_FORMATS.letter;
        const cardSizeKey = this.currentSettings.cardSize;
        const cardConfig = CEDULA_CONFIG.CARD_SIZES[cardSizeKey] || CEDULA_CONFIG.CARD_SIZES.standard;
        const cardWidthMm = cardConfig.width;

        if (this.dom.paperSheet) {
            this.dom.paperSheet.style.aspectRatio = `${pageFormat.width} / ${pageFormat.height}`;
            this.dom.paperSheet.style.justifyContent = 'center';
        }

        const applyCardPreview = (sideState, container, imgEl, placeholderEl) => {
            if (sideState.isLoaded && sideState.processedDataUrl) {
                const dim = calculateProportionalDimensions(
                    sideState.width,
                    sideState.height,
                    cardWidthMm,
                    CEDULA_CONFIG.DEFAULTS.maxCardHeight
                );
                const widthPct = (dim.width / pageFormat.width) * 100;
                if (container) {
                    container.style.width = `${widthPct.toFixed(2)}%`;
                    container.style.aspectRatio = `${dim.width} / ${dim.height}`;
                }
                if (imgEl) {
                    imgEl.src = sideState.processedDataUrl;
                    imgEl.classList.remove('hidden');
                }
                placeholderEl?.classList.add('hidden');
            } else {
                const widthPct = (cardWidthMm / pageFormat.width) * 100;
                if (container) {
                    container.style.width = `${widthPct.toFixed(2)}%`;
                    container.style.aspectRatio = '85.6 / 53.98';
                }
                if (imgEl) {
                    imgEl.removeAttribute('src');
                    imgEl.classList.add('hidden');
                }
                placeholderEl?.classList.remove('hidden');
            }
        };

        const front = this.imageHandler.getSide('front');
        const back = this.imageHandler.getSide('back');

        applyCardPreview(
            front,
            this.dom.previewFrontContainer,
            this.dom.previewImgFront,
            this.dom.placeholderFront
        );
        applyCardPreview(
            back,
            this.dom.previewBackContainer,
            this.dom.previewImgBack,
            this.dom.placeholderBack
        );

        this.dom.watermarkText?.classList.toggle('hidden', front.isLoaded || back.isLoaded);
    }

    handleDownload() {
        this._flushPendingSliders();
        if (!this.imageHandler.hasAnySide()) {
            const warning = msg(
                'Sube o toma foto de al menos una cara de la cédula.',
                'Upload or capture at least one side of the ID card.'
            );
            this.showAlert(warning);
            ToastManager.warning(warning);
            return;
        }

        this.hideAlert();
        AppState.setBusy(true);
        ProgressModal.open({
            title: msg('Generando PDF en alta definición...', 'Generating HD PDF...'),
            cancellable: false,
        });

        try {
            const { blob, pagesAdded } = CedulaPDFService.buildDocument(
                this.imageHandler,
                this.currentSettings
            );
            const filename = buildOutputName({
                originalName: 'cedula_escaneada',
                suffix: 'hd',
                pageCount: pagesAdded,
            });
            BlobRegistry.downloadBlob(blob, filename);
            ToastManager.success(t('toast_saved_pdf', { name: filename }));
        } catch (err) {
            const message = err?.message || msg('Error al generar el PDF.', 'Error generating PDF.');
            this.showAlert(message);
            ToastManager.error(message);
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
        }
    }

    handlePrint() {
        this._flushPendingSliders();
        if (!this.imageHandler.hasAnySide()) {
            const warning = msg(
                'Sube o toma foto de al menos una cara de la cédula.',
                'Upload or capture at least one side of the ID card.'
            );
            this.showAlert(warning);
            ToastManager.warning(warning);
            return;
        }

        this.hideAlert();
        AppState.setBusy(true);
        ProgressModal.open({
            title: msg('Preparando impresión...', 'Preparing print...'),
            cancellable: false,
        });

        try {
            const { blob } = CedulaPDFService.buildDocument(this.imageHandler, this.currentSettings);
            PrintService.printPdfBlob(blob);
        } catch (err) {
            const message = err?.message || msg('Error al preparar impresión.', 'Error preparing print.');
            this.showAlert(message);
            ToastManager.error(message);
        } finally {
            ProgressModal.close();
            AppState.setBusy(false);
        }
    }

    showAlert(message) {
        if (!this.dom.globalAlert) return;
        this.dom.globalAlert.textContent = String(message ?? '');
        this.dom.globalAlert.classList.remove('hidden');
    }

    hideAlert() {
        if (!this.dom.globalAlert) return;
        this.dom.globalAlert.textContent = '';
        this.dom.globalAlert.classList.add('hidden');
    }

    cleanupOnDeactivate() {
        this.cameraService.stopAndClose();
        this.cropService.close(false);
    }
}

let initialized = false;

/**
 * Initializes the ID Card (Cédula) Scanner tool (`#section-cedula`) exactly once.
 */
export function initCedulaTool() {
    if (initialized) return;
    initialized = true;

    const imageHandler = new CedulaImageHandler();
    const uiController = new CedulaUIController(imageHandler);
    uiController.init();

    AppState.registerTool('cedula', {
        onActivate: () => {
            uiController.updatePaperPreview();
        },
        onDeactivate: () => {
            uiController.cleanupOnDeactivate();
        },
    });
}
