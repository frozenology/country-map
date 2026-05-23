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

let COLORS = {
    water: '#0f172a',
    land: '#1e293b',
    landStroke: '#334155',
    hover: '#3b82f6',
    hoverStroke: '#2563eb',
    selected: '#ef4444',
    selectedStroke: '#dc2626',
};

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

function unwrapRing(ring) {
    const out = [];
    let offset = 0;
    let lastOrig = null;
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

function drawFeature(ctx, feature, fill, stroke, w, h) {
    ctx.beginPath();
    buildPath(ctx, feature, w, h);
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();
}

function pointInFeature(x, y, feature, w, h) {
    ctx.beginPath();
    buildPath(ctx, feature, w, h);
    return ctx.isPointInPath(x, y, 'evenodd');
}

function findCountryAt(x, y, w, h) {
    for (const f of features) {
        if (pointInFeature(x, y, f, w, h)) return f;
    }
    return null;
}

function initSelection(w, h) {
    const margin = Math.round(Math.min(w, h) * 0.1);
    sel.x = margin;
    sel.y = margin;
    sel.w = w - 2 * margin;
    sel.h = h - 2 * margin;
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
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
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
    const hs = HANDLE_SIZE;
    const half = hs / 2;
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
    const rects = getHandleRects(sel);
    for (const [key, r] of Object.entries(rects)) {
        if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h)
            return key;
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
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const cropRect = { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
    for (const f of features) {
        const bounds = getFeatureBounds(f, cssW, cssH);
        if (bounds && rectsIntersect(cropRect, bounds)) {
            highlightedIds.add(f.id);
        }
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

    targetCtx.strokeStyle = '#3b82f6';
    targetCtx.lineWidth = 2;
    targetCtx.strokeRect(r.x, r.y, r.w, r.h);

    targetCtx.fillStyle = '#ffffff';
    targetCtx.strokeStyle = '#3b82f6';
    targetCtx.lineWidth = 1.5;
    const handles = getHandleRects(r);
    for (const hr of Object.values(handles)) {
        targetCtx.fillRect(hr.x, hr.y, hr.w, hr.h);
        targetCtx.strokeRect(hr.x, hr.y, hr.w, hr.h);
    }

    targetCtx.restore();
}

function drawMap(targetCtx, w, h, showHover) {
    targetCtx.fillStyle = COLORS.water;
    targetCtx.fillRect(0, 0, w, h);

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, w, h);
    targetCtx.clip();

    const highlightOn = toggleHighlight.checked;

    for (const f of features) {
        try {
            const id = f.id;
            const isHovered = showHover && highlightOn && mouseX >= 0 && lastHoveredId === id;

            let fill, stroke;
            if (highlightedIds.has(id) || isHovered) {
                fill = COLORS.hover;
                stroke = COLORS.hoverStroke;
            } else {
                fill = COLORS.land;
                stroke = COLORS.landStroke;
            }

            drawFeature(targetCtx, f, fill, stroke, w, h);
        } catch (e) {
            console.warn('Error rendering feature:', f.id, e);
        }
    }

    targetCtx.restore();
}

function render() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    drawMap(ctx, w, h, true);
    drawCropOverlay(ctx, w, h);
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = mapContainer.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!sel.w && !sel.h) {
        initSelection(rect.width, rect.height);
    } else if (sel.w || sel.h) {
        clampSel(rect.width, rect.height);
        syncSelToInputs();
    }
}

function darken(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

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
    }
    render();
    saveState();
}

const CONTINENT_ORDER = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'];

