/**
 * Centralized application state and reactive event bus.
 */
class AppStateStore {
    constructor() {
        const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null;
        const storedTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
        const prefersDark =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches;

        this.state = {
            activeTool: 'home',
            lang: storedLang === 'en' ? 'en' : 'es',
            theme: storedTheme === 'dark' || (!storedTheme && prefersDark) ? 'dark' : 'light',
            sidebarCollapsed:
                typeof localStorage !== 'undefined' && localStorage.getItem('sidebarCollapsed') === 'true',
            busy: false,
        };

        this._listeners = new Map();
        this._tools = new Map();
    }

    get activeTool() {
        return this.state.activeTool;
    }

    get lang() {
        return this.state.lang;
    }

    get theme() {
        return this.state.theme;
    }

    get sidebarCollapsed() {
        return this.state.sidebarCollapsed;
    }

    get busy() {
        return this.state.busy;
    }

    on(event, handler) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(handler);
        return () => this.off(event, handler);
    }

    off(event, handler) {
        this._listeners.get(event)?.delete(handler);
    }

    emit(event, payload) {
        const handlers = this._listeners.get(event);
        if (!handlers) return;
        for (const handler of handlers) {
            try {
                handler(payload);
            } catch (err) {
                console.error(`[AppState] Listener error for "${event}":`, err);
            }
        }
    }

    registerTool(toolId, controller) {
        this._tools.set(toolId, controller);
    }

    getTool(toolId) {
        return this._tools.get(toolId);
    }

    setActiveTool(toolId) {
        if (this.state.activeTool === toolId) {
            this.emit('tool:reselected', toolId);
            return;
        }
        const prev = this.state.activeTool;
        const prevCtrl = this._tools.get(prev);
        if (prevCtrl && typeof prevCtrl.onDeactivate === 'function') {
            prevCtrl.onDeactivate();
        }
        this.state.activeTool = toolId;
        const nextCtrl = this._tools.get(toolId);
        if (nextCtrl && typeof nextCtrl.onActivate === 'function') {
            nextCtrl.onActivate();
        }
        this.emit('tool:changed', { from: prev, to: toolId });
    }

    setLang(lang) {
        const normalized = lang === 'en' ? 'en' : 'es';
        this.state.lang = normalized;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('lang', normalized);
        }
        this.emit('lang:changed', normalized);
    }

    setTheme(theme) {
        const normalized = theme === 'dark' ? 'dark' : 'light';
        this.state.theme = normalized;
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('theme', normalized);
        }
        this.emit('theme:changed', normalized);
    }

    setSidebarCollapsed(collapsed) {
        this.state.sidebarCollapsed = Boolean(collapsed);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('sidebarCollapsed', String(this.state.sidebarCollapsed));
        }
        this.emit('sidebar:changed', this.state.sidebarCollapsed);
    }

    setBusy(busy) {
        this.state.busy = Boolean(busy);
        this.emit('busy:changed', this.state.busy);
    }
}

export const AppState = new AppStateStore();
