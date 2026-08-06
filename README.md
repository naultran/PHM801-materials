# Sequencing in Pharmacology & Toxicology — Interactive Lecture Course

A fully static, browser-based Quarto + Reveal.js course website demonstrating
interactive teaching activities for sequencing concepts in pharmacology and
toxicology. It deploys to GitHub Pages with **no backend, no database, and no
student accounts** — students open a URL and interact immediately.

All example genes, samples, and datasets in this template are small and
**fictional**, used only to demonstrate the interaction mechanics. See
[Replacing fictional example data](#replacing-fictional-example-data) below
before using this for a real course.

For a deeper reference, see also:

- [`INTERACTIVITY-GUIDE.md`](INTERACTIVITY-GUIDE.md) — for every activity: the teaching question, what
  students manipulate, which files hold data vs. behavior, and how to replace it
- [`TECHNICAL-LIMITS.md`](TECHNICAL-LIMITS.md) — what's practical (and what isn't) in a static,
  no-backend browser lecture, and the specific simplifications made in this template

## 1. How to install Quarto

```bash
winget install --id Posit.Quarto -e
```

(macOS: `brew install quarto`; Linux/manual: download from
[quarto.org/docs/get-started](https://quarto.org/docs/get-started/).) Confirm with:

```bash
quarto --version
```

## 2. How to preview the course locally

From the repository root:

```bash
quarto preview
```

This starts a local server (typically `http://localhost:4848`) and opens the site in your
browser. Editing a `.qmd`, `.json`, `.js`, or `.css` file triggers an automatic reload.

> **Important:** always use `quarto preview` (or `quarto render` + any static file server) —
> never open an activity's `index.html` directly from disk (a `file://` URL). Browsers block
> the local `fetch()` calls that load each activity's JSON data under `file://`. See
> `TECHNICAL-LIMITS.md`.

To produce the final static site without a live server:

```bash
quarto render
```

Output goes to `_site/` (gitignored — this is what GitHub Pages actually serves).

## 3. How to add a lecture

1. Copy `lectures/lecture-02-template.qmd` to `lectures/lecture-0N-your-topic.qmd`.
2. Edit the YAML title/subtitle at the top.
3. Add it to the site navigation in `_quarto.yml` (`website.navbar.left`) and/or link it from
   `index.qmd`'s lecture list.
4. `quarto preview` to check it.

## 4. How to duplicate the lecture template

`lectures/lecture-02-template.qmd` *is* the reusable blank template — it already has the
correct front matter, the embed-bridge include, a worked example of a conventional slide and
an activity-embed slide (heavily commented), and the required closing attribution slide. Just
copy it (see above) rather than starting a `.qmd` from scratch.

## 5. How to add a conventional slide

In any lecture `.qmd`, a `##` heading starts a new slide:

```markdown
## Your slide title

- A bullet point
- Another bullet point

::: {.notes}
Speaker notes — visible only in the speaker view (press "s" during the presentation).
:::
```

Keep slides short (a handful of bullets) — the interactive activities carry the depth.

## 6. How to add an interactive activity

To **embed an existing activity** in a lecture slide, copy this pattern (see any slide in
`lecture-01-showcase.qmd`):

```markdown
::: {.activity-embed-controls}
<button onclick="EmbedBridge.reloadIframe(this)">↻ Reset this activity</button>
:::
::: {.activity-embed}
<iframe class="activity-iframe" loading="lazy" title="Descriptive activity title"
  src="../activities/<slug>/index.html?mode=student-exploration&seed=12345"></iframe>
:::
```

`mode` is one of `instructor`, `student-exploration`, or `review`; `seed` is any integer
(reproducible — same seed always produces the same starting scenario).

To **build a brand-new activity**, follow the pattern of any existing one under `activities/`:

- `activities/<slug>/index.html` — links `css/*.css`, loads the shared `js/*.js` files it
  needs (see the `<script>` order in an existing activity), then its own `<slug>.js`
- `activities/<slug>/<slug>.js` — calls `ActivityShell.init({ title, dataUrl, defaultSeed,
  instructions, render(data, {mode, seed, rng, container, controller}) {...} })`
- `data/<slug>.json` — the activity's replaceable scientific content
- Add a card for it to `activities/index.html` (the gallery)

`activity-shell.js` gives you the header, mode badge, seed controls, and a "Reset activity"
button automatically — your `render()` function only needs to build the activity's own UI
inside the `container` it's given.

## 7. How to replace fictional example data

Every activity's scientific content lives in one JSON file under `data/`, completely separate
from the JS that implements its visualization/interaction. Edit the JSON directly — gene
names, sample labels, numeric values, pathway definitions — the activity code will pick up the
new content automatically on next reload. See `INTERACTIVITY-GUIDE.md` for the exact schema
of each `data/*.json` file.

## 8. How to add an image

Place the file under `assets/` (or `images/` for lecture-specific figures) and reference it
with a relative path from the `.qmd` file, e.g.:

```markdown
![Alt text describing the figure](../images/my-figure.png)
```

## 9. How to embed a video

See the "A note on format" slide in `lecture-01-showcase.qmd` for a working placeholder. For a
**local file**: put the `.mp4` under `videos/` and set `<source src="../videos/your-file.mp4"
type="video/mp4">`. For **YouTube/institutional embeds**, replace the `<video>` block with an
`<iframe>` embed from the provider. Either way:

- Always include visible `controls`
- Never `autoplay` with sound
- Provide a `poster` attribute (a static fallback image) so something useful shows if the
  video fails to load or the network is unavailable
- Add captions (a `<track kind="captions">` for local files, or the platform's native
  captioning) and/or a transcript

Large video files should not be committed directly to Git — use Git LFS, an institutional
video host, or YouTube/Vimeo embeds instead.

## 10. How to change the theme

Colors, spacing, and font sizes are all CSS custom properties in `css/variables.css` — change
a value there and it updates everywhere (website pages and every activity). The Reveal.js
slide deck uses Quarto's built-in `simple` theme (set in each lecture's YAML front matter)
plus small overrides in `css/reveal-overrides.css`; change `theme: simple` to any other
[built-in Quarto revealjs theme name](https://quarto.org/docs/presentations/revealjs/themes.html)
if you want a different starting point.

## 11. How to deploy to GitHub Pages

1. Push this repository to GitHub (already configured to `origin` if you cloned it as-is).
2. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` — `.github/workflows/publish.yml` renders the site and deploys it
   automatically. Check the **Actions** tab for progress.
4. The deployed site will be at `https://<your-org-or-username>.github.io/<repo-name>/`.

You can also trigger a deploy manually from the Actions tab (`workflow_dispatch`).

## 12. How to restore an older lecture version with Git

```bash
git log --oneline -- lectures/lecture-01-showcase.qmd   # find the commit you want
git show <commit-hash>:lectures/lecture-01-showcase.qmd > lectures/lecture-01-showcase.qmd
```

Or, to browse without changing anything yet:

```bash
git show <commit-hash>:lectures/lecture-01-showcase.qmd | less
```

## 13. How to create a new semester branch or tag

For a lightweight snapshot of "what we taught this semester":

```bash
git tag fall-2026 -m "Fall 2026 offering"
git push origin fall-2026
```

For an actively-diverging semester copy (e.g. a different section with its own edits):

```bash
git checkout -b fall-2026-section-b
git push -u origin fall-2026-section-b
```

## 14. Troubleshooting common classroom problems

**An activity shows a blank page or "could not load" error.**
Almost always means it was opened via `file://` instead of a served URL — see the warning in
section 2. Use `quarto preview`, or serve `_site/` with any static file server.

**A slide's embedded activity looks tiny, clipped, or oddly tall.**
The iframe auto-resizes to its content shortly after the slide becomes active (this uses a
`postMessage` handshake — see `js/embed-bridge.js`). If it looks wrong, click the slide's
"↻ Reset this activity" button, or refresh the page.

**Students see a different result than the instructor's projected screen.**
Expected and by design — each browser tab is completely independent, and unless a `seed=`
query parameter is fixed, activities use a randomized starting scenario. To show everyone the
exact same scenario, use a lecture-embed URL with an explicit `&seed=` value (already done
throughout `lecture-01-showcase.qmd`), or set `?mode=instructor` for a fixed, curated state.

**One student's changes appear to affect another student, or the projector.**
This should not be possible — every activity runs in its own iframe with no shared state and
no network calls between browsers. If you see this, it's a bug — please file an issue.

**The projector/classroom display looks too small to read.**
`css/variables.css` sets a relatively large base font size already; if it's still too small
for the room, temporarily increase `--font-size-base` there, or use your browser's zoom
(Ctrl/Cmd `+`).

**Internet drops mid-class.**
Everything except embedded YouTube/institutional video continues to work — the entire site
(HTML, CSS, JS, JSON data) is served locally from the same origin with no external API calls.

## Repository layout

```
_quarto.yml, index.qmd, resources.qmd   Quarto website project
_includes/                              shared partials (attribution notice, embed-bridge init)
lectures/                                Reveal.js lecture decks (.qmd)
activities/                              one self-contained folder per interactive activity
data/                                    fictional datasets, one JSON file per activity
js/                                      shared JS (math, stats, UI shell, components)
css/                                     shared stylesheet (design tokens + components)
assets/                                  static images/previews
.github/workflows/                       GitHub Pages deploy workflow
```

## Replacing fictional example data

To turn this into a real lecture, start with these files (in this order):

1. `data/*.json` — replace fictional genes/samples/values with real ones, activity by activity
   (schemas documented in `INTERACTIVITY-GUIDE.md`)
2. `lectures/lecture-01-showcase.qmd` — replace the concept-framing text around each activity
   embed, or start fresh from `lecture-02-template.qmd`
3. `index.qmd` — update the course title/description and lecture list
4. Everywhere the string **"Rance Nault"** appears (the attribution notice in
   `js/content-notice.js`) — update only if authorship changes; otherwise leave as-is per the
   content notice requirements

Do not remove the "Content and Development Notice" — see `js/content-notice.js` for the single
source of that required wording.
