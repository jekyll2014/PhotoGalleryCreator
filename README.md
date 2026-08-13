# pgc — Photo Gallery Creator

Command-line tool that turns disk folders of images into **fully static** HTML photo
galleries. All work (thumbnails, metadata, HTML) happens at generation time — the published
site is plain HTML/CSS/JS with no server-side processing, so production CPU cost is just
static file serving.

## Build

```
dotnet build -c Release
```

Produces `pgc` (`bin/Release/net10.0/pgc.exe`). Requires .NET 10 SDK.

## Usage

```
pgc init     [--config settings.json]   Write a starter settings.json
pgc generate [--config settings.json]   Build galleries (default command)
pgc help
```

For each configured folder, output is written to `<folder>/.web/`:

```
<folder>/.web/
  index.html          rendered from the chosen template
  web/                template resources (style.css, gallery.js)
  thumbs/             baked JPEG thumbnails
```

Full-size images are **referenced in place** (never copied), so serve the gallery from the
folder itself (its `.web/index.html` links `../<image>`).

## Settings (`settings.json`)

```json
{
  "folders": [
    {
      "path": "C:\\Photos\\Trip",
      "includeSubfolders": true,        // recurse; each subfolder gets its own linked gallery
      "flattenSubfolderImages": false,  // also pull subfolder images into this folder's list
      "ignore": false,                  // skip this entry
      "ignoreSubfolders": ["Raw"]       // subfolder names to exclude
    }
  ],
  "template": "template1",
  "thumbnailSize": 320,                 // long-edge px
  "thumbnailQuality": 80,               // JPEG quality 1-100
  "initialThumbnails": 10,              // thumbs loaded up front; rest lazy-load
  "cacheRadius": 2,                     // neighbours cached each side (2 => 5 images warm)
  "sort": "name",                       // name | date | size | modified (applied at generation)
  "sortDescending": false,              // reverse the sort order
  "imageExtensions": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff"]
}
```

## Per-folder metadata (`.web/`)

Per-folder preferences live in the folder's `.web/` directory, alongside the generated
artifacts. Generation only writes `index.html`, `web/` and `thumbs/`, so these hand-authored
files are never overwritten:

- **`.web/description.json`** — folder title/description and per-image captions:

  ```json
  {
    "title": "Summer Trip",
    "description": "Slovenia, 2019",
    "images": {
      "A7200833.jpg": { "title": "Summit panorama", "description": "morning fog" }
    }
  }
  ```

- **`.web/settings.json`** — an `AppSettings` object (with an empty `folders` list) that
  overrides settings for this folder and its descendants (e.g. a different `initialThumbnails`
  or `thumbnailSize`).

## Templates

Templates live under `templates/<name>/` beside the binary:

```
templates/template1/
  index.sbn          Scriban template (placeholders: folder.title, folder.description,
                     folder.name, generated_at, plus a JSON data island for the client)
  web/style.css
  web/gallery.js
```

### template1 (default)

- Big **stage** image on top, **scrollable thumbnail strip** at the bottom.
- Loads the first `initialThumbnails` thumbs, lazy-loads the rest on scroll/navigation.
- Caches `2*cacheRadius + 1` full images (default 5: 2 previous, current, 2 next).
- Navigate by **swipe** (finger on mobile / mouse drag on desktop), **keyboard** arrows, or
  **semi-transparent edge arrows** that appear only as the cursor nears an edge.
- Subfolders appear in the strip as **folder icons with names** (and a faint preview cover),
  linking to their own generated galleries.

## Placeholders available to templates

`folder.name`, `folder.title`, `folder.description`, `generated_at`, and the `data_json`
island containing `images[]` (`fileName`, `title`, `description`, `thumb`, `full`, `width`,
`height`, `dateTaken`, `camera`), `subfolders[]` (`name`, `title`, `link`, `thumb`), and
`settings` (`initialThumbnails`, `cacheRadius`).
