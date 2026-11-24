/**
 * Tracks created ObjectURLs by scope and guarantees deterministic revocation
 * to prevent memory leaks across repeated renders, resets, and downloads.
 */
class BlobRegistryService {
    constructor() {
        /** @type {Map<string, Set<string>>} */
        this._scopes = new Map();
    }

    /**
     * Creates and registers an ObjectURL for a Blob under a tool scope.
     * @param {Blob} blob
     * @param {string} [scope='global']
     * @returns {string}
     */
    create(blob, scope = 'global') {
        const url = URL.createObjectURL(blob);
        if (!this._scopes.has(scope)) {
            this._scopes.set(scope, new Set());
        }
        this._scopes.get(scope).add(url);
        return url;
    }

    /**
     * Revokes a single registered ObjectURL immediately.
     * @param {string | null | undefined} url
     */
    revokeUrl(url) {
        if (!url || typeof url !== 'string') return;
        for (const urls of this._scopes.values()) {
            urls.delete(url);
        }
        try {
            URL.revokeObjectURL(url);
        } catch {
            // Ignore already-revoked or non-object URLs
        }
    }

    /**
     * Revokes all ObjectURLs registered under the given scope.
     * @param {string} scope
     */
    revokeScope(scope) {
        const urls = this._scopes.get(scope);
        if (!urls) return;
        for (const url of urls) {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // Ignore
            }
        }
        urls.clear();
        this._scopes.delete(scope);
    }

    /**
     * Revokes every registered ObjectURL across all scopes.
     */
    revokeAll() {
        for (const scope of Array.from(this._scopes.keys())) {
            this.revokeScope(scope);
        }
    }

    /**
     * Triggers a browser file download from a Blob and revokes the temporary URL.
     * @param {Blob} blob
     * @param {string} filename
     */
    downloadBlob(blob, filename) {
        const url = this.create(blob, '__download__');
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => this.revokeUrl(url), 2500);
    }
}

export const BlobRegistry = new BlobRegistryService();
