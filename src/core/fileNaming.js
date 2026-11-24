/**
 * Sanitizes base file names and constructs descriptive download filenames.
 */
export function sanitizeBaseName(fileName, fallback = 'documento') {
    if (!fileName || typeof fileName !== 'string') return fallback;
    const withoutExt = fileName.replace(/\.[^/.]+$/, '');
    const cleaned = withoutExt
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    if (!cleaned) return fallback;
    return cleaned.slice(0, 64);
}

/**
 * Formats descriptive output names such as:
 * - foto_poster_6pags.pdf
 * - credencial_duplicado_2x1.pdf
 * - contrato_comprimido.pdf
 *
 * @param {object} opts
 * @param {string} [opts.originalName]
 * @param {string} [opts.suffix]
 * @param {number} [opts.pageCount]
 * @param {string} [opts.ext='pdf']
 * @returns {string}
 */
export function buildOutputName({ originalName = '', suffix = '', pageCount = null, ext = 'pdf' } = {}) {
    const base = sanitizeBaseName(originalName, 'documento');
    const parts = [base];
    if (suffix) {
        parts.push(sanitizeBaseName(suffix, suffix));
    }
    if (Number.isInteger(pageCount) && pageCount > 0) {
        parts.push(`${pageCount}pags`);
    }
    const cleanExt = String(ext || 'pdf').replace(/^\.+/, '').toLowerCase() || 'pdf';
    return `${parts.join('_')}.${cleanExt}`;
}

/**
 * Formats byte sizes into human-readable KB or MB strings.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