const COUNTRY_CONTINENT = {
    'Algeria':'Africa','Angola':'Africa','Benin':'Africa','Botswana':'Africa','Burkina Faso':'Africa',
    'Burundi':'Africa','Cabo Verde':'Africa','Cameroon':'Africa','Central African Rep.':'Africa',
    'Chad':'Africa','Comoros':'Africa','Congo':'Africa',"Côte d'Ivoire":'Africa','Dem. Rep. Congo':'Africa',
    'Djibouti':'Africa','Egypt':'Africa','Eq. Guinea':'Africa','Eritrea':'Africa','eSwatini':'Africa',
    'Ethiopia':'Africa','Gabon':'Africa','Gambia':'Africa','Ghana':'Africa','Guinea':'Africa',
    'Guinea-Bissau':'Africa','Kenya':'Africa','Lesotho':'Africa','Liberia':'Africa','Libya':'Africa',
    'Madagascar':'Africa','Malawi':'Africa','Mali':'Africa','Mauritania':'Africa','Mauritius':'Africa',
    'Morocco':'Africa','Mozambique':'Africa','Namibia':'Africa','Niger':'Africa','Nigeria':'Africa',
    'Rwanda':'Africa','Saint Helena':'Africa','São Tomé and Principe':'Africa','Senegal':'Africa',
    'Seychelles':'Africa','Sierra Leone':'Africa','Somalia':'Africa','Somaliland':'Africa',
    'South Africa':'Africa','S. Sudan':'Africa','Sudan':'Africa','Tanzania':'Africa','Togo':'Africa',
    'Tunisia':'Africa','Uganda':'Africa','W. Sahara':'Africa','Zambia':'Africa','Zimbabwe':'Africa',
    'Afghanistan':'Asia','Armenia':'Asia','Azerbaijan':'Asia','Bahrain':'Asia','Bangladesh':'Asia',
    'Bhutan':'Asia','Brunei':'Asia','Cambodia':'Asia','China':'Asia','Cyprus':'Asia',
    'Georgia':'Asia','Hong Kong':'Asia','India':'Asia','Indonesia':'Asia','Iran':'Asia','Iraq':'Asia',
    'Israel':'Asia','Japan':'Asia','Jordan':'Asia','Kazakhstan':'Asia','Kuwait':'Asia',
    'Kyrgyzstan':'Asia','Laos':'Asia','Lebanon':'Asia','Macao':'Asia','Malaysia':'Asia',
    'Maldives':'Asia','Mongolia':'Asia','Myanmar':'Asia','N. Cyprus':'Asia','Nepal':'Asia',
    'North Korea':'Asia','Oman':'Asia','Pakistan':'Asia','Palestine':'Asia','Philippines':'Asia',
    'Qatar':'Asia','Russia':'Asia','Saudi Arabia':'Asia','Siachen Glacier':'Asia','Singapore':'Asia',
    'South Korea':'Asia','Sri Lanka':'Asia','Syria':'Asia','Taiwan':'Asia','Tajikistan':'Asia',
    'Thailand':'Asia','Timor-Leste':'Asia','Turkey':'Asia','Turkmenistan':'Asia',
    'United Arab Emirates':'Asia','Uzbekistan':'Asia','Vietnam':'Asia','Yemen':'Asia',
    'Br. Indian Ocean Ter.':'Asia','Indian Ocean Ter.':'Asia',
    'Albania':'Europe','Andorra':'Europe','Austria':'Europe','Belarus':'Europe','Belgium':'Europe',
    'Bosnia and Herz.':'Europe','Bulgaria':'Europe','Croatia':'Europe','Czechia':'Europe',
    'Denmark':'Europe','Estonia':'Europe','Faeroe Is.':'Europe','Finland':'Europe','France':'Europe',
    'Germany':'Europe','Greece':'Europe','Guernsey':'Europe','Hungary':'Europe','Iceland':'Europe',
    'Ireland':'Europe','Isle of Man':'Europe','Italy':'Europe','Jersey':'Europe','Kosovo':'Europe',
    'Latvia':'Europe','Liechtenstein':'Europe','Lithuania':'Europe','Luxembourg':'Europe',
    'Macedonia':'Europe','Malta':'Europe','Moldova':'Europe','Monaco':'Europe','Montenegro':'Europe',
    'Netherlands':'Europe','Norway':'Europe','Poland':'Europe','Portugal':'Europe','Romania':'Europe',
    'San Marino':'Europe','Serbia':'Europe','Slovakia':'Europe','Slovenia':'Europe','Spain':'Europe',
    'Sweden':'Europe','Switzerland':'Europe','Ukraine':'Europe','United Kingdom':'Europe',
    'Vatican':'Europe','Åland':'Europe',
    'Anguilla':'North America','Antigua and Barb.':'North America','Aruba':'North America',
    'Bahamas':'North America','Barbados':'North America','Belize':'North America',
    'Bermuda':'North America','British Virgin Is.':'North America','Canada':'North America',
    'Cayman Is.':'North America','Costa Rica':'North America','Cuba':'North America',
    'Curaçao':'North America','Dominica':'North America','Dominican Rep.':'North America',
    'El Salvador':'North America','Greenland':'North America','Grenada':'North America',
    'Guatemala':'North America','Haiti':'North America','Honduras':'North America',
    'Jamaica':'North America','Mexico':'North America','Montserrat':'North America',
    'Nicaragua':'North America','Panama':'North America','Puerto Rico':'North America',
    'St. Kitts and Nevis':'North America','Saint Lucia':'North America',
    'St. Pierre and Miquelon':'North America','St. Vin. and Gren.':'North America',
    'St-Barthélemy':'North America','St-Martin':'North America','Sint Maarten':'North America',
    'Trinidad and Tobago':'North America','Turks and Caicos Is.':'North America',
    'United States of America':'North America','U.S. Virgin Is.':'North America',
    'Argentina':'South America','Bolivia':'South America','Brazil':'South America','Chile':'South America',
    'Colombia':'South America','Ecuador':'South America','Falkland Is.':'South America',
    'Guyana':'South America','Paraguay':'South America','Peru':'South America',
    'S. Geo. and the Is.':'South America','Suriname':'South America','Uruguay':'South America',
    'Venezuela':'South America',
    'American Samoa':'Oceania','Ashmore and Cartier Is.':'Oceania','Australia':'Oceania',
    'Cook Is.':'Oceania','Fiji':'Oceania','Fr. Polynesia':'Oceania','Guam':'Oceania',
    'Kiribati':'Oceania','Marshall Is.':'Oceania','Micronesia':'Oceania',
    'N. Mariana Is.':'Oceania','Nauru':'Oceania','New Caledonia':'Oceania','New Zealand':'Oceania',
    'Niue':'Oceania','Norfolk Island':'Oceania','Palau':'Oceania','Papua New Guinea':'Oceania',
    'Pitcairn Is.':'Oceania','Samoa':'Oceania','Solomon Is.':'Oceania','Tonga':'Oceania',
    'Vanuatu':'Oceania','Wallis and Futuna Is.':'Oceania',
    'Antarctica':'Antarctica','Fr. S. Antarctic Lands':'Antarctica',
    'Heard I. and McDonald Is.':'Antarctica',
};

