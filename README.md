# PHM801 Systems Pharmacology — Interactive Lectures

Two interactive lectures for PHM801 (Fundamental Principles of Pharmacology and Toxicology) at
Michigan State University:

- **Lecture 1 — Systems Pharmacology I: Transcriptomics**
- **Lecture 2 — Systems Pharmacology II: Single-Cell and Spatial**

Each lecture is a Quarto + Reveal.js slide deck with one hands-on activity per learning
objective. The whole course is a static website that deploys to GitHub Pages with **no backend,
no database, and no student accounts**: students open a URL and interact immediately. The
activities also run on their own from the course home page, for review.

The activities use small **synthetic** datasets (generated in the browser or stored under
[`data/`](data/)) so each one isolates a single idea. Real gene names appear only where the
biology is being taught (for example dexamethasone and the glucocorticoid receptor).

## What's where

| Path | What it is |
|---|---|
| `index.qmd` | Course home: the two lectures, then every activity |
| `lectures/lecture-01-systems-pharm.qmd` | Lecture 1 |
| `lectures/lecture-02-transcriptomics.qmd` | Lecture 2 |
| `lectures/lecture-02-template.qmd` | Blank lecture to copy when adding a new one (not published) |
| `activities/<slug>/` | One folder per activity (page, script, styles) |
| `data/` | Content for the two activities that read a data file |
| `js/`, `css/` | Shared scripts and styles (activity shell, math/stats helpers, design tokens) |
| `assets/figures/` | Slide figures and the zonation video |
| `_includes/` | Shared partials (attribution notice, embed bridge) |
| `.github/workflows/publish.yml` | Builds and deploys the site on every push to `main` |
| `.claude/skills/address-notes/` | The `/address-notes` workflow (see "Slide helpers") |

More detail:

- [`INTERACTIVITY-GUIDE.md`](INTERACTIVITY-GUIDE.md): for every activity, the teaching question,
  what students manipulate, and which files to edit.
- [`TECHNICAL-LIMITS.md`](TECHNICAL-LIMITS.md): what is practical in a static, no-backend
  lecture site, and how the activities are scaled to fit.

> `README.md`, `INTERACTIVITY-GUIDE.md` and `TECHNICAL-LIMITS.md` are excluded from the build
> (see the `render:` list in `_quarto.yml`), so students only ever see course content.

## 1. Install Quarto

```bash
winget install --id Posit.Quarto -e
```

