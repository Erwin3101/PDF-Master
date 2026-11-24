import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
import { CDN_URLS } from './config.js';
import { BlobRegistry } from './blobRegistry.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = CDN_URLS.pdfjsWorker;

export { pdfjsLib };

export class FileLoadError extends Error {
    /**
     * @param {'EMPTY'|'UNSUPPORTED'|'PDF_ENCRYPTED'|'PDF_CORRUPT'|'IMAGE_CORRUPT'|'HEIC_FAILED'|'TIFF_FAILED'} code
     * @param {string} message
     * @param {unknown} [cause]
     */
    constructor(code, message, cause) {
        super(message);
        this.name = 'FileLoadError';
        this.code = code;
        this.cause = cause;
    }
}

/**
 * Reads a Blob/File into a DataURL.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Loads an HTMLImageElement from a DataURL or ObjectURL.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (!img.naturalWidth || !img.naturalHeight) {
                reject(new FileLoadError('IMAGE_CORRUPT', 'Imagen vacía o con dimensiones inválidas.'));
                return;
            }
            resolve(img);
        };
        img.onerror = (err) => reject(new FileLoadError('IMAGE_CORRUPT', 'No se pudo decodificar la imagen.', err));
        img.src = src;
    });
}

/**
 * Detects file format reliably using both extension and MIME type.
 * Never fails when Windows or browsers supply empty MIME types.
 * @param {File} file
 * @returns {'pdf'|'heic'|'tiff'|'image'|'unknown'}
 */
export function detectFileKind(file) {
    if (!file) return 'unknown';
    const name = (file.name || '').toLowerCase();
    const ext = name.includes('.') ? name.split('.').pop() : '';
    const mime = (file.type || '').toLowerCase();

    if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
    if (ext === 'heic' || ext === 'heif' || mime === 'image/heic' || mime === 'image/heif') return 'heic';
    if (ext === 'tif' || ext === 'tiff' || mime === 'image/tiff') return 'tiff';
    if (
        mime.startsWith('image/') ||
        ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif'].includes(ext)
    ) {
        return 'image';
    }
    return 'unknown';
}

/**
 * Checks whether an ArrayBuffer starts with a valid PDF header (%PDF-) within the first 1 KB.
 * @param {ArrayBuffer} buffer
 * @returns {boolean}
 */
export function hasPdfHeader(buffer) {
    if (!buffer || buffer.byteLength < 8) return false;
    const slice = new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength));
    const ascii = String.fromCharCode(...slice);
    return ascii.includes('%PDF-');
}

/**
 * Validates and loads a PDF File into a detached ArrayBuffer plus PDF.js & optional pdf-lib doc.
 * @param {File} file
 * @returns {Promise<{ bytes: ArrayBuffer, pdfjsDoc: import('pdfjs-dist').PDFDocumentProxy }>}
 */
export async function openPdfFile(file) {
    if (!file || file.size === 0) {
        throw new FileLoadError('EMPTY', 'El archivo PDF está vacío.');
    }
    const bytes = await file.arrayBuffer();
    if (!hasPdfHeader(bytes)) {
        throw new FileLoadError('PDF_CORRUPT', `El archivo "${file.name}" no es un PDF válido o está dañado.`);
    }

    let loadingTask = null;
    try {
        loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
        const pdfjsDoc = await loadingTask.promise;
        return { bytes, pdfjsDoc };
    } catch (err) {
        loadingTask?.destroy?.().catch(() => {});
        const msg = String(err?.message || err || '');
        if (err?.name === 'PasswordException' || /password/i.test(msg)) {
            throw new FileLoadError(
                'PDF_ENCRYPTED',
                `El PDF "${file.name}" está protegido con contraseña. Desbloquéalo antes de procesarlo.`,
                err
            );
        }
        throw new FileLoadError(
            'PDF_CORRUPT',
            `No se pudo abrir "${file.name}". El documento podría estar corrupto.`,
            err
        );
    }
}

/**
 * Loads a PDF into pdf-lib with friendly encryption/corruption errors.
 * @param {ArrayBuffer} bytes
 * @param {string} [fileName='documento.pdf']
 */
export async function loadPdfLibDocument(bytes, fileName = 'documento.pdf') {
    if (!window.PDFLib) {
        throw new Error('La librería pdf-lib no se cargó correctamente.');
    }
    try {
        return await window.PDFLib.PDFDocument.load(bytes);
    } catch (err) {
        const msg = String(err?.message || err || '');
        if (/encrypted/i.test(msg)) {
            throw new FileLoadError(
                'PDF_ENCRYPTED',
                `El PDF "${fileName}" está encriptado o protegido con contraseña.`,
                err
            );
        }
        throw new FileLoadError('PDF_CORRUPT', `No se pudo leer la estructura de "${fileName}".`, err);
    }
}

