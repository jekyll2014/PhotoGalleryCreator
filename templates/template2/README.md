# template2

Masonry **grid + fullscreen lightbox** gallery. Browse the whole folder at a glance as a
responsive grid of thumbnails; click any photo to open a fullscreen lightbox with prev/next.

Complements `template1` (single-focus stage + strip): use template2 when the folder is meant
to be scanned/browsed, template1 when photos are viewed one at a time.

See `../README.md` for the placeholder/data-island contract shared by all templates.

## Files

```
template2/
  index.sbn      header + #folders row + #grid + hidden #lightbox overlay + data island
  web/style.css  masonry columns, folder cards, lightbox, 360 badge
  web/gallery.js  grid build + lightbox behaviour
  web/pano.js    dependency-free WebGL viewer for 360° spherical panoramas
```

## 360° spherical panoramas

Images the generator flags as `is360` (via Google Photo Sphere / GPano XMP tags, or a 2:1
equirectangular aspect ratio) get a **360°** badge on their grid cell and open in an
interactive WebGL sphere viewer (`pano.js`) instead of a flat image:

- drag (mouse or touch) to look around, wheel / pinch to zoom the field of view,
- prev/next and keyboard still move between images; swipe-nav is suspended while a 360 is open
  (the viewer owns drag),
- panoramas are excluded from the flat-image neighbour cache (they are large — loaded on open).

The viewer is self-contained (no three.js, no external assets) and downscales the source to
the GPU's max texture size when needed, so it stays fully static.

## Behaviour (gallery.js)

- **Folders first** — subfolders render as a row of `.folder-card` links *above* the photo
  grid, so navigation is always at the top.
- **Masonry grid** — CSS multi-column layout (`column-width` in `style.css`), so thumbnails
  keep their native aspect ratio. Images use native `loading="lazy"`, so off-screen thumbs
  aren't fetched until scrolled near.
- **Lightbox** — click/Enter on a cell opens a fullscreen overlay. Neighbour cache keeps
  `2*cacheRadius + 1` full images warm (default 5). Close via the X, the dark backdrop, or Esc.
- **Navigation** — prev/next buttons, keyboard left/right (and Esc to close), and swipe/drag
  (finger on mobile, mouse on desktop) inside the lightbox.
- **Captions** — hover shows the title over a cell; the lightbox shows
  `title description — dateTaken · camera · WxH` (from `.web/description.json` + EXIF).

Note: `initialThumbnails` is not used here — the grid renders all cells and relies on native
lazy-loading. `cacheRadius` still controls lightbox preloading.

## DOM contract

`gallery.js` looks up these IDs from `index.sbn` — keep them if you edit the HTML:

| ID          | Element                          |
|-------------|----------------------------------|
| `folders`   | subfolder-card row (top)         |
| `grid`      | masonry container for `.cell`s   |
| `lightbox`  | overlay (gets `.open`)           |
| `lbImg`     | full image in the lightbox       |
| `lbCaption` | lightbox caption                 |
| `lbPrev` / `lbNext` | lightbox nav buttons     |
| `lbClose`   | close button                     |

## Theming

CSS variables at the top of `style.css`:

```css
:root {
  --bg; --panel; --fg; --muted; --accent;   /* palette */
  --gap: 10px;                               /* grid + card gap */
  --col-width: 240px;                        /* target masonry column width */
}
```

Smaller screens (`max-width: 560px`) drop `--col-width` to 150px automatically.

## Using it

Set `"template": "template2"` in `settings.json` (or a folder's `.web/settings.json`), then
run `pgc generate`. Rebuild first if you changed the template files, so they ship next to the
binary.
