import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/modular/sortable.esm.js';

/**
 * Centralized Drag & Drop manager that guarantees a single Sortable instance
 * per container and synchronizes item arrays strictly by unique item `id`.
 */
class DragSortService {
    constructor() {
        /** @type {Map<HTMLElement, Sortable>} */
        this._instances = new Map();
    }

    /**
     * Attaches (or cleanly replaces) Sortable on `containerEl`.
     * @param {HTMLElement | null} containerEl
     * @param {object} options
     * @param {() => Array<{id: string|number}>} options.getItems
     * @param {(items: Array<any>) => void} options.setItems
     * @param {(items: Array<any>) => void} [options.onReorder]
     * @param {string} [options.draggable='[data-id]']
     * @param {string} [options.handle]
     */
    attach(containerEl, { getItems, setItems, onReorder, draggable = '[data-id]', handle } = {}) {
        if (!containerEl) return null;

        // Destroy any existing instance on this container to prevent duplicate listeners
        this.destroy(containerEl);

        const instance = new Sortable(containerEl, {
            animation: 160,
            draggable,
            handle: handle || undefined,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            delay: 90,
            delayOnTouchOnly: true,
            touchStartThreshold: 4,
            filter: 'button, input, select, textarea, a, label, [data-no-drag]',
            preventOnFilter: false,
            onEnd: () => {
                const currentItems = getItems();
                const byId = new Map(currentItems.map((item) => [String(item.id), item]));
                const orderedIds = Array.from(containerEl.children)
                    .map((child) => child.getAttribute('data-id'))
                    .filter((id) => id !== null && byId.has(id));

                const reordered = orderedIds.map((id) => byId.get(id));
                setItems(reordered);
                if (typeof onReorder === 'function') {
                    onReorder(reordered);
                }
            },
        });

        this._instances.set(containerEl, instance);
        return instance;
    }

    /**
     * Destroys the Sortable instance bound to `containerEl`, if any.
     * @param {HTMLElement | null} containerEl
     */
    destroy(containerEl) {
        if (!containerEl) return;
        const existing = this._instances.get(containerEl);
        if (existing) {
            try {
                existing.destroy();
            } catch {
                // Ignore if DOM already detached
            }
            this._instances.delete(containerEl);
        }
    }

    /**
     * Destroys all active Sortable instances.
     */
    destroyAll() {
        for (const el of Array.from(this._instances.keys())) {
            this.destroy(el);
        }
    }
}

export const DragSortManager = new DragSortService();
