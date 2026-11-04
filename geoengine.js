/**
 * geoengine.js — GeoEngine constructor + prototype (ES2015, no class syntax)
 * Projection, drawing, selection, crop, zoom/pan.
 * Depends on helpers.js and topojson-client.
 * Other modules attach methods: geoengine-view, geoengine-app, geoengine-interact.
 */

function GeoEngine(elements) {
    this.initialize(elements);
}

GeoEngine.prototype.initialize = function (elements) {
    this.STORAGE_KEY = 'genmap-config';
    this.HANDLE_SIZE = 8;
    this.MIN_SCALE = 0.5;
    this.MAX_SCALE = 8;
    this.PADDING = 30;

    this.THEME_COLORS = {
        dark: { water: '#0f172a', land: '#1e293b', landStroke: '#334155' },
        light: { water: '#dbeafe', land: '#e2e8f0', landStroke: '#cbd5e1' },
    };

    this.HANDLE_CURSORS = {
        nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
        e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize',
        sw: 'nesw-resize', w: 'ew-resize', move: 'move',
    };

    elements = elements || {};

    this.canvas = $(elements.canvas || 'map');
    this.mapContainer = $(elements.mapContainer || 'map-container');
    this.canvasWidthInput = $(elements.canvasWidthInput || 'canvas-width');
    this.canvasHeightInput = $(elements.canvasHeightInput || 'canvas-height');
    this.searchInput = $(elements.searchInput || 'search');
    this.countryListEl = $(elements.countryListEl || 'country-list');
    this.toggleHighlight = $(elements.toggleHighlight || 'toggle-highlight');
    this.tagList = $(elements.tagList || 'tag-list');
    this.tagInput = $(elements.tagInput || 'tag-input');
    this.colorHighlight = $(elements.colorHighlight || 'color-highlight');
    this.colorLand = $(elements.colorLand || 'color-land');
    this.colorWater = $(elements.colorWater || 'color-water');
    this.toggleBorder = $(elements.toggleBorder || 'toggle-border');
    this.colorBorder = $(elements.colorBorder || 'color-border');
    this.swatchBorder = $(elements.swatchBorder || 'swatch-border');
    this.borderSizeInput = $(elements.borderSizeInput || 'border-size');
    this.swatchHighlight = $(elements.swatchHighlight || 'swatch-highlight');
    this.swatchLand = $(elements.swatchLand || 'swatch-land');
    this.swatchWater = $(elements.swatchWater || 'swatch-water');
    this.saveBtn = $(elements.saveBtn || 'save-btn');
    this.selectBtn = $(elements.selectBtn || 'select-btn');
    this.resetBtn = $(elements.resetBtn || 'reset-btn');
    this.themeBtn = $(elements.themeBtn || 'theme-btn');
    this.aboutBtn = $(elements.aboutBtn || 'about-btn');
    this.aboutOverlay = $(elements.aboutOverlay || 'about-overlay');
    this.aboutClose = $(elements.aboutClose || 'about-close');
    this.exportBtn = $(elements.exportBtn || 'export-btn');
    this.exportPanel = $(elements.exportPanel || 'export-panel');
    this.exportClose = $(elements.exportClose || 'export-close');
    this.toggleTransparentWater = $(elements.toggleTransparentWater || 'toggle-transparent-water');
    this.toggleTransparentBorder = $(elements.toggleTransparentBorder || 'toggle-transparent-border');
    this.toggleCrop = $(elements.toggleCrop || 'toggle-crop');
    this.cropInputs = $(elements.cropInputs || 'crop-inputs');
    this.cropX = $(elements.cropX || 'crop-x');
    this.cropY = $(elements.cropY || 'crop-y');
    this.cropW = $(elements.cropW || 'crop-w');
    this.cropH = $(elements.cropH || 'crop-h');
    this.zoomSlider = $(elements.zoomSlider || 'zoom-slider');
    this.zoomLabel = $(elements.zoomLabel || 'zoom-label');
    this.ctx = this.canvas.getContext('2d');

    this.features = [];
    this.countries = [];
    this.CONTINENT_ORDER = [];
    this.COUNTRY_CONTINENT = {};

    this.highlightedIds = new Set();
    this.lastHoveredId = null;
    this.mouseX = -1;
    this.mouseY = -1;
    this.sel = { x: 0, y: 0, w: 0, h: 0 };
    this.showCrop = false;
    this.dragState = null;
    this.dragOccurred = false;
    this.dragStartMouse = { x: 0, y: 0 };
    this.dragStartSel = { x: 0, y: 0, w: 0, h: 0 };

    this.viewScale = 1;
    this.viewOffsetX = 0;
    this.viewOffsetY = 0;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0, ox: 0, oy: 0 };
    this.marquee = null;
    this.isMarquee = false;

    this.COLORS = {
        water: '#0f172a',
        land: '#1e293b',
        landStroke: '#334155',
        border: '#334155',
        hover: '#3b82f6',
        hoverStroke: '#2563eb',
        selected: '#ef4444',
        selectedStroke: '#dc2626',
    };
    this.drawBorders = true;
    this.borderWidth = 0.5;
    this.theme = 'dark';
    this.mapRenderW = null;
    this.mapRenderH = null;
};

