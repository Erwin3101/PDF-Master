import { CATEGORIES, TOOL_LIST } from '../core/config.js';
import { t } from '../core/i18n.js';
import { AppState } from '../core/state.js';

let selectHandler = (toolId) => AppState.setActiveTool(toolId);
let activeHomeCategory = 'all';
let listenersBound = false;

/**
 * Sets or clears mobile drawer open state on `#app-sidebar` and `#sidebar-backdrop`.
 * @param {boolean} open
 */
function setMobileDrawerOpen(open) {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const mobileBtn = document.getElementById('btn-mobile-menu');

    sidebar?.classList.toggle('is-open', open);
    if (backdrop) {
        backdrop.classList.toggle('is-open', open);
        backdrop.classList.toggle('hidden', !open);
        backdrop.setAttribute('aria-hidden', String(!open));
    }
    mobileBtn?.setAttribute('aria-expanded', String(open));
}

/**
 * Applies sidebar collapsed state onto `#app-sidebar`.
 * @param {boolean} collapsed
 */
function applyCollapsedState(collapsed) {
    const sidebar = document.getElementById('app-sidebar');
    const collapseBtn = document.getElementById('btn-sidebar-collapse');
    sidebar?.classList.toggle('is-collapsed', Boolean(collapsed));
    collapseBtn?.setAttribute('aria-expanded', String(!collapsed));
}

/**
 * Triggers tool selection and closes the mobile drawer if open.
 * @param {string} toolId
 */
function handleToolSelect(toolId) {
    setMobileDrawerOpen(false);
    selectHandler(toolId);
}

/**
 * Populates `#sidebar-nav` dynamically from `CATEGORIES` and `TOOL_LIST`.
 */
function renderSidebarNav() {
    const navEl = document.getElementById('sidebar-nav');
    if (!navEl) return;

    const fragment = document.createDocumentFragment();

    for (const category of CATEGORIES) {
        const tools = TOOL_LIST.filter((tool) => tool.category === category.id);
        if (tools.length === 0) continue;

        const groupEl = document.createElement('div');
        groupEl.className = 'sidebar-group';
        groupEl.dataset.category = category.id;

        const headingEl = document.createElement('div');
        headingEl.className = 'sidebar-group-title';
        headingEl.textContent = t(category.labelKey);
        groupEl.appendChild(headingEl);

        for (const tool of tools) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sidebar-item';
            btn.dataset.toolId = tool.id;
            btn.dataset.accent = tool.accent;

            const title = t(tool.titleKey);
            btn.setAttribute('title', title);
            btn.setAttribute('aria-label', title);

            const iconWrap = document.createElement('span');
            iconWrap.className = 'sidebar-item-icon';
            iconWrap.setAttribute('aria-hidden', 'true');
            const iconEl = document.createElement('i');
            iconEl.setAttribute('data-lucide', tool.icon);
            iconWrap.appendChild(iconEl);

            const labelEl = document.createElement('span');
            labelEl.className = 'sidebar-item-label';
            labelEl.textContent = title;

            btn.appendChild(iconWrap);
            btn.appendChild(labelEl);
            btn.addEventListener('click', () => handleToolSelect(tool.id));

            groupEl.appendChild(btn);
        }

        fragment.appendChild(groupEl);
    }

    navEl.replaceChildren(fragment);
    syncSidebarActive(AppState.activeTool);
}

/**
 * Populates `#home-category-filters` inside `#section-home`.
 */
function renderHomeCategoryFilters() {
    const filtersEl = document.getElementById('home-category-filters');
    if (!filtersEl) return;

    const homeTools = TOOL_LIST.filter((tool) => tool.showInHomeGrid !== false);
    const availableCats = CATEGORIES.filter((cat) => homeTools.some((tool) => tool.category === cat.id));

    if (activeHomeCategory !== 'all' && !availableCats.some((c) => c.id === activeHomeCategory)) {
        activeHomeCategory = 'all';
    }

    const chipSpecs = [
        { id: 'all', label: t('hero_filter_all') },
        ...availableCats.map((cat) => ({ id: cat.id, label: t(cat.labelKey) })),
    ];

    const fragment = document.createDocumentFragment();
    for (const spec of chipSpecs) {
        const isActive = activeHomeCategory === spec.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = isActive ? 'chip-btn is-active' : 'chip-btn';
        btn.dataset.category = spec.id;
        btn.setAttribute('aria-pressed', String(isActive));
        btn.textContent = spec.label;

        btn.addEventListener('click', () => {
            if (activeHomeCategory === spec.id) return;
            activeHomeCategory = spec.id;
            renderHomeCategoryFilters();
            renderHomeToolsGrid();
            window.lucide?.createIcons?.();
        });

        fragment.appendChild(btn);
    }

    filtersEl.replaceChildren(fragment);
}

