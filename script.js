/**
 * script.js — create GeoEngine instance and bind UI events
 * Element id names are passed into initialize() via the constructor.
 */
const engine = new GeoEngine({
    canvas: 'map',
    mapContainer: 'map-container',
    canvasWidthInput: 'canvas-width',
    canvasHeightInput: 'canvas-height',
    searchInput: 'search',
    countryListEl: 'country-list',
    toggleHighlight: 'toggle-highlight',
    tagList: 'tag-list',
    tagInput: 'tag-input',
    colorHighlight: 'color-highlight',
    colorLand: 'color-land',
    colorWater: 'color-water',
    toggleBorder: 'toggle-border',
    colorBorder: 'color-border',
    swatchBorder: 'swatch-border',
    borderSizeInput: 'border-size',
    swatchHighlight: 'swatch-highlight',
    swatchLand: 'swatch-land',
    swatchWater: 'swatch-water',
    saveBtn: 'save-btn',
    selectBtn: 'select-btn',
    resetBtn: 'reset-btn',
    themeBtn: 'theme-btn',
    aboutBtn: 'about-btn',
    aboutOverlay: 'about-overlay',
    aboutClose: 'about-close',
    exportBtn: 'export-btn',
    exportPanel: 'export-panel',
    exportClose: 'export-close',
    toggleTransparentWater: 'toggle-transparent-water',
    toggleTransparentBorder: 'toggle-transparent-border',
    toggleCrop: 'toggle-crop',
    cropInputs: 'crop-inputs',
    cropX: 'crop-x',
    cropY: 'crop-y',
    cropW: 'crop-w',
    cropH: 'crop-h',
    zoomSlider: 'zoom-slider',
    zoomLabel: 'zoom-label'
});

engine.searchInput.on('input', () => engine.populateList(engine.searchInput.value));

engine.toggleHighlight.on('change', () => {
    engine.render();
    engine.saveState();
});

engine.colorHighlight.on('input', (e) => engine.updateColor('highlight', e.target.value));
engine.colorLand.on('input', (e) => engine.updateColor('land', e.target.value));
engine.colorWater.on('input', (e) => engine.updateColor('water', e.target.value));

if (engine.toggleBorder) {
    engine.toggleBorder.on('change', () => {
        engine.drawBorders = engine.toggleBorder.checked;
        engine.render();
        engine.saveState();
    });
}
if (engine.colorBorder) {
    engine.colorBorder.on('input', (e) => engine.updateColor('border', e.target.value));
}
if (engine.borderSizeInput) {
    engine.borderSizeInput.on('input', () => {
        engine.borderWidth = Math.max(0, parseFloat(engine.borderSizeInput.value) || 0);
        engine.render();
        engine.saveState();
    });
}

engine.toggleCrop.on('change', () => {
    engine.showCrop = engine.toggleCrop.checked;
    engine.selectBtn.disabled = !engine.showCrop;
    if (engine.showCrop) {
        engine.cropInputs.rmCls('disabled');
        const dpr = window.devicePixelRatio || 1;
        const cssW = engine.canvas.width / dpr;
        const cssH = engine.canvas.height / dpr;
        if (!engine.sel.w || !engine.sel.h) engine.initSelection(cssW, cssH);
        else {
            engine.clampSel(cssW, cssH);
            engine.syncSelToInputs();
        }
    } else {
        engine.cropInputs.addCls('disabled');
    }
    engine.render();
    engine.saveState();
});

[engine.cropX, engine.cropY, engine.cropW, engine.cropH].forEach(inp => {
    if (!inp) return;
    inp.on('change', function () { engine.syncInputsToSel(); });
    inp.on('input', function () { engine.syncInputsToSel(); });
});

engine.selectBtn.on('click', function () { engine.selectCountriesInCrop(); });
engine.saveBtn.on('click', function () { engine.saveAsImage(); });
engine.resetBtn.on('click', function () { engine.resetAll(); });

engine.themeBtn.on('click', () => {
    engine.applyTheme(engine.theme === 'dark' ? 'light' : 'dark', false);
    engine.saveState();
    engine.render();
});

engine.aboutBtn.on('click', () => engine.aboutOverlay.rmCls('hidden'));
engine.aboutClose.on('click', () => engine.aboutOverlay.addCls('hidden'));
engine.aboutOverlay.on('click', (e) => {
    if (e.target === engine.aboutOverlay) engine.aboutOverlay.addCls('hidden');
});

if (engine.exportBtn) {
    engine.exportBtn.on('click', () => {
        const open = engine.exportPanel && engine.exportPanel.classList.contains('hidden');
        engine.setExportPanelOpen(open);
    });
}
if (engine.exportClose) {
    engine.exportClose.on('click', () => engine.setExportPanelOpen(false));
}

engine.canvas.on('mousedown', function (e) { engine.onPointerDown(e); });
window.on('mousemove', function (e) { engine.onPointerMove(e); });
window.on('mouseup', function (e) { engine.onPointerUp(e); });
engine.canvas.on('wheel', function (e) { engine.onWheel(e); }, { passive: false });
engine.canvas.on('contextmenu', (e) => e.preventDefault());

if (engine.zoomSlider) {
    engine.zoomSlider.on('input', () => {
        const pct = parseInt(engine.zoomSlider.value, 10) || 100;
        engine.setZoom(pct / 100);
    });
}

if (engine.canvasWidthInput) {
    engine.canvasWidthInput.on('change', function () { engine.applyCanvasSizeFromInputs(); });
    engine.canvasWidthInput.on('keydown', (e) => {
        if (e.key === 'Enter') engine.applyCanvasSizeFromInputs();
    });
}
if (engine.canvasHeightInput) {
    engine.canvasHeightInput.on('change', function () { engine.applyCanvasSizeFromInputs(); });
    engine.canvasHeightInput.on('keydown', (e) => {
        if (e.key === 'Enter') engine.applyCanvasSizeFromInputs();
    });
}

window.on('resize', () => {
    engine.resizeCanvas();
    engine.render();
});

engine.updateZoomUI();
engine.loadData();
