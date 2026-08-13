# template1

Default gallery template: one large **stage** image on top, a horizontally **scrollable
thumbnail strip** at the bottom, subfolders shown as folder-icon tiles.

See `../README.md` for the placeholder/data-island contract shared by all templates.

## Files

```
template1/
  index.sbn      HTML shell + the data island <script>window.__GALLERY__ = {{ data_json }}</script>
  web/style.css  layout + theming (copied to <folder>/.web/web/style.css)
  web/gallery.js  all runtime behaviour (copied to <folder>/.web/web/gallery.js)
  web/pano.js    dependency-free WebGL viewer for 360° spherical panoramas
```

## 360° spherical panoramas

Images the generator flags as `is360` (Google Photo Sphere / GPano XMP tags, or a 2:1
equirectangular ratio) get a **360°** badge on their strip thumbnail, and the stage mounts an
interactive WebGL sphere viewer (`pano.js`) instead of the flat image:

- drag (mouse or touch) to look around, wheel / pinch to zoom the field of view,
- the edge arrows and keyboard still move between images; stage swipe-nav is suspended while a
  360 is showing (the viewer owns drag),
- panoramas are excluded from the neighbour cache (they are large — loaded on open).

Self-contained (no three.js / external assets); downscales to the GPU max texture size.

`index.sbn` is intentionally thin: it renders the header/footer and the empty stage + strip
containers, then hands the image/subfolder data to `gallery.js` via the JSON island. All the
list building happens client-side so the HTML stays tiny regardless of image count.

## Behaviour (gallery.js)

- **Lazy thumbnails** — renders the first `settings.initialThumbnails` (default 10) tiles;
  loads another batch when the strip is scrolled near its right edge or when navigation moves
  past the loaded range.
- **Neighbour cache** — keeps `2*cacheRadius + 1` full images warm (default 5: 2 prev,
  current, 2 next); evicts anything outside that window to bound memory.
- **Navigation**
  - swipe / drag on the stage (pointer events — finger on mobile, mouse on desktop),
  - keyboard `ArrowLeft` / `ArrowRight`,
  - semi-transparent edge arrows, revealed only as the cursor nears a stage edge
    (`show-prev` / `show-next` classes; kept faintly visible on touch via `@media (hover:none)`).
- **Subfolders** — appended after the image tiles as `.tile-folder` links (folder icon + name +
  faint preview cover), pointing at each subfolder's own `.web/index.html`.
- **Captions** — `<b>title</b> description — dateTaken · camera · WxH`, from
  `.web/description.json` + EXIF.
- **Zoom** — flat images zoom with the wheel up to 2:1; drag to pan while zoomed,
  double-click to toggle/reset. Swipe-nav is suspended while zoomed. (360s zoom via FOV.)

## DOM contract

`gallery.js` looks up these IDs from `index.sbn` — keep them if you edit the HTML:

| ID            | Element                                  |
|---------------|------------------------------------------|
| `stage`       | stage container (hosts swipe + arrows)   |
| `stageImg`    | big current `<img>`                      |
| `stageCaption`| caption line                             |
| `strip`       | scroll container                         |
| `stripTrack`  | flex row that tiles are inserted into    |
| `navPrev`/`navNext` | edge arrow buttons                 |

## Theming

Colours and sizes are CSS variables at the top of `style.css`:

```css
:root {
  --bg; --panel; --fg; --muted; --accent;   /* palette */
  --strip-h: 132px;                          /* strip height */
  --thumb-h: 96px;                           /* thumbnail height */
}
```

Thumbnail *pixel* size is set at generation time (`thumbnailSize` in settings); `--thumb-h`
only controls display height in the strip.

## Customising

- Edit `style.css` for looks (safe, no JS impact).
- Edit `index.sbn` to change header/footer or add fields — keep the IDs above and the data
  island `<script>`.
- Edit `gallery.js` for behaviour (swipe threshold is `50`px; edge-arrow trigger zones are
  the outer 18% of the stage width).
- After editing, rebuild (or copy the folder into `bin/**/templates/`) so the change ships
  with the binary, then re-run `pgc generate`.
