/**
 * geoengine-app.js — GeoEngine.prototype: persistence, theme, list/tags, export, data load
 */
GeoEngine.prototype.saveState = function () {
    try {
        const data = {
            theme: this.theme,
            colors: {
                water: this.COLORS.water,
                land: this.COLORS.land,
                hover: this.COLORS.hover,
                hoverStroke: this.COLORS.hoverStroke,
            },
            highlighted: Array.from(this.highlightedIds),
            showCrop: this.showCrop,
            sel: this.showCrop ? { x: this.sel.x, y: this.sel.y, w: this.sel.w, h: this.sel.h } : null,
            highlightOn: this.toggleHighlight && this.toggleHighlight.checked,
            drawBorders: this.drawBorders,
            border: this.COLORS.border,
            borderWidth: this.borderWidth,
            mapRenderW: this.mapRenderW,
            mapRenderH: this.mapRenderH,
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
};

GeoEngine.prototype.loadState = function () {
    try {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data.theme === 'light' || data.theme === 'dark') {
            this.applyTheme(data.theme, true);
        }
        if (data.colors) {
            if (data.colors.water) this.updateColor('water', data.colors.water);
            if (data.colors.land) this.updateColor('land', data.colors.land);
            if (data.colors.hover) this.updateColor('highlight', data.colors.hover);
        }
        if (data.highlighted) {
            for (var i = 0; i < data.highlighted.length; i++) {
                var id = data.highlighted[i];
                if (this.features.some(function (f) { return f.id === id; })) this.highlightedIds.add(id);
            }
            this.renderTags();
        }
        if (data.highlightOn !== undefined && this.toggleHighlight) {
            this.toggleHighlight.checked = data.highlightOn;
        }
        if (data.drawBorders !== undefined) {
            this.drawBorders = !!data.drawBorders;
            if (this.toggleBorder) this.toggleBorder.checked = this.drawBorders;
        }
        if (data.border) this.updateColor('border', data.border);
        if (data.borderWidth !== undefined) {
            this.borderWidth = Math.max(0, Number(data.borderWidth) || 0);
            if (this.borderSizeInput) this.borderSizeInput.value = String(this.borderWidth);
        }
        if (data.mapRenderW != null && data.mapRenderW >= 100) this.mapRenderW = data.mapRenderW;
        if (data.mapRenderH != null && data.mapRenderH >= 100) this.mapRenderH = data.mapRenderH;
        if (data.showCrop && data.sel) {
            this.showCrop = true;
            if (this.toggleCrop) this.toggleCrop.checked = true;
            if (this.selectBtn) this.selectBtn.disabled = false;
            if (this.cropInputs) this.cropInputs.rmCls('disabled');
            this.sel.x = data.sel.x; this.sel.y = data.sel.y;
            this.sel.w = data.sel.w; this.sel.h = data.sel.h;
            this.syncSelToInputs();
        }
        return true;
    } catch (e) {
        return false;
    }
};

GeoEngine.prototype.applyTheme = function (t, restoring) {
    this.theme = t;
    document.documentElement.dataset.theme = t;
    if (this.themeBtn) this.themeBtn.textContent = t === 'dark' ? '\u2600' : '\u263E';
    if (!restoring) {
        var tc = this.THEME_COLORS[t];
        this.updateColor('water', tc.water);
        this.updateColor('land', tc.land);
    }
};

GeoEngine.prototype.updateColor = function (which, hex) {
    if (which === 'highlight') {
        this.COLORS.hover = hex;
        this.COLORS.hoverStroke = this.darken(hex, 30);
        if (this.swatchHighlight) this.swatchHighlight.style.background = hex;
    } else if (which === 'land') {
        this.COLORS.land = hex;
        this.COLORS.landStroke = this.darken(hex, 20);
        if (this.swatchLand) this.swatchLand.style.background = hex;
    } else if (which === 'water') {
        this.COLORS.water = hex;
        if (this.swatchWater) this.swatchWater.style.background = hex;
    } else if (which === 'border') {
        this.COLORS.border = hex;
        this.COLORS.landStroke = hex;
        if (this.swatchBorder) this.swatchBorder.style.background = hex;
    }
    this.render();
    this.saveState();
};

GeoEngine.prototype.loadData = async function () {
    try {
        var topoRes = await fetch('countries-50m.json');
        var contRes = await fetch('data/continents.json');
        var countryRes = await fetch('data/countries.json');
        var topology = await topoRes.json();
        this.CONTINENT_ORDER = await contRes.json();
        this.COUNTRY_CONTINENT = await countryRes.json();
        this.features = topojson.feature(topology, topology.objects.countries).features;
        this.features = this.features.filter(function (f) {
            if (!f || !f.geometry) return false;
            var g = f.geometry;
            if (!g.coordinates) return false;
            if (g.type === 'Polygon') return Array.isArray(g.coordinates) && g.coordinates.length > 0;
            if (g.type === 'MultiPolygon') return Array.isArray(g.coordinates) && g.coordinates.some(function (p) {
                return Array.isArray(p) && p.length > 0;
            });
            return false;
        });

        var self = this;
        this.countries = this.features.map(function (f) {
            return {
                name: f.properties.name || ('Unknown (' + f.id + ')'),
                id: f.id,
                continent: self.COUNTRY_CONTINENT[f.properties.name] || 'Other',
            };
        });
        this.countries.sort(function (a, b) {
            var ca = self.CONTINENT_ORDER.indexOf(a.continent);
            var cb = self.CONTINENT_ORDER.indexOf(b.continent);
            if (ca !== cb) return ca - cb;
            return a.name.localeCompare(b.name);
        });

        if (this.swatchHighlight) this.swatchHighlight.style.background = this.COLORS.hover;
        if (this.swatchLand) this.swatchLand.style.background = this.COLORS.land;
        if (this.swatchWater) this.swatchWater.style.background = this.COLORS.water;
        if (this.swatchBorder) this.swatchBorder.style.background = this.COLORS.border;
        if (this.toggleBorder) this.toggleBorder.checked = this.drawBorders;
        if (this.borderSizeInput) this.borderSizeInput.value = String(this.borderWidth);

        this.resizeCanvas();
        this.populateList();
        if (!this.loadState()) {
            this.applyTheme('dark', true);
        } else {
            this.resizeCanvas();
        }
        this.render();
    } catch (err) {
        console.error('Failed to load map data:', err);
        if (this.searchInput) this.searchInput.placeholder = 'Error loading map data';
        if (this.countryListEl) this.countryListEl.textContent = 'Failed to load map data. Check console for details.';
    }
};

GeoEngine.prototype.populateList = function (filter) {
    filter = (filter || '').trim().toLowerCase();
    this.countryListEl.innerHTML = '';

    var groups;
    var self = this;
    if (filter) {
        var filtered = this.countries.filter(function (c) {
            return c.name.toLowerCase().indexOf(filter) >= 0;
        });
        groups = filtered.length ? { Results: filtered } : {};
    } else {
        groups = {};
        for (var i = 0; i < this.CONTINENT_ORDER.length; i++) groups[this.CONTINENT_ORDER[i]] = [];
        groups['Other'] = [];
        for (var j = 0; j < this.countries.length; j++) {
            var c = this.countries[j];
            (groups[c.continent] || groups['Other']).push(c);
        }
    }

    var total = 0;
    Object.keys(groups).forEach(function (cont) {
        var list = groups[cont];
        if (!list.length) return;
        if (!filter) {
            var header = document.createElement('div');
            header.className = 'continent-header';
            header.textContent = cont;
            self.countryListEl.appendChild(header);
        }
        list.forEach(function (c) {
            var item = document.createElement('div');
            item.className = 'country-item';
            if (self.highlightedIds.has(c.id)) item.addCls('selected');
            item.textContent = c.name;
            item.dataset.id = c.id;
            item.on('click', function () { self.selectCountry(c.id); });
            self.countryListEl.appendChild(item);
            total++;
        });
    });

    if (!total) {
        var item = document.createElement('div');
        item.className = 'country-item empty';
        item.textContent = 'No countries found';
        this.countryListEl.appendChild(item);
    }
};

GeoEngine.prototype.renderTags = function () {
    this.tagList.innerHTML = '';
    var self = this;
    this.highlightedIds.forEach(function (id) {
        var country = self.countries.find(function (c) { return c.id === id; });
        if (!country) return;
        var tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = country.name;
        var removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove';
        removeBtn.textContent = '\u00D7';
        removeBtn.on('click', function (e) {
            e.stopPropagation();
            self.selectCountry(id);
        });
        tag.appendChild(removeBtn);
        self.tagList.appendChild(tag);
    });
};

GeoEngine.prototype.selectCountry = function (id) {
    if (this.highlightedIds.has(id)) this.highlightedIds.delete(id);
    else this.highlightedIds.add(id);
    this.renderTags();
    this.render();
    this.populateList(this.searchInput.value);
    this.saveState();
};

GeoEngine.prototype.saveAsImage = function () {
    var dpr = window.devicePixelRatio || 1;
    var cssW = this.canvas.width / dpr;
    var cssH = this.canvas.height / dpr;
    var transparent = !!(this.toggleTransparentWater && this.toggleTransparentWater.checked);
    var transparentBorder = !!(this.toggleTransparentBorder && this.toggleTransparentBorder.checked);

    var offscreen = document.createElement('canvas');
    offscreen.width = Math.round(cssW);
    offscreen.height = Math.round(cssH);
    var offCtx = offscreen.getContext('2d');
    this.drawMap(offCtx, cssW, cssH, false, { transparentWater: transparent, transparentBorder: transparentBorder });

    var outCanvas = offscreen;
    if (this.showCrop && this.sel.w && this.sel.h) {
        outCanvas = document.createElement('canvas');
        outCanvas.width = Math.round(this.sel.w);
        outCanvas.height = Math.round(this.sel.h);
        var outCtx = outCanvas.getContext('2d');
        if (transparent) outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
        outCtx.drawImage(offscreen, this.sel.x, this.sel.y, this.sel.w, this.sel.h, 0, 0, this.sel.w, this.sel.h);
    }

    var link = document.createElement('a');
    link.download = 'world-map.png';
    link.href = outCanvas.toDataURL('image/png');
    link.click();
};

GeoEngine.prototype.resetAll = function () {
    this.highlightedIds.clear();
    this.sel = { x: 0, y: 0, w: 0, h: 0 };
    this.showCrop = false;
    this.dragState = null;
    this.isMarquee = false;
    this.marquee = null;
    this.isPanning = false;
    this.mapRenderW = null;
    this.mapRenderH = null;
    if (this.toggleCrop) this.toggleCrop.checked = false;
    if (this.selectBtn) this.selectBtn.disabled = true;
    if (this.cropInputs) this.cropInputs.addCls('disabled');
    this.lastHoveredId = null;
    this.mouseX = -1;
    this.mouseY = -1;
    this.resetView();
    this.canvas.style.cursor = 'default';
    this.resizeCanvas();
    this.renderTags();
    this.populateList(this.searchInput.value);
    this.render();
    this.saveState();
};

GeoEngine.prototype.setExportPanelOpen = function (open) {
    if (!this.exportPanel) return;
    this.exportPanel.toggleCls('hidden', !open);
    if (this.exportBtn) this.exportBtn.toggleCls('active', open);
};