(macOS: `brew install quarto`; Linux or manual: [quarto.org/docs/get-started](https://quarto.org/docs/get-started/).)
Confirm with `quarto --version`.

## 2. Preview the course locally

From the repository root:

```bash
quarto preview
```

This starts a local server (typically `http://localhost:4848`). Editing a `.qmd`, `.js` or
`.css` file reloads the page. To build the final static site without a server:

```bash
quarto render
```

Output goes to `_site/` (gitignored; this is what GitHub Pages serves).

> Always use `quarto preview` (or `quarto render` plus any static file server). Never open an
> activity's `index.html` directly from disk (a `file://` URL): browsers block the `fetch()` call
> that loads an activity's data file.

## 3. Editing a lecture

A `##` heading starts a new slide:

```markdown
## Your slide title

- A bullet point
- Another bullet point

::: {.notes}
Speaker notes, visible only in the speaker view (press "s" during the presentation).
:::
```

Keep slides short; the activities carry the depth.

### Embedding an activity

```markdown
::: {.activity-embed-controls}
<button onclick="EmbedBridge.reloadIframe(this)">↻ Reset this activity</button>
:::
::: {.activity-embed}
<iframe class="activity-iframe" loading="lazy" title="Descriptive activity title"
  src="../activities/<slug>/index.html?seed=12345"></iframe>
:::
```

`seed` is any integer. The same seed always gives the same starting scenario; leave it out for
a fresh random scenario on every load.

When an activity runs inside a slide it switches to a compact layout (`body.is-embedded`): the
back link, title and long instructions are hidden, and the instructions move into a collapsed
"Instructions" toggle. Keep the key part of the interface in the first ~500px so it is visible
without scrolling inside the frame.

### Slide helpers

Small building blocks from `css/reveal-overrides.css`, used with fenced divs:

| Markup | Result |
|---|---|
| `::: statement` … `:::` | A short statement centered horizontally and vertically |
| `::: text-center` … `:::` | Center-align one block of text |
| `::: source-credit` … `:::` | **The one way to credit a figure**: a small line at the bottom-left of the slide. Put a link inside with `target="_blank" rel="noopener"`, and put it last on the slide. |
| `::: credit-spacer` … `:::` | Put right after a stretched figure that also has a `source-credit`, so the figure doesn't run under the credit |
| `::: back-to-hub` … `:::` | A tiny "↩ Back to menu" link at the bottom right (`<a href="#/some-slide-id">`); used on the first slide of each hub branch |
| `::: {.fragment .definition-popup}` … `:::` | A light-yellow, black-bordered box that appears on click |
| `::: placeholder-box` … `:::` | A dashed "figure goes here" box. Search the `.qmd` files for `PLACEHOLDER` to find them all |
| `::: slide-footnote` … `:::` | A small caveat line that flows after the slide content |

**Student notes.** Every lecture has a "✎ My notes" button (bottom left) that opens a note box for
the current slide. Notes are saved in the student's own browser (nothing is sent anywhere), and
"Download all my notes" saves them as a text file. The code is in `_includes/reveal-embed-bridge.qmd`
(`initStudentNotes`).

A figure in a two-column slide:

```markdown
::::: columns
:::: {.column width="33%"}
Text goes here.
::::

:::: {.column .tall-figure width="67%"}
![](../assets/figures/figure.png){fig-alt="Describe the figure for screen readers." fig-align="center"}
::::
:::::
```

`.tall-figure` keeps a tall image inside the slide; add `.figure-short` for a slightly shorter cap.

**Slide size.** Decks are 1280 × 720 (16:9). The green masthead adds 78px above that, so the
usable bottom edge is about 750px from the top of a slide; anything below is clipped.

**Hub slides.** The "Systems Pharmacology in Practice" (Lecture 1) and "Dissecting
Heterogeneity" (Lecture 2) slides are rows of clickable cards. Each card jumps to a slide by its
id (the `{#some-id}` after a heading).

**Leaving yourself notes.** Type `<note-for-reformat>what you want changed</note-for-reformat>`
anywhere on a slide while drafting, then run `/address-notes` and Claude carries each one out and
removes the marker, or tells you what it still needs.

### Images

Put figures under `assets/figures/` and reference them relatively from the `.qmd`
(`../assets/figures/name.png`). Always give a figure `fig-alt` text (or `alt=""` if purely
decorative). GitHub Pages is **case-sensitive**: match the file name's capitalisation exactly.

### Video

Put the file under `assets/figures/`. Browsers only play H.264 MP4 (`yuv420p`), so re-encode
anything else, for example:

```bash
ffmpeg -i in.mp4 -c:v libx264 -crf 26 -pix_fmt yuv420p -movflags +faststart -an out.mp4
```

Inside a fenced-div column, wrap the `<video>` in a raw HTML block so Quarto does not swallow the
closing fences:

````markdown
```{=html}
<video class="zonation-video" data-autoplay muted loop playsinline controls preload="auto"
       aria-label="What the video shows.">
<source src="../assets/figures/video.mp4" type="video/mp4">
</video>
```
````

`data-autoplay` starts the video when its slide appears and pauses it when you leave (browsers
only allow autoplay when `muted`). Keep the visible `controls`, and keep files small; a few MB
is fine, tens of MB is not.

## 4. Adding things

**A lecture.** Copy `lectures/lecture-02-template.qmd` to `lectures/lecture-0N-your-topic.qmd`,
edit the front matter, add it to `website.navbar.left` in `_quarto.yml`, and add a lecture card
to `index.qmd`. A file whose name starts with an underscore is not built, which keeps a draft off
the live site.

**An activity.** Follow any existing folder under `activities/`:

- `activities/<slug>/index.html`: links `css/*.css` and the shared `js/*.js` it needs (copy the
  `<script>` order from an existing activity), then its own `<slug>.js`.
- `activities/<slug>/<slug>.js`: calls `ActivityShell.init({ title, dataUrl?, defaultSeed,
  instructions, render(data, { rng, container }) {...} })`. The shell provides the header, seed
  controls and Reset button; `render()` only builds the activity's own interface.
- `data/<slug>.json`: optional. Most activities generate their data from the seed instead.
- Add a `home-activity` card to the **Activities** section of `index.qmd`.

## 5. Theme

Colors, spacing and font sizes are CSS custom properties in `css/variables.css`; change a value
there and it updates everywhere. The slide decks use Quarto's built-in `simple` Reveal theme plus
small overrides in `css/reveal-overrides.css`.

## 6. Deploying to GitHub Pages

1. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions** (one time).
2. Push to `main`. `.github/workflows/publish.yml` renders the site and deploys it. Watch the
   **Actions** tab for progress; you can also run it manually (`workflow_dispatch`).
3. The site is at `https://<username>.github.io/<repository-name>/`. That address appears in
   `site-url` in `_quarto.yml`; update it if the repository is renamed.

**The site is unlisted, not private.** Every page has a `noindex` tag and `robots.txt` asks search
engines to stay away, so it will not show up in a search, but anyone with the link can open it
(GitHub Pages cannot password-protect a site). New lectures copied from the template inherit the tag;
a new activity page needs `<meta name="robots" content="noindex, nofollow">` in its `<head>`.

## 7. Using Git

Restore an older version of a lecture:

```bash
git log --oneline --follow -- lectures/lecture-01-systems-pharm.qmd
git show <commit-hash>:lectures/lecture-01-systems-pharm.qmd > lectures/lecture-01-systems-pharm.qmd
```

Snapshot what you taught in a given semester:

```bash
git tag fall-2026 -m "Fall 2026 offering"
git push origin fall-2026
```

## 8. Troubleshooting classroom problems

**An activity shows a blank page or "could not load".** It was probably opened as a `file://`
URL. Use the deployed site, `quarto preview`, or serve `_site/` with a static file server.

**An embedded activity looks tiny, clipped or oddly tall.** The frame resizes to its content
shortly after the slide becomes active (a `postMessage` handshake in `js/embed-bridge.js`). Click
the slide's "↻ Reset this activity" button or refresh the page.

**Students see a different result than the projector.** By design: each browser tab is
independent, and without a fixed `seed=` an activity starts from a random scenario. The lectures
fix a seed on every embed so the projected scenario is reproducible.

**The projector text is too small.** Zoom the browser (Ctrl/Cmd `+`), or raise `--font-size-base`
in `css/variables.css`.

**The internet drops mid-class.** Everything keeps working except any externally hosted image
(the "Central Dogma" figure is loaded from `personal.cityu.edu.hk`); the site makes no API calls.

## License

Copyright (c) 2026 Rance Nault. **All rights reserved.** Students may use the site for their own
learning; nobody may use, copy, adapt or redistribute the material in their own teaching without
written permission. Third-party figures keep their own licences. See [`LICENSE`](LICENSE).

## Content and Development Notice

Do not remove the "Content and Development Notice" shown on the homepage and on each lecture's
closing slide. The wording lives in one place, `js/content-notice.js`.
