/**
 * geoengine-view.js — GeoEngine.prototype: render, resize, darken
 */
GeoEngine.prototype.render = function () {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width / dpr;
    const h = this.canvas.height / dpr;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    this.applyViewTransform();
    this.drawMap(this.ctx, w, h, true);
    this.drawCropOverlay(this.ctx, w, h);
    this.drawMarquee(this.ctx);
};

GeoEngine.prototype.syncCanvasSizeInputs = function (cssW, cssH) {
    if (this.canvasWidthInput && document.activeElement !== this.canvasWidthInput) {
        this.canvasWidthInput.value = String(Math.round(cssW));
    }
    if (this.canvasHeightInput && document.activeElement !== this.canvasHeightInput) {
        this.canvasHeightInput.value = String(Math.round(cssH));
    }
};

GeoEngine.prototype.getRenderSize = function () {
    const rect = this.mapContainer.getBoundingClientRect();
    const cssW = (this.mapRenderW != null && this.mapRenderW > 0) ? this.mapRenderW : Math.max(1, rect.width);
    const cssH = (this.mapRenderH != null && this.mapRenderH > 0) ? this.mapRenderH : Math.max(1, rect.height);
    return { cssW: cssW, cssH: cssH, rect: rect };
};

GeoEngine.prototype.resizeCanvas = function () {
    const dpr = window.devicePixelRatio || 1;
    const size = this.getRenderSize();
    const cssW = size.cssW;
    const cssH = size.cssH;
    const rect = size.rect;

    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    const scale = Math.min(rect.width / cssW || 1, rect.height / cssH || 1, 1);
    const dispW = Math.max(1, cssW * scale);
    const dispH = Math.max(1, cssH * scale);
    this.canvas.style.width = dispW + 'px';
    this.canvas.style.height = dispH + 'px';

    this.applyViewTransform();
    if (!this.sel.w && !this.sel.h) {
        this.initSelection(cssW, cssH);
    } else if (this.sel.w || this.sel.h) {
        this.clampSel(cssW, cssH);
        this.syncSelToInputs();
    }
    this.clampView(cssW, cssH);
    this.syncCanvasSizeInputs(cssW, cssH);
};

GeoEngine.prototype.applyCanvasSizeFromInputs = function () {
    const w = parseInt(this.canvasWidthInput && this.canvasWidthInput.value, 10);
    const h = parseInt(this.canvasHeightInput && this.canvasHeightInput.value, 10);
    this.mapRenderW = (Number.isFinite(w) && w >= 100) ? w : null;
    this.mapRenderH = (Number.isFinite(h) && h >= 100) ? h : null;
    this.resetView();
    this.resizeCanvas();
    this.render();
    this.saveState();
};

GeoEngine.prototype.darken = function (hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
};
