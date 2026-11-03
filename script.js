/**
 * script.js — event bindings only
 */
searchInput.on('input', () => populateList(searchInput.value));

toggleHighlight.on('change', () => {
    render();
    saveState();
});

colorHighlight.on('input', () => updateColor('highlight', colorHighlight.value));
colorLand.on('input', () => updateColor('land', colorLand.value));
colorWater.on('input', () => updateColor('water', colorWater.value));

if (toggleBorder) {
    toggleBorder.on('change', () => {
        drawBorders = toggleBorder.checked;
        render();
        saveState();
    });
}
if (colorBorder) {
    colorBorder.on('input', () => updateColor('border', colorBorder.value));
}
if (borderSizeInput) {
    borderSizeInput.on('change', () => {
        borderWidth = Math.max(0, parseFloat(borderSizeInput.value) || 0);
        render();
        saveState();
    });
    borderSizeInput.on('input', () => {
        borderWidth = Math.max(0, parseFloat(borderSizeInput.value) || 0);
        render();
    });
}

toggleCrop.on('change', () => {
    showCrop = toggleCrop.checked;
    selectBtn.disabled = !showCrop;
    if (showCrop) {
        cropInputs.rmCls('disabled');
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.width / dpr;
        const cssH = canvas.height / dpr;
        if (!sel.w || !sel.h) initSelection(cssW, cssH);
        else {
            clampSel(cssW, cssH);
            syncSelToInputs();
        }
    } else {
        cropInputs.addCls('disabled');
    }
    render();
    saveState();
});

[cropX, cropY, cropW, cropH].forEach(inp => {
    if (!inp) return;
    inp.on('change', syncInputsToSel);
});

selectBtn.on('click', selectCountriesInCrop);
saveBtn.on('click', saveAsImage);

if (exportBtn && exportPanel) {
    exportBtn.on('click', () => {
        exportPanel.classList.toggle('hidden');
    });
}
if (exportClose && exportPanel) {
    exportClose.on('click', () => exportPanel.addCls('hidden'));
}

resetBtn.on('click', () => {
    highlightedIds.clear();
    renderTags();
    populateList(searchInput.value);
    showCrop = false;
    toggleCrop.checked = false;
    selectBtn.disabled = true;
    cropInputs.addCls('disabled');
    sel = { x: 0, y: 0, w: 0, h: 0 };
    mapRenderW = null;
    mapRenderH = null;
    resetView();
    resizeCanvas();
    render();
    saveState();
});

themeBtn.on('click', () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
    saveState();
});

aboutBtn.on('click', () => aboutOverlay.rmCls('hidden'));
aboutClose.on('click', () => aboutOverlay.addCls('hidden'));
aboutOverlay.on('click', (e) => {
    if (e.target === aboutOverlay) aboutOverlay.addCls('hidden');
});

canvas.on('mousedown', onPointerDown);
window.on('mousemove', onPointerMove);
window.on('mouseup', onPointerUp);
canvas.on('wheel', onWheel, { passive: false });
canvas.on('contextmenu', (e) => e.preventDefault());

if (zoomSlider) {
    zoomSlider.on('input', () => {
        const pct = parseInt(zoomSlider.value, 10) || 100;
        setZoom(pct / 100);
    });
}

if (canvasWidthInput) {
    canvasWidthInput.on('change', applyCanvasSizeFromInputs);
    canvasWidthInput.on('keydown', (e) => { if (e.key === 'Enter') applyCanvasSizeFromInputs(); });
}
if (canvasHeightInput) {
    canvasHeightInput.on('change', applyCanvasSizeFromInputs);
    canvasHeightInput.on('keydown', (e) => { if (e.key === 'Enter') applyCanvasSizeFromInputs(); });
}

window.on('resize', () => {
    resizeCanvas();
    render();
});

loadData();
