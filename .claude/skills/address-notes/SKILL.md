---
name: address-notes
description: Use this skill whenever the user runs `/address-notes`, or asks to process, handle, resolve, clean up, or "address" the `<note-for-reformat>` markers left inline in this repo's lecture `.qmd` files. These markers are how the instructor leaves themselves (and Claude) per-slide instructions while drafting lecture content without stopping to act on them right away — always check for and act on them when the user references "the notes", "my reformat notes", "the notes I left", or asks to finish/clean up a slide they flagged earlier while drafting.
---

# Address reformat notes

## What this is for

While drafting a lecture in a `.qmd` file, the instructor sometimes wants to flag a specific slide for later attention — reformat it, turn a rough description into a real interactive activity, fix wording, restructure it — without stopping to do it themselves right then, or without stopping to ask Claude to do it right then either. They mark that slide like this:

```
## Some Slide Heading

<note-for-reformat>
free-text instructions for what should happen to this specific slide
</note-for-reformat>

...rest of the slide's content...
```

The note can appear anywhere within a slide's content (right after the heading, in the middle, wherever the instructor happened to type it) — it belongs to the nearest preceding `##` heading above it, not necessarily the slide it physically sits inside if pasted oddly.

## What to do, in order

1. **Find every note.** Grep all `.qmd` files in the repo (not just `lectures/` — a note could end up anywhere) for `note-for-reformat`, rather than assuming a fixed file list. New lecture files get added over time, and hardcoding paths here would silently miss them. Match loosely on that substring rather than the exact tag `<note-for-reformat>` — VS Code's Quarto Visual Editor sometimes round-trips it as backslash-escaped `\<note-for-reformat\>`, and the closing tag gets escaped the same way, so don't assume one exact literal form.

2. **If none are found, say so plainly.** Don't silently do nothing — tell the user "no reformat notes found" so they know the command actually ran and there was genuinely nothing to do, versus it quietly failing to find something that's there.

3. **For each note, identify its slide.** The nearest `##` heading above the note is the slide it belongs to. Read that whole slide's content (from its heading down to the next `##` or end of file) for context — you need to know what's already on the slide before you can sensibly act on an instruction like "reformat this" or "turn this into an activity."

4. **Confirm the repo's current conventions before editing — don't rely on memory of them.** Read a neighboring slide of the same "kind" in the same file (e.g. another activity-embed slide, or another auto-animate pair) to see the current concrete markup, since patterns in this project evolve over time. Things worth checking this way:
   - Interactive activity embeds (`::: activity-embed` + `<iframe>`, wired through `js/activity-shell.js` and `js/embed-bridge.js`, `::: activity-embed-controls` reset button)
   - Auto-animate slide pairs (`{auto-animate="true"}` on two *adjacent* slide headings; elements meant to morph between them share a `data-id`)
   - Where a brand-new activity's data would live (`data/<slug>.json`) and how it gets registered in the gallery (`activities/index.html`'s `CORE_ACTIVITIES` list)
   - Speaker notes (`::: notes ... :::`) and slide-level attributes (`{.smaller}`, etc.)

   `README.md` and `INTERACTIVITY-GUIDE.md` at the repo root document these conventions in prose — check them if a note asks for something you haven't seen a concrete example of yet in the deck itself (e.g. the first time a note asks for a brand-new activity rather than a tweak to an existing one).

5. **Carry out the instruction.** Edit the slide's content to do what the note asks. If it's a simple reformat or wording fix, just make the edit. If it asks for something substantial — "turn this into a real interactive activity" — treat it exactly as if the instructor had typed that request directly in chat: build it properly against the established architecture, not a stub or placeholder.

6. **Judge whether this is actually something you can decide, or something only the instructor can.** Some notes are self-contained and safe to just execute (wording, formatting, restructuring existing content, reusing an established pattern). Others require a decision only the instructor can make — specific data or names not yet chosen, genuinely ambiguous intent, a design choice with real tradeoffs where guessing wrong would be worse than asking. For those, don't silently guess and ship something that might not be what they meant.
   - Leave the `<note-for-reformat>` block in place for anything you didn't fully resolve.
   - Call it out clearly in your summary: what's blocking it, and specifically what you'd need from the instructor to finish it next time this runs.

7. **Remove the marker once — and only once — its instructions are actually done.** Delete the `<note-for-reformat>...</note-for-reformat>` block (nothing else from the slide) after carrying out what it asked. A note left in place because it's genuinely unresolved should stay untouched so the next run picks it back up.

8. **Verify before reporting done.** If you touched anything that renders — a new or changed activity, a layout change, a new auto-animate pair — render the site and check it in the browser the same way you would for any other change to this project. Don't report success on the strength of the source looking right.

9. **Report a clear, itemized summary.** For each note found: which slide it was on, and what you did — or, if you left it, exactly why and what's needed to unblock it. If every note was fully resolved, say so plainly. If anything was skipped, phrase the ask so the instructor can just answer it directly and rerun `/address-notes`.

## Why leave ambiguous notes in place rather than guessing

The whole point of this workflow is that the instructor can keep drafting without breaking flow to make every decision immediately — but that only works if they can trust a vague note won't turn into a wrong, and possibly hard-to-notice, change to their lecture. A bad guess on something like a new activity's content or a restructured teaching point is worse than leaving it flagged, because it might not get caught until the instructor is standing in front of the class.