GeoEngine.prototype.project = function (lng, lat, w, h) {
    var x = this.PADDING + (lng + 180) / 360 * (w - 2 * this.PADDING);
    var y = this.PADDING + (90 - lat) / 180 * (h - 2 * this.PADDING);
    return [x, y];
};

GeoEngine.prototype.clientToLogical = function (cx, cy) {
    var dpr = window.devicePixelRatio || 1;
    var logicalW = this.canvas.width / dpr;
    var logicalH = this.canvas.height / dpr;
    var dispW = this.canvas.clientWidth || logicalW;
    var dispH = this.canvas.clientHeight || logicalH;
    return [cx * (logicalW / dispW), cy * (logicalH / dispH)];
};

GeoEngine.prototype.screenToMap = function (cx, cy) {
    var pt = this.clientToLogical(cx, cy);
    return [
        (pt[0] - this.viewOffsetX) / this.viewScale,
        (pt[1] - this.viewOffsetY) / this.viewScale,
    ];
};

GeoEngine.prototype.applyViewTransform = function () {
    var dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(
        dpr * this.viewScale, 0,
        0, dpr * this.viewScale,
        dpr * this.viewOffsetX, dpr * this.viewOffsetY
    );
};

GeoEngine.prototype.updateZoomUI = function () {
    var pct = Math.round(this.viewScale * 100);
    if (this.zoomSlider) this.zoomSlider.value = String(pct);
    if (this.zoomLabel) this.zoomLabel.textContent = pct + '%';
};

GeoEngine.prototype.setZoom = function (scale, focusCx, focusCy) {
    var dpr = window.devicePixelRatio || 1;
    var cssW = this.canvas.width / dpr;
    var cssH = this.canvas.height / dpr;
    var lx, ly;
    if (focusCx != null && focusCy != null) {
        var pt = this.clientToLogical(focusCx, focusCy);
        lx = pt[0]; ly = pt[1];
    } else {
        lx = cssW / 2;
        ly = cssH / 2;
    }
    var mapX = (lx - this.viewOffsetX) / this.viewScale;
    var mapY = (ly - this.viewOffsetY) / this.viewScale;
    this.viewScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, scale));
    this.viewOffsetX = lx - mapX * this.viewScale;
    this.viewOffsetY = ly - mapY * this.viewScale;
    this.clampView(cssW, cssH);
    this.updateZoomUI();
    this.render();
};

GeoEngine.prototype.clampView = function (cssW, cssH) {
    var minVisible = 80;
    var mapW = cssW * this.viewScale;
    var mapH = cssH * this.viewScale;
    if (this.viewOffsetX > cssW - minVisible) this.viewOffsetX = cssW - minVisible;
    if (this.viewOffsetY > cssH - minVisible) this.viewOffsetY = cssH - minVisible;
    if (this.viewOffsetX + mapW < minVisible) this.viewOffsetX = minVisible - mapW;
    if (this.viewOffsetY + mapH < minVisible) this.viewOffsetY = minVisible - mapH;
};

GeoEngine.prototype.resetView = function () {
    this.viewScale = 1;
    this.viewOffsetX = 0;
    this.viewOffsetY = 0;
    this.updateZoomUI();
};

