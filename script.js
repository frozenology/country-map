/**
 * script.js — UI event bindings for World Map Explorer
 * Depends on helpers.js, geoengine.js
 */

canvas.on('mousemove', onPointerMove);

canvas.on('mouseleave', () => {
    if (isPanning) {
        isPanning = false;
        dragOccurred = true;
    }
    if (isMarquee) {
        isMarquee = false;
        selectCountriesInMarquee();
        marquee = null;
        dragOccurred = true;
    }
    if (dragState) {
        dragState = null;
        dragOccurred = true;
        dragStartMouse.x = -1;
        dragStartMouse.y = -1;
    }
    if (lastHoveredId !== null) {
        lastHoveredId = null;
        mouseX = -1;
        mouseY = -1;
        canvas.style.cursor = 'default';
        render();
    } else if (marquee === null) {
        render();
    }
});

canvas.on('mousedown', onPointerDown);
document.on('mouseup', onPointerUp);

// Prevent middle-click autoscroll
canvas.on('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
canvas.on('contextmenu', (e) => { /* allow */ });

// Mouse wheel zoom
canvas.on('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setZoom(viewScale * factor, cx, cy);
}, { passive: false });

// Zoom slider
if (zoomSlider) {
    zoomSlider.on('input', () => {
        const rect = mapContainer.getBoundingClientRect();
        setZoom(parseInt(zoomSlider.value, 10) / 100, rect.width / 2, rect.height / 2);
    });
}

canvas.on('click', (e) => {
    if (dragOccurred) { dragOccurred = false; return; }
    if (dragState || isMarquee || isPanning) return;
    if (e.shiftKey) return; // handled by marquee
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const [mapX, mapY] = screenToMap(cx, cy);
    if (showCrop && sel.w && sel.h) {
        if (getHandleAt(mapX, mapY) || (mapX >= sel.x && mapX <= sel.x + sel.w && mapY >= sel.y && mapY <= sel.y + sel.h)) {
            return;
        }
    }
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const feature = findCountryAt(mapX, mapY, cssW, cssH);
    if (feature) selectCountry(feature.id);
});

tagInput.on('click', (e) => {
    if (e.target === tagInput || e.target === tagList) searchInput.focus();
});

searchInput.on('input', () => {
    populateList(searchInput.value);
});

toggleHighlight.on('change', () => {
    if (!toggleHighlight.checked) {
        lastHoveredId = null;
        canvas.style.cursor = 'default';
    }
    render();
    saveState();
});

toggleCrop.on('change', () => {
    showCrop = toggleCrop.checked;
    selectBtn.disabled = !showCrop;
    cropInputs.toggleCls('disabled', !showCrop);
    if (!showCrop) { dragState = null; dragOccurred = false; }
    if (showCrop && !sel.w && !sel.h) {
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.width / dpr;
        const cssH = canvas.height / dpr;
        initSelection(cssW, cssH);
    }
    render();
    saveState();
});

aboutBtn.on('click', () => aboutOverlay.rmCls('hidden'));
aboutClose.on('click', () => aboutOverlay.addCls('hidden'));
aboutOverlay.on('click', (e) => { if (e.target === aboutOverlay) aboutOverlay.addCls('hidden'); });

themeBtn.on('click', () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next, false);
    saveState();
    render();
});

cropX.on('input', syncInputsToSel);
cropY.on('input', syncInputsToSel);
cropW.on('input', syncInputsToSel);
cropH.on('input', syncInputsToSel);

colorHighlight.on('input', (e) => updateColor('highlight', e.target.value));
colorLand.on('input', (e) => updateColor('land', e.target.value));
colorWater.on('input', (e) => updateColor('water', e.target.value));

saveBtn.on('click', saveAsImage);
selectBtn.on('click', selectCountriesInCrop);

resetBtn.on('click', () => {
    highlightedIds.clear();
    sel.x = 0; sel.y = 0; sel.w = 0; sel.h = 0;
    showCrop = false;
    dragState = null;
    isMarquee = false;
    marquee = null;
    isPanning = false;
    toggleCrop.checked = false;
    selectBtn.disabled = true;
    cropInputs.addCls('disabled');
    lastHoveredId = null;
    mouseX = -1;
    mouseY = -1;
    resetView();
    canvas.style.cursor = 'default';
    renderTags();
    populateList(searchInput.value);
    render();
    saveState();
});

window.on('resize', () => { resizeCanvas(); render(); });

updateZoomUI();
loadData();
