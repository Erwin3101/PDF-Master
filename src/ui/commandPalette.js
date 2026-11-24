import { CATEGORIES, TOOL_LIST } from '../core/config.js';
import { t } from '../core/i18n.js';
import { AppState } from '../core/state.js';
import { trapModalFocus } from './modalFocus.js';

let selectHandler = (toolId) => AppState.setActiveTool(toolId);
let listenersBound = false;
let isOpen = false;
let selectedIndex = 0;
let currentResults = [];
let previousFocus = null;

/**
 * Normalizes strings for accent-insensitive, case-insensitive matching.
 * @param {string} value
 * @returns {string}
 */
function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Resolves the localized category label for a category id.
 * @param {string} categoryId
 * @returns {string}
 */
function getCategoryLabel(categoryId) {
    const cat = CATEGORIES.find((item) => item.id === categoryId);
    return cat ? t(cat.labelKey) : categoryId;
}

/**
 * Filters and ranks `TOOL_LIST` entries against the search query.
 * @param {string} rawQuery
 * @returns {typeof TOOL_LIST}
 */
function searchTools(rawQuery) {
    const normalized = normalizeSearchText(rawQuery);
    if (!normalized) {
        return [...TOOL_LIST];
    }

    const terms = normalized.split(/\s+/).filter(Boolean);
    const scored = [];

    for (const tool of TOOL_LIST) {
        const title = normalizeSearchText(t(tool.titleKey));
        const desc = normalizeSearchText(t(tool.descKey));
        const sectTitle = tool.sectTitleKey ? normalizeSearchText(t(tool.sectTitleKey)) : '';
        const catLabel = normalizeSearchText(getCategoryLabel(tool.category));
        const keywords = Array.isArray(tool.keywords) ? tool.keywords.map(normalizeSearchText).join(' ') : '';
        const haystack = `${title} ${sectTitle} ${desc} ${keywords} ${catLabel} ${tool.id}`;

        const allMatch = terms.every((term) => haystack.includes(term));
        if (!allMatch) continue;

        let score = 0;
        if (title.startsWith(normalized)) score += 100;
        else if (title.includes(normalized)) score += 60;
        else if (keywords.includes(normalized)) score += 35;
        else if (desc.includes(normalized)) score += 15;

        scored.push({ tool, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((entry) => entry.tool);
}

/**
 * Updates active highlight and ARIA selection across `#cmdk-results` options.
 */
function syncSelectionHighlight() {
    const resultsEl = document.getElementById('cmdk-results');
    if (!resultsEl) return;

    const options = resultsEl.querySelectorAll('[data-index]');
    for (const option of options) {
        const idx = Number(option.getAttribute('data-index'));
        const active = idx === selectedIndex;
        option.classList.toggle('is-active', active);
        option.classList.toggle('is-selected', active);
        option.setAttribute('aria-selected', String(active));
        if (active) {
            option.scrollIntoView({ block: 'nearest' });
        }
    }
}

/**
 * Selects a tool from the palette, closes the modal, and invokes `onSelectTool`.
 * @param {string} toolId
 */
function activateTool(toolId) {
    closeCommandPalette();
    selectHandler(toolId);
}

/**
 * Renders filtered results into `#cmdk-results`.
 * @param {string} query
 */
function renderResults(query) {
    const resultsEl = document.getElementById('cmdk-results');
    if (!resultsEl) return;

    currentResults = searchTools(query);
    selectedIndex = 0;

    if (currentResults.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'cmdk-empty';
        emptyEl.textContent = t('cmdk_empty');
        resultsEl.replaceChildren(emptyEl);
        return;
    }

    const fragment = document.createDocumentFragment();
    currentResults.forEach((tool, idx) => {
        const itemBtn = document.createElement('button');
        itemBtn.type = 'button';
        itemBtn.className = idx === 0 ? 'cmdk-item is-active is-selected' : 'cmdk-item';
        itemBtn.setAttribute('role', 'option');
        itemBtn.setAttribute('aria-selected', String(idx === 0));
        itemBtn.dataset.toolId = tool.id;
        itemBtn.dataset.index = String(idx);

        const iconWrap = document.createElement('span');
        iconWrap.className = `cmdk-item-icon accent-${tool.accent}`;
        iconWrap.dataset.accent = tool.accent;
        iconWrap.setAttribute('aria-hidden', 'true');
        const iconEl = document.createElement('i');
        iconEl.setAttribute('data-lucide', tool.icon);
        iconWrap.appendChild(iconEl);

        const textWrap = document.createElement('span');
        textWrap.className = 'cmdk-item-text';

        const titleEl = document.createElement('span');
        titleEl.className = 'cmdk-item-title';
        titleEl.textContent = t(tool.titleKey);

        const descEl = document.createElement('span');
        descEl.className = 'cmdk-item-desc';
        descEl.textContent = t(tool.descKey);

        textWrap.appendChild(titleEl);
        textWrap.appendChild(descEl);

        const catBadge = document.createElement('span');
        catBadge.className = 'cmdk-item-cat';
        catBadge.textContent = getCategoryLabel(tool.category);

        itemBtn.appendChild(iconWrap);
        itemBtn.appendChild(textWrap);
        itemBtn.appendChild(catBadge);

        itemBtn.addEventListener('mouseenter', () => {
            if (selectedIndex !== idx) {
                selectedIndex = idx;
                syncSelectionHighlight();
            }
        });

        itemBtn.addEventListener('click', () => {
            activateTool(tool.id);
        });

        fragment.appendChild(itemBtn);
    });

    resultsEl.replaceChildren(fragment);
    globalThis.lucide?.createIcons?.();
}

/**
 * Opens the command palette modal and focuses `#cmdk-input`.
 */
export function openCommandPalette() {
    if (AppState.busy || document.querySelector('.modal-backdrop.is-open:not(#cmdk-modal)')) {
        return;
    }

    const modal = document.getElementById('cmdk-modal');
    const input = document.getElementById('cmdk-input');
    if (!modal) return;

    if (!isOpen) {
        previousFocus = document.activeElement;
    }
    isOpen = true;

    modal.classList.remove('hidden');
    modal.classList.add('is-open');
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');

    if (input) {
        input.value = '';
        input.setAttribute('placeholder', t('cmdk_placeholder'));
    }

    renderResults('');

    if (input) {
        requestAnimationFrame(() => {
            input.focus({ preventScroll: true });
        });
    }
}

/**
 * Closes the command palette modal and restores prior focus.
 */
export function closeCommandPalette() {
    const modal = document.getElementById('cmdk-modal');
    if (!modal) return;

    isOpen = false;
    modal.classList.remove('is-open');
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');

    if (previousFocus && typeof previousFocus.focus === 'function' && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;
}

/**
 * Initializes command palette shortcuts (`Ctrl+K` / `Cmd+K`), triggers,
 * search filtering, and keyboard navigation.
 * @param {object} [options]
 * @param {(toolId: string) => void} [options.onSelectTool]
 */
export function initCommandPalette({ onSelectTool } = {}) {
    if (typeof onSelectTool === 'function') {
        selectHandler = onSelectTool;
    }

    if (listenersBound) return;
    listenersBound = true;

    const modal = document.getElementById('cmdk-modal');
    const input = document.getElementById('cmdk-input');

    document.getElementById('btn-open-cmdk')?.addEventListener('click', openCommandPalette);
    document.getElementById('home-search-trigger')?.addEventListener('click', openCommandPalette);

    modal?.addEventListener('click', (event) => {
        const target = event.target;
        if (
            target === modal ||
            (target instanceof Element &&
                (target.classList.contains('modal-backdrop') || target.hasAttribute('data-close-cmdk')))
        ) {
            closeCommandPalette();
        }
    });

    input?.addEventListener('input', () => {
        renderResults(input.value);
    });

    input?.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (currentResults.length === 0) return;
            selectedIndex = (selectedIndex + 1) % currentResults.length;
            syncSelectionHighlight();
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (currentResults.length === 0) return;
            selectedIndex = (selectedIndex - 1 + currentResults.length) % currentResults.length;
            syncSelectionHighlight();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const chosen = currentResults[selectedIndex];
            if (chosen) {
                activateTool(chosen.id);
            }
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeCommandPalette();
        }
    });

    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            if (isOpen) {
                closeCommandPalette();
            } else {
                openCommandPalette();
            }
            return;
        }

        if (!isOpen) return;

        if (trapModalFocus(event, document.getElementById('cmdk-modal'))) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeCommandPalette();
        }
    });

    AppState.on('lang:changed', () => {
        if (!isOpen) return;
        const currentInput = document.getElementById('cmdk-input');
        if (currentInput) {
            currentInput.setAttribute('placeholder', t('cmdk_placeholder'));
        }
        renderResults(currentInput?.value || '');
    });
}