GeoEngine.prototype.unwrapRing = function (ring) {
    var out = [];
    var offset = 0, lastOrig = null;
    for (var i = 0; i < ring.length; i++) {
        var p = ring[i];
        if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number' || !isFinite(p[0]) || !isFinite(p[1])) continue;
        var orig = p[0];
        if (lastOrig !== null) {
            var diff = orig - lastOrig;
            if (diff > 180) offset -= 360;
            else if (diff < -180) offset += 360;
        }
        out.push({ lng: orig + offset, lat: p[1] });
        lastOrig = orig;
    }
    return out;
};

GeoEngine.prototype.buildPath = function (ctx, feature, w, h) {
    var geo = feature.geometry;
    if (!geo || !geo.coordinates) return;
    var polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    if (!Array.isArray(polys)) return;
    for (var pi = 0; pi < polys.length; pi++) {
        var poly = polys[pi];
        if (!Array.isArray(poly)) continue;
        for (var ri = 0; ri < poly.length; ri++) {
            var ring = poly[ri];
            if (!Array.isArray(ring) || ring.length < 3) continue;
            var pts = this.unwrapRing(ring);
            if (pts.length < 3) continue;
            for (var i = 0; i < pts.length; i++) {
                var xy = this.project(pts[i].lng, pts[i].lat, w, h);
                if (i === 0) ctx.moveTo(xy[0], xy[1]);
                else ctx.lineTo(xy[0], xy[1]);
            }
            ctx.closePath();
        }
    }
};

GeoEngine.prototype.drawFeature = function (ctx, feature, fill, stroke, w, h, mode) {
    mode = mode || 'both';
    if (mode === 'fill' || mode === 'both') {
        ctx.beginPath();
        this.buildPath(ctx, feature, w, h);
        ctx.fillStyle = fill;
        ctx.fill('evenodd');
    }
    if ((mode === 'stroke' || mode === 'both') && this.drawBorders && this.borderWidth > 0) {
        ctx.save();
        ctx.beginPath();
        this.buildPath(ctx, feature, w, h);
        ctx.clip('evenodd');
        ctx.beginPath();
        this.buildPath(ctx, feature, w, h);
        ctx.strokeStyle = stroke || this.COLORS.border;
        ctx.lineWidth = this.borderWidth * 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    }
};

GeoEngine.prototype.pointInFeature = function (mapX, mapY, feature, w, h) {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.beginPath();
    this.buildPath(this.ctx, feature, w, h);
    var hit = this.ctx.isPointInPath(mapX, mapY, 'evenodd');
    this.ctx.restore();
    return hit;
};

GeoEngine.prototype.findCountryAt = function (mapX, mapY, w, h) {
    for (var i = 0; i < this.features.length; i++) {
        if (this.pointInFeature(mapX, mapY, this.features[i], w, h)) return this.features[i];
    }
    return null;
};

GeoEngine.prototype.initSelection = function (w, h) {
    var margin = Math.round(Math.min(w, h) * 0.1);
    this.sel.x = margin; this.sel.y = margin;
    this.sel.w = w - 2 * margin; this.sel.h = h - 2 * margin;
    this.syncSelToInputs();
};

GeoEngine.prototype.syncSelToInputs = function () {
    if (this.cropX) this.cropX.value = String(Math.round(this.sel.x));
    if (this.cropY) this.cropY.value = String(Math.round(this.sel.y));
    if (this.cropW) this.cropW.value = String(Math.round(this.sel.w));
    if (this.cropH) this.cropH.value = String(Math.round(this.sel.h));
};

GeoEngine.prototype.syncInputsToSel = function () {
    var dpr = window.devicePixelRatio || 1;
    var cssW = this.canvas.width / dpr;
    var cssH = this.canvas.height / dpr;
    this.sel.x = Math.max(0, parseInt(this.cropX.value, 10) || 0);
    this.sel.y = Math.max(0, parseInt(this.cropY.value, 10) || 0);
    this.sel.w = Math.max(1, parseInt(this.cropW.value, 10) || 1);
    this.sel.h = Math.max(1, parseInt(this.cropH.value, 10) || 1);
    if (this.sel.x + this.sel.w > cssW) this.sel.w = cssW - this.sel.x;
    if (this.sel.y + this.sel.h > cssH) this.sel.h = cssH - this.sel.y;
    this.render();
    this.saveState();
};

