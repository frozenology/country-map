/**
 * Pointer / interaction handlers (loaded after geoengine core)
 */
function onPointerDown(e) {
    dragOccurred = false;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [mapX, mapY] = screenToMap(cx, cy);

    // Middle mouse → pan
    if (e.button === 1) {
        isPanning = true;
        panStart.x = cx;
        panStart.y = cy;
        panStart.ox = viewOffsetX;
        panStart.oy = viewOffsetY;
        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }

    // Shift + left → marquee multi-select
    if (e.button === 0 && e.shiftKey) {
        isMarquee = true;
        marquee = { x0: mapX, y0: mapY, x1: mapX, y1: mapY };
        dragOccurred = true;
        e.preventDefault();
        render();
        return;
    }

    // Crop handle / move (in map coordinates)
    if (showCrop && sel.w && sel.h && (getHandleAt(mapX, mapY) || (mapX >= sel.x && mapX <= sel.x + sel.w && mapY >= sel.y && mapY <= sel.y + sel.h))) {
        dragStartMouse.x = mapX;
        dragStartMouse.y = mapY;
        e.preventDefault();
    } else {
        dragStartMouse.x = -1;
        dragStartMouse.y = -1;
    }
}

function onPointerMove(e) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [mapX, mapY] = screenToMap(cx, cy);
    mouseX = mapX;
    mouseY = mapY;

    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    // Pan with middle mouse
    if (isPanning) {
        viewOffsetX = panStart.ox + (cx - panStart.x);
        viewOffsetY = panStart.oy + (cy - panStart.y);
        clampView(cssW, cssH);
        canvas.style.cursor = 'grabbing';
        render();
        return;
    }

    // Marquee drag
    if (isMarquee && marquee) {
        marquee.x1 = mapX;
        marquee.y1 = mapY;
        canvas.style.cursor = 'crosshair';
        render();
        return;
    }

    if (!dragState && showCrop && sel.w && sel.h && dragStartMouse.x >= 0) {
        const dx = mapX - dragStartMouse.x;
        const dy = mapY - dragStartMouse.y;
        if (dx * dx + dy * dy > 9 / (viewScale * viewScale)) {
            const handle = getHandleAt(dragStartMouse.x, dragStartMouse.y);
            if (handle) {
                dragState = handle;
            } else if (
                dragStartMouse.x >= sel.x && dragStartMouse.x <= sel.x + sel.w &&
                dragStartMouse.y >= sel.y && dragStartMouse.y <= sel.y + sel.h
            ) {
                dragState = 'move';
            }
            if (dragState) {
                dragStartSel.x = sel.x;
                dragStartSel.y = sel.y;
                dragStartSel.w = sel.w;
                dragStartSel.h = sel.h;
            }
        }
    }

    if (dragState) {
        const dx = mapX - dragStartMouse.x;
        const dy = mapY - dragStartMouse.y;
        const s = dragStartSel;

        switch (dragState) {
            case 'move':
                sel.x = Math.round(s.x + dx);
                sel.y = Math.round(s.y + dy);
                break;
            case 'nw':
                sel.x = Math.round(s.x + dx);
                sel.y = Math.round(s.y + dy);
                sel.w = Math.round(s.w - dx);
                sel.h = Math.round(s.h - dy);
                break;
            case 'n':
                sel.y = Math.round(s.y + dy);
                sel.h = Math.round(s.h - dy);
                break;
            case 'ne':
                sel.y = Math.round(s.y + dy);
                sel.w = Math.round(s.w + dx);
                sel.h = Math.round(s.h - dy);
                break;
            case 'e':
                sel.w = Math.round(s.w + dx);
                break;
            case 'se':
                sel.w = Math.round(s.w + dx);
                sel.h = Math.round(s.h + dy);
                break;
            case 's':
                sel.h = Math.round(s.h + dy);
                break;
            case 'sw':
                sel.x = Math.round(s.x + dx);
                sel.w = Math.round(s.w - dx);
                sel.h = Math.round(s.h + dy);
                break;
            case 'w':
                sel.x = Math.round(s.x + dx);
                sel.w = Math.round(s.w - dx);
                break;
        }
        clampSel(cssW, cssH);
        syncSelToInputs();
        render();
        return;
    }

    if (showCrop && sel.w && sel.h) {
        const overHandle = getHandleAt(mapX, mapY);
        if (overHandle) {
            canvas.style.cursor = HANDLE_CURSORS[overHandle];
            return;
        }
        if (mapX >= sel.x && mapX <= sel.x + sel.w && mapY >= sel.y && mapY <= sel.y + sel.h) {
            canvas.style.cursor = 'move';
            return;
        }
    }

    if (!toggleHighlight.checked) {
        if (lastHoveredId !== null) {
            lastHoveredId = null;
            render();
        }
        canvas.style.cursor = viewScale !== 1 ? 'grab' : 'default';
        return;
    }

    const hit = findCountryAt(mapX, mapY, cssW, cssH);
    const hitId = hit ? hit.id : null;

    if (hitId !== lastHoveredId) {
        lastHoveredId = hitId;
        render();
    }

    canvas.style.cursor = lastHoveredId ? 'pointer' : (viewScale !== 1 ? 'grab' : 'default');
}

function onPointerUp(e) {
    if (isPanning) {
        isPanning = false;
        dragOccurred = true;
        canvas.style.cursor = viewScale !== 1 ? 'grab' : 'default';
    }
    if (isMarquee) {
        isMarquee = false;
        selectCountriesInMarquee();
        marquee = null;
        dragOccurred = true;
        render();
    }
    if (dragState) {
        dragState = null;
        dragOccurred = true;
        dragStartMouse.x = -1;
        dragStartMouse.y = -1;
        render();
    }
}
