/**
 * geoengine.js — map projection, drawing, selection, crop, zoom/pan
 * Depends on helpers.js and topojson-client.
 */
const canvas = $('map');
const ctx = canvas.getContext('2d');
const mapContainer = $('map-container');
const searchInput = $('search');
const countryListEl = $('country-list');
const toggleHighlight = $('toggle-highlight');
const tagList = $('tag-list');
const tagInput = $('tag-input');
const colorHighlight = $('color-highlight');
const colorLand = $('color-land');
const colorWater = $('color-water');
const toggleBorder = $('toggle-border');
const colorBorder = $('color-border');
const swatchBorder = $('swatch-border');
const borderSizeInput = $('border-size');
const swatchHighlight = $('swatch-highlight');
const swatchLand = $('swatch-land');
const swatchWater = $('swatch-water');
const saveBtn = $('save-btn');
const selectBtn = $('select-btn');
const resetBtn = $('reset-btn');
const themeBtn = $('theme-btn');
const aboutBtn = $('about-btn');
const aboutOverlay = $('about-overlay');
const aboutClose = $('about-close');
const exportBtn = $('export-btn');
const exportPanel = $('export-panel');
const exportClose = $('export-close');
const toggleTransparentWater = $('toggle-transparent-water');
const STORAGE_KEY = 'genmap-config';
const toggleCrop = $('toggle-crop');
const cropInputs = $('crop-inputs');
const cropX = $('crop-x');
const cropY = $('crop-y');
const cropW = $('crop-w');
const cropH = $('crop-h');
let features = [];
let countries = [];
let highlightedIds = new Set();
let lastHoveredId = null;
let mouseX = -1;
let mouseY = -1;
let sel = { x: 0, y: 0, w: 0, h: 0 };
let showCrop = false;
let dragState = null;
let dragOccurred = false;
let dragStartMouse = { x: 0, y: 0 };
let dragStartSel = { x: 0, y: 0, w: 0, h: 0 };
const HANDLE_SIZE = 8;
let viewScale = 1;
let viewOffsetX = 0;
let viewOffsetY = 0;
const MIN_SCALE = 0.5;
const MAX_SCALE = 8;
let isPanning = false;
let panStart = { x: 0, y: 0, ox: 0, oy: 0 };
let marquee = null;
let isMarquee = false;
const zoomSlider = $('zoom-slider');
const zoomLabel = $('zoom-label');
let COLORS = {
    water: '#0f172a',
    land: '#1e293b',
    landStroke: '#334155',
    border: '#334155',
    hover: '#3b82f6',
    hoverStroke: '#2563eb',
    selected: '#ef4444',
    selectedStroke: '#dc2626',
};
let drawBorders = true;
let borderWidth = 0.5;
let theme = 'dark';
const THEME_COLORS = {
    dark: { water: '#0f172a', land: '#1e293b', landStroke: '#334155' },
    light: { water: '#dbeafe', land: '#e2e8f0', landStroke: '#cbd5e1' },
};
const PADDING = 30;
function project(lng, lat, w, h) {
    const x = PADDING + (lng + 180) / 360 * (w - 2 * PADDING);
    const y = PADDING + (90 - lat) / 180 * (h - 2 * PADDING);
    return [x, y];
}
function screenToMap(cx, cy) {
    return [(cx - viewOffsetX) / viewScale, (cy - viewOffsetY) / viewScale];
}
function applyViewTransform() {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, dpr * viewOffsetX, dpr * viewOffsetY);
}
function updateZoomUI() {
    const pct = Math.round(viewScale * 100);
    if (zoomSlider) zoomSlider.value = String(pct);
    if (zoomLabel) zoomLabel.textContent = pct + '%';
}
function setZoom(scale, focusCx, focusCy) {
    const rect = mapContainer.getBoundingClientRect();
    const cssW = rect.width, cssH = rect.height;
    const cx = focusCx != null ? focusCx : cssW / 2;
    const cy = focusCy != null ? focusCy : cssH / 2;
    const [mapX, mapY] = screenToMap(cx, cy);
    viewScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    viewOffsetX = cx - mapX * viewScale;
    viewOffsetY = cy - mapY * viewScale;
    clampView(cssW, cssH);
    updateZoomUI();
    render();
}
function clampView(cssW, cssH) {
    const minVisible = 80;
    const mapW = cssW * viewScale, mapH = cssH * viewScale;
    if (viewOffsetX > cssW - minVisible) viewOffsetX = cssW - minVisible;
    if (viewOffsetY > cssH - minVisible) viewOffsetY = cssH - minVisible;
    if (viewOffsetX + mapW < minVisible) viewOffsetX = minVisible - mapW;
    if (viewOffsetY + mapH < minVisible) viewOffsetY = minVisible - mapH;
}
function resetView() {
    viewScale = 1; viewOffsetX = 0; viewOffsetY = 0;
    updateZoomUI();
}
function unwrapRing(ring) {
    const out = [];
    let offset = 0, lastOrig = null;
    for (let i = 0; i < ring.length; i++) {
        const p = ring[i];
        if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number' || !isFinite(p[0]) || !isFinite(p[1])) continue;
        const orig = p[0];
        if (lastOrig !== null) {
            const diff = orig - lastOrig;
            if (diff > 180) offset -= 360;
            else if (diff < -180) offset += 360;
        }
        out.push({ lng: orig + offset, lat: p[1] });
        lastOrig = orig;
    }
    return out;
}
function buildPath(ctx, feature, w, h) {
    const geo = feature.geometry;
    if (!geo || !geo.coordinates) return;
    const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    if (!Array.isArray(polys)) return;
    for (const poly of polys) {
        if (!Array.isArray(poly)) continue;
        for (const ring of poly) {
            if (!Array.isArray(ring) || ring.length < 3) continue;
            const pts = unwrapRing(ring);
            if (pts.length < 3) continue;
            for (let i = 0; i < pts.length; i++) {
                const [x, y] = project(pts[i].lng, pts[i].lat, w, h);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
        }
    }
}
function drawFeature(ctx, feature, fill, stroke, w, h, mode) {
    mode = mode || 'both';
    if (mode === 'fill' || mode === 'both') {
        ctx.beginPath();
        buildPath(ctx, feature, w, h);
        ctx.fillStyle = fill;
        ctx.fill('evenodd');
    }
    if ((mode === 'stroke' || mode === 'both') && drawBorders && borderWidth > 0) {
        ctx.save();
        ctx.beginPath();
        buildPath(ctx, feature, w, h);
        ctx.clip('evenodd');
        ctx.beginPath();
        buildPath(ctx, feature, w, h);
        ctx.strokeStyle = stroke || COLORS.border;
        ctx.lineWidth = borderWidth * 2;
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    }
}
function pointInFeature(mapX, mapY, feature, w, h) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    buildPath(ctx, feature, w, h);
    const hit = ctx.isPointInPath(mapX, mapY, 'evenodd');
    ctx.restore();
    return hit;
}
function findCountryAt(mapX, mapY, w, h) {
    for (const f of features) {
        if (pointInFeature(mapX, mapY, f, w, h)) return f;
    }
    return null;
}
function initSelection(w, h) {
    const margin = Math.round(Math.min(w, h) * 0.1);
    sel.x = margin; sel.y = margin;
    sel.w = w - 2 * margin; sel.h = h - 2 * margin;
    syncSelToInputs();
}
function syncSelToInputs() {
    cropX.value = Math.round(sel.x);
    cropY.value = Math.round(sel.y);
    cropW.value = Math.round(sel.w);
    cropH.value = Math.round(sel.h);
}
function syncInputsToSel() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr, cssH = canvas.height / dpr;
    sel.x = Math.max(0, parseInt(cropX.value) || 0);
    sel.y = Math.max(0, parseInt(cropY.value) || 0);
    sel.w = Math.max(1, parseInt(cropW.value) || 1);
    sel.h = Math.max(1, parseInt(cropH.value) || 1);
    if (sel.x + sel.w > cssW) sel.w = cssW - sel.x;
    if (sel.y + sel.h > cssH) sel.h = cssH - sel.y;
    render();
    saveState();
}
function getHandleRects(r) {
    const hs = HANDLE_SIZE, half = hs / 2;
    return {
        nw: { x: r.x - half, y: r.y - half, w: hs, h: hs },
        n:  { x: r.x + r.w / 2 - half, y: r.y - half, w: hs, h: hs },
        ne: { x: r.x + r.w - half, y: r.y - half, w: hs, h: hs },
        e:  { x: r.x + r.w - half, y: r.y + r.h / 2 - half, w: hs, h: hs },
        se: { x: r.x + r.w - half, y: r.y + r.h - half, w: hs, h: hs },
        s:  { x: r.x + r.w / 2 - half, y: r.y + r.h - half, w: hs, h: hs },
        sw: { x: r.x - half, y: r.y + r.h - half, w: hs, h: hs },
        w:  { x: r.x - half, y: r.y + r.h / 2 - half, w: hs, h: hs },
    };
}
function getHandleAt(cx, cy) {
    const hs = HANDLE_SIZE / viewScale, half = hs / 2, r = sel;
    const rects = {
        nw: { x: r.x - half, y: r.y - half, w: hs, h: hs },
        n:  { x: r.x + r.w / 2 - half, y: r.y - half, w: hs, h: hs },
        ne: { x: r.x + r.w - half, y: r.y - half, w: hs, h: hs },
        e:  { x: r.x + r.w - half, y: r.y + r.h / 2 - half, w: hs, h: hs },
        se: { x: r.x + r.w - half, y: r.y + r.h - half, w: hs, h: hs },
        s:  { x: r.x + r.w / 2 - half, y: r.y + r.h - half, w: hs, h: hs },
        sw: { x: r.x - half, y: r.y + r.h - half, w: hs, h: hs },
        w:  { x: r.x - half, y: r.y + r.h / 2 - half, w: hs, h: hs },
    };
    for (const [key, hr] of Object.entries(rects)) {
        if (cx >= hr.x && cx < hr.x + hr.w && cy >= hr.y && cy < hr.y + hr.h) return key;
    }
    return null;
}
const HANDLE_CURSORS = {
    nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
    e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize',
    sw: 'nesw-resize', w: 'ew-resize', move: 'move',
};
function clampSel(cssW, cssH) {
    sel.x = Math.max(0, Math.min(sel.x, cssW - 1));
    sel.y = Math.max(0, Math.min(sel.y, cssH - 1));
    sel.w = Math.max(1, Math.min(sel.w, cssW - sel.x));
    sel.h = Math.max(1, Math.min(sel.h, cssH - sel.y));
}
function getFeatureBounds(feature, w, h) {
    const geo = feature.geometry;
    if (!geo || !geo.coordinates) return null;
    const polys = geo.type === 'Polygon' ? [geo.coordinates] : geo.coordinates;
    if (!Array.isArray(polys)) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const poly of polys) {
        if (!Array.isArray(poly)) continue;
        for (const ring of poly) {
            if (!Array.isArray(ring) || ring.length < 3) continue;
            const pts = unwrapRing(ring);
            for (const pt of pts) {
                const [x, y] = project(pt.lng, pt.lat, w, h);
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function rectsIntersect(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function selectCountriesInCrop() {
    if (!showCrop || !sel.w || !sel.h) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr, cssH = canvas.height / dpr;
    const cropRect = { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
    for (const f of features) {
        const bounds = getFeatureBounds(f, cssW, cssH);
        if (bounds && rectsIntersect(cropRect, bounds)) highlightedIds.add(f.id);
    }
    renderTags();
    render();
    populateList(searchInput.value);
    saveState();
}
function drawCropOverlay(targetCtx, w, h) {
    if (!showCrop || !sel.w || !sel.h) return;
    const r = sel;
    targetCtx.save();
    targetCtx.fillStyle = 'rgba(0,0,0,0.45)';
    if (r.y > 0) targetCtx.fillRect(0, 0, w, r.y);
    if (r.y + r.h < h) targetCtx.fillRect(0, r.y + r.h, w, h - r.y - r.h);
    if (r.x > 0) targetCtx.fillRect(0, r.y, r.x, r.h);
    if (r.x + r.w < w) targetCtx.fillRect(r.x + r.w, r.y, w - r.x - r.w, r.h);
    const lw = 2 / viewScale;
    targetCtx.strokeStyle = '#3b82f6';
    targetCtx.lineWidth = lw;
    targetCtx.strokeRect(r.x, r.y, r.w, r.h);
    targetCtx.fillStyle = '#ffffff';
    targetCtx.strokeStyle = '#3b82f6';
    targetCtx.lineWidth = 1.5 / viewScale;
    const hs = HANDLE_SIZE / viewScale, half = hs / 2;
    const scaled = {
        nw: { x: r.x - half, y: r.y - half, w: hs, h: hs },
        n:  { x: r.x + r.w / 2 - half, y: r.y - half, w: hs, h: hs },
        ne: { x: r.x + r.w - half, y: r.y - half, w: hs, h: hs },
        e:  { x: r.x + r.w - half, y: r.y + r.h / 2 - half, w: hs, h: hs },
        se: { x: r.x + r.w - half, y: r.y + r.h - half, w: hs, h: hs },
        s:  { x: r.x + r.w / 2 - half, y: r.y + r.h - half, w: hs, h: hs },
        sw: { x: r.x - half, y: r.y + r.h - half, w: hs, h: hs },
        w:  { x: r.x - half, y: r.y + r.h / 2 - half, w: hs, h: hs },
    };
    for (const hr of Object.values(scaled)) {
        targetCtx.fillRect(hr.x, hr.y, hr.w, hr.h);
        targetCtx.strokeRect(hr.x, hr.y, hr.w, hr.h);
    }
    targetCtx.restore();
}
function drawMarquee(targetCtx) {
    if (!marquee) return;
    const x = Math.min(marquee.x0, marquee.x1);
    const y = Math.min(marquee.y0, marquee.y1);
    const w = Math.abs(marquee.x1 - marquee.x0);
    const h = Math.abs(marquee.y1 - marquee.y0);
    if (w < 1 && h < 1) return;
    targetCtx.save();
    targetCtx.strokeStyle = '#f59e0b';
    targetCtx.lineWidth = 1.5 / viewScale;
    targetCtx.setLineDash([6 / viewScale, 3 / viewScale, 1.5 / viewScale, 3 / viewScale]);
    targetCtx.strokeRect(x, y, w, h);
    targetCtx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    targetCtx.fillRect(x, y, w, h);
    targetCtx.restore();
}
function selectCountriesInMarquee() {
    if (!marquee) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr, cssH = canvas.height / dpr;
    const r = {
        x: Math.min(marquee.x0, marquee.x1),
        y: Math.min(marquee.y0, marquee.y1),
        w: Math.abs(marquee.x1 - marquee.x0),
        h: Math.abs(marquee.y1 - marquee.y0),
    };
    if (r.w < 2 && r.h < 2) return;
    for (const f of features) {
        const bounds = getFeatureBounds(f, cssW, cssH);
        if (bounds && rectsIntersect(r, bounds)) highlightedIds.add(f.id);
    }
    renderTags();
    populateList(searchInput.value);
    saveState();
}
function drawMap(targetCtx, w, h, showHover, opts) {
    opts = opts || {};
    if (opts.transparentWater) {
        targetCtx.clearRect(0, 0, w, h);
    } else {
        targetCtx.fillStyle = COLORS.water;
        targetCtx.fillRect(0, 0, w, h);
    }
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, w, h);
    targetCtx.clip();
    const highlightOn = toggleHighlight.checked;

    // Pass 1: fill all countries (highlight/land)
    for (const f of features) {
        try {
            const id = f.id;
            const isHovered = showHover && highlightOn && mouseX >= 0 && lastHoveredId === id;
            const fill = (highlightedIds.has(id) || isHovered) ? COLORS.hover : COLORS.land;
            drawFeature(targetCtx, f, fill, COLORS.border, w, h, 'fill');
        } catch (e) {
            console.warn('Error rendering feature:', f.id, e);
        }
    }

    // Pass 2: borders on top of every country (including selected/highlight)
    if (drawBorders && borderWidth > 0) {
        for (const f of features) {
            try {
                drawFeature(targetCtx, f, COLORS.land, COLORS.border, w, h, 'stroke');
            } catch (e) {
                console.warn('Error stroking feature:', f.id, e);
            }
        }
    }
    targetCtx.restore();
}