/**
 * Populates `#home-tools-grid` inside `#section-home` filtered by `activeHomeCategory`.
 */
function renderHomeToolsGrid() {
    const gridEl = document.getElementById('home-tools-grid');
    if (!gridEl) return;

    const visibleTools = TOOL_LIST.filter(
        (tool) =>
            tool.showInHomeGrid !== false &&
            (activeHomeCategory === 'all' || tool.category === activeHomeCategory)
    );

    const fragment = document.createDocumentFragment();
    for (const tool of visibleTools) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'tool-card home-card';
        card.dataset.toolId = tool.id;
        card.dataset.category = tool.category;
        card.dataset.accent = tool.accent;

        const iconWrap = document.createElement('div');
        iconWrap.className = `tool-card-icon accent-${tool.accent}`;
        iconWrap.dataset.accent = tool.accent;
        iconWrap.setAttribute('aria-hidden', 'true');
        const iconEl = document.createElement('i');
        iconEl.setAttribute('data-lucide', tool.icon);
        iconWrap.appendChild(iconEl);

        const titleEl = document.createElement('h3');
        titleEl.className = 'tool-card-title';
        titleEl.textContent = t(tool.titleKey);

        const descEl = document.createElement('p');
        descEl.className = 'tool-card-desc';
        descEl.textContent = t(tool.descKey);

        card.appendChild(iconWrap);
        card.appendChild(titleEl);
        card.appendChild(descEl);
        card.addEventListener('click', () => handleToolSelect(tool.id));

        fragment.appendChild(card);
    }

    gridEl.replaceChildren(fragment);
}

/**
 * Re-renders dynamic sidebar & home grid entries and refreshes Lucide icons.
 */
function renderAllNavigation() {
    renderSidebarNav();
    renderHomeCategoryFilters();
    renderHomeToolsGrid();
    window.lucide?.createIcons?.();
}

/**
 * Synchronizes active highlight state across `#sidebar-nav` items for `toolId`.
 * @param {string} toolId
 */
export function syncSidebarActive(toolId) {
    const navEl = document.getElementById('sidebar-nav');
    if (!navEl) return;

    const items = navEl.querySelectorAll('[data-tool-id]');
    for (const item of items) {
        const isActive = item.getAttribute('data-tool-id') === toolId;
        item.classList.toggle('is-active', isActive);
        item.classList.toggle('active', isActive);
        if (isActive) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
    }
}

/**
 * Initializes sidebar navigation, collapse toggle, mobile drawer, brand button,
 * and home category filters / tools grid.
 * @param {object} [options]
 * @param {(toolId: string) => void} [options.onSelectTool]
 */
export function initSidebar({ onSelectTool } = {}) {
    if (typeof onSelectTool === 'function') {
        selectHandler = onSelectTool;
    }

    applyCollapsedState(AppState.sidebarCollapsed);
    setMobileDrawerOpen(false);
    renderAllNavigation();

    if (!listenersBound) {
        listenersBound = true;

        document.getElementById('btn-sidebar-collapse')?.addEventListener('click', () => {
            AppState.setSidebarCollapsed(!AppState.sidebarCollapsed);
        });

        document.getElementById('btn-mobile-menu')?.addEventListener('click', () => {
            const sidebar = document.getElementById('app-sidebar');
            const isOpen = Boolean(sidebar?.classList.contains('is-open'));
            setMobileDrawerOpen(!isOpen);
        });

        document.getElementById('sidebar-backdrop')?.addEventListener('click', () => {
            setMobileDrawerOpen(false);
        });

        document.getElementById('brand-home-btn')?.addEventListener('click', (event) => {
            event.preventDefault();
            handleToolSelect('home');
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                const sidebar = document.getElementById('app-sidebar');
                if (sidebar?.classList.contains('is-open')) {
                    setMobileDrawerOpen(false);
                }
            }
        });

        AppState.on('sidebar:changed', applyCollapsedState);
        AppState.on('tool:changed', ({ to }) => syncSidebarActive(to));
        AppState.on('lang:changed', renderAllNavigation);
    }
}
