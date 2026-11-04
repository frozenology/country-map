/**
 * geoengine-interact.js — GeoEngine.prototype: pointer, wheel, marquee, crop drag
 */
GeoEngine.prototype.onPointerDown = function (e) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.width / dpr;
    const cssH = this.canvas.height / dpr;

    if (e.button === 1) {
        e.preventDefault();
        this.isPanning = true;
        this.panStart = { x: cx, y: cy, ox: this.viewOffsetX, oy: this.viewOffsetY };
        this.canvas.style.cursor = 'grabbing';
        return;
    }

    if (e.button !== 0) return;

    if (e.shiftKey) {
        e.preventDefault();
        this.isMarquee = true;
        const mapPt = this.screenToMap(cx, cy);
        this.marquee = { x0: mapPt[0], y0: mapPt[1], x1: mapPt[0], y1: mapPt[1] };
        this.render();
        return;
    }

    if (this.showCrop) {
        const mapPt = this.screenToMap(cx, cy);
        const mx = mapPt[0];
        const my = mapPt[1];
        const handle = this.getHandleAt(mx, my);
        if (handle) {
            this.dragState = handle;
            this.dragOccurred = false;
            this.dragStartMouse = { x: mx, y: my };
            this.dragStartSel = { x: this.sel.x, y: this.sel.y, w: this.sel.w, h: this.sel.h };
            e.preventDefault();
            return;
        }
        if (mx >= this.sel.x && mx <= this.sel.x + this.sel.w && my >= this.sel.y && my <= this.sel.y + this.sel.h) {
            this.dragState = 'move';
            this.dragOccurred = false;
            this.dragStartMouse = { x: mx, y: my };
            this.dragStartSel = { x: this.sel.x, y: this.sel.y, w: this.sel.w, h: this.sel.h };
            e.preventDefault();
            return;
        }
    }

    const mapPt = this.screenToMap(cx, cy);
    const f = this.findCountryAt(mapPt[0], mapPt[1], cssW, cssH);
    if (f) this.selectCountry(f.id);
};

GeoEngine.prototype.onPointerMove = function (e) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.width / dpr;
    const cssH = this.canvas.height / dpr;

    this.mouseX = cx;
    this.mouseY = cy;

    if (this.isPanning) {
        const logicalW = this.canvas.width / dpr;
        const logicalH = this.canvas.height / dpr;
        const dispW = this.canvas.clientWidth || logicalW;
        const dispH = this.canvas.clientHeight || logicalH;
        const sx = logicalW / dispW;
        const sy = logicalH / dispH;
        this.viewOffsetX = this.panStart.ox + (cx - this.panStart.x) * sx;
        this.viewOffsetY = this.panStart.oy + (cy - this.panStart.y) * sy;
        this.clampView(cssW, cssH);
        this.render();
        return;
    }

    if (this.isMarquee && this.marquee) {
        const mapPt = this.screenToMap(cx, cy);
        this.marquee.x1 = mapPt[0];
        this.marquee.y1 = mapPt[1];
        this.render();
        return;
    }

    if (this.dragState) {
        const mapPt = this.screenToMap(cx, cy);
        const mx = mapPt[0];
        const my = mapPt[1];
        const dx = mx - this.dragStartMouse.x;
        const dy = my - this.dragStartMouse.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) this.dragOccurred = true;
        const s = this.dragStartSel;
        if (this.dragState === 'move') {
            this.sel.x = s.x + dx;
            this.sel.y = s.y + dy;
        } else {
            var x = s.x, y = s.y, w = s.w, h = s.h;
            if (this.dragState.indexOf('w') >= 0) { x = s.x + dx; w = s.w - dx; }
            if (this.dragState.indexOf('e') >= 0) { w = s.w + dx; }
            if (this.dragState.indexOf('n') >= 0) { y = s.y + dy; h = s.h - dy; }
            if (this.dragState.indexOf('s') >= 0) { h = s.h + dy; }
            if (w < 1) { x = x + w - 1; w = 1; }
            if (h < 1) { y = y + h - 1; h = 1; }
            this.sel.x = x; this.sel.y = y; this.sel.w = w; this.sel.h = h;
        }
        this.clampSel(cssW, cssH);
        this.syncSelToInputs();
        this.render();
        return;
    }

    const mapPt = this.screenToMap(cx, cy);
    const f = this.findCountryAt(mapPt[0], mapPt[1], cssW, cssH);
    const newId = f ? f.id : null;
    if (newId !== this.lastHoveredId) {
        this.lastHoveredId = newId;
        this.render();
    }

    if (this.showCrop) {
        const handle = this.getHandleAt(mapPt[0], mapPt[1]);
        if (handle) this.canvas.style.cursor = this.HANDLE_CURSORS[handle] || 'default';
        else if (mapPt[0] >= this.sel.x && mapPt[0] <= this.sel.x + this.sel.w && mapPt[1] >= this.sel.y && mapPt[1] <= this.sel.y + this.sel.h)
            this.canvas.style.cursor = 'move';
        else this.canvas.style.cursor = 'default';
    } else {
        this.canvas.style.cursor = this.lastHoveredId ? 'pointer' : 'default';
    }
};

GeoEngine.prototype.onPointerUp = function (e) {
    if (this.isPanning) {
        this.isPanning = false;
        this.canvas.style.cursor = 'default';
        return;
    }
    if (this.isMarquee) {
        this.isMarquee = false;
        this.selectCountriesInMarquee();
        this.marquee = null;
        this.render();
        return;
    }
    if (this.dragState) {
        this.dragState = null;
        if (this.dragOccurred) this.saveState();
        return;
    }
};

GeoEngine.prototype.onWheel = function (e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.setZoom(this.viewScale * factor, cx, cy);
};
