# Changelog

## v6.0.1 — 2026-11-24

- **Corrección en Escáner Formato Cédula (`src/tools/cedula.js`)**: restaurada la función `rotateImageElementForCrop` para pre-hornear la rotación activa al abrir el modal de recorte y evitar doble rotación tras aplicar cambios; flujo completo rotación + recorte + guarda `Ctrl+K` + exportación PDF verificado en vivo en navegador sin errores.

## v6.0.0 — 2026-11-24

Modernización arquitectónica completa, corrección integral de bugs conocidos y ocultos, y rediseño Workspace 2026 100% del lado del cliente compatible con GitHub Pages sin paso de compilación (*Native ES Modules*).

### Arquitectura Core & UI (`src/core/`, `src/ui/`, `styles/`)
- **ES Modules nativos sin duplicados**: eliminación del monolito heredado (`scripts/main.js`, `styles/main.css`) y fijación de una única versión por dependencia CDN (`pdfjs-dist@4.10.38`, `pdf-lib@1.17.1`, `jspdf@2.5.2`, `jszip@3.10.1`, `sortablejs@1.15.6`, `heic2any@0.0.4`, `utif@3.1.0`, `tesseract.js@5.1.1`, `lucide@0.469.0`).
- **Design System & Workspace 2026** (`styles/tokens.css`, `styles/layout.css`, `styles/components.css`, `styles/tools.css`): barra lateral colapsable por categorías, drawer móvil, paleta claro/oscuro sin FOUC, búsqueda rápida con `Ctrl+K` / `Cmd+K` (`commandPalette.js`) y vista previa amplia en vivo.
- **Ciclo de vida y memoria**:
  - `BlobRegistry` (`src/core/blobRegistry.js`): registro por ámbito con revocación determinista de Object URLs.
  - `DragSortManager` (`src/core/dragSortManager.js`): instancia única `Sortable` por contenedor que destruye instancias previas antes de re-enlazar y sincroniza exclusivamente por `data-id`.
  - `ToastManager`, `ProgressModal` (`AbortController`) y `confirmDialog`: reemplazo completo de `alert()` / `confirm()` / `prompt()` nativos, con trampa de foco `Tab` (`modalFocus.js`) y atributos ARIA (`role="dialog"`, `aria-modal="true"`).
  - `PrintService` (`src/core/printService.js`): impresión mediante `iframe` oculto con descarga de respaldo si el navegador restringe la vista previa.
  - `FileNaming` (`src/core/fileNaming.js`) & `fileLoader.js`: nombres descriptivos sanitizados, detección robusta PDF/HEIC/TIFF/imagen y limpieza de `loadingTask` / lienzos temporales.
- **Bilingüismo completo ES/EN** (`src/core/i18n.js`): diccionario sincronizado y verificado automáticamente para navegación, modales, las 14 herramientas y etiquetas de salida.

### Módulos Prioritarios
- **Póster Gigante 2.0 (`src/tools/poster.js`, `src/core/geometry.js`)**: cálculo geométrico sin distorsión (`Contain` / `Cover`) en Carta, Legal, A4, A3 y Tabloide con orientación vertical, horizontal o automática; coordenadas enteras en Canvas; solape configurable (0–15 mm), marcas finas de corte y unión, etiquetas de referencia (`F1-C2 · Pág`), exportación optimizada en JPEG y panel de retoque en tiempo real (Brillo, Contraste, Saturación, Temperatura y presets).
- **Organizar / Dividir y Unir PDF (`src/tools/split.js`, `src/tools/merge.js`)**: ordenación exacta por `id` único tras arrastrar, selección múltiple, extracción por rangos (`1-3, 5, 8-10`), inversión de orden, duplicación, rotación independiente por ocurrencia e historial Deshacer (`Ctrl+Z`).
- **Imagen a PDF + Duplicar 2×1 (`src/tools/img2pdf.js`)**: paridad milimétrica 1:1 entre vista previa en Canvas y generación `jsPDF`, presets de margen reales (`2 mm`, `5 mm`, `10 mm`), espacio central (`0–15 mm`) y guía profesional de corte con tijeras opcionales y etiqueta bilingüe.

### Herramientas Modernizadas (`src/tools/`)
- **Comprimir PDF (`compress.js`)**: preserva las dimensiones reales de cada página (Carta/Legal/A4/mixto), aplica límite seguro de escala (`clampPdfRenderScale`) y muestra comparativa Antes → Después y porcentaje real.
- **Resumir N-Up (`nup.js`)**: soporta 2, 4, 6 y 9 páginas por hoja con selección de papel/orientación y compensación de páginas con `/Rotate`.
- **OCR Multipágina (`ocr.js`)**: extracción multipágina con selección de rango, portapapeles moderno (`navigator.clipboard`), cancelación real con terminación segura del Web Worker y limpieza UI consistente.
- **Marca de Agua (`watermark.js`) & Números de Página (`pageNumbers.js`)**: alineación y rotación exactas incluso en páginas PDF con `/Rotate` de 90°/180°/270°.
- **Firmar PDF (`sign.js`)**: dibujo (aspecto `480/180` sin deformación), texto cursivo o imagen; transformación exacta sobre páginas rotadas; tokens anti-carrera al paginar.
- **Escáner Cédula (`cedula.js`)**: anverso/reverso proporcional (ISO 85.6 mm), lotes multipágina, sincronización rotación-recorte y gestión segura de cámara/modales.
- **Mejorar Escaneo (`scanEnhancer.js`), Collage (`collage.js`) y PDF a Imágenes (`pdf2img.js`)**: filtros adaptativos y de contraste en vivo, plantillas de mosaico, render progresivo cancelable conservando resultados previos y exportación ZIP.

### Pruebas
- Suite unitaria en `tests/core.test.mjs` (`node --test tests/core.test.mjs`) cubriendo papel, `computeContainRect`, `computePosterLayout`, `computeDuplicate2x1Layout`, `clampPdfRenderScale`, `fileNaming`, `AppState` y paridad de claves ES/EN.