GeoEngine.prototype.getHandleAt = function (cx, cy) {
    var hs = this.HANDLE_SIZE / this.viewScale;
    var half = hs / 2;
    var r = this.sel;
    var rects = {
        nw: { x: r.x - half, y: r.y - half, w: hs, h: hs },
        n:  { x: r.x + r.w / 2 - half, y: r.y - half, w: hs, h: hs },
        ne: { x: r.x + r.w - half, y: r.y - half, w: hs, h: hs },
        e:  { x: r.x + r.w - half, y: r.y + r.h / 2 - half, w: hs, h: hs },
        se: { x: r.x + r.w - half, y: r.y + r.h - half, w: hs, h: hs },
        s:  { x: r.x + r.w / 2 - half, y: r.y + r.h - half, w: hs, h: hs },
        sw: { x: r.x - half, y: r.y + r.h - half, w: hs, h: hs },
        w:  { x: r.x - half, y: r.y + r.h / 2 - half, w: hs, h: hs },
    };
    for (var key in rects) {
        if (!rects.hasOwnProperty(key)) continue;
        var hr = rects[key];
        if (cx >= hr.x && cx < hr.x + hr.w && cy >= hr.y && cy < hr.y + hr.h) return key;
    }
    return null;
};

GeoEngine.prototype.clampSel = function (cssW, cssH) {
    this.sel.x = Math.max(0, Math.min(this.sel.x, cssW - 1));
    this.sel.y = Math.max(0, Math.min(this.sel.y, cssH - 1));
    this.sel.w = Math.max(1, Math.min(this.sel.w, cssW - this.sel.x));
    this.sel.h = Math.max(1, Math.min(this.sel.h, cssH - this.sel.y));
};

GeoEngine.prototype.getFeatureBounds = function (feature, w, h) {
    var geo = feature.geometry;
    if (!geo || !geo.coordinates) return null;
    var polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    if (!Array.isArray(polys)) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var pi = 0; pi < polys.length; pi++) {
        var poly = polys[pi];
        if (!Array.isArray(poly)) continue;
        for (var ri = 0; ri < poly.length; ri++) {
            var ring = poly[ri];
            if (!Array.isArray(ring) || ring.length < 3) continue;
            var pts = this.unwrapRing(ring);
            for (var i = 0; i < pts.length; i++) {
                var xy = this.project(pts[i].lng, pts[i].lat, w, h);
                if (xy[0] < minX) minX = xy[0];
                if (xy[0] > maxX) maxX = xy[0];
                if (xy[1] < minY) minY = xy[1];
                if (xy[1] > maxY) maxY = xy[1];
            }
        }
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

GeoEngine.prototype.rectsIntersect = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
};

GeoEngine.prototype.selectCountriesInCrop = function () {
    if (!this.showCrop || !this.sel.w || !this.sel.h) return;
    var dpr = window.devicePixelRatio || 1;
    var cssW = this.canvas.width / dpr;
    var cssH = this.canvas.height / dpr;
    var cropRect = { x: this.sel.x, y: this.sel.y, w: this.sel.w, h: this.sel.h };
    for (var i = 0; i < this.features.length; i++) {
        var bounds = this.getFeatureBounds(this.features[i], cssW, cssH);
        if (bounds && this.rectsIntersect(cropRect, bounds)) this.highlightedIds.add(this.features[i].id);
    }
    this.renderTags();
    this.render();
    this.populateList(this.searchInput.value);
    this.saveState();
};

