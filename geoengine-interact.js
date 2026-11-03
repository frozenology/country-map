/**
 * geoengine-interact.js — pointer, wheel, marquee, crop drag
 */
function onPointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    // Middle mouse: pan
    if (e.button === 1) {
        e.preventDefault();
        isPanning = true;
        panStart = { x: cx, y: cy, ox: viewOffsetX, oy: viewOffsetY };
        canvas.style.cursor = 'grabbing';
        return;
    }

    if (e.button !== 0) return;

    // Shift + drag: marquee multi-select
    if (e.shiftKey) {
        e.preventDefault();
        isMarquee = true;
        const [mx, my] = screenToMap(cx, cy);
        marquee = { x0: mx, y0: my, x1: mx, y1: my };
        render();
        return;
    }

    // Crop handles / move
    if (showCrop) {
        const [mx, my] = screenToMap(cx, cy);
        const handle = getHandleAt(mx, my);
        if (handle) {
            dragState = handle;
            dragOccurred = false;
            dragStartMouse = { x: mx, y: my };
            dragStartSel = { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
            e.preventDefault();
            return;
        }
        if (mx >= sel.x && mx <= sel.x + sel.w && my >= sel.y && my <= sel.y + sel.h) {
            dragState = 'move';
            dragOccurred = false;
            dragStartMouse = { x: mx, y: my };
            dragStartSel = { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
            e.preventDefault();
            return;
        }
    }

    // Country click selection
    const [mx, my] = screenToMap(cx, cy);
    const f = findCountryAt(mx, my, cssW, cssH);
    if (f) {
        selectCountry(f.id);
    }
}

function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    mouseX = cx;
    mouseY = cy;

    if (isPanning) {
        const dpr = window.devicePixelRatio || 1;
        const logicalW = canvas.width / dpr;
        const logicalH = canvas.height / dpr;
        const dispW = canvas.clientWidth || logicalW;
        const dispH = canvas.clientHeight || logicalH;
        const sx = logicalW / dispW;
        const sy = logicalH / dispH;
        viewOffsetX = panStart.ox + (cx - panStart.x) * sx;
        viewOffsetY = panStart.oy + (cy - panStart.y) * sy;
        clampView(cssW, cssH);
        render();
        return;
    }

    if (isMarquee && marquee) {
        const [mx, my] = screenToMap(cx, cy);
        marquee.x1 = mx;
        marquee.y1 = my;
        render();
        return;
    }

    if (dragState) {
        const [mx, my] = screenToMap(cx, cy);
        const dx = mx - dragStartMouse.x;
        const dy = my - dragStartMouse.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragOccurred = true;
        const s = dragStartSel;
        if (dragState === 'move') {
            sel.x = s.x + dx;
            sel.y = s.y + dy;
        } else {
            let x = s.x, y = s.y, w = s.w, h = s.h;
            if (dragState.includes('w')) { x = s.x + dx; w = s.w - dx; }
            if (dragState.includes('e')) { w = s.w + dx; }
            if (dragState.includes('n')) { y = s.y + dy; h = s.h - dy; }
            if (dragState.includes('s')) { h = s.h + dy; }
            if (w < 1) { x = x + w - 1; w = 1; }
            if (h < 1) { y = y + h - 1; h = 1; }
            sel.x = x; sel.y = y; sel.w = w; sel.h = h;
        }
        clampSel(cssW, cssH);
        syncSelToInputs();
        render();
        return;
    }

    // Hover highlight
    const [mx, my] = screenToMap(cx, cy);
    const f = findCountryAt(mx, my, cssW, cssH);
    const newId = f ? f.id : null;
    if (newId !== lastHoveredId) {
        lastHoveredId = newId;
        render();
    }

    if (showCrop) {
        const handle = getHandleAt(mx, my);
        if (handle) canvas.style.cursor = HANDLE_CURSORS[handle] || 'default';
        else if (mx >= sel.x && mx <= sel.x + sel.w && my >= sel.y && my <= sel.y + sel.h) canvas.style.cursor = 'move';
        else canvas.style.cursor = 'default';
    } else {
        canvas.style.cursor = lastHoveredId ? 'pointer' : 'default';
    }
}

function onPointerUp(e) {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'default';
        return;
    }
    if (isMarquee) {
        isMarquee = false;
        selectCountriesInMarquee();
        marquee = null;
        render();
        return;
    }
    if (dragState) {
        dragState = null;
        if (dragOccurred) saveState();
        return;
    }
}

function onWheel(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom(viewScale * factor, cx, cy);
}
