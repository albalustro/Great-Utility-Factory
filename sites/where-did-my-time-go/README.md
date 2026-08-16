# Where Did My Time Go? / Para Onde Foi Meu Tempo?

A static utility that turns everyday routines into years of a life. No build
step, no framework, no backend, no accounts, no database — plain HTML, CSS and
vanilla JavaScript.

```
index.html          root: resolves a language and redirects
en/index.html       English
pt-br/index.html    Português do Brasil
assets/styles.css   one stylesheet for all three pages
assets/language.js  country lookup, language resolution, EN | PT-BR switcher
assets/app.js       copy, maths, form flow, results, reclaim simulator
assets/share.js     canvas share cards, captions, native share, download
robots.txt
sitemap.xml
```

Both language pages load the same three scripts and the same stylesheet. The
`<html lang>` attribute selects the string table; no application logic is
duplicated between them. The localised prose that matters for indexing (hero,
FAQ, privacy, footer) lives in each page's HTML.

## Run it locally

Any static file server works. From this directory:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

or

```bash
npx serve .
```

Opening `en/index.html` straight off the file system mostly works too, but a
server is better: `file://` blocks the country lookup and some browsers restrict
`localStorage` there.

### Query parameters for testing

| Parameter | Effect |
|---|---|
| `?lang=en` / `?lang=pt-BR` | forces a language on the root page |
| `?country=BR` | pretends the IP lookup returned that country |
| `?geo=off` | simulates a failed lookup, exercising the `navigator.language` fallback |
| `?demo=46` | fills the form with a 46-year-old example and jumps to the result |

## Deploy it

The directory is the site root — upload it as-is.

- **Netlify / Cloudflare Pages / Vercel**: drag the folder in, or point the
  project at it with no build command and this directory as the output.
- **GitHub Pages**: push the contents to the `gh-pages` branch (or `/docs` on
  `main`) and enable Pages.
- **S3 / any web server**: copy the files, keep the directory structure, serve
  `index.html` as the directory index.

Nothing needs a runtime, a rewrite rule or an environment variable. `/en/` and
`/pt-br/` are real directories with real `index.html` files, so they work on any
host that serves directory indexes.

After pointing a domain at it, update the absolute URLs — they are in one place
per file:

- `<link rel="canonical">` and the `hreflang` / OpenGraph tags in the three HTML files
- `Sitemap:` in `robots.txt`
- the three `<loc>` entries in `sitemap.xml`
- `FALLBACK_DOMAIN` in `assets/app.js` (used for share-card branding when the
  page is opened from the file system)

The site has no `og:image`. Social previews fall back to a text card, which is
correct rather than broken; add a static 1200×630 PNG and an `og:image` tag when
one exists.

## Configuration worth knowing

**Geo provider** — `GEO_PROVIDER` at the top of `assets/language.js` is the only
place the site talks to a geo service. It reads an ISO country code and nothing
else, with a 1.2 s timeout, and never blocks rendering. Replace `url` and `read`
to swap providers.

**Analytics** — `trackEvent(name, payload)` in `assets/app.js` is an inert
adapter: it queues events in memory and re-dispatches them as a `wdmtg:track`
DOM event. No vendor, no network, no cookies. Events emitted:
`calculator_started`, `calculator_completed`, `reclaim_simulated`,
`share_clicked`, `share_instagram`, `share_tiktok`, `share_native`,
`image_downloaded`, `language_changed`.

**Share cards** — drawn directly onto a canvas at export size (1080×1350 for
Instagram feed, 1080×1920 for Story and TikTok), never screenshotted from the
DOM. The canvas shown on the page is the export, so the preview is exact.
`navigator.canShare({ files })` decides between the native share sheet and the
download fallback; the site never claims a post succeeded, because it cannot
know.

## Privacy

Every calculation runs in the browser. Age, habits and results are never sent
anywhere and never stored. The only persisted value is `preferred_language` in
`localStorage`, written when someone picks a language by hand. The country
lookup runs once on the root page, reads only a two-letter code, and never
requests a location permission.
