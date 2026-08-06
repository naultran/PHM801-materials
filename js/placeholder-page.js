/**
 * Shared renderer for the 7 "coming soon" activity placeholders. Each
 * placeholder-<slug>/index.html is a thin wrapper that calls
 * PlaceholderPage.init('some-id') — all the actual layout/fetch logic lives
 * here once, so adding a real implementation later just means deleting the
 * placeholder folder and building activities/<slug>/ normally (see
 * INTERACTIVITY-GUIDE.md).
 */
(function () {
  "use strict";

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
    (children || []).forEach((c) => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  }

  function init(placeholderId) {
    const root = document.getElementById("activity-root");
    fetch("../../data/placeholders.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const entry = data.placeholders.find((p) => p.id === placeholderId);
        if (!entry) throw new Error(`No placeholder entry found for id "${placeholderId}"`);
        render(root, entry);
      })
      .catch((err) => {
        root.innerHTML = "";
        root.appendChild(el("div", { class: "activity-error-box", role: "alert" }, [
          `Could not load placeholder content: ${err.message}`
        ]));
      });
  }

  function render(root, entry) {
    root.innerHTML = "";

    const header = el("header", { class: "activity-header" }, [
      el("div", { class: "activity-header__top" }, [
        el("a", { class: "activity-header__home touch-target", href: "../index.html" }, ["← Activity Gallery"]),
        el("span", { class: "status-badge-coming-soon" }, ["Coming soon"])
      ]),
      el("h1", {}, [entry.title])
    ]);

    const main = el("main", { class: "activity-mount" }, [
      el("img", {
        src: `../../assets/placeholder-previews/${entry.previewImage}`,
        alt: `${entry.title} preview`,
        style: "max-width: 100%; border-radius: 8px; border: 1px solid var(--color-border); margin-bottom: 1.5rem;"
      }),
      el("p", {}, [entry.description]),
      el("p", { style: "color: var(--color-text-muted); font-size: 0.95rem;" }, [
        "This is a design placeholder in the demonstration template — not a working activity yet. " +
        "See INTERACTIVITY-GUIDE.md for the full list of implemented vs. placeholder activities."
      ])
    ]);

    root.appendChild(header);
    root.appendChild(main);

    if (window.ContentNotice) ContentNotice.mountAboutLink();
  }

  window.PlaceholderPage = { init };
})();
