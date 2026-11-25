/**
 * Shared vector scissors renderers for Canvas 2D previews and jsPDF exports (in mm units).
 */

/**
 * Draws a crisp vector scissors icon onto Canvas 2D in mm units scaled by `scale`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cxMm
 * @param {number} cyMm
 * @param {number} scale
 * @param {boolean} isVertical
 * @param {string} color
 */
export function drawScissorsToCtx(ctx, cxMm, cyMm, scale, isVertical, color) {
    ctx.save();
    ctx.translate(cxMm * scale, cyMm * scale);
    if (isVertical) {
        ctx.rotate(-Math.PI / 2);
    }
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 0.32;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Handle loops
    ctx.beginPath();
    ctx.arc(-1.25, -0.82, 0.58, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-1.25, 0.82, 0.58, 0, Math.PI * 2);
    ctx.stroke();

    // Crossing blades
    ctx.beginPath();
    ctx.moveTo(-0.72, -0.52);
    ctx.lineTo(1.78, 0.82);
    ctx.moveTo(-0.72, 0.52);
    ctx.lineTo(1.78, -0.82);
    ctx.stroke();

    // Pivot screw
    ctx.beginPath();
    ctx.arc(0.05, 0, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/**
 * Draws a crisp vector scissors icon in jsPDF in mm units matching Canvas 1:1.
 * @param {any} doc
 * @param {number} cxMm
 * @param {number} cyMm
 * @param {number} iconScale
 * @param {boolean} isVertical
 * @param {{ r: number, g: number, b: number }} rgb
 */
export function drawScissorsToPdf(doc, cxMm, cyMm, iconScale, isVertical, rgb) {
    const mapPt = (lx, ly) =>
        isVertical
            ? { x: cxMm + ly * iconScale, y: cyMm - lx * iconScale }
            : { x: cxMm + lx * iconScale, y: cyMm + ly * iconScale };

    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(0.32 * iconScale);

    const h1 = mapPt(-1.25, -0.82);
    const h2 = mapPt(-1.25, 0.82);
    doc.circle(h1.x, h1.y, 0.58 * iconScale, 'S');
    doc.circle(h2.x, h2.y, 0.58 * iconScale, 'S');

    const b1a = mapPt(-0.72, -0.52);
    const b1b = mapPt(1.78, 0.82);
    doc.line(b1a.x, b1a.y, b1b.x, b1b.y);

    const b2a = mapPt(-0.72, 0.52);
    const b2b = mapPt(1.78, -0.82);
    doc.line(b2a.x, b2a.y, b2b.x, b2b.y);

    const pivot = mapPt(0.05, 0);
    doc.circle(pivot.x, pivot.y, 0.2 * iconScale, 'F');
}
