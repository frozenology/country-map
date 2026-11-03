/**
 * geoengine-view.js — render, resize, color helpers
 */
function render() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    // Clear full canvas in device pixels
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    applyViewTransform();
    drawMap(ctx, w, h, true);
    drawCropOverlay(ctx, w, h);
    drawMarquee(ctx);
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = mapContainer.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    applyViewTransform();
    if (!sel.w && !sel.h) {
        initSelection(rect.width, rect.height);
    } else if (sel.w || sel.h) {
        clampSel(rect.width, rect.height);
        syncSelToInputs();
    }
    clampView(rect.width, rect.height);
}

function darken(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
