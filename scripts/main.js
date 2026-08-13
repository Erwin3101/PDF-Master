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
                nav_all: "Todas",

                hero_title: "Suite de Herramientas <span class='text-blue-600 dark:text-blue-400'>PDF</span>",
                hero_desc: "Todas las herramientas que necesitas en un solo lugar. 100% Privado y seguro en tu navegador.",

                // Cards
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
                card_cedula_title: "Escáner Cédula",
                card_cedula_desc: "Anverso y reverso con proporción exacta.",

                // Sections Headers
                sect_compress_title: "Comprimir PDF",
                sect_compress_desc: "Reduce el tamaño de tu archivo PDF.",

                sect_img2pdf_title: "Imagen a PDF",
                sect_img2pdf_desc: "Convierte tus imágenes con opciones de personalización profesionales.",

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

                sect_cedula_title: "Escáner Formato Cédula",
                sect_cedula_desc: "Escanea anverso y reverso con proporción exacta, filtros inteligentes y descarga/impresión directa.",

                // Dropdown
                drop_organize: "Organizar",
                drop_convert: "Convertir",
                drop_edit: "Editar",
                drop_others: "Otros",

                // Dropdown Tools
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
                drop_cedula: "Escáner Cédula",
                cedula_paper_format: "Tamaño de Hoja",
                cedula_card_size: "Tamaño de Cédula",
                cedula_preview_title: "Vista Previa de Impresión",

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
                nav_all: "All Tools",

                hero_title: "PDF <span class='text-blue-600 dark:text-blue-400'>Master</span> Suite",
                hero_desc: "All the tools you need in one place. 100% Private and secure in your browser.",

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
                card_cedula_title: "ID Card Scanner",
                card_cedula_desc: "Front and back with exact ratio.",

                sect_compress_title: "Compress PDF",
                sect_compress_desc: "Reduce your PDF file size.",

                sect_img2pdf_title: "Image to PDF",
                sect_img2pdf_desc: "Convert your images with professional options.",

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

                sect_cedula_title: "ID Card Scanner to PDF",
                sect_cedula_desc: "Scan front and back with exact ratio, smart filters and direct print/download.",

                drop_organize: "Organize",
                drop_convert: "Convert",
                drop_edit: "Edit",
                drop_others: "Others",

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
                drop_cedula: "ID Card Scanner",
                cedula_paper_format: "Paper Size",
                cedula_card_size: "Card Size",
                cedula_preview_title: "Print Preview",

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
                        let icon = el.querySelector('i') || el.querySelector('svg');
                        if (icon) {
                            const iconHtml = icon.outerHTML;
                            el.innerHTML = iconHtml + ' ' + t[key];
                            lucide.createIcons();
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
            ['home', 'img2pdf', 'split', 'merge', 'poster', 'collage', 'pdf2img', 'nup', 'watermark', 'pagenumbers', 'sign', 'compress', 'ocr', 'scan-enhancer', 'cedula'].forEach(s => {
                const sec = document.getElementById(`section-${s}`);
                if (sec) sec.classList.add('hidden');
            });
            const activeSec = document.getElementById(`section-${tool}`);
            if (activeSec) activeSec.classList.remove('hidden');
            lucide.createIcons();
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
                        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                            const p = await pdf.getPage(pageNum);
                            const vp = p.getViewport({ scale: 3.5 }); // High Quality
                            const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
                            await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
                            const u = c.toDataURL('image/jpeg', 0.95);
                            const imgObj = await loadImage(u);
                            posterImages.push(imgObj);
                        }
                    }
                    else if (ext === 'heic' || ext === 'heif') {
                        u = await blobToDataURL(await heic2any({ blob: f, toType: "image/jpeg" }));
                        const imgObj = await loadImage(u);
                        posterImages.push(imgObj);
                    }
                    else {
                        u = await blobToDataURL(f);
                        const imgObj = await loadImage(u);
                        posterImages.push(imgObj);
                    }
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
        // 15. ESCÁNER FORMATO CÉDULA A PDF
        // ==========================================

        const CEDULA_CONFIG = {
            PAGE_FORMATS: {
                a4: { name: 'A4', width: 210, height: 297 },
                letter: { name: 'Carta / Letter', width: 215.9, height: 279.4 }
            },
            CARD_SIZES: {
                standard: { name: 'Estándar Real (85.6 mm)', width: 85.6 },
                large: { name: 'Grande / Legible (105 mm)', width: 105 },
                max: { name: 'Máximo Ajuste (120 mm)', width: 120 }
            },
            DEFAULTS: {
                format: 'letter',
                cardSize: 'standard',
                spacing: 20,
                topMargin: 30,
                defaultFilter: 'document'
            },
            SCAN_FILTERS: {
                ORIGINAL: 'original',
                DOCUMENT: 'document',
                GRAYSCALE: 'grayscale',
                BW: 'bw'
            }
        };

        class CedulaScannerEngine {
            static async processImage(sourceImage, options = {}) {
                const filter = options.filter || CEDULA_CONFIG.SCAN_FILTERS.DOCUMENT;
                const brightness = options.brightness || 0;
                const contrast = options.contrast || 0;
                const rotation = (options.rotation || 0) % 360;

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });

                const srcWidth = sourceImage.naturalWidth || sourceImage.width;
                const srcHeight = sourceImage.naturalHeight || sourceImage.height;

                const isRotated90or270 = (rotation === 90 || rotation === 270);
                canvas.width = isRotated90or270 ? srcHeight : srcWidth;
                canvas.height = isRotated90or270 ? srcWidth : srcHeight;

                ctx.save();
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.drawImage(sourceImage, -srcWidth / 2, -srcHeight / 2);
                ctx.restore();

                if (filter === CEDULA_CONFIG.SCAN_FILTERS.ORIGINAL && brightness === 0 && contrast === 0) {
                    return {
                        dataUrl: canvas.toDataURL('image/jpeg', 0.96),
                        width: canvas.width,
                        height: canvas.height,
                        format: 'JPEG'
                    };
                }

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                const brightnessOffset = brightness * 1.5;

                let minLuma = 255;
                let maxLuma = 0;

                if (filter === CEDULA_CONFIG.SCAN_FILTERS.DOCUMENT) {
                    for (let i = 0; i < data.length; i += 16) {
                        const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                        if (luma < minLuma) minLuma = luma;
                        if (luma > maxLuma) maxLuma = luma;
                    }
                }

                const whitePoint = Math.max(170, maxLuma - 15);
                const blackPoint = Math.min(60, minLuma + 20);
                const range = Math.max(1, whitePoint - blackPoint);

                for (let i = 0; i < data.length; i += 4) {
                    let r = data[i];
                    let g = data[i + 1];
                    let b = data[i + 2];
                    let luma = 0.299 * r + 0.587 * g + 0.114 * b;

                    switch (filter) {
                        case CEDULA_CONFIG.SCAN_FILTERS.DOCUMENT: {
                            if (luma >= whitePoint) {
                                const lift = (luma - whitePoint) / (255 - whitePoint + 0.001);
                                r = Math.min(255, r + (255 - r) * (0.85 + 0.15 * lift));
                                g = Math.min(255, g + (255 - g) * (0.85 + 0.15 * lift));
                                b = Math.min(255, b + (255 - b) * (0.85 + 0.15 * lift));
                            } else if (luma <= blackPoint) {
                                r = Math.max(0, r * 0.7);
                                g = Math.max(0, g * 0.7);
                                b = Math.max(0, b * 0.7);
                            } else {
                                const normalized = (luma - blackPoint) / range;
                                const curve = normalized < 0.5 ? 2 * normalized * normalized : 1 - Math.pow(-2 * normalized + 2, 2) / 2;
                                const factor = 0.8 + 0.4 * curve;
                                r = Math.min(255, Math.max(0, r * factor));
                                g = Math.min(255, Math.max(0, g * factor));
                                b = Math.min(255, Math.max(0, b * factor));
                            }
                            break;
                        }
                        case CEDULA_CONFIG.SCAN_FILTERS.GRAYSCALE: {
                            r = luma; g = luma; b = luma;
                            break;
                        }
                        case CEDULA_CONFIG.SCAN_FILTERS.BW: {
                            const val = luma > 135 ? 255 : 0;
                            r = val; g = val; b = val;
                            break;
                        }
                        default:
                            break;
                    }

                    if (brightness !== 0) {
                        r += brightnessOffset;
                        g += brightnessOffset;
                        b += brightnessOffset;
                    }

                    if (contrast !== 0) {
                        r = contrastFactor * (r - 128) + 128;
                        g = contrastFactor * (g - 128) + 128;
                        b = contrastFactor * (b - 128) + 128;
                    }

                    data[i] = Math.min(255, Math.max(0, Math.round(r)));
                    data[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
                    data[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
                }

                ctx.putImageData(imageData, 0, 0);

                return {
                    dataUrl: canvas.toDataURL('image/jpeg', 0.95),
                    width: canvas.width,
                    height: canvas.height,
                    format: 'JPEG'
                };
            }

            static loadImageElement(dataUrl) {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = (err) => reject(err);
                    img.src = dataUrl;
                });
            }
        }

        class CedulaCameraService {
            constructor() {
                this.modal = null;
                this.video = null;
                this.stream = null;
                this.currentFacingMode = 'environment';
                this.onCaptureCallback = null;
                this.onCancelCallback = null;
                this.targetSide = 'front';
            }

            init() {
                this.modal = document.getElementById('camera-modal-cedula');
                this.video = document.getElementById('camera-video-cedula');
                const closeBtn = document.getElementById('camera-close-btn-cedula');
                const cancelBtn = document.getElementById('camera-cancel-btn-cedula');
                const shutterBtn = document.getElementById('camera-shutter-btn-cedula');
                const switchBtn = document.getElementById('camera-switch-btn-cedula');

                closeBtn?.addEventListener('click', () => this.stopAndClose());
                cancelBtn?.addEventListener('click', () => this.stopAndClose());
                shutterBtn?.addEventListener('click', () => this.captureSnapshot());
                switchBtn?.addEventListener('click', () => this.toggleFacingMode());
            }

            async start(side = 'front', onCapture, onCancel) {
                if (!this.modal) this.init();
                this.targetSide = side;
                this.onCaptureCallback = onCapture;
                this.onCancelCallback = onCancel;

                const targetLabel = document.getElementById('camera-target-label-cedula');
                if (targetLabel) {
                    targetLabel.textContent = side === 'front' 
                        ? 'Fotografía el ANVERSO (Frente) de la cédula' 
                        : 'Fotografía el REVERSO (Atrás) de la cédula';
                }

                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    alert("La cámara web no está disponible. Se abrirá el selector de archivos.");
                    this.fallbackToNativeInput(side);
                    return;
                }

                this.modal.classList.remove('hidden');
                document.getElementById('camera-loading-cedula')?.classList.remove('hidden');

                try {
                    await this.startStream();
                } catch (error) {
                    console.warn('Error en cámara:', error);
                    alert("No se pudo acceder a la cámara (" + error.message + "). Se abrirá el selector de archivos.");
                    this.stopAndClose();
                    this.fallbackToNativeInput(side);
                }
            }

            async startStream() {
                if (this.stream) {
                    this.stream.getTracks().forEach(t => t.stop());
                }

                const constraints = {
                    audio: false,
                    video: {
                        facingMode: { ideal: this.currentFacingMode },
                        width: { ideal: 1920, min: 1280 },
                        height: { ideal: 1080, min: 720 }
                    }
                };

                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.stream = stream;
                this.video.srcObject = stream;

                await new Promise((resolve) => {
                    this.video.onloadedmetadata = () => {
                        this.video.play();
                        document.getElementById('camera-loading-cedula')?.classList.add('hidden');
                        resolve();
                    };
                });
            }

            async toggleFacingMode() {
                this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
                document.getElementById('camera-loading-cedula')?.classList.remove('hidden');
                try {
                    await this.startStream();
                } catch (e) {
                    console.error('Error al cambiar cámara:', e);
                    document.getElementById('camera-loading-cedula')?.classList.add('hidden');
                }
            }

            captureSnapshot() {
                if (!this.video || !this.stream) return;
                const vW = this.video.videoWidth || 1920;
                const vH = this.video.videoHeight || 1080;

                const canvas = document.createElement('canvas');
                canvas.width = vW;
                canvas.height = vH;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this.video, 0, 0, vW, vH);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.98);

                this.stopAndClose();
                if (this.onCaptureCallback) {
                    this.onCaptureCallback({ dataUrl, width: vW, height: vH, side: this.targetSide });
                }
            }

            stopAndClose() {
                if (this.stream) {
                    this.stream.getTracks().forEach(t => t.stop());
                    this.stream = null;
                }
                if (this.video) {
                    this.video.srcObject = null;
                }
                if (this.modal) {
                    this.modal.classList.add('hidden');
                }
                if (this.onCancelCallback) {
                    this.onCancelCallback();
                }
            }

            fallbackToNativeInput(side) {
                const input = document.getElementById(`file-input-${side}-cedula`);
                if (input) input.click();
            }
        }

        class CedulaCropService {
            constructor() {
                this.modal = null;
                this.canvas = null;
                this.ctx = null;
                this.sourceImage = null;
                this.cropBox = { x: 0, y: 0, width: 0, height: 0 };
                this.isDragging = false;
                this.dragHandle = null;
                this.dragStart = { x: 0, y: 0 };
                this.initialCropBox = null;
                this.onCompleteCallback = null;
                this.onCancelCallback = null;
                this.keepIdRatio = true;
            }

            init() {
                this.modal = document.getElementById('crop-modal-cedula');
                this.canvas = document.getElementById('crop-canvas-cedula');
                this.ctx = this.canvas.getContext('2d');

                const closeBtn = document.getElementById('crop-close-btn-cedula');
                const cancelBtn = document.getElementById('crop-cancel-btn-cedula');
                const applyBtn = document.getElementById('crop-apply-btn-cedula');
                const presetIdBtn = document.getElementById('crop-btn-preset-id-cedula');
                const presetFreeBtn = document.getElementById('crop-btn-preset-free-cedula');

                closeBtn?.addEventListener('click', () => this.close(false));
                cancelBtn?.addEventListener('click', () => this.close(false));
                applyBtn?.addEventListener('click', () => this.applyCrop());

                presetIdBtn?.addEventListener('click', () => {
                    this.keepIdRatio = true;
                    presetIdBtn.classList.add('active');
                    presetFreeBtn?.classList.remove('active');
                    this.adjustCropBoxToRatio();
                    this.draw();
                });

                presetFreeBtn?.addEventListener('click', () => {
                    this.keepIdRatio = false;
                    presetFreeBtn.classList.add('active');
                    presetIdBtn?.classList.remove('active');
                });

                const getCanvasCoords = (e) => {
                    const rect = this.canvas.getBoundingClientRect();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    return {
                        x: (clientX - rect.left) * (this.canvas.width / rect.width),
                        y: (clientY - rect.top) * (this.canvas.height / rect.height)
                    };
                };

                const handlePointerDown = (e) => {
                    if (!this.sourceImage) return;
                    const coords = getCanvasCoords(e);
                    this.dragHandle = this.getHandleAt(coords.x, coords.y);
                    if (this.dragHandle) {
                        this.isDragging = true;
                        this.dragStart = coords;
                        this.initialCropBox = { ...this.cropBox };
                        if (e.cancelable) e.preventDefault();
                    }
                };

                const handlePointerMove = (e) => {
                    if (!this.sourceImage) return;
                    const coords = getCanvasCoords(e);
                    if (!this.isDragging) {
                        const handle = this.getHandleAt(coords.x, coords.y);
                        this.canvas.style.cursor = this.getCursorForHandle(handle);
                        return;
                    }
                    if (e.cancelable) e.preventDefault();
                    const dx = coords.x - this.dragStart.x;
                    const dy = coords.y - this.dragStart.y;
                    this.updateCropBox(dx, dy);
                    this.draw();
                };

                const handlePointerUp = () => {
                    this.isDragging = false;
                    this.dragHandle = null;
                };

                this.canvas.addEventListener('mousedown', handlePointerDown);
                window.addEventListener('mousemove', handlePointerMove);
                window.addEventListener('mouseup', handlePointerUp);

                this.canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
                window.addEventListener('touchmove', handlePointerMove, { passive: false });
                window.addEventListener('touchend', handlePointerUp);
            }

            open(imageElement, onComplete, onCancel) {
                if (!this.modal) this.init();
                this.sourceImage = imageElement;
                this.onCompleteCallback = onComplete;
                this.onCancelCallback = onCancel;

                const maxWidth = 800;
                const maxHeight = 500;
                let w = imageElement.naturalWidth || imageElement.width;
                let h = imageElement.naturalHeight || imageElement.height;
                let scale = 1;
                if (w > maxWidth || h > maxHeight) {
                    scale = Math.min(maxWidth / w, maxHeight / h);
                }

                this.canvas.width = Math.round(w * scale);
                this.canvas.height = Math.round(h * scale);

                const initW = this.canvas.width * 0.85;
                let initH = this.keepIdRatio ? initW / 1.586 : this.canvas.height * 0.85;
                if (initH > this.canvas.height * 0.9) {
                    initH = this.canvas.height * 0.9;
                    if (this.keepIdRatio) initW = initH * 1.586;
                }

                this.cropBox = {
                    x: (this.canvas.width - initW) / 2,
                    y: (this.canvas.height - initH) / 2,
                    width: initW,
                    height: initH
                };

                this.modal.classList.remove('hidden');
                this.draw();
            }

            adjustCropBoxToRatio() {
                const ratio = 1.586;
                let newHeight = this.cropBox.width / ratio;
                if (this.cropBox.y + newHeight > this.canvas.height) {
                    newHeight = this.canvas.height - this.cropBox.y;
                    this.cropBox.width = newHeight * ratio;
                }
                this.cropBox.height = newHeight;
            }

            getHandleAt(x, y) {
                const handleRadius = 24;
                const { x: bx, y: by, width: bw, height: bh } = this.cropBox;
                if (Math.hypot(x - bx, y - by) <= handleRadius) return 'tl';
                if (Math.hypot(x - (bx + bw), y - by) <= handleRadius) return 'tr';
                if (Math.hypot(x - bx, y - (by + bh)) <= handleRadius) return 'bl';
                if (Math.hypot(x - (bx + bw), y - (by + bh)) <= handleRadius) return 'br';
                if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) return 'move';
                return null;
            }

            getCursorForHandle(handle) {
                switch (handle) {
                    case 'tl': case 'br': return 'nwse-resize';
                    case 'tr': case 'bl': return 'nesw-resize';
                    case 'move': return 'move';
                    default: return 'default';
                }
            }

            updateCropBox(dx, dy) {
                const b = { ...this.initialCropBox };
                const idRatio = 1.586;

                if (this.dragHandle === 'move') {
                    let newX = b.x + dx;
                    let newY = b.y + dy;
                    newX = Math.max(0, Math.min(this.canvas.width - b.width, newX));
                    newY = Math.max(0, Math.min(this.canvas.height - b.height, newY));
                    this.cropBox.x = newX;
                    this.cropBox.y = newY;
                    return;
                }

                let { x, y, width, height } = b;
                if (this.dragHandle === 'br') {
                    width = Math.max(40, b.width + dx);
                    height = this.keepIdRatio ? width / idRatio : Math.max(30, b.height + dy);
                } else if (this.dragHandle === 'tr') {
                    width = Math.max(40, b.width + dx);
                    height = this.keepIdRatio ? width / idRatio : Math.max(30, b.height - dy);
                    y = b.y + (b.height - height);
                } else if (this.dragHandle === 'bl') {
                    width = Math.max(40, b.width - dx);
                    height = this.keepIdRatio ? width / idRatio : Math.max(30, b.height + dy);
                    x = b.x + (b.width - width);
                } else if (this.dragHandle === 'tl') {
                    width = Math.max(40, b.width - dx);
                    height = this.keepIdRatio ? width / idRatio : Math.max(30, b.height - dy);
                    x = b.x + (b.width - width);
                    y = b.y + (b.height - height);
                }

                if (x < 0) { width += x; x = 0; }
                if (y < 0) { height += y; y = 0; }
                if (x + width > this.canvas.width) width = this.canvas.width - x;
                if (y + height > this.canvas.height) height = this.canvas.height - y;

                this.cropBox = { x, y, width, height };
            }

            draw() {
                if (!this.ctx || !this.sourceImage) return;
                const { width, height } = this.canvas;
                this.ctx.clearRect(0, 0, width, height);
                this.ctx.drawImage(this.sourceImage, 0, 0, width, height);

                // Overlay oscuro
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                this.ctx.fillRect(0, 0, width, height);

                // Recortar zona transparente
                const { x, y, width: bw, height: bh } = this.cropBox;
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.rect(x, y, bw, bh);
                this.ctx.clip();
                this.ctx.drawImage(this.sourceImage, 0, 0, width, height);

                // Guías tercios
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x + bw / 3, y); this.ctx.lineTo(x + bw / 3, y + bh);
                this.ctx.moveTo(x + (bw * 2) / 3, y); this.ctx.lineTo(x + (bw * 2) / 3, y + bh);
                this.ctx.moveTo(x, y + bh / 3); this.ctx.lineTo(x + bw, y + bh / 3);
                this.ctx.moveTo(x, y + (bh * 2) / 3); this.ctx.lineTo(x + bw, y + (bh * 2) / 3);
                this.ctx.stroke();
                this.ctx.restore();

                // Borde y esquinas
                this.ctx.strokeStyle = '#0284c7';
                this.ctx.lineWidth = 2.5;
                this.ctx.strokeRect(x, y, bw, bh);

                const handleSize = 14;
                this.ctx.fillStyle = '#38bdf8';
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 2;
                [
                    [x, y], [x + bw, y], [x, y + bh], [x + bw, y + bh]
                ].forEach(([hx, hy]) => {
                    this.ctx.beginPath();
                    this.ctx.arc(hx, hy, handleSize / 2, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.stroke();
                });
            }

            applyCrop() {
                const scaleX = (this.sourceImage.naturalWidth || this.sourceImage.width) / this.canvas.width;
                const scaleY = (this.sourceImage.naturalHeight || this.sourceImage.height) / this.canvas.height;

                const cropX = Math.round(this.cropBox.x * scaleX);
                const cropY = Math.round(this.cropBox.y * scaleY);
                const cropW = Math.round(this.cropBox.width * scaleX);
                const cropH = Math.round(this.cropBox.height * scaleY);

                const outCanvas = document.createElement('canvas');
                outCanvas.width = cropW;
                outCanvas.height = cropH;
                const outCtx = outCanvas.getContext('2d');
                outCtx.drawImage(this.sourceImage, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

                const dataUrl = outCanvas.toDataURL('image/jpeg', 0.98);
                this.close(true);
                if (this.onCompleteCallback) {
                    this.onCompleteCallback({ dataUrl, width: cropW, height: cropH });
                }
            }

            close(success = false) {
                if (this.modal) this.modal.classList.add('hidden');
                if (!success && this.onCancelCallback) this.onCancelCallback();
            }
        }

        class CedulaImageHandler {
            constructor() {
                this.documents = [{ front: this.createSideState(), back: this.createSideState() }];
                this.currentIndex = 0;
                this.listeners = [];
            }

            get sides() { return this.documents[this.currentIndex]; }

            createSideState() {
                return {
                    isLoaded: false,
                    fileName: '',
                    rawSource: null,
                    rawCropped: null,
                    processedDataUrl: null,
                    width: 0,
                    height: 0,
                    format: 'JPEG',
                    rotation: 0,
                    filter: CEDULA_CONFIG.DEFAULTS.defaultFilter,
                    brightness: 0,
                    contrast: 0
                };
            }

            onChange(cb) { this.listeners.push(cb); }
            notify(side) { this.listeners.forEach(cb => cb(side, this.sides[side], this.sides)); }
            notifyAll() { this.notify('front'); this.notify('back'); }

            addDocument() {
                this.documents.push({ front: this.createSideState(), back: this.createSideState() });
                this.currentIndex = this.documents.length - 1;
                this.notifyAll();
            }

            nextDocument() {
                if (this.currentIndex < this.documents.length - 1) {
                    this.currentIndex++;
                    this.notifyAll();
                }
            }

            prevDocument() {
                if (this.currentIndex > 0) {
                    this.currentIndex--;
                    this.notifyAll();
                }
            }

            deleteCurrentDocument() {
                if (this.documents.length > 1) {
                    this.documents.splice(this.currentIndex, 1);
                    if (this.currentIndex >= this.documents.length) this.currentIndex = this.documents.length - 1;
                } else {
                    this.documents[0] = { front: this.createSideState(), back: this.createSideState() };
                }
                this.notifyAll();
            }

            async loadFile(file, side) {
                let u = null, ext = file.name.split('.').pop().toLowerCase();
                if (['heic', 'heif'].includes(ext)) {
                    u = await blobToDataURL(await heic2any({ blob: file, toType: "image/jpeg" }));
                } else {
                    u = await blobToDataURL(file);
                }
                await this.loadDataUrl(u, side, file.name);
            }

            async loadDataUrl(dataUrl, side, fileName = 'imagen.jpg') {
                const imgElement = await CedulaScannerEngine.loadImageElement(dataUrl);
                const state = this.sides[side];
                state.isLoaded = true;
                state.fileName = fileName;
                state.rawSource = imgElement;
                state.rawCropped = imgElement;
                state.rotation = 0;
                state.brightness = 0;
                state.contrast = 0;
                await this.reprocess(side);
            }

            async applyCropResult(side, cropData) {
                const state = this.sides[side];
                const imgElement = await CedulaScannerEngine.loadImageElement(cropData.dataUrl);
                state.rawCropped = imgElement;
                await this.reprocess(side);
            }

            async rotate(side, deg = 90) {
                const state = this.sides[side];
                if (!state.isLoaded) return;
                state.rotation = (state.rotation + deg) % 360;
                await this.reprocess(side);
            }

            async setFilter(side, filterName) {
                const state = this.sides[side];
                if (!state.isLoaded) return;
                state.filter = filterName;
                await this.reprocess(side);
            }

            async setBrightness(side, value) {
                const state = this.sides[side];
                if (!state.isLoaded) return;
                state.brightness = Math.max(-100, Math.min(100, Number(value) || 0));
                await this.reprocess(side);
            }

            async setContrast(side, value) {
                const state = this.sides[side];
                if (!state.isLoaded) return;
                state.contrast = Math.max(-100, Math.min(100, Number(value) || 0));
                await this.reprocess(side);
            }

            async reprocess(side) {
                const state = this.sides[side];
                if (!state.isLoaded || !state.rawCropped) return;
                const res = await CedulaScannerEngine.processImage(state.rawCropped, {
                    filter: state.filter,
                    brightness: state.brightness,
                    contrast: state.contrast,
                    rotation: state.rotation
                });
                state.processedDataUrl = res.dataUrl;
                state.width = res.width;
                state.height = res.height;
                state.format = res.format;
                this.notify(side);
            }

            resetSide(side) {
                this.sides[side] = this.createSideState();
                this.notify(side);
            }

            hasAnySide() { return this.documents.some(doc => doc.front.isLoaded || doc.back.isLoaded); }
            hasBothSides() { return this.documents.some(doc => doc.front.isLoaded && doc.back.isLoaded); }
            getSide(side) { return this.sides[side]; }
        }

        class CedulaPDFService {
            static buildDocument(imageHandler, customSettings = {}) {
                const { jsPDF } = window.jspdf;
                if (!jsPDF) throw new Error('Librería jsPDF no encontrada.');

                const formatKey = customSettings.format || CEDULA_CONFIG.DEFAULTS.format;
                const cardSizeKey = customSettings.cardSize || CEDULA_CONFIG.DEFAULTS.cardSize;
                const cardConfig = CEDULA_CONFIG.CARD_SIZES[cardSizeKey] || CEDULA_CONFIG.CARD_SIZES.standard;
                const targetCardWidth = cardConfig.width;

                const doc = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: formatKey === 'letter' ? 'letter' : 'a4',
                    compress: true
                });

                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const textureBase64 = this.generateScannerTexture();
                let pagesAdded = 0;

                for (let i = 0; i < imageHandler.documents.length; i++) {
                    const docState = imageHandler.documents[i];
                    const front = docState.front;
                    const back = docState.back;

                    if (!front.isLoaded && !back.isLoaded) continue;

                    if (pagesAdded > 0) doc.addPage();
                    pagesAdded++;

                    doc.addImage(textureBase64, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');

                    const maxCardHeight = 90;
                    let spacing = CEDULA_CONFIG.DEFAULTS.spacing;
                    let topMargin = CEDULA_CONFIG.DEFAULTS.topMargin;

                    let frontDim = null;
                    if (front.isLoaded && front.processedDataUrl) {
                        frontDim = this.calculateProportionalDimensions(front.width, front.height, targetCardWidth, maxCardHeight);
                    }

                    let backDim = null;
                    if (back.isLoaded && back.processedDataUrl) {
                        backDim = this.calculateProportionalDimensions(back.width, back.height, targetCardWidth, maxCardHeight);
                    }

                    if (frontDim && backDim) {
                        const blockHeight = frontDim.height + spacing + backDim.height;
                        if (blockHeight > pageHeight - 40) {
                            topMargin = Math.max(15, (pageHeight - (frontDim.height + backDim.height + spacing)) / 2);
                            spacing = Math.max(12, spacing * 0.7);
                        } else {
                            topMargin = (pageHeight - blockHeight) / 2;
                        }
                    } else if (frontDim && !backDim) {
                        topMargin = (pageHeight - frontDim.height) / 2;
                    } else if (!frontDim && backDim) {
                        topMargin = (pageHeight - backDim.height) / 2;
                    }

                    if (frontDim) {
                        const xFront = (pageWidth - frontDim.width) / 2;
                        doc.addImage(front.processedDataUrl, front.format || 'JPEG', xFront, topMargin, frontDim.width, frontDim.height, undefined, 'FAST');
                    }

                    if (backDim) {
                        const xBack = (pageWidth - backDim.width) / 2;
                        const yBack = frontDim ? topMargin + frontDim.height + spacing : topMargin;
                        doc.addImage(back.processedDataUrl, back.format || 'JPEG', xBack, yBack, backDim.width, backDim.height, undefined, 'FAST');
                    }
                }

                if (pagesAdded === 0) throw new Error('Carga al menos una cara de la cédula.');
                return doc;
            }

            static generateScannerTexture() {
                const canvas = document.createElement('canvas');
                canvas.width = 600; canvas.height = 800;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const noise = Math.random() * 8;
                    data[i] = Math.max(0, 255 - noise - (Math.random() * 2));
                    data[i + 1] = Math.max(0, 255 - noise - (Math.random() * 2));
                    data[i + 2] = Math.max(0, 255 - noise);
                }
                ctx.putImageData(imageData, 0, 0);
                return canvas.toDataURL('image/jpeg', 0.6);
            }

            static calculateProportionalDimensions(naturalWidth, naturalHeight, targetWidthMm, maxHeightMm) {
                if (!naturalWidth || !naturalHeight) {
                    return { width: targetWidthMm, height: targetWidthMm * (53.98 / 85.6) };
                }
                const aspectRatio = naturalHeight / naturalWidth;
                let width = targetWidthMm;
                let height = width * aspectRatio;
                if (height > maxHeightMm) {
                    height = maxHeightMm;
                    width = height / aspectRatio;
                }
                return { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 };
            }

            static async downloadPDF(imageHandler, settings = {}, fileName = 'Cedula_Escaneada_HD.pdf') {
                const doc = this.buildDocument(imageHandler, settings);
                doc.save(fileName);
            }

            static async generateBlob(imageHandler, settings = {}) {
                const doc = this.buildDocument(imageHandler, settings);
                return doc.output('blob');
            }
        }

        class CedulaPrintService {
            static async printDocument(imageHandler, settings = {}) {
                const pdfBlob = await CedulaPDFService.generateBlob(imageHandler, settings);
                printPdfBlob(pdfBlob);
            }
        }

        class CedulaUIController {
            constructor(imageHandler) {
                this.imageHandler = imageHandler;
                this.cameraService = new CedulaCameraService();
                this.cropService = new CedulaCropService();
                this.currentSettings = {
                    format: CEDULA_CONFIG.DEFAULTS.format,
                    cardSize: CEDULA_CONFIG.DEFAULTS.cardSize
                };
                this.dom = {};
            }

            init() {
                this.cacheDom();
                this.bindEvents();
                this.subscribeToState();
                this.updateBatchUI();
                this.updatePaperPreview();
            }

            cacheDom() {
                this.dom = {
                    dropzoneFront: document.getElementById('dropzone-front-box-cedula'),
                    dropzoneBack: document.getElementById('dropzone-back-box-cedula'),
                    fileInputFront: document.getElementById('file-input-front-cedula'),
                    fileInputBack: document.getElementById('file-input-back-cedula'),

                    btnCameraFront: document.getElementById('btn-camera-front-cedula'),
                    btnCameraBack: document.getElementById('btn-camera-back-cedula'),
                    btnUploadFront: document.getElementById('btn-upload-front-cedula'),
                    btnUploadBack: document.getElementById('btn-upload-back-cedula'),

                    emptyStateFront: document.getElementById('empty-state-front-cedula'),
                    emptyStateBack: document.getElementById('empty-state-back-cedula'),
                    loadedStateFront: document.getElementById('loaded-state-front-cedula'),
                    loadedStateBack: document.getElementById('loaded-state-back-cedula'),

                    thumbImgFront: document.getElementById('thumb-img-front-cedula'),
                    thumbImgBack: document.getElementById('thumb-img-back-cedula'),
                    fileNameFront: document.getElementById('filename-front-cedula'),
                    fileNameBack: document.getElementById('filename-back-cedula'),

                    btnRotateFront: document.getElementById('btn-rotate-front-cedula'),
                    btnRotateBack: document.getElementById('btn-rotate-back-cedula'),
                    btnCropFront: document.getElementById('btn-crop-front-cedula'),
                    btnCropBack: document.getElementById('btn-crop-back-cedula'),
                    btnDeleteFront: document.getElementById('btn-delete-front-cedula'),
                    btnDeleteBack: document.getElementById('btn-delete-back-cedula'),

                    filterSelectFront: document.getElementById('filter-select-front-cedula'),
                    filterSelectBack: document.getElementById('filter-select-back-cedula'),
                    brightnessSliderFront: document.getElementById('brightness-front-cedula'),
                    brightnessSliderBack: document.getElementById('brightness-back-cedula'),
                    contrastSliderFront: document.getElementById('contrast-front-cedula'),
                    contrastSliderBack: document.getElementById('contrast-back-cedula'),

                    selectPaperFormat: document.getElementById('select-paper-format-cedula'),
                    selectCardSize: document.getElementById('select-card-size-cedula'),

                    paperSheet: document.getElementById('paper-sheet-cedula'),
                    previewFrontContainer: document.getElementById('preview-front-container-cedula'),
                    previewBackContainer: document.getElementById('preview-back-container-cedula'),
                    previewImgFront: document.getElementById('preview-img-front-cedula'),
                    previewImgBack: document.getElementById('preview-img-back-cedula'),
                    placeholderFront: document.getElementById('placeholder-front-cedula'),
                    placeholderBack: document.getElementById('placeholder-back-cedula'),
                    watermarkText: document.getElementById('watermark-text-cedula'),

                    btnDownload: document.getElementById('btn-download-pdf-cedula'),
                    btnPrint: document.getElementById('btn-print-doc-cedula'),
                    globalAlert: document.getElementById('global-alert-cedula'),

                    btnPrevDoc: document.getElementById('btn-prev-doc-cedula'),
                    btnNextDoc: document.getElementById('btn-next-doc-cedula'),
                    btnAddDoc: document.getElementById('btn-add-doc-cedula'),
                    btnDeleteDoc: document.getElementById('btn-delete-doc-cedula'),
                    batchCounter: document.getElementById('batch-counter-cedula')
                };
            }

            bindEvents() {
                this.setupDropzone('front', this.dom.dropzoneFront, this.dom.fileInputFront);
                this.setupDropzone('back', this.dom.dropzoneBack, this.dom.fileInputBack);

                this.dom.btnCameraFront?.addEventListener('click', (e) => { e.stopPropagation(); this.handleCameraCapture('front'); });
                this.dom.btnCameraBack?.addEventListener('click', (e) => { e.stopPropagation(); this.handleCameraCapture('back'); });

                this.dom.btnUploadFront?.addEventListener('click', (e) => { e.stopPropagation(); this.dom.fileInputFront.click(); });
                this.dom.btnUploadBack?.addEventListener('click', (e) => { e.stopPropagation(); this.dom.fileInputBack.click(); });

                this.dom.btnRotateFront?.addEventListener('click', () => this.imageHandler.rotate('front', 90));
                this.dom.btnRotateBack?.addEventListener('click', () => this.imageHandler.rotate('back', 90));

                this.dom.btnCropFront?.addEventListener('click', () => this.openCropModal('front'));
                this.dom.btnCropBack?.addEventListener('click', () => this.openCropModal('back'));

                this.dom.btnDeleteFront?.addEventListener('click', () => this.imageHandler.resetSide('front'));
                this.dom.btnDeleteBack?.addEventListener('click', () => this.imageHandler.resetSide('back'));

                this.dom.btnPrevDoc?.addEventListener('click', () => { this.imageHandler.prevDocument(); this.updateBatchUI(); });
                this.dom.btnNextDoc?.addEventListener('click', () => { this.imageHandler.nextDocument(); this.updateBatchUI(); });
                this.dom.btnAddDoc?.addEventListener('click', () => { this.imageHandler.addDocument(); this.updateBatchUI(); });
                this.dom.btnDeleteDoc?.addEventListener('click', () => {
                    if (confirm("¿Eliminar este documento completo?")) {
                        this.imageHandler.deleteCurrentDocument();
                        this.updateBatchUI();
                    }
                });

                this.dom.filterSelectFront?.addEventListener('change', (e) => this.imageHandler.setFilter('front', e.target.value));
                this.dom.filterSelectBack?.addEventListener('change', (e) => this.imageHandler.setFilter('back', e.target.value));

                this.dom.brightnessSliderFront?.addEventListener('input', (e) => this.imageHandler.setBrightness('front', e.target.value));
                this.dom.brightnessSliderBack?.addEventListener('input', (e) => this.imageHandler.setBrightness('back', e.target.value));

                this.dom.contrastSliderFront?.addEventListener('input', (e) => this.imageHandler.setContrast('front', e.target.value));
                this.dom.contrastSliderBack?.addEventListener('input', (e) => this.imageHandler.setContrast('back', e.target.value));

                this.dom.selectPaperFormat?.addEventListener('change', (e) => {
                    this.currentSettings.format = e.target.value;
                    this.updatePaperPreview();
                });

                this.dom.selectCardSize?.addEventListener('change', (e) => {
                    this.currentSettings.cardSize = e.target.value;
                    this.updatePaperPreview();
                });

                this.dom.btnDownload?.addEventListener('click', () => this.handleDownload());
                this.dom.btnPrint?.addEventListener('click', () => this.handlePrint());
            }

            setupDropzone(side, dropzoneEl, inputEl) {
                if (!dropzoneEl || !inputEl) return;
                dropzoneEl.addEventListener('click', () => inputEl.click());

                ['dragenter', 'dragover'].forEach(eventName => {
                    dropzoneEl.addEventListener(eventName, (e) => {
                        e.preventDefault(); e.stopPropagation();
                        dropzoneEl.classList.add('border-sky-500', 'bg-sky-50/40');
                    }, false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    dropzoneEl.addEventListener(eventName, (e) => {
                        e.preventDefault(); e.stopPropagation();
                        dropzoneEl.classList.remove('border-sky-500', 'bg-sky-50/40');
                    }, false);
                });

                dropzoneEl.addEventListener('drop', async (e) => {
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) await this.processSelectedFile(files[0], side);
                });

                inputEl.addEventListener('change', async (e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                        await this.processSelectedFile(files[0], side);
                        inputEl.value = '';
                    }
                });
            }

            async processSelectedFile(file, side) {
                this.hideAlert();
                showLoader("Procesando imagen...");
                try {
                    await this.imageHandler.loadFile(file, side);
                    this.showToast(`Imagen del ${side === 'front' ? 'anverso' : 'reverso'} cargada.`);
                } catch (error) {
                    this.showAlert(error.message || 'Error al procesar la imagen.');
                } finally {
                    hideLoader();
                }
            }

            async handleCameraCapture(side) {
                this.hideAlert();
                try {
                    await this.cameraService.start(side, async (captureResult) => {
                        await this.imageHandler.loadDataUrl(
                            captureResult.dataUrl,
                            side,
                            `foto_${side}_${Date.now()}.jpg`
                        );
                        this.openCropModal(side);
                    }, () => {});
                } catch (err) {
                    this.showAlert('No se pudo acceder a la cámara.');
                }
            }

            openCropModal(side) {
                const sideData = this.imageHandler.getSide(side);
                if (!sideData.isLoaded || !sideData.rawSource) return;
                this.cropService.open(
                    sideData.rawSource,
                    async (cropResult) => {
                        await this.imageHandler.applyCropResult(side, cropResult);
                        this.showToast('Recorte aplicado.');
                    },
                    () => {}
                );
            }

            subscribeToState() {
                this.imageHandler.onChange((side, sideState) => {
                    this.updateSideUI(side, sideState);
                    this.updatePaperPreview();
                });
            }

            updateBatchUI() {
                if (!this.dom.batchCounter) return;
                const total = this.imageHandler.documents.length;
                const current = this.imageHandler.currentIndex + 1;
                this.dom.batchCounter.textContent = `Doc ${current} / ${total}`;

                if (this.dom.btnPrevDoc) this.dom.btnPrevDoc.disabled = current === 1;
                if (this.dom.btnNextDoc) this.dom.btnNextDoc.disabled = current === total;
                if (this.dom.btnDeleteDoc) {
                    if (total > 1) this.dom.btnDeleteDoc.classList.remove('hidden');
                    else this.dom.btnDeleteDoc.classList.add('hidden');
                }

                this.updateSideUI('front', this.imageHandler.sides.front);
                this.updateSideUI('back', this.imageHandler.sides.back);
                this.updatePaperPreview();
            }

            updateSideUI(side, state) {
                const isFront = side === 'front';
                const emptyState = isFront ? this.dom.emptyStateFront : this.dom.emptyStateBack;
                const loadedState = isFront ? this.dom.loadedStateFront : this.dom.loadedStateBack;
                const thumbImg = isFront ? this.dom.thumbImgFront : this.dom.thumbImgBack;
                const fileName = isFront ? this.dom.fileNameFront : this.dom.fileNameBack;
                const filterSelect = isFront ? this.dom.filterSelectFront : this.dom.filterSelectBack;
                const brightnessSlider = isFront ? this.dom.brightnessSliderFront : this.dom.brightnessSliderBack;
                const contrastSlider = isFront ? this.dom.contrastSliderFront : this.dom.contrastSliderBack;

                if (state.isLoaded && state.processedDataUrl) {
                    emptyState?.classList.add('hidden');
                    loadedState?.classList.remove('hidden');
                    if (thumbImg) thumbImg.src = state.processedDataUrl;
                    if (fileName) fileName.textContent = state.fileName || `Imagen ${isFront ? 'Anverso' : 'Reverso'}`;
                    if (filterSelect) filterSelect.value = state.filter;
                    if (brightnessSlider) brightnessSlider.value = state.brightness;
                    if (contrastSlider) contrastSlider.value = state.contrast;
                } else {
                    emptyState?.classList.remove('hidden');
                    loadedState?.classList.add('hidden');
                    if (thumbImg) thumbImg.src = '';
                }
            }

            updatePaperPreview() {
                const formatKey = this.currentSettings.format;
                const formatConfig = CEDULA_CONFIG.PAGE_FORMATS[formatKey] || CEDULA_CONFIG.PAGE_FORMATS.letter;
                if (this.dom.paperSheet) {
                    this.dom.paperSheet.style.aspectRatio = `${formatConfig.width} / ${formatConfig.height}`;
                }

                const cardSizeKey = this.currentSettings.cardSize;
                let cardWidthPercent = '72%';
                if (cardSizeKey === 'large') cardWidthPercent = '82%';
                if (cardSizeKey === 'max') cardWidthPercent = '92%';

                if (this.dom.previewFrontContainer) this.dom.previewFrontContainer.style.width = cardWidthPercent;
                if (this.dom.previewBackContainer) this.dom.previewBackContainer.style.width = cardWidthPercent;

                const front = this.imageHandler.getSide('front');
                const back = this.imageHandler.getSide('back');

                if (front.isLoaded && front.processedDataUrl) {
                    this.dom.previewImgFront.src = front.processedDataUrl;
                    this.dom.previewImgFront.classList.remove('hidden');
                    this.dom.placeholderFront?.classList.add('hidden');
                } else {
                    this.dom.previewImgFront.src = '';
                    this.dom.previewImgFront.classList.add('hidden');
                    this.dom.placeholderFront?.classList.remove('hidden');
                }

                if (back.isLoaded && back.processedDataUrl) {
                    this.dom.previewImgBack.src = back.processedDataUrl;
                    this.dom.previewImgBack.classList.remove('hidden');
                    this.dom.placeholderBack?.classList.add('hidden');
                } else {
                    this.dom.previewImgBack.src = '';
                    this.dom.previewImgBack.classList.add('hidden');
                    this.dom.placeholderBack?.classList.remove('hidden');
                }

                if (front.isLoaded || back.isLoaded) {
                    this.dom.watermarkText?.classList.add('hidden');
                } else {
                    this.dom.watermarkText?.classList.remove('hidden');
                }
            }

            async handleDownload() {
                if (!this.imageHandler.hasAnySide()) {
                    this.showAlert('Por favor sube o toma foto de al menos una cara de la cédula.');
                    return;
                }
                showLoader("Generando PDF en alta definición...");
                try {
                    await CedulaPDFService.downloadPDF(
                        this.imageHandler,
                        this.currentSettings,
                        `Cedula_HD_${Date.now()}.pdf`
                    );
                    this.showToast('¡PDF descargado con éxito!');
                } catch (err) {
                    console.error(err);
                    this.showAlert('Error al generar el PDF: ' + err.message);
                } finally {
                    hideLoader();
                }
            }

            async handlePrint() {
                if (!this.imageHandler.hasAnySide()) {
                    this.showAlert('Por favor sube o toma foto de al menos una cara de la cédula.');
                    return;
                }
                showLoader("Preparando impresión...");
                try {
                    await CedulaPrintService.printDocument(this.imageHandler, this.currentSettings);
                } catch (err) {
                    console.error(err);
                    this.showAlert('Error al preparar impresión: ' + err.message);
                } finally {
                    hideLoader();
                }
            }

            showAlert(msg) {
                if (!this.dom.globalAlert) return;
                this.dom.globalAlert.textContent = msg;
                this.dom.globalAlert.classList.remove('hidden');
            }

            hideAlert() {
                if (this.dom.globalAlert) this.dom.globalAlert.classList.add('hidden');
            }

            showToast(msg) {
                let toast = document.getElementById('toast-notification-cedula');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'toast-notification-cedula';
                    toast.className = 'toast-msg-cedula';
                    document.body.appendChild(toast);
                }
                toast.textContent = msg;
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3500);
            }
        }

        // Instanciar e inicializar controlador de Cédula al cargar
        let cedulaImageHandler = null;
        let cedulaUIController = null;
        document.addEventListener('DOMContentLoaded', () => {
            cedulaImageHandler = new CedulaImageHandler();
            cedulaUIController = new CedulaUIController(cedulaImageHandler);
            cedulaUIController.init();
        });
        // Si el DOM ya cargó previamente
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            if (!cedulaUIController) {
                cedulaImageHandler = new CedulaImageHandler();
                cedulaUIController = new CedulaUIController(cedulaImageHandler);
                cedulaUIController.init();
            }
        }



