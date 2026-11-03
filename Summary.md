# World Map Explorer — Function Summary

Interactive world map built with HTML Canvas and TopoJSON. Users can browse, search, highlight, zoom, multi-select, crop, and export countries. State (selections, colors, crop, theme) persists in `localStorage`.

---

## Core rendering

| Function | Description |
|---|---|
| `project(lng, lat, w, h)` | Equirectangular projection of lon/lat into canvas CSS coordinates with padding. |
| `unwrapRing(ring)` | Unwraps polygon rings that cross the antimeridian so paths stay continuous. |
| `buildPath(ctx, feature, w, h)` | Builds a canvas path for a country’s polygon/multipolygon geometry. |
| `drawFeature(ctx, feature, fill, stroke, w, h)` | Fills and strokes a single country path (`evenodd` fill rule). |
| `drawMap(targetCtx, w, h, showHover)` | Clears water background and draws all countries with land / hover / selected colors. |
| `drawCropOverlay(targetCtx, w, h)` | Dims outside the crop rectangle and draws resize handles when Crop is enabled. |
| `drawMarquee(targetCtx)` | Draws the temporary Shift-drag selection rectangle (dash-dot amber outline + light fill). |
| `render()` | Applies the view transform (zoom/pan), then draws map, crop overlay, and marquee. |
| `resizeCanvas()` | Sizes the canvas to the container (device pixel ratio aware) and reclamps crop/view. |

---

## Hit testing & selection

| Function | Description |
|---|---|
| `pointInFeature(mapX, mapY, feature, w, h)` | Point-in-path test for a country in **map** coordinates (transform-safe). |
| `findCountryAt(mapX, mapY, w, h)` | Returns the topmost country under a map point, or `null`. |
| `getFeatureBounds(feature, w, h)` | Axis-aligned bounding box of a country in map space. |
| `rectsIntersect(a, b)` | Rectangle intersection test. |
| `selectCountry(id)` | Toggles a single country in `highlightedIds`, refreshes tags/list/map, saves state. |
| `selectCountriesInCrop()` | Selects every country whose bounds intersect the active crop rectangle. |
| `selectCountriesInMarquee()` | Selects every country intersecting the Shift-drag marquee rectangle. |
| `renderTags()` | Renders selected countries as removable tags in the sidebar. |
| `populateList(filter)` | Builds the continent-grouped country list, filtered by search text. |

---

## Crop region

| Function | Description |
|---|---|
| `initSelection(w, h)` | Initializes crop rectangle with a 10% margin. |
| `syncSelToInputs()` / `syncInputsToSel()` | Bidirectional sync between crop rect and X/Y/W/H number inputs. |
| `getHandleRects(r)` / `getHandleAt(cx, cy)` | Crop resize-handle geometry and hit-test (8 handles + move body). |
| `clampSel(cssW, cssH)` | Keeps the crop rectangle inside the logical map bounds. |

Crop interactions: drag handles to resize, drag interior to move. “Select” selects all countries in the crop. “Save as Image” exports only the cropped region when crop is on.

---

## Zoom & pan (view transform)

| Function / control | Description |
|---|---|
| `viewScale`, `viewOffsetX`, `viewOffsetY` | Logical zoom (1 = 100%) and pan offset in CSS pixels. |
| `screenToMap(cx, cy)` | Converts screen (container) coordinates → map coordinates. |
| `applyViewTransform()` | Sets the canvas transform: `scale × offset` with device pixel ratio. |
| `setZoom(scale, focusCx, focusCy)` | Zooms toward a focus point (mouse or center), clamped 50%–800%. |
| `clampView(cssW, cssH)` | Soft-clamps pan so some map always remains visible. |
| `resetView()` | Resets zoom to 100% and pan to origin. |
| `updateZoomUI()` | Syncs the bottom-right slider and percentage label. |

**User controls**

- **Mouse wheel** over the map → zoom in/out centered on cursor.
- **Zoom slider** (bottom-right of `#map-container`) → zoom toward map center; live percentage label.
- **Middle mouse drag** → pan the view while zoomed (or at any scale).
- **Reset** also restores zoom/pan to defaults.

---

## Marquee multi-select

| Behavior | Description |
|---|---|
| **Shift + left-click drag** | Starts a selection rectangle from the current mouse position (map space). |
| **While dragging** | Rectangle is drawn with a **dash-dot** stroke (amber) and light fill. |
| **On release** | All countries whose bounds intersect the rectangle are added to the selection. |

Does not conflict with crop dragging: Shift always starts a marquee; crop handles still work without Shift.

---

## Theme, colors & persistence

| Function | Description |
|---|---|
| `applyTheme(t, restoring)` | Switches light/dark theme and updates default water/land colors. |
| `updateColor(which, hex)` | Updates highlight, land, or water color (and derived stroke). |
| `darken(hex, amount)` | Helper to derive stroke colors from fills. |
| `saveState()` / `loadState()` | Persist/restore theme, colors, selected country IDs, crop, and highlight-on-hover to `localStorage` (`genmap-config`). |

---

## Export & data

| Function | Description |
|---|---|
| `saveAsImage()` | Renders the full logical map (or crop region) to a temporary canvas and downloads PNG. Ignores current zoom/pan so the export matches geographic content. |
| `loadData()` | Fetches `countries-50m.json`, `data/continents.json`, and `data/countries.json`, builds the country list, restores state, and performs the first render. |

---

## UI event wiring (high level)

- **Hover** (optional via sidebar toggle) → highlight country under cursor.
- **Click** → select/deselect single country (ignored after a drag or while Shift is held).
- **Sidebar search** → filters continent-grouped list; click list item to select.
- **Tag ×** → remove country from selection.
- **Crop checkbox** → show/hide crop overlay and enable Select + dimension inputs.
- **Theme button** → toggle light/dark.
- **About** → modal with usage notes.
- **Reset** → clear selections, crop, marquee, and view transform; restore defaults.

---

## Files

| File | Role |
|---|---|
| `index.html` | Layout: toolbar, sidebar, map canvas, zoom controls, about modal. |
| `style.css` | Theme variables, toolbar/sidebar/map layout, zoom control overlay. |
| `geoengine.js` | Projection, drawing, crop overlay, zoom/pan view transform. |
| `geoengine-app.js` | Persistence, theme, country list/tags, export, TopoJSON load. |
| `geoengine-interact.js` | Pointer handlers (pan, marquee, crop drag). |
| `script.js` | UI event bindings (mouse, wheel, toolbar, sidebar). |
| `helpers.js` | Small DOM helpers (`$`, `.on`, class utilities). |
| `data/continents.json` | Ordered list of continent names for the sidebar. |
| `data/countries.json` | Country name → continent mapping. |
| `countries-50m.json` | TopoJSON world boundaries (~50m resolution). |
| `js/topojson-client.min.js` | TopoJSON client library.
