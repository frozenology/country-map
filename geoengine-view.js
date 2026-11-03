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

function syncCanvasSizeInputs(cssW, cssH) {
    if (canvasWidthInput && document.activeElement !== canvasWidthInput) {
        canvasWidthInput.value = String(Math.round(cssW));
    }
    if (canvasHeightInput && document.activeElement !== canvasHeightInput) {
        canvasHeightInput.value = String(Math.round(cssH));
    }
}

function getRenderSize() {
    const rect = mapContainer.getBoundingClientRect();
    const cssW = (mapRenderW != null && mapRenderW > 0) ? mapRenderW : Math.max(1, rect.width);
    const cssH = (mapRenderH != null && mapRenderH > 0) ? mapRenderH : Math.max(1, rect.height);
    return { cssW, cssH, rect };
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const { cssW, cssH, rect } = getRenderSize();

    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    // Display size: fit inside container while keeping aspect
    const scale = Math.min(
        rect.width / cssW || 1,
        rect.height / cssH || 1,
        1
    );
    const dispW = Math.max(1, cssW * scale);
    const dispH = Math.max(1, cssH * scale);
    canvas.style.width = dispW + 'px';
    canvas.style.height = dispH + 'px';

    applyViewTransform();
    if (!sel.w && !sel.h) {
        initSelection(cssW, cssH);
    } else if (sel.w || sel.h) {
        clampSel(cssW, cssH);
        syncSelToInputs();
    }
    clampView(cssW, cssH);
    syncCanvasSizeInputs(cssW, cssH);
}

function applyCanvasSizeFromInputs() {
    const w = parseInt(canvasWidthInput && canvasWidthInput.value, 10);
    const h = parseInt(canvasHeightInput && canvasHeightInput.value, 10);
    mapRenderW = (Number.isFinite(w) && w >= 100) ? w : null;
    mapRenderH = (Number.isFinite(h) && h >= 100) ? h : null;
    resetView();
    resizeCanvas();
    render();
    saveState();
}

function darken(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
