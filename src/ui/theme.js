import { AppState } from '../core/state.js';

let isInitialized = false;

/**
 * Applies the given theme ('dark' | 'light') to the document root and updates
 * the theme toggle button icon visibility.
 * @param {'dark'|'light'} theme
 */
function applyTheme(theme) {
    const isDark = theme === 'dark';
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.classList.toggle('light', !isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';

    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (!toggleBtn) return;

    toggleBtn.setAttribute('aria-pressed', String(isDark));

    const sunIcon = toggleBtn.querySelector('.icon-sun');
    const moonIcon = toggleBtn.querySelector('.icon-moon');

    if (sunIcon) {
        sunIcon.classList.toggle('hidden', !isDark);
        sunIcon.style.display = isDark ? '' : 'none';
    }
    if (moonIcon) {
        moonIcon.classList.toggle('hidden', isDark);
        moonIcon.style.display = isDark ? 'none' : '';
    }
}

/**
 * Toggles between 'light' and 'dark' themes through AppState.
 */
export function toggleTheme() {
    const next = AppState.theme === 'dark' ? 'light' : 'dark';
    AppState.setTheme(next);
}

/**
 * Initializes theme synchronization on startup, subscribes to `theme:changed`,
 * and binds the `#btn-theme-toggle` click handler.
 */
export function initTheme() {
    applyTheme(AppState.theme);

    if (!isInitialized) {
        isInitialized = true;
        AppState.on('theme:changed', applyTheme);
        const toggleBtn = document.getElementById('btn-theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }
    }
}
