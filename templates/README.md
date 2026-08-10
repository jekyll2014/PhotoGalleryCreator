# Templates

Each subfolder here is one template, selected by the `template` field in `settings.json`
(or a folder's `.web/settings.json`). At generation time pgc renders the template's
`index.sbn` once per gallery folder and copies its `web/` resources into the output.

## Layout

```
templates/<name>/
  index.sbn          Scriban template -> rendered to <folder>/.web/index.html
  web/               copied verbatim to <folder>/.web/web/ (css, js, fonts, ...)
```

Only `index.sbn` is required. Anything under `web/` is copied as-is; reference it from the
HTML as `web/<file>` (e.g. `<link rel="stylesheet" href="web/style.css">`).

## Output paths (important)

The rendered `index.html` lives in `<folder>/.web/`, so paths are relative to that dir:

- thumbnails: `thumbs/<name>.jpg`
- full images: `../<name>.jpg` (originals sit beside `.web`, never copied)
- template resources: `web/<file>`

pgc supplies these already-correct paths in the model — don't rebuild them.

## Placeholders

The template engine is [Scriban](https://github.com/scriban/scriban). Member names are
snake_case. Top-level values:

| Placeholder            | Meaning                                             |
|------------------------|-----------------------------------------------------|
| `folder.name`          | Folder name on disk                                 |
| `folder.title`         | Title (`.web/description.json` -> settings -> name) |
| `folder.description`   | Folder description, may be empty                    |
| `generated_at`         | Build timestamp `yyyy-MM-dd HH:mm`                  |
| `data_json`            | Full model as JSON, for the client script (below)   |

`data_json` is safe to embed directly inside a `<script>` (`<`, `>`, `&` are escaped):

```html
<script>window.__GALLERY__ = {{ data_json }};</script>
```

### Data island shape (camelCase, for JS)

```jsonc
{
  "folder":   { "name": "", "title": "", "description": "" },
  "images": [
    { "fileName": "", "title": "", "description": "",
      "thumb": "thumbs/x.jpg", "full": "../x.jpg",
      "width": 0, "height": 0, "dateTaken": "", "camera": "" }
  ],
  "subfolders": [
    { "name": "", "title": "", "link": "../Sub/.web/index.html", "thumb": "../Sub/.web/thumbs/first.jpg" }
  ],
  "settings":  { "initialThumbnails": 10, "cacheRadius": 2 },
  "generatedAt": "yyyy-MM-dd HH:mm"
}
```

You can also iterate the same data server-side (snake_case) instead of via JS, e.g.:

```scriban
{{ for img in images }}
  <img src="{{ img.thumb }}" alt="{{ img.title }}">
{{ end }}
{{ for sub in subfolders }}
  <a href="{{ sub.link }}">📁 {{ sub.title }}</a>
{{ end }}
```

## Writing a new template

1. Copy `template1/` to `templates/<yourname>/`.
2. Edit `index.sbn` and `web/`.
3. Set `"template": "<yourname>"` in `settings.json` and run `pgc generate`.

Templates are copied next to the binary on build (see the csproj `Content` item), so a
rebuild — or a manual copy into `bin/**/templates/` — is needed for a new template to be
found at runtime.

## Built-in templates

- **template1** — big "stage" image on top, scrollable thumbnail strip at the bottom;
  lazy-loads the first `initialThumbnails` and caches `2*cacheRadius+1` full images;
  navigation by swipe, keyboard arrows, and edge arrows revealed on cursor approach;
  subfolders shown first as folder-icon tiles with preview covers.
- **template2** — responsive masonry grid of thumbnails with a fullscreen lightbox
  (swipe / arrows / keyboard, Esc or backdrop to close); subfolders shown first as a row
  of cards. Good for browsing a whole folder at a glance.

In both, subfolders always appear first.
