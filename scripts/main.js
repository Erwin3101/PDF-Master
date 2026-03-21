// ==========================================
// Img options listener (from inline HTML)
// ==========================================
                            // Agregar listeners para actualizar preview al cambiar opciones
                            ['img-page-size', 'img-orientation', 'img-margin'].forEach(id => {
                                document.getElementById(id).addEventListener('change', renderImg2PdfPreview);
                            });

// ==========================================
// MAIN LOGIC BLOCK
// ==========================================
        lucide.createIcons();

        // ==========================================
        // MODO OSCURO & IDIOMA & FOOTER
        // ==========================================
        document.getElementById('current-year').textContent = new Date().getFullYear();

        // Dark Mode Logic
        function toggleDarkMode() {
            if (document.documentElement.classList.contains('dark')) {
                document.documentElement.classList.remove('dark');
                localStorage.theme = 'light';
            } else {
                document.documentElement.classList.add('dark');
                localStorage.theme = 'dark';
            }
        }

        // Language Logic
        let currentLang = localStorage.getItem('lang') || 'es';

        const translations = {
            es: {
                nav_home: "Inicio",
                nav_compress: "Comprimir",
                nav_img2pdf: "Img a PDF",
                nav_nup: "Resumir",
                nav_split: "Dividir",
                nav_merge: "Unir",
                nav_pdf2img: "PDF a Img",
                nav_bgrem: "Borrar Fondo",
                nav_all: "Todas",

                hero_title: "Suite de Herramientas <span class='text-blue-600 dark:text-blue-400'>PDF</span>",
                hero_desc: "Todas las herramientas que necesitas en un solo lugar. 100% Privado y seguro en tu navegador.",

                // Cards
                card_bgrem_title: "Borrar Fondo (IA)",
                card_bgrem_desc: "Elimina el fondo de tus imágenes con IA de forma precisa.",
                card_img2pdf_title: "Img a PDF",
                card_img2pdf_desc: "Convierte fotos a PDF.",
                card_compress_title: "Comprimir PDF",
                card_compress_desc: "Reduce el tamaño del archivo.",
                card_nup_title: "Resumir PDF",
                card_nup_desc: "Varias páginas en una.",
                card_split_title: "Dividir / Rotar",
                card_split_desc: "Elimina o rota páginas.",
                card_merge_title: "Unir PDFs",
                card_merge_desc: "Combina múltiples archivos.",
                card_pdf2img_title: "PDF a Imágenes",
                card_pdf2img_desc: "Extrae páginas como JPG.",
                card_ocr_title: "OCR / Texto",
                card_ocr_desc: "Extrae texto editable de imágenes.",
                card_scan_title: "Mejorar Escaneo",
                card_scan_desc: "Limpia y binariza fotos de documentos.",
                card_poster_title: "Póster Gigante",
                card_poster_desc: "Imprime en múltiples A4.",
                card_collage_title: "Estudio Collage",
                card_collage_desc: "Crea composiciones.",
                card_watermark_title: "Marca de Agua",
                card_watermark_desc: "Pon tu sello en todas las páginas.",
                card_pagenum_title: "Números de Pág",
                card_pagenum_desc: "Añade numeración auto.",
                card_sign_title: "Firmar PDF",
                card_sign_desc: "Dibuja y coloca tu firma.",

                // Sections Headers
                sect_compress_title: "Comprimir PDF",
                sect_compress_desc: "Reduce el tamaño de tu archivo PDF.",

                sect_img2pdf_title: "Imagen a PDF",
                sect_img2pdf_desc: "Convierte tus imágenes con opciones de personalización profesionales.",

                sect_bgrem_title: "Eliminador de Fondo (IA)",
                sect_bgrem_desc: "Sube imágenes (.jpg, .png, .webp) y elimina el fondo automáticamente con alta calidad.",

                sect_nup_title: "Resumir PDF",
                sect_nup_desc: "Junta varias páginas en una sola para ahorrar impresión.",

                sect_split_title: "Editor de Páginas",
                sect_split_desc: "Arrastra para reordenar, elimina páginas o gíralas.",

                sect_merge_title: "Unir PDFs",
                sect_merge_desc: "Combina múltiples documentos en uno solo. Arrastra para ordenar.",

                sect_pdf2img_title: "PDF a Imágenes",
                sect_pdf2img_desc: "Convierte cada página de tu PDF en una imagen JPG de alta calidad.",

                sect_ocr_title: "Reconocimiento de Texto (OCR)",
                sect_ocr_desc: "Extrae texto de imágenes escaneadas o PDFs.",

                sect_scan_title: "Mejorador de Escaneos",
                sect_scan_desc: "Optimiza fotos de documentos para impresión (Fondo blanco, texto nítido).",

                sect_poster_title: "Creador de Pósters",
                sect_poster_desc: "Imprime una imagen grande en varias hojas A4.",

                sect_collage_title: "Estudio de Collage",
                sect_collage_desc: "Combina fotos en diseños predefinidos.",

                sect_watermark_title: "Marca de Agua",
                sect_watermark_desc: "Agrega texto superpuesto a tu documento.",

                sect_pagenum_title: "Numeración de Páginas",
                sect_pagenum_desc: "Añade números de página a tu documento.",

                sect_sign_title: "Firmar PDF",
                sect_sign_desc: "Dibuja tu firma, escribe texto o sube una imagen y colócala en el PDF.",

                // Dropdown
                drop_organize: "Organizar",
                drop_convert: "Convertir",
                drop_edit: "Editar",
                drop_edit: "Editar",
                drop_others: "Otros",
                drop_ai: "IA & Edición",

                // Dropdown Tools
                drop_bgrem: "Borrar Fondo",
                drop_merge: "Unir PDF",
                drop_compress: "Comprimir",
                drop_split: "Dividir PDF",
                drop_nup: "Resumir PDF",
                drop_img2pdf: "Img a PDF",
                drop_pdf2img: "PDF a Img",
                drop_ocr: "OCR / Texto",
                drop_scan: "Mejorar Escaneo",
                drop_watermark: "Marca Agua",
                drop_pagenum: "Números Pág",
                drop_sign: "Firmar PDF",
                drop_poster: "Póster",
                drop_collage: "Collage",

                bgrem_upload_text: "Haz clic para subir imágenes",

                // Footer
                footer_rights: "Todos los derechos reservados.",
                footer_author: "Autor:"
            },
            en: {
                nav_home: "Home",
                nav_compress: "Compress",
                nav_img2pdf: "Img to PDF",
                nav_nup: "N-Up",
                nav_split: "Split",
                nav_merge: "Merge",
                nav_pdf2img: "PDF to Img",
                nav_bgrem: "Remove Background",
                nav_all: "All Tools",

                hero_title: "PDF <span class='text-blue-600 dark:text-blue-400'>Master</span> Suite",
                hero_desc: "All the tools you need in one place. 100% Private and secure in your browser.",

                card_bgrem_title: "Remove Background (AI)",
                card_bgrem_desc: "Remove the background from your images accurately with AI.",
                card_img2pdf_title: "Img to PDF",
                card_img2pdf_desc: "Convert photos to PDF.",
                card_compress_title: "Compress PDF",
                card_compress_desc: "Reduce file size.",
                card_nup_title: "N-Up PDF",
                card_nup_desc: "Multiple pages per sheet.",
                card_split_title: "Split / Rotate",
                card_split_desc: "Delete or rotate pages.",
                card_merge_title: "Merge PDFs",
                card_merge_desc: "Combine multiple files.",
                card_pdf2img_title: "PDF to Images",
                card_pdf2img_desc: "Extract pages as JPG.",
                card_ocr_title: "OCR / Text",
                card_ocr_desc: "Extract editable text.",
                card_scan_title: "Scan Enhancer",
                card_scan_desc: "Clean and binarize docs.",
                card_poster_title: "Giant Poster",
                card_poster_desc: "Print on multiple A4s.",
                card_collage_title: "Collage Studio",
                card_collage_desc: "Create compositions.",
                card_watermark_title: "Watermark",
                card_watermark_desc: "Stamp all pages.",
                card_pagenum_title: "Page Numbers",
                card_pagenum_desc: "Add auto numbering.",
                card_sign_title: "Sign PDF",
                card_sign_desc: "Draw and place signature.",

                sect_compress_title: "Compress PDF",
                sect_compress_desc: "Reduce your PDF file size.",

                sect_img2pdf_title: "Image to PDF",
                sect_img2pdf_desc: "Convert your images with professional options.",

                sect_bgrem_title: "Background Remover (AI)",
                sect_bgrem_desc: "Upload images (.jpg, .png, .webp) and remove the background automatically with high quality.",

                sect_nup_title: "N-Up (Summarize)",
                sect_nup_desc: "Put multiple pages on one sheet to save paper.",

                sect_split_title: "Page Editor",
                sect_split_desc: "Drag to reorder, delete pages or rotate them.",

                sect_merge_title: "Merge PDFs",
                sect_merge_desc: "Combine multiple documents into one. Drag to sort.",

                sect_pdf2img_title: "PDF to Images",
                sect_pdf2img_desc: "Convert each PDF page to a high-quality JPG image.",

                sect_ocr_title: "Text Recognition (OCR)",
                sect_ocr_desc: "Extract text from scanned images or PDFs.",

                sect_scan_title: "Scan Enhancer",
                sect_scan_desc: "Optimize document photos (White background, sharp text).",

                sect_poster_title: "Poster Creator",
                sect_poster_desc: "Print a large image across multiple A4 sheets.",

                sect_collage_title: "Collage Studio",
                sect_collage_desc: "Combine photos into predefined layouts.",

                sect_watermark_title: "Watermark",
                sect_watermark_desc: "Add overlay text to your document.",

                sect_pagenum_title: "Page Numbers",
                sect_pagenum_desc: "Add page numbers to your document.",

                sect_sign_title: "Sign PDF",
                sect_sign_desc: "Draw your signature, type text or upload an image and place it on the PDF.",

                drop_organize: "Organize",
                drop_convert: "Convert",
                drop_edit: "Edit",
                drop_edit: "Edit",
                drop_others: "Others",
                drop_ai: "AI & Editing",

                drop_bgrem: "Remove Background",
                drop_merge: "Merge PDF",
                drop_compress: "Compress",
                drop_split: "Split PDF",
                drop_nup: "N-Up PDF",
                drop_img2pdf: "Img to PDF",
                drop_pdf2img: "PDF to Img",
                drop_ocr: "OCR / Text",
                drop_scan: "Scan Enhancer",
                drop_watermark: "Watermark",
                drop_pagenum: "Page Numbers",
                drop_sign: "Sign PDF",
                drop_poster: "Poster",
                drop_collage: "Collage",

                bgrem_upload_text: "Click to upload images",

                footer_rights: "All rights reserved.",
                footer_author: "Author:"
            }
        };

        function toggleLanguage() {
            currentLang = currentLang === 'es' ? 'en' : 'es';
            localStorage.setItem('lang', currentLang);
            applyLanguage();
        }

        function applyLanguage() {
            document.documentElement.lang = currentLang;
            document.getElementById('lang-btn-text').textContent = currentLang.toUpperCase();

            const t = translations[currentLang];

            // Apply to all elements with data-i18n attribute
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (t[key]) {
                    if (el.tagName === 'INPUT' && el.type === 'placeholder') {
                        el.placeholder = t[key];
                    } else if (key === 'hero_title') {
                        el.innerHTML = t[key]; // Special case for HTML content
                    } else if (el.childNodes.length > 0) {
                        // Try to preserve icons if they are creating children. 
                        // Strategy: Update text node only if mixed content? 
                        // For simplicity in this project's structure, standard replacement is mostly fine
                        // BUT for buttons with icons, we need to be careful.
                        // Let's check if there is a direct text node to replace or innerHTML.

                        // Simple approach: if element has specific structure constraint, handle manually
                        // Else, just innerHTML or textContent.

                        // For tool buttons (icon + text), we'll wrap text in span or just rebuild.
                        // Let's look at nav buttons: <i data-lucide...></i> Text
                        // We should wrap the text in a span or just replace the last child if it's text.

                        let icon = el.querySelector('i') || el.querySelector('svg');
                        if (icon) {
                            // Preserve icon
                            const iconHtml = icon.outerHTML;
                            el.innerHTML = iconHtml + ' ' + t[key];
                            lucide.createIcons(); // Re-init icons just in case
                        } else {
                            el.innerHTML = t[key];
                        }
                    } else {
                        el.textContent = t[key];
                    }
                }
            });
        }

        // Init Load
        applyLanguage();



        function toggleDarkMode() {
            const html = document.documentElement;
            if (html.classList.contains('dark')) {
                html.classList.remove('dark');
                localStorage.theme = 'light';
            } else {
                html.classList.add('dark');
                localStorage.theme = 'dark';
            }
            setTimeout(lucide.createIcons, 50);
        }

        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        // ==========================================
        // FUNCIONES DE HERRAMIENTAS & UTILIDADES
        // ==========================================

        function switchTool(tool) {
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.classList.add('inactive');
            });
            const navBtn = document.getElementById(`nav-${tool}`);
            if (navBtn) {
                navBtn.classList.add('active');
                navBtn.classList.remove('inactive');
            }
            ['home', 'img2pdf', 'split', 'merge', 'poster', 'collage', 'pdf2img', 'nup', 'watermark', 'pagenumbers', 'sign', 'compress', 'ocr', 'scan-enhancer', 'bgrem'].forEach(s => {
                const sec = document.getElementById(`section-${s}`);
                if (sec) sec.classList.add('hidden');
            });
            const activeSec = document.getElementById(`section-${tool}`);
            if (activeSec) activeSec.classList.remove('hidden');
        }

        const showLoader = (msg) => { document.getElementById('status-text').innerText = msg; document.getElementById('status-modal').classList.remove('hidden'); };
        const hideLoader = () => document.getElementById('status-modal').classList.add('hidden');
        function blobToDataURL(b) { return new Promise((r, j) => { const x = new FileReader(); x.onload = e => r(e.target.result); x.onerror = j; x.readAsDataURL(b); }); }
        function loadImage(s) { return new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = s; }); }

        // =======================================================
        // HELPER PARA SORTABLE (DRAG & DROP)
        // =======================================================
        function enableDragSort(containerId, dataArray, callbackUpdate) {
            const el = document.getElementById(containerId);
            new Sortable(el, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                delay: 100, // Pequeño delay para evitar arrastres accidentales en móvil
                delayOnTouchOnly: true,
                onEnd: function (evt) {
                    // Reordenar el array de datos basado en el nuevo orden del DOM
                    const newOrderIds = Array.from(el.children).map(child => child.getAttribute('data-id'));

                    // Crear un mapa temporal para acceso rápido
                    const tempMap = new Map(dataArray.map(item => [item.id.toString(), item]));

                    // Reconstruir el array en el nuevo orden
                    // NOTA: Modificamos el array original in-place
                    dataArray.length = 0;
                    newOrderIds.forEach(id => {
                        if (tempMap.has(id)) dataArray.push(tempMap.get(id));
                    });

                    // Callback opcional si se necesita actualizar algo más (ej: contadores)
                    if (callbackUpdate) callbackUpdate();
                }
            });
        }

        // ==========================================
        // 1. IMAGEN A PDF (ACTUALIZADO: LOGICA TIPO FREEPDFCONVERT)
        // ==========================================
        let imgFiles = []; let imgMode = 'standard';

        function setImgMode(mode) {
            imgMode = mode;
            const stdBtn = document.getElementById('tab-std');
            const dupBtn = document.getElementById('tab-dup');
            const dupInfo = document.getElementById('duplicate-info');
            const stdOptions = document.getElementById('standard-options'); // Panel de nuevas opciones

            const baseClass = 'flex-1 py-3 text-sm font-medium border-b-2 transition-colors duration-300';
            const activeClass = 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/20';
            const inactiveClass = 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';

            if (mode === 'standard') {
                stdBtn.className = `${baseClass} ${activeClass}`;
                dupBtn.className = `${baseClass} ${inactiveClass}`;
                // dupInfo.classList.add('hidden'); // Ocultamos la info antigua
                stdOptions.classList.remove('hidden');
            } else {
                stdBtn.className = `${baseClass} ${inactiveClass}`;
                dupBtn.className = `${baseClass} ${activeClass}`;
                // dupInfo.classList.remove('hidden'); // Ya no mostramos el mensaje de "ignora configs"
                stdOptions.classList.remove('hidden'); // AHORA MOSTRAMOS OPCIONES EN DUPLICATE TAMBIÉN
            }
            renderImg2PdfPreview(); // Actualizar preview al cambiar modo
        }

        document.getElementById('file-input-img').addEventListener('change', async (e) => { await handleImgFiles(e.target.files); });

        async function handleImgFiles(files) {
            showLoader("Procesando...");
            for (const file of Array.from(files)) {
                try {
                    let dataUrl;
                    const ext = file.name.split('.').pop().toLowerCase();
                    if (ext === 'pdf') {
                        const ab = await file.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                        for (let i = 1; i <= pdf.numPages; i++) {
                            const page = await pdf.getPage(i); const vp = page.getViewport({ scale: 2 }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
                            imgFiles.push({ id: Math.random(), data: c.toDataURL('image/jpeg', 0.8), w: vp.width, h: vp.height, rotation: 0 });
                        }
                        continue;
                    } else if (['heic', 'heif'].includes(ext)) { dataUrl = await blobToDataURL(await heic2any({ blob: file, toType: "image/jpeg" })); }
                    else if (['tiff', 'tif'].includes(ext)) { const ab = await file.arrayBuffer(); const ifds = UTIF.decode(ab); UTIF.decodeImage(ab, ifds[0]); const rgba = UTIF.toRGBA8(ifds[0]); const c = document.createElement("canvas"); c.width = ifds[0].width; c.height = ifds[0].height; const ctx = c.getContext("2d"); const d = ctx.createImageData(c.width, c.height); for (let i = 0; i < rgba.length; i++) d.data[i] = rgba[i]; ctx.putImageData(d, 0, 0); dataUrl = c.toDataURL("image/jpeg", 0.9); }
                    else { dataUrl = await blobToDataURL(file); }
                    const i = await loadImage(dataUrl);
                    imgFiles.push({ id: Math.random(), data: dataUrl, w: i.width, h: i.height, rotation: 0 });
                } catch (e) { console.error(e); }
            }
            hideLoader(); renderImgGrid(); document.getElementById('file-input-img').value = '';
        }

        function renderImgGrid() {
            const g = document.getElementById('img-grid');
            g.innerHTML = '';

            imgFiles.forEach((f, i) => {
                g.innerHTML += `
                <div class="relative group bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing" data-id="${f.id}">
                    <!-- Contenedor Imagen -->
                    <div class="aspect-square flex items-center justify-center p-2 bg-slate-200/50 dark:bg-slate-900/50 overflow-hidden pointer-events-none">
                        <img src="${f.data}" class="object-contain max-w-full max-h-full transition-transform duration-300" style="transform: rotate(${f.rotation}deg)">
                    </div>
                    
                    <!-- Overlay Controles -->
                    <div class="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity backdrop-blur-[1px] p-2">
                        <div class="text-white text-xs font-bold mb-2"><i data-lucide="move" class="inline w-4 h-4"></i> Arrastrar</div>
                        
                        <!-- Botones Acción -->
                        <div class="flex gap-2 mt-2">
                            <button onclick="rotImg(${i})" class="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-transform hover:scale-110" title="Rotar 90º">
                                <i data-lucide="rotate-cw" class="w-5 h-5"></i>
                            </button>
                            <button onclick="rmImg(${i})" class="w-10 h-10 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition-transform hover:scale-110" title="Eliminar">
                                <i data-lucide="trash-2" class="w-5 h-5"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Badge Número -->
                    <div class="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-bold shadow-sm pointer-events-none border border-white/20">
                        ${i + 1}
                    </div>
                </div>`;
            });

            document.getElementById('btn-gen-img').classList.toggle('hidden', imgFiles.length === 0);
            lucide.createIcons();

            // ACTIVAR DRAG & DROP
            enableDragSort('img-grid', imgFiles, () => {
                // Actualizar números visuales después de soltar
                document.querySelectorAll('#img-grid > div').forEach((div, idx) => {
                    div.querySelector('.absolute.top-2').innerText = idx + 1;
                });
            });
        }

        function rmImg(i) { imgFiles.splice(i, 1); renderImgGrid(); }
        function rotImg(i) { imgFiles[i].rotation = (imgFiles[i].rotation + 90) % 360; renderImgGrid(); }

        function getRotatedImage(url, rotation) {
            return new Promise((resolve) => {
                const image = new Image();
                image.onload = () => {
                    if (rotation === 0) {
                        resolve({ data: url, w: image.width, h: image.height });
                        return;
                    }
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const rads = rotation * Math.PI / 180;
                    const sin = Math.abs(Math.sin(rads));
                    const cos = Math.abs(Math.cos(rads));
                    canvas.width = image.width * cos + image.height * sin;
                    canvas.height = image.width * sin + image.height * cos;
                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate(rads);
                    ctx.drawImage(image, -image.width / 2, -image.height / 2);
                    resolve({ data: canvas.toDataURL('image/jpeg', 0.9), w: canvas.width, h: canvas.height });
                };
                image.src = url;
            });
        }

        // ==========================================
        // LÓGICA DE GENERACIÓN MEJORADA (TIPO FREEPDFCONVERT)
        // ==========================================
        // ==========================================
        // PREVIEW logic
        // ==========================================
        function togglePreviewImg2Pdf() {
            const area = document.getElementById('img2pdf-preview-area');
            if (area.classList.contains('hidden')) {
                area.classList.remove('hidden');
                renderImg2PdfPreview();
            } else {
                area.classList.add('hidden');
            }
        }

        async function renderImg2PdfPreview() {
            const area = document.getElementById('img2pdf-preview-area');
            // If hidden, do nothing unless we force? No, save resources.
            if (area.classList.contains('hidden')) return;

            if (imgFiles.length === 0) {
                const cvs = document.getElementById('img2pdf-preview-canvas');
                cvs.width = 300; cvs.height = 150;
                const ctx = cvs.getContext('2d');
                ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0, 0, cvs.width, cvs.height);
                ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText("Sube una imagen para previsualizar", cvs.width / 2, cvs.height / 2);
                return;
            }

            const imgFile = imgFiles[0];
            const imgObj = await loadImage(imgFile.data);

            const cvs = document.getElementById('img2pdf-preview-canvas');
            const ctx = cvs.getContext('2d');

            const pageSizeOpt = document.getElementById('img-page-size').value;
            const orientOpt = document.getElementById('img-orientation').value;
            const marginOpt = document.getElementById('img-margin').value;

            // Dimensions in mm
            const sizes = {
                'a0': { w: 841, h: 1189 }, 'a1': { w: 594, h: 841 }, 'a2': { w: 420, h: 594 },
                'a3': { w: 297, h: 420 }, 'a4': { w: 210, h: 297 }, 'a5': { w: 148.5, h: 210 },
                'a6': { w: 105, h: 148.5 }, 'a7': { w: 74, h: 105 }, 'a8': { w: 52, h: 74 },
                'a9': { w: 37, h: 52 }, 'a10': { w: 26, h: 37 },
                'letter': { w: 215.9, h: 279.4 }, 'legal': { w: 215.9, h: 355.6 }
            };

            let pageW, pageH;

            // Determine Page Dimensions (mm)
            if (pageSizeOpt === 'fit') {
                if (imgMode === 'duplicate') {
                    // Auto-fallback to A4 if fit selected in duplicate
                    pageW = 210; pageH = 297;
                } else {
                    pageW = imgObj.width * 0.264583;
                    pageH = imgObj.height * 0.264583;
                }
            } else {
                const s = sizes[pageSizeOpt] || sizes['a4'];
                pageW = s.w; pageH = s.h;
            }

            // Determine Orientation
            let finalOrient = 'p';
            if (orientOpt === 'auto') {
                if (imgMode === 'standard') {
                    finalOrient = (imgObj.width > imgObj.height) ? 'l' : 'p';
                } else {
                    // DUPLICATE AUTO LOGIC
                    const pScale = Math.min(Math.min(pageW, pageH) / imgObj.width, (Math.max(pageW, pageH) / 2) / imgObj.height);
                    const lScale = Math.min((Math.max(pageW, pageH) / 2) / imgObj.width, Math.min(pageW, pageH) / imgObj.height);
                    finalOrient = (lScale > pScale) ? 'l' : 'p';
                }
            } else {
                finalOrient = orientOpt;
            }

            // Swap page dimensions if landscape
            let displayW, displayH;
            if (finalOrient === 'l') {
                displayW = Math.max(pageW, pageH);
                displayH = Math.min(pageW, pageH);
            } else {
                displayW = Math.min(pageW, pageH);
                displayH = Math.max(pageW, pageH);
            }

            // Canvas Setup (Scale to fit max 500px height or width)
            const scaleFactor = 500 / displayH;
            cvs.height = 500;
            cvs.width = displayW * scaleFactor;

            // Draw Page Background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, cvs.width, cvs.height);
            ctx.strokeStyle = '#cbd5e1';
            ctx.strokeRect(0, 0, cvs.width, cvs.height);

            // Draw Content
            let margin = 0;
            if (marginOpt === 'small') margin = 10;
            if (marginOpt === 'normal') margin = 20;
            margin *= scaleFactor; // Convert mm to px

            if (imgMode === 'standard') {
                const drawAreaW = cvs.width - (margin * 2);
                const drawAreaH = cvs.height - (margin * 2);
                drawContain(ctx, imgObj, margin, margin, drawAreaW, drawAreaH);
            } else {
                // DUPLICATE DRAW
                const isLand = displayW > displayH;
                const gap = 30 * scaleFactor; // 30mm gap
                const pad = 5 * scaleFactor; // 5mm padding from edges

                let boxW, boxH, box1X, box1Y, box2X, box2Y;
                let cutX1, cutY1, cutX2, cutY2;
                let textX, textY, textAngle = 0;

                if (isLand) {
                    // Landscape Page: Side by Side (GAP VERTICAL)
                    const totalW = cvs.width;
                    const availableW = totalW - gap;

                    boxW = availableW / 2;
                    boxH = cvs.height;

                    // Apply padding inside the box
                    const innerBoxW = boxW - (pad * 2);
                    const innerBoxH = boxH - (pad * 2);

                    // Box 1 (Left) - Add left pad
                    drawContain(ctx, imgObj, margin + pad, margin + pad, innerBoxW, innerBoxH);
                    // Box 2 (Right) - Add left pad (offset by boxW + gap)
                    drawContain(ctx, imgObj, boxW + gap + margin + pad, margin + pad, innerBoxW, innerBoxH);

                    // Cut Line
                    cutX1 = boxW + (gap / 2); cutY1 = 10;
                    cutX2 = boxW + (gap / 2); cutY2 = cvs.height - 10;

                    // Text
                    textX = cutX1; textY = cvs.height / 2; textAngle = -90 * Math.PI / 180;

                } else {
                    // Portrait Page: Vertical Stack (GAP HORIZONTAL)
                    const totalH = cvs.height;
                    const availableH = totalH - gap;

                    boxW = cvs.width;
                    boxH = availableH / 2;

                    // Apply padding
                    const innerBoxW = boxW - (pad * 2);
                    const innerBoxH = boxH - (pad * 2);

                    // Box 1 (Top)
                    drawContain(ctx, imgObj, margin + pad, margin + pad, innerBoxW, innerBoxH);
                    // Box 2 (Bottom)
                    drawContain(ctx, imgObj, margin + pad, boxH + gap + margin + pad, innerBoxW, innerBoxH);

                    // Cut Line
                    cutX1 = 10; cutY1 = boxH + (gap / 2);
                    cutX2 = cvs.width - 10; cutY2 = boxH + (gap / 2);

                    // Text
                    textX = cvs.width / 2; textY = cutY1;
                }

                // Draw Text & Split Line
                ctx.save();
                ctx.translate(textX, textY);
                ctx.rotate(textAngle);
                ctx.fillStyle = '#94a3b8'; // Lighter gray (Slate 400)
                ctx.font = 'normal 7px sans-serif'; // 7px, normal weight
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const textW = ctx.measureText("- Recortar aquí -").width;
                const textGap = (textW / 2) + 4; // Gap from center to line start

                // Draw Text
                ctx.fillText("- Recortar aquí -", 0, 0);
                ctx.restore();

                // Draw Split Lines (Skip text)
                ctx.strokeStyle = '#94a3b8';
                ctx.setLineDash([5, 5]);
                ctx.beginPath();

                if (isLand) {
                    // Vertical Line (text angle -90)
                    // Line goes from top (10) to bottom (h-10)
                    // Text is at center (h/2)
                    // Top Segment: 10 to (center - gap)
                    // Bottom Segment: (center + gap) to (h-10)
                    const cY = cvs.height / 2;
                    ctx.moveTo(cutX1, 10);
                    ctx.lineTo(cutX1, cY - textGap);

                    ctx.moveTo(cutX1, cY + textGap);
                    ctx.lineTo(cutX1, cvs.height - 10);
                } else {
                    // Horizontal Line (text angle 0)
                    // Line goes from left (10) to right (w-10)
                    // Text is at center (w/2)
                    // Left Segment: 10 to (center - gap)
                    // Right Segment: (center + gap) to (w-10)
                    const cX = cvs.width / 2;
                    ctx.moveTo(10, cutY1);
                    ctx.lineTo(cX - textGap, cutY1);

                    ctx.moveTo(cX + textGap, cutY1);
                    ctx.lineTo(cvs.width - 10, cutY1);
                }
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        async function generateImgPDF(forPrint = false) {
            if (!imgFiles.length) return;
            showLoader("Generando PDF...");
            await new Promise(r => setTimeout(r, 100));

            const { jsPDF } = window.jspdf;

            // Obtener configuraciones del usuario
            const pageSizeOpt = document.getElementById('img-page-size').value; // a4, letter, fit...
            const orientOpt = document.getElementById('img-orientation').value; // auto, p, l
            const marginOpt = document.getElementById('img-margin').value; // none, small, normal
            const separateFiles = document.getElementById('img-separate-files').checked;

            const sizes = {
                'a0': { w: 841, h: 1189 }, 'a1': { w: 594, h: 841 }, 'a2': { w: 420, h: 594 },
                'a3': { w: 297, h: 420 }, 'a4': { w: 210, h: 297 }, 'a5': { w: 148.5, h: 210 },
                'a6': { w: 105, h: 148.5 }, 'a7': { w: 74, h: 105 }, 'a8': { w: 52, h: 74 },
                'letter': { w: 215.9, h: 279.4 }, 'legal': { w: 215.9, h: 355.6 }
            };

            // Definir márgenes (en mm)
            let marginVal = 0;
            if (marginOpt === 'small') marginVal = 10;
            if (marginOpt === 'normal') marginVal = 20;

            let zip = null;
            if (separateFiles && imgMode === 'standard') zip = new JSZip();

            let doc = null;
            if (!separateFiles || imgMode === 'duplicate') {
                doc = new jsPDF({ format: 'a4', unit: 'mm' }); // Default init
                doc.deletePage(1);
            }

            for (let i = 0; i < imgFiles.length; i++) {
                const rotatedImg = await getRotatedImage(imgFiles[i].data, imgFiles[i].rotation);
                const imgData = rotatedImg.data;
                const imgW = rotatedImg.w;
                const imgH = rotatedImg.h;
                const ratio = imgW / imgH;

                let currentDoc = doc;
                if (separateFiles && imgMode === 'standard') {
                    currentDoc = new jsPDF({ format: 'a4', unit: 'mm' });
                    currentDoc.deletePage(1);
                }

                // Determine Page Size & Orientation logic (Shared)
                let pageW, pageH, orientation;

                if (pageSizeOpt === 'fit') {
                    if (imgMode === 'duplicate') {
                        // Fallback for duplicate fit -> A4 (Standard)
                        const s = sizes['a4'];
                        pageW = s.w; pageH = s.h; // Default portrait basis
                    } else {
                        pageW = imgW * 0.264583; pageH = imgH * 0.264583;
                        if (marginOpt === 'none') marginVal = 0;
                    }
                } else {
                    const s = sizes[pageSizeOpt] || sizes['a4'];
                    pageW = s.w; pageH = s.h;
                }

                // Orientation Optimization
                if (orientOpt === 'auto') {
                    if (imgMode === 'standard') {
                        orientation = ratio > 1 ? 'l' : 'p';
                    } else {
                        // Duplicate Optimization
                        // Duplicate Optimization
                        const gap = 30; // 30mm gap for cutting
                        const pad = 5; // 5mm padding edge
                        // Logic: (PageDim - Gap) / 2

                        // P Scale (Total Height split)
                        const pSubH = (Math.max(pageW, pageH) - gap - (pad * 2)) / 2;
                        const pSubW = Math.min(pageW, pageH) - (pad * 2);
                        const pScale = Math.min(pSubW / imgW, pSubH / imgH);

                        // L Scale (Total Width split)
                        const lSubW = (Math.max(pageW, pageH) - gap - (pad * 2)) / 2;
                        const lSubH = Math.min(pageW, pageH) - (pad * 2);
                        const lScale = Math.min(lSubW / imgW, lSubH / imgH);

                        orientation = (lScale > pScale) ? 'l' : 'p';
                    }
                } else {
                    orientation = orientOpt;
                }

                // Set final dimensions passed to addPage
                let finalPageW, finalPageH;
                if (orientation === 'p') {
                    finalPageW = Math.min(pageW, pageH); finalPageH = Math.max(pageW, pageH);
                } else {
                    finalPageW = Math.max(pageW, pageH); finalPageH = Math.min(pageW, pageH);
                }

                currentDoc.addPage([finalPageW, finalPageH], orientation);

                // DRAWING
                const drawAreaW = finalPageW - (marginVal * 2);
                const drawAreaH = finalPageH - (marginVal * 2);

                if (imgMode === 'standard') {
                    let finalW = drawAreaW; let finalH = finalW / ratio;
                    if (finalH > drawAreaH) { finalH = drawAreaH; finalW = finalH * ratio; }
                    const x = marginVal + (drawAreaW - finalW) / 2;
                    const y = marginVal + (drawAreaH - finalH) / 2;
                    currentDoc.addImage(imgData, 'JPEG', x, y, finalW, finalH);

                    if (separateFiles) {
                        zip.file(`documento_${i + 1}.pdf`, currentDoc.output('blob'));
                    }

                } else if (imgMode === 'duplicate') {
                    currentDoc.setFontSize(7); currentDoc.setTextColor(180); // Lighter text (approx #b4b4b4)
                    // Logic: Split page in 2 with GAP and PADDING
                    const gap = 30; // 30mm gap
                    const pad = 5;  // 5mm padding edge

                    const isLandPage = finalPageW > finalPageH;
                    let boxW, boxH, b1X, b1Y, b2X, b2Y;
                    let cutX1, cutY1, cutX2, cutY2;
                    let textX, textY, textAngle = 0;

                    if (isLandPage) {
                        // Landscape Page -> Vertical Split (Left | Gap | Right)
                        const availableW = finalPageW - gap;
                        boxW = availableW / 2;
                        boxH = finalPageH;

                        b1X = 0; b1Y = 0;
                        b2X = boxW + gap; b2Y = 0;

                        // Cut Line
                        cutX1 = boxW + (gap / 2); cutY1 = 10;
                        cutX2 = boxW + (gap / 2); cutY2 = finalPageH - 10;

                        textX = cutX1; textY = finalPageH / 2; textAngle = 90;
                    } else {
                        // Portrait Page -> Horizontal Split (Top / Gap / Bottom)
                        const availableH = finalPageH - gap;
                        boxW = finalPageW;
                        boxH = availableH / 2;

                        b1X = 0; b1Y = 0;
                        b2X = 0; b2Y = boxH + gap;

                        // Cut Line
                        cutX1 = 10; cutY1 = boxH + (gap / 2);
                        cutX2 = finalPageW - 10; cutY2 = boxH + (gap / 2);

                        textX = finalPageW / 2; textY = cutY1; textAngle = 0;
                    }

                    // Helper to draw in box honoring margin + padding
                    const drawInBox = (bx, by, bw, bh) => {
                        // Use marginVal from settings OR default 0 in this mode? 
                        // User asked for "good space". Let's use pad + marginVal.
                        const totalPad = pad + marginVal;

                        const innerW = bw - (totalPad * 2);
                        const innerH = bh - (totalPad * 2);

                        if (innerW <= 0 || innerH <= 0) return; // Prevention

                        let dW = innerW; let dH = dW / ratio;
                        if (dH > innerH) { dH = innerH; dW = dH * ratio; }

                        const imgX = bx + totalPad + (innerW - dW) / 2;
                        const imgY = by + totalPad + (innerH - dH) / 2;

                        currentDoc.addImage(imgData, 'JPEG', imgX, imgY, dW, dH);
                    };

                    drawInBox(b1X, b1Y, boxW, boxH);
                    drawInBox(b2X, b2Y, boxW, boxH);

                    // Draw Text First to calculate GAP
                    const txt = "- Recortar aquí -";
                    const txtW = currentDoc.getTextWidth(txt);
                    const txtGap = (txtW / 2) + 2; // mm gap from center

                    if (textAngle !== 0) {
                        currentDoc.text(txt, textX, textY, { angle: textAngle, align: 'center', baseline: 'middle' });
                    } else {
                        currentDoc.text(txt, textX, textY, { align: 'center', baseline: 'middle' });
                    }

                    // Draw Split Lines
                    currentDoc.setLineDashPattern([3, 3], 0); currentDoc.setDrawColor(180); // Lighter line (approx #b4b4b4)

                    if (isLandPage) {
                        // Vertical Cut Line (Left | Right)
                        // Top Segment
                        currentDoc.line(cutX1, 10, cutX1, (finalPageH / 2) - txtGap);
                        // Bottom Segment
                        currentDoc.line(cutX1, (finalPageH / 2) + txtGap, cutX1, finalPageH - 10);
                    } else {
                        // Horizontal Cut Line (Top / Bottom)
                        // Left Segment
                        currentDoc.line(10, cutY1, (finalPageW / 2) - txtGap, cutY1);
                        // Right Segment
                        currentDoc.line((finalPageW / 2) + txtGap, cutY1, finalPageW - 10, cutY1);
                    }

                }
            }

            if (separateFiles && imgMode === 'standard') {
                const content = await zip.generateAsync({ type: "blob" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(content);
                a.download = "documentos_pdf_separados.zip";
                a.click();
            } else {
                if (forPrint) return doc.output('blob');
                doc.save('documento_convertido.pdf');
            }

            hideLoader();
        }

        // ==========================================
        // 2. RESUMIR PDF (N-UP)
        // ==========================================
        let nupFile = null;
        document.getElementById('file-input-nup').addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            nupFile = file;
            document.getElementById('nup-upload-area').classList.add('hidden');
            document.getElementById('nup-options').classList.remove('hidden');
        });
        function resetNUp() { nupFile = null; document.getElementById('file-input-nup').value = ''; document.getElementById('nup-options').classList.add('hidden'); document.getElementById('nup-upload-area').classList.remove('hidden'); }
        async function generateNUpPDF(forPrint = false) {
            if (!nupFile) return; showLoader("Resumiendo PDF...");
            try {
                const arrayBuffer = await nupFile.arrayBuffer();
                const { PDFDocument, PageSizes } = PDFLib;
                const srcDoc = await PDFDocument.load(arrayBuffer);
                const newDoc = await PDFDocument.create();
                const pagesPerSheet = parseInt(document.getElementById('nup-count').value);
                let cols, rows;
                if (pagesPerSheet === 2) { cols = 1; rows = 2; } else if (pagesPerSheet === 4) { cols = 2; rows = 2; } else if (pagesPerSheet === 6) { cols = 2; rows = 3; } else { cols = 3; rows = 3; }
                const PageWidth = PageSizes.A4[0]; const PageHeight = PageSizes.A4[1];
                const margin = 20; const gap = 10;
                const cellWidth = (PageWidth - (2 * margin) - (gap * (cols - 1))) / cols;
                const cellHeight = (PageHeight - (2 * margin) - (gap * (rows - 1))) / rows;
                const sourcePages = srcDoc.getPages(); const totalSourcePages = sourcePages.length;
                const copiedPages = await newDoc.embedPages(sourcePages);
                let currentPage; const itemsPerPage = cols * rows;
                for (let i = 0; i < totalSourcePages; i++) {
                    const positionIndex = i % itemsPerPage;
                    if (positionIndex === 0) { currentPage = newDoc.addPage(PageSizes.A4); }
                    const col = positionIndex % cols; const row = Math.floor(positionIndex / cols);
                    const embeddedPage = copiedPages[i]; const { width: srcWidth, height: srcHeight } = embeddedPage;
                    const scaleX = cellWidth / srcWidth; const scaleY = cellHeight / srcHeight; const scale = Math.min(scaleX, scaleY);
                    const finalWidth = srcWidth * scale; const finalHeight = srcHeight * scale;
                    const x = margin + (col * (cellWidth + gap)) + ((cellWidth - finalWidth) / 2);
                    const cellTopY = PageHeight - margin - (row * (cellHeight + gap));
                    const y = (cellTopY - cellHeight) + ((cellHeight - finalHeight) / 2);
                    currentPage.drawPage(embeddedPage, { x: x, y: y, width: finalWidth, height: finalHeight, });
                }
                const pdfBytes = await newDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                if (forPrint) return blob;
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `resumido_${pagesPerSheet}en1.pdf`; link.click();
            } catch (err) { console.error(err); alert("Hubo un error al procesar el PDF: " + err.message); } finally { hideLoader(); }
        }

        // ==========================================
        // 3. DIVIDIR & ROTAR
        // ==========================================
        let splitPdfDoc = null; let splitPages = [];

        document.getElementById('file-input-split').addEventListener('change', async (e) => {
            const file = e.target.files[0]; if (!file) return; showLoader("Leyendo PDF...");

            try {
                const ab = await file.arrayBuffer();
                const abCopy = ab.slice(0);

                splitPdfDoc = await PDFLib.PDFDocument.load(ab);

                splitPages = [];
                const loadingTask = pdfjsLib.getDocument({ data: abCopy });
                const pdf = await loadingTask.promise;

                document.getElementById('split-page-count').innerText = pdf.numPages;

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const vp = page.getViewport({ scale: 0.3 });
                    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
                    const ctx = c.getContext('2d'); await page.render({ canvasContext: ctx, viewport: vp }).promise;
                    const imgUrl = c.toDataURL('image/jpeg', 0.8);

                    // AÑADIMOS UN ID ÚNICO
                    splitPages.push({ id: `page-${i}-${Date.now()}`, index: i - 1, rotation: 0, imgUrl: imgUrl, originalNum: i });
                }

                document.getElementById('split-upload-area').classList.add('hidden');
                document.getElementById('split-workspace').classList.remove('hidden');
                updateSplitGrid();

            } catch (err) { console.error(err); alert("Error al cargar el PDF.\n" + err.message); } finally { hideLoader(); e.target.value = ''; }
        });

        function updateSplitGrid() {
            const c = document.getElementById('pages-container'); c.innerHTML = '';

            splitPages.forEach((p, displayIdx) => {
                const div = document.createElement('div');
                div.className = "bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 relative group cursor-grab active:cursor-grabbing";
                div.setAttribute('data-id', p.id); // IMPORTANTE PARA SORTABLE

                const wrap = document.createElement('div');
                wrap.className = "relative rounded-lg overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800 aspect-[1/1.4] pointer-events-none";
                const img = document.createElement('img');
                img.src = p.imgUrl;
                img.className = "max-w-full max-h-full object-contain";
                img.style.transform = `rotate(${p.rotation}deg)`;
                img.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
                wrap.appendChild(img);

                const over = document.createElement('div');
                over.className = "absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity backdrop-blur-[1px]";
                over.innerHTML = `
                    <div class="text-white text-xs font-bold mb-1"><i data-lucide="move" class="inline w-3 h-3"></i> Mover</div>
                    <div class="flex gap-2 pointer-events-auto">
                        <button onclick="rotatePage(${displayIdx})" class="w-8 h-8 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow transition-transform hover:scale-110"><i data-lucide="rotate-cw" class="w-4 h-4"></i></button>
                        <button onclick="delPage(${displayIdx})" class="w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow transition-transform hover:scale-110"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>`;
                wrap.appendChild(over);
                div.appendChild(wrap);
                div.innerHTML += `<div class="text-center mt-2 text-xs font-bold text-slate-500 dark:text-slate-300">Pág. orig: ${p.originalNum}</div>`;
                c.appendChild(div);
            });
            lucide.createIcons();

            enableDragSort('pages-container', splitPages, null);
        }
        function rotatePage(idx) { splitPages[idx].rotation = (splitPages[idx].rotation + 90) % 360; updateSplitGrid(); }
        function delPage(i) { splitPages.splice(i, 1); updateSplitGrid(); }
        function resetSplit() { splitPdfDoc = null; splitPages = []; document.getElementById('split-workspace').classList.add('hidden'); document.getElementById('split-upload-area').classList.remove('hidden'); }
        async function downloadSplitPDF(forPrint = false) {
            if (!splitPages.length) return alert("¡No has dejado ninguna página!"); showLoader("Guardando PDF...");
            try {
                const newPdf = await PDFLib.PDFDocument.create();

                // IMPORTANTE: Mapear indices originales correctamente
                const indices = splitPages.map(p => p.index);
                const copied = await newPdf.copyPages(splitPdfDoc, indices);

                copied.forEach((page, i) => {
                    const addedRot = splitPages[i].rotation;
                    const currentRot = page.getRotation().angle;
                    page.setRotation(PDFLib.degrees((currentRot + addedRot) % 360));
                    newPdf.addPage(page);
                });
                const pdfBytes = await newPdf.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                if (forPrint) return blob;
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `editado_${Date.now()}.pdf`; link.click();
            } catch (e) { console.error(e); alert("Error al guardar."); } finally { hideLoader(); }
        }

        // ==========================================
        // 4. UNIR (MERGE) - DRAG & DROP ENABLED
        // ==========================================
        let mergePagesData = [];
        let mergeSourceFiles = {};

        document.getElementById('file-input-merge').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            showLoader("Procesando archivos...");

            try {
                for (const file of files) {
                    const fileId = Math.random().toString(36).substring(7);
                    const arrayBuffer = await file.arrayBuffer();
                    mergeSourceFiles[fileId] = arrayBuffer.slice(0);

                    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
                    const pdf = await loadingTask.promise;

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const vp = page.getViewport({ scale: 0.3 });
                        const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
                        const ctx = canvas.getContext('2d'); await page.render({ canvasContext: ctx, viewport: vp }).promise;

                        mergePagesData.push({
                            id: Math.random().toString(36), // ID UNICO NECESARIO
                            fileId: fileId,
                            fileName: file.name,
                            pageIndex: i - 1,
                            rotation: 0,
                            thumbUrl: canvas.toDataURL('image/jpeg', 0.8)
                        });
                    }
                }
                document.getElementById('merge-workspace').classList.remove('hidden');
                renderMergeGrid();
            } catch (err) { console.error(err); alert("Error al cargar archivos: " + err.message); } finally { hideLoader(); e.target.value = ''; }
        });

        function renderMergeGrid() {
            const grid = document.getElementById('merge-grid');
            grid.innerHTML = '';
            document.getElementById('merge-page-count').innerText = mergePagesData.length;

            if (mergePagesData.length === 0) {
                grid.innerHTML = '<div class="col-span-full text-center text-slate-400 dark:text-slate-500 py-8">No hay páginas. Añade PDFs.</div>';
                return;
            }

            mergePagesData.forEach((page, idx) => {
                const div = document.createElement('div');
                div.className = "bg-white dark:bg-slate-700 p-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600 relative group cursor-grab active:cursor-grabbing";
                div.setAttribute('data-id', page.id); // ID PARA SORTABLE

                const wrap = document.createElement('div');
                wrap.className = "relative rounded-lg overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800 aspect-[1/1.4] pointer-events-none";
                const img = document.createElement('img'); img.src = page.thumbUrl; img.className = "max-w-full max-h-full object-contain";
                img.style.transform = `rotate(${page.rotation}deg)`; img.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
                wrap.appendChild(img);

                const over = document.createElement('div');
                over.className = "absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity backdrop-blur-[1px]";
                over.innerHTML = `
                    <div class="text-white text-xs font-bold mb-1"><i data-lucide="move" class="inline w-3 h-3"></i> Mover</div>
                    <div class="flex gap-2 pointer-events-auto">
                        <button onclick="rotateMergePage(${idx})" class="w-8 h-8 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow transition-transform hover:scale-110"><i data-lucide="rotate-cw" class="w-4 h-4"></i></button>
                        <button onclick="removeMergePage(${idx})" class="w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow transition-transform hover:scale-110"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>`;
                wrap.appendChild(over); div.appendChild(wrap);

                div.innerHTML += `<div class="mt-2 text-center"><p class="text-[10px] text-slate-400 dark:text-slate-400 truncate w-full">${page.fileName}</p><p class="text-xs font-bold text-slate-600 dark:text-slate-300">Pág ${page.pageIndex + 1}</p></div>`;
                grid.appendChild(div);
            });
            lucide.createIcons();

            enableDragSort('merge-grid', mergePagesData, null);
        }

        function rotateMergePage(idx) { mergePagesData[idx].rotation = (mergePagesData[idx].rotation + 90) % 360; renderMergeGrid(); }
        function removeMergePage(idx) { mergePagesData.splice(idx, 1); renderMergeGrid(); }
        function resetMerge() { mergePagesData = []; mergeSourceFiles = {}; document.getElementById('merge-grid').innerHTML = ''; document.getElementById('merge-workspace').classList.add('hidden'); }

        async function mergePDFs(forPrint = false) {
            if (mergePagesData.length === 0) return alert("No hay páginas para unir.");
            showLoader("Uniendo documentos...");

            try {
                const newDoc = await PDFLib.PDFDocument.create();
                const loadedDocsCache = {};

                for (const pageData of mergePagesData) {
                    const { fileId, pageIndex, rotation } = pageData;
                    if (!loadedDocsCache[fileId]) { loadedDocsCache[fileId] = await PDFLib.PDFDocument.load(mergeSourceFiles[fileId]); }
                    const srcDoc = loadedDocsCache[fileId];
                    const [copiedPage] = await newDoc.copyPages(srcDoc, [pageIndex]);
                    const currentRotation = copiedPage.getRotation().angle;
                    copiedPage.setRotation(PDFLib.degrees((currentRotation + rotation) % 360));
                    newDoc.addPage(copiedPage);
                }
                const pdfBytes = await newDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                if (forPrint) return blob;
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `unido_completo_${Date.now()}.pdf`; link.click();
            } catch (err) { console.error(err); alert("Error al unir: " + err.message); } finally { hideLoader(); }
        }

        // ==========================================
        // 5. PDF A IMÁGENES
        // ==========================================
        let p2iImages = [];
        document.getElementById('file-input-p2i').addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return; showLoader("Extrayendo imágenes...");
            try {
                const ab = await f.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                p2iImages = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const vp = page.getViewport({ scale: 2.0 });
                    const cvs = document.createElement('canvas'); cvs.width = vp.width; cvs.height = vp.height;
                    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
                    const blob = await new Promise(resolve => cvs.toBlob(resolve, 'image/jpeg', 0.9));
                    p2iImages.push({ id: Math.random().toString(36), blob: blob, name: `pagina_${i}.jpg`, rotation: 0, url: URL.createObjectURL(blob) });
                }
                document.getElementById('p2i-upload-area').classList.add('hidden');
                document.getElementById('p2i-workspace').classList.remove('hidden');
                renderP2IGrid();
            } catch (e) { console.error(e); alert("Error al leer PDF"); } finally { hideLoader(); e.target.value = ''; }
        });
        function renderP2IGrid() {
            const grid = document.getElementById('p2i-grid'); grid.innerHTML = '';
            if (p2iImages.length === 0) { grid.innerHTML = '<div class="col-span-full text-center text-slate-400 py-10">No quedan imágenes</div>'; return; }
            p2iImages.forEach((img, idx) => {
                grid.innerHTML += `
                <div class="bg-white dark:bg-slate-700 p-2 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm relative group cursor-grab active:cursor-grabbing" data-id="${img.id}">
                    <div class="relative overflow-hidden bg-slate-100 dark:bg-slate-800 rounded border dark:border-slate-600 mb-2 aspect-[1/1.4] flex items-center justify-center pointer-events-none">
                        <img src="${img.url}" style="transform: rotate(${img.rotation}deg); transition: transform 0.3s;" class="max-w-full max-h-full object-contain">
                    </div>
                    <div class="flex justify-between items-center px-1">
                        <span class="text-xs font-bold text-slate-500 dark:text-slate-300">Pág ${idx + 1}</span>
                        <div class="flex gap-1 pointer-events-auto">
                            <button onclick="rotateP2I(${idx}, 90)" class="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-600 hover:text-blue-600 rounded"><i data-lucide="rotate-cw" class="w-4 h-4"></i></button>
                            <button onclick="deleteP2I(${idx})" class="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                </div>`;
            });
            lucide.createIcons();
            enableDragSort('p2i-grid', p2iImages, null);
        }
        function rotateP2I(idx, deg) { p2iImages[idx].rotation = (p2iImages[idx].rotation + deg) % 360; renderP2IGrid(); }
        function deleteP2I(idx) { p2iImages.splice(idx, 1); renderP2IGrid(); }
        async function downloadAllImagesZip() {
            if (!p2iImages.length) return; showLoader("Comprimiendo...");
            const zip = new JSZip();
            for (const img of p2iImages) {
                if (img.rotation === 0) { zip.file(img.name, img.blob); } else { const rotatedBlob = await rotateImageBlob(img.url, img.rotation); zip.file(img.name, rotatedBlob); }
            }
            const content = await zip.generateAsync({ type: "blob" }); const a = document.createElement("a"); a.href = URL.createObjectURL(content); a.download = "imagenes_extraidas.zip"; a.click(); hideLoader();
        }
        function rotateImageBlob(url, degrees) {
            return new Promise((resolve) => {
                const image = new Image();
                image.onload = () => {
                    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                    const rads = degrees * Math.PI / 180; const sin = Math.abs(Math.sin(rads)); const cos = Math.abs(Math.cos(rads));
                    canvas.width = image.width * cos + image.height * sin; canvas.height = image.width * sin + image.height * cos;
                    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rads); ctx.drawImage(image, -image.width / 2, -image.height / 2);
                    canvas.toBlob(resolve, 'image/jpeg', 0.9);
                };
                image.src = url;
            });
        }
        function resetP2I() { p2iImages = []; document.getElementById('p2i-workspace').classList.add('hidden'); document.getElementById('p2i-upload-area').classList.remove('hidden'); }

        // ==========================================
        // 6. PÓSTER & 7. COLLAGE (MODIFICADO PARA CALIDAD Y CONTADOR)
        // ==========================================
        let posterImages = []; // Ahora es un Array para soportar multiples
        let currentPosterIndex = 0;

        document.getElementById('file-input-poster').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (!files.length) return;
            showLoader("Cargando archivos...");

            posterImages = []; // Resetear para nueva carga
            currentPosterIndex = 0;

            try {
                for (const f of files) {
                    let u = null, ext = f.name.split('.').pop().toLowerCase();
                    if (ext === 'pdf') {
                        const ab = await f.arrayBuffer();
                        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                        const p = await pdf.getPage(1);
                        const vp = p.getViewport({ scale: 5 }); // HIGH QUALITY (360 DPI approx)
                        const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
                        await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
                        u = c.toDataURL('image/jpeg', 0.95);
                    }
                    else if (ext === 'heic' || ext === 'heif') { u = await blobToDataURL(await heic2any({ blob: f, toType: "image/jpeg" })); }
                    else { u = await blobToDataURL(f); }

                    const imgObj = await loadImage(u);
                    posterImages.push(imgObj);
                }

                document.getElementById('poster-upload-area').classList.add('hidden');
                document.getElementById('poster-workspace').classList.remove('hidden');
                updatePosterNav();
                renderPosterPreview();
            } catch (e) { console.error(e); alert("Error al cargar archivo(s)."); } finally { hideLoader(); }
        });

        function updatePosterNav() {
            const count = posterImages.length;
            document.getElementById('poster-counter').innerText = `${currentPosterIndex + 1}/${count}`;
            document.getElementById('poster-nav').style.visibility = count > 1 ? 'visible' : 'hidden';
        }

        function nextPoster() { if (currentPosterIndex < posterImages.length - 1) { currentPosterIndex++; updatePosterNav(); renderPosterPreview(); } }
        function prevPoster() { if (currentPosterIndex > 0) { currentPosterIndex--; updatePosterNav(); renderPosterPreview(); } }

        function renderPosterPreview() {
            const posterImage = posterImages[currentPosterIndex]; if (!posterImage) return;
            const c = parseInt(document.getElementById('poster-cols').value) || 1;
            const r = parseInt(document.getElementById('poster-rows').value) || 1;
            const totalPages = c * r * posterImages.length; const singleFilePages = c * r;
            const text = posterImages.length > 1 ? `${singleFilePages} por archivo (Total: ${totalPages})` : `${singleFilePages}`;
            document.getElementById('poster-total-pages').innerText = text;

            const cvs = document.getElementById('poster-preview-canvas'); const ctx = cvs.getContext('2d');
            const s = Math.min(800 / posterImage.width, 1); cvs.width = posterImage.width * s; cvs.height = posterImage.height * s;
            ctx.drawImage(posterImage, 0, 0, cvs.width, cvs.height);
            ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2; ctx.setLineDash([10, 5]);
            const cw = cvs.width / c; const ch = cvs.height / r;
            for (let i = 1; i < c; i++) { ctx.beginPath(); ctx.moveTo(cw * i, 0); ctx.lineTo(cw * i, cvs.height); ctx.stroke(); }
            for (let i = 1; i < r; i++) { ctx.beginPath(); ctx.moveTo(0, ch * i); ctx.lineTo(cvs.width, ch * i); ctx.stroke(); }
        }

        function resetPoster() { posterImages = []; currentPosterIndex = 0; document.getElementById('file-input-poster').value = ''; document.getElementById('poster-workspace').classList.add('hidden'); document.getElementById('poster-upload-area').classList.remove('hidden'); }

        async function generatePosterPDF(forPrint = false) {
            if (!posterImages.length) return; showLoader("Generando Alta Calidad...");
            await new Promise(r => setTimeout(r, 100));

            const cols = parseInt(document.getElementById('poster-cols').value);
            const rows = parseInt(document.getElementById('poster-rows').value);
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            doc.deletePage(1);

            for (const posterImage of posterImages) {
                const sw = posterImage.width / cols; const sh = posterImage.height / rows;
                const tc = document.createElement('canvas'); tc.width = sw; tc.height = sh; const tctx = tc.getContext('2d');
                for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        tctx.clearRect(0, 0, sw, sh);
                        tctx.drawImage(posterImage, c * sw, r * sh, sw, sh, 0, 0, sw, sh);
                        doc.addPage('a4', 'p');
                        const tileData = tc.toDataURL('image/png');
                        doc.addImage(tileData, 'PNG', 0, 0, 210, 297);
                    }
                }
            }
            if (forPrint) { hideLoader(); return doc.output('blob'); }
            doc.save('poster_hq.pdf'); hideLoader();
        }

        // COLLAGE
        let collageImages = []; let collageTemplate = 'grid';
        document.getElementById('file-input-collage').addEventListener('change', async (e) => { const f = Array.from(e.target.files); if (!f.length) return; showLoader("Cargando..."); for (const file of f) { let u = null, ext = file.name.split('.').pop().toLowerCase(); if (['heic', 'heif'].includes(ext)) u = await blobToDataURL(await heic2any({ blob: file, toType: "image/jpeg" })); else u = await blobToDataURL(file); collageImages.push(await loadImage(u)); } hideLoader(); document.getElementById('collage-upload-area').classList.add('hidden'); document.getElementById('collage-workspace').classList.remove('hidden'); renderCollage(); });
        function setCollageTemplate(t) { collageTemplate = t; document.querySelectorAll('.template-option').forEach(e => e.classList.remove('selected')); document.getElementById('tmpl-' + t).classList.add('selected'); renderCollage(); }
        function setBg(c) { document.getElementById('collage-bg').value = c; updateCollageSettings(); }
        function updateCollageSettings() { document.getElementById('gap-val').innerText = document.getElementById('collage-gap').value + 'px'; renderCollage(); }

        function renderCollage() {
            if (!collageImages.length) return; const cvs = document.getElementById('collage-canvas'), ctx = cvs.getContext('2d'), gap = parseInt(document.getElementById('collage-gap').value), W = 1200, H = 1200;
            cvs.width = W; cvs.height = H; ctx.fillStyle = document.getElementById('collage-bg').value; ctx.fillRect(0, 0, W, H);
            const count = collageImages.length;

            if (collageTemplate === 'grid') { const cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols), cw = (W - (gap * (cols + 1))) / cols, ch = (H - (gap * (rows + 1))) / rows; collageImages.forEach((img, i) => { const c = i % cols, r = Math.floor(i / cols); drawContain(ctx, img, gap + c * (cw + gap), gap + r * (ch + gap), cw, ch); }); }
            else if (collageTemplate === 'mosaic') { if (count === 0) return; const bw = (W - gap * 3) / 2, bh = H - gap * 2; drawContain(ctx, collageImages[0], gap, gap, bw, bh); const rem = collageImages.slice(1); if (rem.length) { const sh = (H - (gap * (rem.length + 1))) / rem.length; rem.forEach((img, i) => { drawContain(ctx, img, gap * 2 + bw, gap + i * (sh + gap), bw, sh); }); } }
            else if (collageTemplate === 'strip') { const rh = (H - (gap * (count + 1))) / count, rw = W - gap * 2; collageImages.forEach((img, i) => { drawContain(ctx, img, gap, gap + i * (rh + gap), rw, rh); }); }
            else if (collageTemplate === 'pile') { const sz = W * 0.4; collageImages.forEach(img => { ctx.save(); ctx.translate((W / 2) + (Math.random() - 0.5) * (W * 0.4), (H / 2) + (Math.random() - 0.5) * (H * 0.4)); ctx.rotate((Math.random() - 0.5) * 0.5); ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 20; ctx.fillStyle = "white"; ctx.fillRect(-sz / 2 - 20, -sz / 2 - 20, sz + 40, sz + 40 + 40); ctx.shadowColor = "transparent"; drawContain(ctx, img, -sz / 2, -sz / 2, sz, sz); ctx.restore(); }); }

            else if (collageTemplate === '2v') { const w = (W - gap * 3) / 2, h = H - gap * 2; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w, h); if (collageImages[1]) drawContain(ctx, collageImages[1], gap * 2 + w, gap, w, h); }
            else if (collageTemplate === '2h') { const w = W - gap * 2, h = (H - gap * 3) / 2; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w, h); if (collageImages[1]) drawContain(ctx, collageImages[1], gap, gap * 2 + h, w, h); }
            else if (collageTemplate === '3v') { const w = (W - gap * 4) / 3, h = H - gap * 2; collageImages.forEach((img, i) => { if (i < 3) drawContain(ctx, img, gap + i * (w + gap), gap, w, h); }); }
            else if (collageTemplate === '3h') { const w = W - gap * 2, h = (H - gap * 4) / 3; collageImages.forEach((img, i) => { if (i < 3) drawContain(ctx, img, gap + i * (h + gap), w, h); }); }
            else if (collageTemplate === '1u2d') { const h1 = (H - gap * 3) / 2; const w2 = (W - gap * 3) / 2; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, W - gap * 2, h1); if (collageImages[1]) drawContain(ctx, collageImages[1], gap, gap * 2 + h1, w2, h1); if (collageImages[2]) drawContain(ctx, collageImages[2], gap * 2 + w2, gap * 2 + h1, w2, h1); }
            else if (collageTemplate === '2u1d') { const h1 = (H - gap * 3) / 2; const w2 = (W - gap * 3) / 2; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w2, h1); if (collageImages[1]) drawContain(ctx, collageImages[1], gap * 2 + w2, gap, w2, h1); if (collageImages[2]) drawContain(ctx, collageImages[2], gap, gap * 2 + h1, W - gap * 2, h1); }
            else if (collageTemplate === '1l2r') { const w1 = (W - gap * 3) / 2; const h2 = (H - gap * 3) / 2; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w1, H - gap * 2); if (collageImages[1]) drawContain(ctx, collageImages[1], gap * 2 + w1, gap, w1, h2); if (collageImages[2]) drawContain(ctx, collageImages[2], gap * 2 + w1, gap * 2 + h2, w1, h2); }
            else if (collageTemplate === '2l1r') { const w1 = (W - gap * 3) / 2; const h2 = (H - gap * 3) / 2; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w1, h2); if (collageImages[1]) drawContain(ctx, collageImages[1], gap, gap * 2 + h2, w1, h2); if (collageImages[2]) drawContain(ctx, collageImages[2], gap * 2 + w1, gap, w1, H - gap * 2); }
            else if (collageTemplate === '2x2') { const w = (W - gap * 3) / 2, h = (H - gap * 3) / 2; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w, h); if (collageImages[1]) drawContain(ctx, collageImages[1], gap * 2 + w, gap, w, h); if (collageImages[2]) drawContain(ctx, collageImages[2], gap, gap * 2 + h, w, h); if (collageImages[3]) drawContain(ctx, collageImages[3], gap * 2 + w, gap * 2 + h, w, h); }
            else if (collageTemplate === '1u3d') { const h1 = (H - gap * 3) * 0.6; const h2 = (H - gap * 3) * 0.4; const w2 = (W - gap * 4) / 3; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, W - gap * 2, h1); for (let i = 0; i < 3; i++) if (collageImages[i + 1]) drawContain(ctx, collageImages[i + 1], gap + i * (w2 + gap), gap * 2 + h1, w2, h2); }
            else if (collageTemplate === '3u1d') { const h1 = (H - gap * 3) * 0.4; const h2 = (H - gap * 3) * 0.6; const w1 = (W - gap * 4) / 3; for (let i = 0; i < 3; i++) if (collageImages[i]) drawContain(ctx, collageImages[i], gap + i * (w1 + gap), gap, w1, h1); if (collageImages[3]) drawContain(ctx, collageImages[3], gap, gap * 2 + h1, W - gap * 2, h2); }
            else if (collageTemplate === '1l3r') { const w1 = (W - gap * 3) * 0.6; const w2 = (W - gap * 3) * 0.4; const h2 = (H - gap * 4) / 3; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w1, H - gap * 2); for (let i = 0; i < 3; i++) if (collageImages[i + 1]) drawContain(ctx, collageImages[i + 1], gap * 2 + w1, gap + i * (h2 + gap), w2, h2); }
            else if (collageTemplate === '3l1r') { const w1 = (W - gap * 3) * 0.4; const w2 = (W - gap * 3) * 0.6; const h1 = (H - gap * 4) / 3; for (let i = 0; i < 3; i++) if (collageImages[i]) drawContain(ctx, collageImages[i], gap, gap + i * (h1 + gap), w1, h1); if (collageImages[3]) drawContain(ctx, collageImages[3], gap * 2 + w1, gap, w2, H - gap * 2); }
            else if (collageTemplate === '2u3d') { const h = (H - gap * 3) / 2; const w1 = (W - gap * 3) / 2; const w2 = (W - gap * 4) / 3; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w1, h); if (collageImages[1]) drawContain(ctx, collageImages[1], gap * 2 + w1, gap, w1, h); for (let i = 0; i < 3; i++) if (collageImages[i + 2]) drawContain(ctx, collageImages[i + 2], gap + i * (w2 + gap), gap * 2 + h, w2, h); }
            else if (collageTemplate === '3u2d') { const h = (H - gap * 3) / 2; const w1 = (W - gap * 4) / 3; const w2 = (W - gap * 3) / 2; for (let i = 0; i < 3; i++) if (collageImages[i]) drawContain(ctx, collageImages[i], gap + i * (w1 + gap), gap, w1, h); if (collageImages[3]) drawContain(ctx, collageImages[3], gap, gap * 2 + h, w2, h); if (collageImages[4]) drawContain(ctx, collageImages[4], gap * 2 + w2, gap * 2 + h, w2, h); }
            else if (collageTemplate === '1l4r') { const w1 = (W - gap * 3) * 0.5; const w2 = (W - gap * 3) * 0.5; const h2 = (H - gap * 3) / 2; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, w1, H - gap * 2); const wSub = (w2 - gap) / 2; if (collageImages[1]) drawContain(ctx, collageImages[1], gap * 2 + w1, gap, wSub, h2); if (collageImages[2]) drawContain(ctx, collageImages[2], gap * 2 + w1 + wSub + gap, gap, wSub, h2); if (collageImages[3]) drawContain(ctx, collageImages[3], gap * 2 + w1, gap * 2 + h2, wSub, h2); if (collageImages[4]) drawContain(ctx, collageImages[4], gap * 2 + w1 + wSub + gap, gap * 2 + h2, wSub, h2); }
            else if (collageTemplate === '2x3') { const w = (W - gap * 3) / 2, h = (H - gap * 4) / 3; collageImages.forEach((img, i) => { if (i < 6) { const c = i % 2, r = Math.floor(i / 2); drawContain(ctx, img, gap + c * (w + gap), gap + r * (h + gap), w, h); } }); }
            else if (collageTemplate === '3x2') { const w = (W - gap * 4) / 3, h = (H - gap * 3) / 2; collageImages.forEach((img, i) => { if (i < 6) { const c = i % 3, r = Math.floor(i / 3); drawContain(ctx, img, gap + c * (w + gap), gap + r * (h + gap), w, h); } }); }
            else if (collageTemplate === '1u5d') { const h1 = (H - gap * 3) * 0.5; const h2 = (H - gap * 3) * 0.5; const w2 = (W - gap * 6) / 5; if (collageImages[0]) drawContain(ctx, collageImages[0], gap, gap, W - gap * 2, h1); for (let i = 0; i < 5; i++) if (collageImages[i + 1]) drawContain(ctx, collageImages[i + 1], gap + i * (w2 + gap), gap * 2 + h1, w2, h2); }
            else if (collageTemplate === '4x2') { const w = (W - gap * 5) / 4, h = (H - gap * 3) / 2; collageImages.forEach((img, i) => { if (i < 8) { const c = i % 4, r = Math.floor(i / 4); drawContain(ctx, img, gap + c * (w + gap), gap + r * (h + gap), w, h); } }); }
            else if (collageTemplate === '3x3') { const w = (W - gap * 4) / 3, h = (H - gap * 4) / 3; collageImages.forEach((img, i) => { if (i < 9) { const c = i % 3, r = Math.floor(i / 3); drawContain(ctx, img, gap + c * (w + gap), gap + r * (h + gap), w, h); } }); }
        }
        function drawContain(ctx, img, x, y, w, h) { const r = img.width / img.height, tr = w / h; let dx, dy, dw, dh; if (r > tr) { dw = w; dh = w / r; dx = x; dy = y + (h - dh) / 2; } else { dh = h; dw = h * r; dy = y; dx = x + (w - dw) / 2; } ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh); }
        function resetCollage() { collageImages = []; document.getElementById('collage-upload-area').classList.remove('hidden'); document.getElementById('collage-workspace').classList.add('hidden'); document.getElementById('file-input-collage').value = ''; }
        function downloadCollage() { const l = document.createElement('a'); l.download = `collage_${Date.now()}.png`; l.href = document.getElementById('collage-canvas').toDataURL(); l.click(); }

        // ==========================================
        // 8. MARCA DE AGUA
        // ==========================================
        let wmFile = null;
        document.getElementById('file-input-watermark').addEventListener('change', (e) => {
            const f = e.target.files[0]; if (!f) return;
            wmFile = f;
            document.getElementById('watermark-upload-area').classList.add('hidden');
            document.getElementById('watermark-workspace').classList.remove('hidden');
        });
        function resetWatermark() { wmFile = null; document.getElementById('file-input-watermark').value = ''; document.getElementById('watermark-workspace').classList.add('hidden'); document.getElementById('watermark-upload-area').classList.remove('hidden'); }

        async function generateWatermark(forPrint = false) {
            if (!wmFile) return; showLoader("Aplicando Marca de Agua...");
            try {
                const ab = await wmFile.arrayBuffer();
                const doc = await PDFLib.PDFDocument.load(ab);
                const text = document.getElementById('wm-text').value;
                const colorHex = document.getElementById('wm-color').value;
                const opacity = parseFloat(document.getElementById('wm-opacity').value);
                const rotation = parseInt(document.getElementById('wm-rotation').value);
                const size = parseInt(document.getElementById('wm-size').value);

                // Convert hex to rgb
                const r = parseInt(colorHex.substr(1, 2), 16) / 255;
                const g = parseInt(colorHex.substr(3, 2), 16) / 255;
                const b = parseInt(colorHex.substr(5, 2), 16) / 255;

                const pages = doc.getPages();
                pages.forEach(page => {
                    const { width, height } = page.getSize();
                    page.drawText(text, {
                        x: width / 2 - (text.length * size / 4), // Simple centering approx
                        y: height / 2,
                        size: size,
                        color: PDFLib.rgb(r, g, b),
                        opacity: opacity,
                        rotate: PDFLib.degrees(rotation),
                    });
                });

                const pdfBytes = await doc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                if (forPrint) return blob;
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'watermarked.pdf'; link.click();
            } catch (e) { console.error(e); alert("Error: " + e.message); } finally { hideLoader(); }
        }

        // ==========================================
        // 9. NÚMEROS DE PÁGINA
        // ==========================================
        let pnFile = null;
        document.getElementById('file-input-pagenum').addEventListener('change', (e) => {
            const f = e.target.files[0]; if (!f) return;
            pnFile = f;
            document.getElementById('pagenum-upload-area').classList.add('hidden');
            document.getElementById('pagenum-workspace').classList.remove('hidden');
        });
        function resetPageNum() { pnFile = null; document.getElementById('file-input-pagenum').value = ''; document.getElementById('pagenum-workspace').classList.add('hidden'); document.getElementById('pagenum-upload-area').classList.remove('hidden'); }

        async function generatePageNum(forPrint = false) {
            if (!pnFile) return; showLoader("Numerando...");
            try {
                const ab = await pnFile.arrayBuffer();
                const doc = await PDFLib.PDFDocument.load(ab);
                const pos = document.getElementById('pn-position').value;
                const fmt = document.getElementById('pn-format').value;
                const pages = doc.getPages();
                const total = pages.length;

                pages.forEach((page, idx) => {
                    const { width, height } = page.getSize();
                    let text = '';
                    const n = idx + 1;
                    if (fmt === 'n') text = `${n}`;
                    else if (fmt === 'p-n') text = `Página ${n}`;
                    else if (fmt === 'n-of-total') text = `${n} de ${total}`;

                    let x = 0, y = 20; // Default bottom
                    const textWidth = text.length * 12 * 0.6; // Approx width

                    if (pos.includes('bottom')) y = 20;
                    else y = height - 20;

                    if (pos.includes('left')) x = 20;
                    else if (pos.includes('center')) x = (width / 2) - (textWidth / 2);
                    else x = width - textWidth - 20;

                    page.drawText(text, { x, y, size: 12, color: PDFLib.rgb(0, 0, 0) });
                });

                const pdfBytes = await doc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                if (forPrint) return blob;
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'numerado.pdf'; link.click();
            } catch (e) { console.error(e); alert("Error: " + e.message); } finally { hideLoader(); }
        }



        // ==========================================
        // 11. FIRMAR PDF
        // ==========================================
        let signFile = null; let signPdfBytes = null; let signPageIdx = 0; let signScale = 1; let signCoords = { x: 0, y: 0 };
        let signImgData = null; // DataURL de la firma

        // CANVAS DE DIBUJO
        const sigCanvas = document.getElementById('sig-canvas');
        const sigCtx = sigCanvas.getContext('2d');
        let painting = false;

        function startPosition(e) { painting = true; draw(e); }
        function endPosition() { painting = false; sigCtx.beginPath(); }
        function draw(e) {
            if (!painting) return;
            e.preventDefault();
            const rect = sigCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            sigCtx.lineWidth = 2; sigCtx.lineCap = 'round'; sigCtx.strokeStyle = 'black';
            sigCtx.lineTo(clientX - rect.left, clientY - rect.top);
            sigCtx.stroke();
            sigCtx.beginPath();
            sigCtx.moveTo(clientX - rect.left, clientY - rect.top);
        }

        // Eventos ratón y touch
        sigCanvas.addEventListener('mousedown', startPosition); sigCanvas.addEventListener('mouseup', endPosition); sigCanvas.addEventListener('mousemove', draw);
        sigCanvas.addEventListener('touchstart', startPosition); sigCanvas.addEventListener('touchend', endPosition); sigCanvas.addEventListener('touchmove', draw);

        // --- GESTIÓN DE PESTAÑAS Y MODOS DE FIRMA ---
        let currentSignMode = 'draw'; // draw, type, upload
        let selectedFont = 'Great Vibes';
        let selectedUploadImg = null;

        function setSignTab(mode) {
            currentSignMode = mode;
            // Update Tab UI
            ['draw', 'type', 'upload'].forEach(m => {
                const btn = document.getElementById(`tab-sign-${m}`);
                const content = document.getElementById(`sign-content-${m}`);
                if (m === mode) {
                    btn.classList.replace('text-slate-500', 'text-slate-800');
                    btn.classList.replace('dark:text-slate-400', 'dark:text-slate-200');
                    btn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow');
                    content.classList.remove('hidden');
                } else {
                    btn.classList.replace('text-slate-800', 'text-slate-500');
                    btn.classList.replace('dark:text-slate-200', 'dark:text-slate-400');
                    btn.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow');
                    content.classList.add('hidden');
                }
            });
            // Reset actions area if changing modes
            // document.getElementById('sig-actions').classList.add('hidden');
        }

        function setSignColor(color) {
            document.getElementById('sign-color-val').value = color;
            renderTypePreviews();
        }

        function renderTypePreviews() {
            const text = document.getElementById('sign-text-input').value || "Tu Firma";
            const color = document.getElementById('sign-color-val').value;
            const fonts = ['Great Vibes', 'Dancing Script', 'Sacramento', 'Allura'];
            const container = document.getElementById('type-previews');
            container.innerHTML = '';

            fonts.forEach(font => {
                const div = document.createElement('div');
                div.className = `p-2 rounded border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${selectedFont === font ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-600'}`;
                div.onclick = () => { selectedFont = font; renderTypePreviews(); };

                const span = document.createElement('span');
                span.style.fontFamily = font;
                span.style.color = color;
                span.style.fontSize = "24px";
                span.innerText = text;

                div.appendChild(span);
                container.appendChild(div);
            });
        }

        function handleSignUpload(input) {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    selectedUploadImg = e.target.result;
                    const preview = document.getElementById('sign-upload-preview');
                    preview.innerHTML = `<img src="${selectedUploadImg}" class="max-h-[100px] object-contain">`;
                };
                reader.readAsDataURL(file);
            }
        }

        function clearSig() {
            sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
            signImgData = null;
            document.getElementById('sig-ghost').classList.add('hidden');
            document.getElementById('sig-actions').classList.add('hidden');
        }

        async function saveSig() {
            if (currentSignMode === 'draw') {
                signImgData = sigCanvas.toDataURL('image/png');
            } else if (currentSignMode === 'type') {
                const text = document.getElementById('sign-text-input').value;
                if (!text) return alert("Escribe tu nombre primero");
                const color = document.getElementById('sign-color-val').value;

                // Generar canvas temporal
                const c = document.createElement('canvas');
                const ctx = c.getContext('2d');
                ctx.font = `60px "${selectedFont}"`;
                const textMetrics = ctx.measureText(text);
                c.width = textMetrics.width + 20;
                c.height = 100; // Altura fija suficiente

                // Redibujar con dimensiones correctas
                ctx.font = `60px "${selectedFont}"`;
                ctx.fillStyle = color;
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 10, 50);

                signImgData = c.toDataURL('image/png');
            } else if (currentSignMode === 'upload') {
                if (!selectedUploadImg) return alert("Sube una imagen primero");
                signImgData = selectedUploadImg;
            }

            document.getElementById('sig-actions').classList.remove('hidden');
            // Activar modo colocación
            document.getElementById('sig-ghost').innerHTML = `<img src="${signImgData}" class="w-full h-full object-contain">`;
            document.getElementById('sig-ghost').classList.remove('hidden');
            alert("Firma generada. Ahora haz clic en el PDF (derecha) para colocarla.");
        }

        document.getElementById('file-input-sign').addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return;
            signFile = f;
            showLoader("Cargando PDF...");
            try {
                signPdfBytes = await f.arrayBuffer();
                document.getElementById('sign-upload-area').classList.add('hidden');
                document.getElementById('sign-workspace').classList.remove('hidden');
                signPageIdx = 0;
                await renderSignPage();
            } catch (e) { console.error(e); } finally { hideLoader(); }
        });

        async function renderSignPage() {
            const pdf = await pdfjsLib.getDocument({ data: signPdfBytes.slice(0) }).promise;
            const page = await pdf.getPage(signPageIdx + 1);
            const viewport = page.getViewport({ scale: 1 });
            const container = document.getElementById('sign-pdf-container');
            // Ajustar escala para que quepa en el contenedor (aprox 500px width o height)
            const availableW = container.clientWidth || 500;
            const scale = availableW / viewport.width;
            signScale = scale;
            const scaledViewport = page.getViewport({ scale: scale });

            const canvas = document.getElementById('sign-pdf-canvas');
            canvas.width = scaledViewport.width; canvas.height = scaledViewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaledViewport }).promise;
            document.getElementById('sign-page-indicator').innerText = `Pág ${signPageIdx + 1} de ${pdf.numPages}`;
        }

        function prevSignPage() { if (signPageIdx > 0) { signPageIdx--; renderSignPage(); } }
        async function nextSignPage() {
            const pdf = await pdfjsLib.getDocument({ data: signPdfBytes.slice(0) }).promise;
            if (signPageIdx < pdf.numPages - 1) { signPageIdx++; renderSignPage(); }
        }
        function resetSign() { clearSig(); signFile = null; signPdfBytes = null; document.getElementById('sign-workspace').classList.add('hidden'); document.getElementById('sign-upload-area').classList.remove('hidden'); document.getElementById('file-input-sign').value = ''; }

        function placeSignatureOnPage(e) {
            if (!signImgData) return alert("Primero dibuja y guarda tu firma.");
            const rect = document.getElementById('sign-pdf-canvas').getBoundingClientRect();
            // Coordenadas relativas al canvas visual
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Actualizar fantasma visual
            const ghost = document.getElementById('sig-ghost');

            // Ajustar tamaño del ghost basado en proporción si es posible, si no default
            // Como signImgData ahora puede ser cualquier cosa, mejor usamos un tamaño fijo por defecto
            // y permitimos que la img interna haga object-contain

            ghost.style.left = (x - 60) + 'px'; // Centrado aprox
            ghost.style.top = (y - 30) + 'px';
            ghost.style.width = '120px';
            ghost.style.height = '60px';
            ghost.classList.remove('hidden');

            // Guardar para generación
            // Las coordenadas deben convertirse a escala PDF original
            // Y recordar que PDF coords empiezan abajo-izquierda, pero PDF.js visual es arriba-izquierda.
            // Necesitamos la altura real de la página PDF para invertir Y.
            signCoords = { x, y };
        }

        async function downloadSignedPDF(forPrint = false) {
            if (!signImgData || !signPdfBytes) return;
            showLoader("Firmando...");
            try {
                const doc = await PDFLib.PDFDocument.load(signPdfBytes);
                const page = doc.getPages()[signPageIdx];
                const { width, height } = page.getSize(); // Dimensiones PDF reales

                // Embed png
                const pngImage = await doc.embedPng(signImgData);
                const pngDims = pngImage.scale(0.5); // Escala inicial arbitraria

                // Calcular posición real
                // signCoords.x / signScale = coord X original
                // signCoords.y / signScale = coord Y original (desde arriba)
                // PDF Y = height - coord Y original

                const realX = (signCoords.x - 60) / signScale; // Ajustamos centro
                const realY = height - ((signCoords.y + 30) / signScale); // Invertimos Y

                page.drawImage(pngImage, {
                    x: realX,
                    y: realY,
                    width: 120 / signScale, // Ancho relativo
                    height: 60 / signScale,
                });

                const pdfBytes = await doc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                if (forPrint) return blob;
                const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'firmado.pdf'; link.click();
            } catch (e) { console.error(e); alert("Error firmando: " + e.message); } finally { hideLoader(); }
        }

        // ==========================================
        // 12. COMPRIMIR PDF
        // ==========================================
        let compressFile = null;
        document.getElementById('file-input-compress').addEventListener('change', (e) => {
            const f = e.target.files[0]; if (!f) return;
            compressFile = f;
            document.getElementById('compress-upload-area').classList.add('hidden');
            document.getElementById('compress-workspace').classList.remove('hidden');
        });
        function resetCompress() { compressFile = null; document.getElementById('compress-workspace').classList.add('hidden'); document.getElementById('compress-upload-area').classList.remove('hidden'); document.getElementById('file-input-compress').value = ''; }

        async function compressPDF(forPrint = false) {
            if (!compressFile) return;
            const level = document.querySelector('input[name="compress-level"]:checked').value;
            showLoader("Comprimiendo PDF...");

            try {
                const ab = await compressFile.arrayBuffer();

                if (level === 'standard') {
                    const doc = await PDFLib.PDFDocument.load(ab);
                    const pdfBytes = await doc.save(); // Default compression is standard
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    if (forPrint) return blob;
                    downloadBlob(blob, 'optimizado_std.pdf');
                } else {
                    // Strong: Rasterize to JPEG using pdf.js -> jsPDF
                    // This is lossy and removes text layer
                    const pdf = await pdfjsLib.getDocument({ data: ab.slice(0) }).promise;
                    const { jsPDF } = window.jspdf;
                    const newDoc = new jsPDF({ format: 'a4', unit: 'mm' });
                    newDoc.deletePage(1);

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const viewport = page.getViewport({ scale: 1.5 }); // Good quality for reading, but smaller
                        const canvas = document.createElement('canvas');
                        canvas.width = viewport.width;
                        canvas.height = viewport.height;
                        await page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise;

                        const imgData = canvas.toDataURL('image/jpeg', 0.7); // 70% quality JPEG

                        const pdfPageWidth = 210;
                        const pdfPageHeight = 297;

                        // Fit to page (simple fit, assume A4 usually)
                        newDoc.addPage('a4', viewport.width > viewport.height ? 'l' : 'p');
                        const isLandscape = viewport.width > viewport.height;

                        newDoc.addImage(imgData, 'JPEG', 0, 0, isLandscape ? 297 : 210, isLandscape ? 210 : 297);
                    }
                    if (forPrint) return newDoc.output('blob');
                    newDoc.save('comprimido_fuerte.pdf');
                }

            } catch (e) {
                console.error(e);
                alert("Error durante la compresión: " + e.message);
            } finally {
                hideLoader();
            }
        }

        function downloadBlob(blob, name) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = name;
            link.click();
        }



        // ==========================================
        // 13. OCR (TEXT RECOGNITION)
        // ==========================================
        let ocrFile = null;
        let ocrPreviewUrl = null;

        document.getElementById('file-input-ocr').addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return;
            ocrFile = f;
            showLoader("Cargando vista previa...");
            try {
                let url = null;
                if (f.type === 'application/pdf') {
                    const ab = await f.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
                    const page = await pdf.getPage(1); // Page 1 only for now
                    const vp = page.getViewport({ scale: 1.5 });
                    const cvs = document.createElement('canvas'); cvs.width = vp.width; cvs.height = vp.height;
                    await page.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
                    url = cvs.toDataURL('image/jpeg');
                } else {
                    url = await blobToDataURL(f);
                }
                ocrPreviewUrl = url;
                document.getElementById('ocr-preview-img').src = url;
                document.getElementById('ocr-upload-area').classList.add('hidden');
                document.getElementById('ocr-workspace').classList.remove('hidden');
                document.getElementById('ocr-result-text').value = '';
            } catch (err) { console.error(err); alert("Error al cargar"); } finally { hideLoader(); }
        });

        async function startOCR() {
            if (!ocrPreviewUrl) return;
            showLoader("Analizando texto (Tesseract)...");
            const lang = document.getElementById('ocr-lang').value;
            try {
                const { data: { text } } = await Tesseract.recognize(ocrPreviewUrl, lang, {
                    logger: m => { } // console.log(m)
                });
                document.getElementById('ocr-result-text').value = text;
            } catch (e) {
                console.error(e); alert("Error en OCR: " + e.message);
            } finally { hideLoader(); }
        }

        function copyOCRText() {
            const txt = document.getElementById('ocr-result-text');
            txt.select();
            document.execCommand('copy');
            alert("Texto copiado");
        }
        function downloadOCRText() {
            const txt = document.getElementById('ocr-result-text').value;
            if (!txt) return;
            const blob = new Blob([txt], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "texto_extraido.txt"; a.click();
        }
        function resetOCR() {
            ocrFile = null; ocrPreviewUrl = null;
            document.getElementById('ocr-workspace').classList.add('hidden');
            document.getElementById('ocr-upload-area').classList.remove('hidden');
            document.getElementById('file-input-ocr').value = '';
        }

        // ==========================================
        // 14. SCAN ENHANCER (BINARIZATION)
        // ==========================================
        let scanImgOriginal = null; // Image Object
        let scanCanvas = document.getElementById('scan-canvas');
        let scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true }); // Optimizado para lecturas

        document.getElementById('file-input-scan').addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return;
            showLoader("Cargando imagen...");
            try {
                const url = await blobToDataURL(f);
                const img = await loadImage(url);
                scanImgOriginal = img;

                // Fit canvas to image (max dimensions handled by CSS object-contain)
                scanCanvas.width = img.width;
                scanCanvas.height = img.height;

                // Initial Render (Auto Enhance)
                updateScanPreview();

                document.getElementById('scan-upload-area').classList.add('hidden');
                document.getElementById('scan-workspace').classList.remove('hidden');
            } catch (err) { console.error(err); alert("Error al cargar imagen"); } finally { hideLoader(); }
        });

        function updateScanPreview() {
            if (!scanImgOriginal) return;
            // 1. Draw Original
            scanCtx.drawImage(scanImgOriginal, 0, 0);

            // 2. Get Data
            const idata = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
            const data = idata.data;
            const threshold = parseInt(document.getElementById('scan-threshold').value);
            document.getElementById('scan-threshold-val').innerText = threshold;
            // const blur = parseFloat(document.getElementById('scan-blur').value); // Not implemented simple js blur manually here for speed, just threshold

            // 3. Simple Binarization Loop
            for (let i = 0; i < data.length; i += 4) {
                // Grayscale
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                // Threshold
                const val = avg < threshold ? 0 : 255;
                data[i] = val;     // R
                data[i + 1] = val; // G
                data[i + 2] = val; // B
                // Alpha stays same
            }

            // 4. Put Data Back
            scanCtx.putImageData(idata, 0, 0);
        }

        function downloadScan(fmt, forPrint = false) {
            if (!scanImgOriginal) return;
            if (fmt === 'jpg') {
                if (forPrint) return printCanvasImage('scan-canvas');
                const a = document.createElement('a');
                a.href = scanCanvas.toDataURL('image/jpeg', 0.9);
                a.download = "scan_mejorado.jpg";
                a.click();
            } else if (fmt === 'pdf') {
                showLoader("Generando PDF...");
                const { jsPDF } = window.jspdf;
                // Determine orientation
                const orient = scanCanvas.width > scanCanvas.height ? 'l' : 'p';
                const doc = new jsPDF({ orientation: orient, unit: 'px', format: [scanCanvas.width, scanCanvas.height] });
                const imgData = scanCanvas.toDataURL('image/jpeg', 0.9);
                doc.addImage(imgData, 'JPEG', 0, 0, scanCanvas.width, scanCanvas.height);
                hideLoader();
                if (forPrint) return doc.output('blob');
                doc.save("scan_documento.pdf");
            }
        }

        function resetScan() {
            scanImgOriginal = null;
            document.getElementById('scan-workspace').classList.add('hidden');
            document.getElementById('scan-upload-area').classList.remove('hidden');
            document.getElementById('file-input-scan').value = '';
            // Reset controls
            document.getElementById('scan-threshold').value = 160;
        }

        // ==========================================
        // PRINT UTILITIES - For all tool sections
        // ==========================================

        // Generic: open a PDF blob in a new tab and trigger print
        function printPdfBlob(blob) {
            hideLoader();
            const url = URL.createObjectURL(blob);
            setTimeout(() => {
                const printWin = window.open(url, '_blank');
                if (printWin) {
                    printWin.addEventListener('load', () => { setTimeout(() => { printWin.print(); }, 500); });
                } else {
                    alert("No se pudo abrir la ventana de impresión. Permite los popups.");
                }
            }, 300);
        }

        // Generic: print a canvas element by its ID
        function printCanvasImage(canvasId) {
            hideLoader();
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const dataUrl = canvas.toDataURL('image/png');
            setTimeout(() => {
                const printWin = window.open('', '_blank');
                if (printWin) {
                    printWin.document.write(`<html><head><title>Imprimir</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;}img{max-width:100%;max-height:100vh;object-fit:contain;}@media print{body{margin:0;}img{max-width:100%;max-height:100%;}}</style></head><body><img src="${dataUrl}" onload="setTimeout(()=>{window.print();},300)"></body></html>`);
                    printWin.document.close();
                } else {
                    alert("No se pudo abrir la ventana de impresión. Permite los popups.");
                }
            }, 300);
        }

        // Generic: open a jsPDF doc in print window instead of saving
        function printJsPdfDoc(doc) {
            const blob = doc.output('blob');
            printPdfBlob(blob);
        }

        // 1. IMG TO PDF - Print
        async function printImgPDF() { try { const b = await generateImgPDF(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 2. N-UP - Print
        async function printNUpPDF() { try { const b = await generateNUpPDF(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 3. SPLIT - Print
        async function printSplitPDF() { try { const b = await downloadSplitPDF(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 4. MERGE - Print
        async function printMergePDF() { try { const b = await mergePDFs(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 6. POSTER - Print
        async function printPosterPDF() { try { const b = await generatePosterPDF(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 7. COLLAGE - Print (uses canvas)
        function printCollage() { try { printCanvasImage('collage-canvas'); } finally { hideLoader(); } }

        // 8. WATERMARK - Print
        async function printWatermarkPDF() { try { const b = await generateWatermark(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 9. PAGE NUMBERS - Print
        async function printPageNumPDF() { try { const b = await generatePageNum(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 11. SIGN PDF - Print
        async function printSignedPDF() { try { const b = await downloadSignedPDF(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 10. COMPRESS - Print
        async function printCompressPDF() { try { const b = await compressPDF(true); if(b) printPdfBlob(b); } finally { hideLoader(); } }

        // 12. SCAN - Print (uses canvas)
        function printScan() { try { printCanvasImage('scan-canvas'); } finally { hideLoader(); } }


        // ==========================================
        // 0. REMOVER FONDO (IA) - LOGIC
        // ==========================================
        let bgRemImages = [];
        let isBgRemProcessing = false;

        document.getElementById('file-input-bgrem').addEventListener('change', async (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                const newImages = Array.from(files).map(file => ({
                    id: Math.random().toString(36).substr(2, 9),
                    originalBlob: file,
                    originalUrl: URL.createObjectURL(file),
                    processedUrl: null,
                    status: 'pending',
                    name: file.name
                }));
                bgRemImages = [...bgRemImages, ...newImages];
                renderBgRemGrid();
                document.getElementById('bgrem-workspace').classList.remove('hidden');
            }
            e.target.value = '';
        });

        async function renderBgRemGrid() {
            const grid = document.getElementById('bgrem-grid');
            grid.innerHTML = '';
            document.getElementById('bgrem-count').innerText = `${bgRemImages.length} Imágenes cargadas`;

            bgRemImages.forEach((img, idx) => {
                const card = document.createElement('div');
                card.className = "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col";
                
                let contentHtml = `
                    <div class="p-3 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                        <span class="text-xs font-medium truncate max-w-[200px] text-slate-600 dark:text-slate-400">${img.name}</span>
                        <button onclick="removeBgRemImage('${img.id}')" class="text-slate-400 hover:text-red-500"><i data-lucide="x" class="w-4 h-4"></i></button>
                    </div>
                    <div class="flex-1 flex flex-col md:flex-row h-[300px]">
                        <div class="flex-1 relative border-r border-slate-100 dark:border-slate-700 bg-checkerboard">
                            <div class="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm z-10">Original</div>
                            <img src="${img.originalUrl}" class="w-full h-full object-contain">
                        </div>
                        <div class="flex-1 relative bg-checkerboard flex items-center justify-center">
                            <div class="absolute top-2 left-2 bg-pink-600/80 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm z-10">Sin Fondo</div>
                `;

                if (img.status === 'completed' && img.processedUrl) {
                    contentHtml += `<img src="${img.processedUrl}" class="w-full h-full object-contain">`;
                } else if (img.status === 'processing') {
                    contentHtml += `
                        <div class="text-center">
                            <i data-lucide="loader-2" class="w-8 h-8 text-pink-500 animate-spin mx-auto mb-2"></i>
                            <span class="text-xs text-slate-500 font-medium">Procesando IA...</span>
                        </div>
                    `;
                } else if (img.status === 'error') {
                    contentHtml += `<span class="text-red-500 text-sm">Error al procesar</span>`;
                } else {
                    contentHtml += `<span class="text-slate-400 text-sm italic">Pendiente</span>`;
                }

                contentHtml += `
                        </div>
                    </div>
                    <div class="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
                `;

                if (img.status === 'pending') {
                    contentHtml += `
                        <button onclick="processBgRemImage('${img.id}')" class="text-xs bg-slate-800 dark:bg-slate-700 text-white px-3 py-1.5 rounded hover:bg-slate-700 transition-colors flex items-center gap-1">
                            <i data-lucide="refresh-cw" class="w-3 h-3"></i> Procesar
                        </button>
                    `;
                } else if (img.status === 'completed') {
                    contentHtml += `
                        <button onclick="downloadBgRemImage('${img.processedUrl}', '${img.name}')" class="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm">
                            <i data-lucide="download" class="w-3 h-3"></i> Descargar PNG
                        </button>
                    `;
                }

                contentHtml += `</div>`;
                card.innerHTML = contentHtml;
                grid.appendChild(card);
            });
            lucide.createIcons();
        }

        window.removeBgRemImage = (id) => {
            bgRemImages = bgRemImages.filter(img => img.id !== id);
            renderBgRemGrid();
            if (bgRemImages.length === 0) document.getElementById('bgrem-workspace').classList.add('hidden');
        };

        window.downloadBgRemImage = (url, name) => {
            const a = document.createElement('a');
            a.href = url;
            a.download = `sin-fondo-${name.replace(/\.[^/.]+$/, "")}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        window.processBgRemImage = async (id) => {
            const imgIdx = bgRemImages.findIndex(img => img.id === id);
            if (imgIdx === -1) return;

            bgRemImages[imgIdx].status = 'processing';
            renderBgRemGrid();

            try {
                // Importar dinámicamente la librería para evitar problemas si no carga
                const { removeBackground } = await import('@imgly/background-removal');
                
                // Configuración con publicPath para que encuentre los archivos WASM en el CDN
                const blob = await removeBackground(bgRemImages[imgIdx].originalBlob, {
                    publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/'
                });
                
                bgRemImages[imgIdx].processedUrl = URL.createObjectURL(blob);
                bgRemImages[imgIdx].status = 'completed';
            } catch (err) {
                console.error(err);
                if (!window.crossOriginIsolated) {
                   alert("Aviso: El procesamiento de IA requiere Aislamiento de Origen Cruzado. Si estás abriendo el archivo directamente (file://), NO funcionará. Por favor, usa un servidor local (localhost) o despliega a GitHub Pages.");
                } else {
                   alert("Error en el procesamiento: " + err.message);
                }
                bgRemImages[imgIdx].status = 'error';
            }
            renderBgRemGrid();
        };

        window.processAllBgRem = async () => {
             const pending = bgRemImages.filter(i => i.status === 'pending');
             for (const img of pending) {
                 await processBgRemImage(img.id);
             }
        };



