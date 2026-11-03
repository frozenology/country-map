/**
 * geoengine-app.js — persistence, theme, list/tags, export, data load
 */
function saveState() {
    try {
        const data = {
            theme,
            colors: {
                water: COLORS.water,
                land: COLORS.land,
                hover: COLORS.hover,
                hoverStroke: COLORS.hoverStroke,
            },
            highlighted: [...highlightedIds],
            showCrop,
            sel: showCrop ? { x: sel.x, y: sel.y, w: sel.w, h: sel.h } : null,
            highlightOn: toggleHighlight.checked,
            drawBorders,
            border: COLORS.border,
            borderWidth,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* storage full or unavailable */ }
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data.theme === 'light' || data.theme === 'dark') {
            applyTheme(data.theme, true);
        }
        if (data.colors) {
            if (data.colors.water) updateColor('water', data.colors.water);
            if (data.colors.land) updateColor('land', data.colors.land);
            if (data.colors.hover) updateColor('highlight', data.colors.hover);
        }
        if (data.highlighted) {
            for (const id of data.highlighted) {
                if (features.some(f => f.id === id)) highlightedIds.add(id);
            }
            renderTags();
        }
        if (data.highlightOn !== undefined) {
            toggleHighlight.checked = data.highlightOn;
        }
        if (data.drawBorders !== undefined) {
            drawBorders = !!data.drawBorders;
            if (toggleBorder) toggleBorder.checked = drawBorders;
        }
        if (data.border) updateColor('border', data.border);
        if (data.borderWidth !== undefined) {
            borderWidth = Math.max(0, Number(data.borderWidth) || 0);
            if (borderSizeInput) borderSizeInput.value = String(borderWidth);
        }
        if (data.showCrop && data.sel) {
            showCrop = true;
            toggleCrop.checked = true;
            selectBtn.disabled = false;
            cropInputs.rmCls('disabled');
            sel.x = data.sel.x; sel.y = data.sel.y;
            sel.w = data.sel.w; sel.h = data.sel.h;
            syncSelToInputs();
        }
        return true;
    } catch (e) {
        return false;
    }
}

function applyTheme(t, restoring) {
    theme = t;
    document.documentElement.dataset.theme = t;
    themeBtn.textContent = t === 'dark' ? '☀' : '☾';
    if (!restoring) {
        const tc = THEME_COLORS[t];
        updateColor('water', tc.water);
        updateColor('land', tc.land);
    }
}

function updateColor(which, hex) {
    if (which === 'highlight') {
        COLORS.hover = hex;
        COLORS.hoverStroke = darken(hex, 30);
        swatchHighlight.style.background = hex;
    } else if (which === 'land') {
        COLORS.land = hex;
        COLORS.landStroke = darken(hex, 20);
        swatchLand.style.background = hex;
    } else if (which === 'water') {
        COLORS.water = hex;
        swatchWater.style.background = hex;
    } else if (which === 'border') {
        COLORS.border = hex;
        COLORS.landStroke = hex;
        if (swatchBorder) swatchBorder.style.background = hex;
    }
    render();
    saveState();
}

let CONTINENT_ORDER = [];
let COUNTRY_CONTINENT = {};