async function loadData() {
    try {
        const res = await fetch('countries-50m.json');
        const topology = await res.json();
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
        groups = filtered.length
            ? { 'Search Results': filtered }
            : { '': [] };
    } else {
        groups = {};
        for (const cont of CONTINENT_ORDER) groups[cont] = [];
        for (const c of countries) {
            if (groups[c.continent]) groups[c.continent].push(c);
        }
        for (const cont of Object.keys(groups)) {
            if (!groups[cont].length) delete groups[cont];
        }
    }

    let total = 0;
    for (const [cont, list] of Object.entries(groups)) {
        if (!list.length) continue;
        if (cont) {
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

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(cssW);
    offscreen.height = Math.round(cssH);
    const offCtx = offscreen.getContext('2d');

    drawMap(offCtx, cssW, cssH, false);

    let outCanvas = offscreen;

    if (showCrop && sel.w && sel.h) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = Math.round(sel.w);
        outCanvas.height = Math.round(sel.h);
        const outCtx = outCanvas.getContext('2d');
        outCtx.drawImage(offscreen, sel.x, sel.y, sel.w, sel.h, 0, 0, sel.w, sel.h);
    }

    const link = document.createElement('a');
    link.download = 'world-map.png';
    link.href = outCanvas.toDataURL('image/png');
    link.click();
}

function onPointerDown(e) {
    dragOccurred = false;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (showCrop && sel.w && sel.h && (getHandleAt(cx, cy) || (cx >= sel.x && cx <= sel.x + sel.w && cy >= sel.y && cy <= sel.y + sel.h))) {
        dragStartMouse.x = cx;
        dragStartMouse.y = cy;
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
    mouseX = cx * dpr;
    mouseY = cy * dpr;

    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;

    if (!dragState && showCrop && sel.w && sel.h && dragStartMouse.x >= 0) {
        const dx = cx - dragStartMouse.x;
        const dy = cy - dragStartMouse.y;
        if (dx * dx + dy * dy > 9) {
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
        const dx = cx - dragStartMouse.x;
        const dy = cy - dragStartMouse.y;
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
        const overHandle = getHandleAt(cx, cy);
        if (overHandle) {
            canvas.style.cursor = HANDLE_CURSORS[overHandle];
            return;
        }
    }

    if (!toggleHighlight.checked) {
        if (lastHoveredId !== null) {
            lastHoveredId = null;
            render();
        }
        canvas.style.cursor = 'default';
        return;
    }

    const hit = findCountryAt(mouseX, mouseY, cssW, cssH);
    const hitId = hit ? hit.id : null;

    if (hitId !== lastHoveredId) {
        lastHoveredId = hitId;
        render();
    }

    canvas.style.cursor = lastHoveredId ? 'pointer' : 'default';
}

function onPointerUp() {
    if (dragState) {
        dragState = null;
        dragOccurred = true;
        dragStartMouse.x = -1;
        dragStartMouse.y = -1;
        render();
    }
}

canvas.on('mousemove', onPointerMove);

canvas.on('mouseleave', () => {
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
    }
});

canvas.on('mousedown', onPointerDown);
document.on('mouseup', onPointerUp);

canvas.on('click', (e) => {
    if (dragOccurred) { dragOccurred = false; return; }
    if (dragState) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    if (showCrop && sel.w && sel.h) {
        if (getHandleAt(cx, cy) || (cx >= sel.x && cx <= sel.x + sel.w && cy >= sel.y && cy <= sel.y + sel.h)) {
            return;
        }
    }
    const x = cx * dpr;
    const y = cy * dpr;
    const cssW = canvas.width / dpr;
    const cssH = canvas.height / dpr;
    const feature = findCountryAt(x, y, cssW, cssH);
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
    toggleCrop.checked = false;
    selectBtn.disabled = true;
    cropInputs.addCls('disabled');
    lastHoveredId = null;
    mouseX = -1;
    mouseY = -1;
    canvas.style.cursor = 'default';
    renderTags();
    populateList(searchInput.value);
    render();
    saveState();
});

window.on('resize', () => { resizeCanvas(); render(); });

loadData();
