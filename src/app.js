import { APP_VERSION, TOOL_LIST, getToolMeta } from './core/config.js';
import { AppState } from './core/state.js';
import { applyI18n, t } from './core/i18n.js';
import { initTheme } from './ui/theme.js';
import { initSidebar, syncSidebarActive } from './ui/sidebar.js';
import { initCommandPalette } from './ui/commandPalette.js';

import { initPosterTool } from './tools/poster.js';
import { initSplitTool } from './tools/split.js';
import { initMergeTool } from './tools/merge.js';
import { initImg2PdfTool } from './tools/img2pdf.js';
import { initCompressTool } from './tools/compress.js';
import { initNupTool } from './tools/nup.js';
import { initPdf2ImgTool } from './tools/pdf2img.js';
import { initOcrTool } from './tools/ocr.js';
import { initScanEnhancerTool } from './tools/scanEnhancer.js';
import { initCollageTool } from './tools/collage.js';
import { initWatermarkTool } from './tools/watermark.js';
import { initPageNumbersTool } from './tools/pageNumbers.js';
import { initSignTool } from './tools/sign.js';
import { initCedulaTool } from './tools/cedula.js';

const VALID_TOOL_IDS = new Set(TOOL_LIST.map((item) => item.id));

function updateActiveSectionDom(toolId) {
    const sections = document.querySelectorAll('.tool-section[id^="section-"]');
    for (const sec of sections) {
        const isTarget = sec.id === `section-${toolId}`;
        sec.classList.toggle('hidden', !isTarget);
        sec.classList.toggle('is-active', isTarget);
    }

    const meta = getToolMeta(toolId);
    const titleEl = document.getElementById('topbar-tool-title');
    if (titleEl) {
        titleEl.textContent = toolId === 'home' ? t('nav_home') : t(meta.sectTitleKey || meta.titleKey);
    }

    syncSidebarActive(toolId);
    window.scrollTo({ top: 0, behavior: 'instant' });
    window.lucide?.createIcons?.();
}

export function navigateToTool(toolId, { updateHash = true } = {}) {
    const safeId = VALID_TOOL_IDS.has(toolId) ? toolId : 'home';
    AppState.setActiveTool(safeId);
    updateActiveSectionDom(safeId);

    if (updateHash) {
        const targetHash = safeId === 'home' ? '#home' : `#${safeId}`;
        if (window.location.hash !== targetHash) {
            history.pushState(null, '', targetHash);
        }
    }
}

function getInitialToolFromHash() {
    const raw = (window.location.hash || '').replace(/^#/, '').trim();
    return VALID_TOOL_IDS.has(raw) ? raw : 'home';
}

function bootstrap() {
    const yearEl = document.getElementById('current-year');
    if (yearEl) {
        yearEl.textContent = String(new Date().getFullYear());
    }
    const versionEl = document.getElementById('app-version-badge');
    if (versionEl) {
        versionEl.textContent = `v${APP_VERSION}`;
    }

    initTheme();
    applyI18n();

    const langBtn = document.getElementById('btn-lang-toggle');
    langBtn?.addEventListener('click', () => {
        const nextLang = AppState.lang === 'es' ? 'en' : 'es';
        AppState.setLang(nextLang);
    });

    AppState.on('lang:changed', () => {
        applyI18n();
        const meta = getToolMeta(AppState.activeTool);
        const titleEl = document.getElementById('topbar-tool-title');
        if (titleEl) {
            titleEl.textContent =
                AppState.activeTool === 'home'
                    ? t('nav_home')
                    : t(meta.sectTitleKey || meta.titleKey);
        }
        window.lucide?.createIcons?.();
    });

    initSidebar({ onSelectTool: (id) => navigateToTool(id) });
    initCommandPalette({ onSelectTool: (id) => navigateToTool(id) });

    // Initialize all 14 tool modules exactly once
    initImg2PdfTool();
    initPosterTool();
    initSplitTool();
    initMergeTool();
    initCompressTool();
    initNupTool();
    initPdf2ImgTool();
    initOcrTool();
    initScanEnhancerTool();
    initCollageTool();
    initWatermarkTool();
    initPageNumbersTool();
    initSignTool();
    initCedulaTool();

    window.addEventListener('popstate', () => {
        navigateToTool(getInitialToolFromHash(), { updateHash: false });
    });

    navigateToTool(getInitialToolFromHash(), { updateHash: false });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
    bootstrap();
}