async function loadData() {
    try {
        const [topoRes, contRes, countryRes] = await Promise.all([
            fetch('countries-50m.json'),
            fetch('data/continents.json'),
            fetch('data/countries.json'),
        ]);
        const topology = await topoRes.json();
        CONTINENT_ORDER = await contRes.json();
        COUNTRY_CONTINENT = await countryRes.json();
        features = topojson.feature(topology, topology.objects.countries).features;
        features = features.filter(f => {
            if (!f || !f.geometry) return false;
            const g = f.geometry;
            if (!g.coordinates) return false;
            if (g.type === 'Polygon') return Array.isArray(g.coordinates) && g.coordinates.length > 0;
            if (g.type === 'MultiPolygon') return Array.isArray(g.coordinates) && g.coordinates.some(p => Array.isArray(p) && p.length > 0);
            return false;
        });

        countries = features.map(f => ({
            name: f.properties.name || `Unknown (${f.id})`,
            id: f.id,
            continent: COUNTRY_CONTINENT[f.properties.name] || 'Other',
        }));
        countries.sort((a, b) => {
            const ca = CONTINENT_ORDER.indexOf(a.continent);
            const cb = CONTINENT_ORDER.indexOf(b.continent);
            if (ca !== cb) return ca - cb;
            return a.name.localeCompare(b.name);
        });

        swatchHighlight.style.background = COLORS.hover;
        swatchLand.style.background = COLORS.land;
        swatchWater.style.background = COLORS.water;
        if (swatchBorder) swatchBorder.style.background = COLORS.border;
        if (toggleBorder) toggleBorder.checked = drawBorders;
        if (borderSizeInput) borderSizeInput.value = String(borderWidth);

        resizeCanvas();
        populateList();
        if (!loadState()) {
            applyTheme('dark', true);
        }
        render();
    } catch (err) {
        console.error('Failed to load map data:', err);
        searchInput.placeholder = 'Error loading map data';
        countryListEl.textContent = 'Failed to load map data. Check console for details.';
    }
}

function populateList(filter) {
    filter = (filter || '').trim().toLowerCase();
    countryListEl.innerHTML = '';

    let groups;
    if (filter) {
        const filtered = countries.filter(c => c.name.toLowerCase().includes(filter));
        groups = filtered.length ? { Results: filtered } : {};
    } else {
        groups = {};
        for (const cont of CONTINENT_ORDER) groups[cont] = [];
        groups['Other'] = [];
        for (const c of countries) {
            (groups[c.continent] || groups['Other']).push(c);
        }
    }

    let total = 0;
    for (const [cont, list] of Object.entries(groups)) {
        if (!list.length) continue;
        if (!filter) {
            const header = document.createElement('div');
            header.className = 'continent-header';
            header.textContent = cont;
            countryListEl.appendChild(header);
        }
        for (const c of list) {
            const item = document.createElement('div');
            item.className = 'country-item';
            if (highlightedIds.has(c.id)) item.addCls('selected');
            item.textContent = c.name;
            item.dataset.id = c.id;
            item.on('click', () => selectCountry(c.id));
            countryListEl.appendChild(item);
            total++;
        }
    }

    if (!total) {
        const item = document.createElement('div');
        item.className = 'country-item empty';
        item.textContent = 'No countries found';
        countryListEl.appendChild(item);
    }
}

function renderTags() {
    tagList.innerHTML = '';
    for (const id of highlightedIds) {
        const country = countries.find(c => c.id === id);
        if (!country) continue;
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = country.name;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove';
        removeBtn.textContent = '\u00D7';
        removeBtn.on('click', (e) => {
            e.stopPropagation();
            selectCountry(id);
        });
        tag.appendChild(removeBtn);
        tagList.appendChild(tag);
    }
}

function selectCountry(id) {
    if (highlightedIds.has(id)) highlightedIds.delete(id);
    else highlightedIds.add(id);
    renderTags();
    render();
    populateList(searchInput.value);
    saveState();
}

function saveAsImage() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const transparent = !!(typeof toggleTransparentWater !== 'undefined' && toggleTransparentWater && toggleTransparentWater.checked);

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(cssW);
    offscreen.height = Math.round(cssH);
    const offCtx = offscreen.getContext('2d');

    drawMap(offCtx, cssW, cssH, false, { transparentWater: transparent });

    let outCanvas = offscreen;

    if (showCrop && sel.w && sel.h) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = Math.round(sel.w);
        outCanvas.height = Math.round(sel.h);
        const outCtx = outCanvas.getContext('2d');
        if (transparent) {
            outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
        }
        outCtx.drawImage(offscreen, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    }

    const link = document.createElement('a');
    link.download = 'world-map.png';
    link.href = outCanvas.toDataURL('image/png');
    link.click();
}