GeoEngine.prototype.drawCropOverlay = function (targetCtx, w, h) {
    if (!this.showCrop || !this.sel.w || !this.sel.h) return;
    var r = this.sel;
    targetCtx.save();
    targetCtx.fillStyle = 'rgba(0,0,0,0.45)';
    if (r.y > 0) targetCtx.fillRect(0, 0, w, r.y);
    if (r.y + r.h < h) targetCtx.fillRect(0, r.y + r.h, w, h - r.y - r.h);
    if (r.x > 0) targetCtx.fillRect(0, r.y, r.x, r.h);
    if (r.x + r.w < w) targetCtx.fillRect(r.x + r.w, r.y, w - r.x - r.w, r.h);
    var lw = 2 / this.viewScale;
    targetCtx.strokeStyle = '#3b82f6';
    targetCtx.lineWidth = lw;
    targetCtx.strokeRect(r.x, r.y, r.w, r.h);
    targetCtx.fillStyle = '#ffffff';
    targetCtx.strokeStyle = '#3b82f6';
    targetCtx.lineWidth = 1.5 / this.viewScale;
    var hs = this.HANDLE_SIZE / this.viewScale;
    var half = hs / 2;
    var scaled = [
        { x: r.x - half, y: r.y - half },
        { x: r.x + r.w / 2 - half, y: r.y - half },
        { x: r.x + r.w - half, y: r.y - half },
        { x: r.x + r.w - half, y: r.y + r.h / 2 - half },
        { x: r.x + r.w - half, y: r.y + r.h - half },
        { x: r.x + r.w / 2 - half, y: r.y + r.h - half },
        { x: r.x - half, y: r.y + r.h - half },
        { x: r.x - half, y: r.y + r.h / 2 - half },
    ];
    for (var i = 0; i < scaled.length; i++) {
        targetCtx.fillRect(scaled[i].x, scaled[i].y, hs, hs);
        targetCtx.strokeRect(scaled[i].x, scaled[i].y, hs, hs);
    }
    targetCtx.restore();
};

GeoEngine.prototype.drawMarquee = function (targetCtx) {
    if (!this.marquee) return;
    var x = Math.min(this.marquee.x0, this.marquee.x1);
    var y = Math.min(this.marquee.y0, this.marquee.y1);
    var w = Math.abs(this.marquee.x1 - this.marquee.x0);
    var h = Math.abs(this.marquee.y1 - this.marquee.y0);
    if (w < 1 && h < 1) return;
    targetCtx.save();
    targetCtx.strokeStyle = '#f59e0b';
    targetCtx.lineWidth = 1.5 / this.viewScale;
    targetCtx.setLineDash([6 / this.viewScale, 3 / this.viewScale, 1.5 / this.viewScale, 3 / this.viewScale]);
    targetCtx.strokeRect(x, y, w, h);
    targetCtx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    targetCtx.fillRect(x, y, w, h);
    targetCtx.restore();
};

GeoEngine.prototype.selectCountriesInMarquee = function () {
    if (!this.marquee) return;
    var dpr = window.devicePixelRatio || 1;
    var cssW = this.canvas.width / dpr;
    var cssH = this.canvas.height / dpr;
    var r = {
        x: Math.min(this.marquee.x0, this.marquee.x1),
        y: Math.min(this.marquee.y0, this.marquee.y1),
        w: Math.abs(this.marquee.x1 - this.marquee.x0),
        h: Math.abs(this.marquee.y1 - this.marquee.y0),
    };
    if (r.w < 2 && r.h < 2) return;
    for (var i = 0; i < this.features.length; i++) {
        var bounds = this.getFeatureBounds(this.features[i], cssW, cssH);
        if (bounds && this.rectsIntersect(r, bounds)) this.highlightedIds.add(this.features[i].id);
    }
    this.renderTags();
    this.populateList(this.searchInput.value);
    this.saveState();
};

GeoEngine.prototype.drawMap = function (targetCtx, w, h, showHover, opts) {
    opts = opts || {};
    if (opts.transparentWater) {
        targetCtx.clearRect(0, 0, w, h);
    } else {
        targetCtx.fillStyle = this.COLORS.water;
        targetCtx.fillRect(0, 0, w, h);
    }
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, w, h);
    targetCtx.clip();
    var highlightOn = this.toggleHighlight && this.toggleHighlight.checked;

    for (var i = 0; i < this.features.length; i++) {
        try {
            var f = this.features[i];
            var id = f.id;
            var isHovered = showHover && highlightOn && this.mouseX >= 0 && this.lastHoveredId === id;
            var fill = (this.highlightedIds.has(id) || isHovered) ? this.COLORS.hover : this.COLORS.land;
            this.drawFeature(targetCtx, f, fill, this.COLORS.border, w, h, 'fill');
        } catch (e) {
            console.warn('Error rendering feature:', this.features[i].id, e);
        }
    }

    if (this.drawBorders && this.borderWidth > 0 && !opts.transparentBorder) {
        for (var j = 0; j < this.features.length; j++) {
            try {
                this.drawFeature(targetCtx, this.features[j], this.COLORS.land, this.COLORS.border, w, h, 'stroke');
            } catch (e2) {
                console.warn('Error stroking feature:', this.features[j].id, e2);
            }
        }
    }
    targetCtx.restore();
};