/**
 * Decodes any supported image file (JPG, PNG, WebP, BMP, HEIC/HEIF including multi-frame, TIFF/TIF)
 * into a ready-to-use DataURL + HTMLImageElement + dimensions.
 * @param {File} file
 * @returns {Promise<{ dataUrl: string, image: HTMLImageElement, width: number, height: number, name: string }>}
 */
export async function decodeImageFile(file) {
    if (!file || file.size === 0) {
        throw new FileLoadError('EMPTY', `El archivo "${file?.name || ''}" está vacío.`);
    }
    const kind = detectFileKind(file);
    let dataUrl;

    if (kind === 'heic') {
        if (typeof window.heic2any !== 'function') {
            throw new FileLoadError('HEIC_FAILED', 'Decodificador HEIC no disponible.');
        }
        try {
            const converted = await window.heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.92,
            });
            const blob = Array.isArray(converted) ? converted[0] : converted;
            if (!(blob instanceof Blob)) {
                throw new Error('Resultado HEIC inválido');
            }
            dataUrl = await blobToDataUrl(blob);
        } catch (err) {
            throw new FileLoadError('HEIC_FAILED', `No se pudo convertir la imagen HEIC "${file.name}".`, err);
        }
    } else if (kind === 'tiff') {
        if (!window.UTIF) {
            throw new FileLoadError('TIFF_FAILED', 'Decodificador TIFF no disponible.');
        }
        try {
            const ab = await file.arrayBuffer();
            const ifds = window.UTIF.decode(ab);
            if (!ifds || ifds.length === 0) {
                throw new Error('Sin frames TIFF');
            }
            window.UTIF.decodeImage(ab, ifds[0]);
            const rgba = window.UTIF.toRGBA8(ifds[0]);
            const w = ifds[0].width;
            const h = ifds[0].height;
            if (!w || !h || !rgba?.length) {
                throw new Error('Dimensiones TIFF inválidas');
            }
            const canvas = document.createElement('canvas');
            try {
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                const imgData = ctx.createImageData(w, h);
                imgData.data.set(rgba);
                ctx.putImageData(imgData, 0, 0);
                dataUrl = canvas.toDataURL('image/jpeg', 0.94);
            } finally {
                canvas.width = 0;
                canvas.height = 0;
            }
        } catch (err) {
            throw new FileLoadError('TIFF_FAILED', `No se pudo decodificar el archivo TIFF "${file.name}".`, err);
        }
    } else if (kind === 'image') {
        dataUrl = await blobToDataUrl(file);
    } else {
        throw new FileLoadError('UNSUPPORTED', `Formato no soportado: "${file.name}".`);
    }

    const image = await loadImageElement(dataUrl);
    return {
        dataUrl,
        image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        name: file.name,
    };
}

/**
 * Creates a rotated JPEG/PNG DataURL if `rotation` !== 0.
 * @param {string} srcUrl
 * @param {number} rotation
 * @param {string} [mime='image/jpeg']
 * @param {number} [quality=0.92]
 * @returns {Promise<{ dataUrl: string, width: number, height: number }>}
 */
export async function rotateImageDataUrl(srcUrl, rotation, mime = 'image/jpeg', quality = 0.92) {
    const img = await loadImageElement(srcUrl);
    const norm = ((rotation % 360) + 360) % 360;
    if (norm === 0 && mime === 'image/jpeg' && srcUrl.startsWith('data:image/jpeg')) {
        return { dataUrl: srcUrl, width: img.naturalWidth, height: img.naturalHeight };
    }
    const canvas = document.createElement('canvas');
    try {
        const ctx = canvas.getContext('2d');
        const rads = (norm * Math.PI) / 180;
        const swap = norm === 90 || norm === 270;
        canvas.width = swap ? img.naturalHeight : img.naturalWidth;
        canvas.height = swap ? img.naturalWidth : img.naturalHeight;
        if (mime === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rads);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        return {
            dataUrl: canvas.toDataURL(mime, quality),
            width: canvas.width,
            height: canvas.height,
        };
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * Renders a PDF page to an offscreen canvas with white background.
 */
export async function renderPdfPageToCanvas(pdfjsDoc, pageNum, scale = 1.5) {
    const page = await pdfjsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    page.cleanup();
    return { canvas, viewport };
}

/**
 * Releases helper URLs if created by BlobRegistry.
 */
export function releaseScopeUrls(scope) {
    BlobRegistry.revokeScope(scope);
}
