/**
 * postMessage bridge between a lecture deck (parent window) and an activity
 * embedded via <iframe class="activity-iframe">. Two responsibilities:
 *  1. Child reports its content height so the parent can size the iframe
 *     without clipping (activities have variable content height).
 *  2. Parent reports slide visibility so an activity can pause any animation
 *     loop while its slide isn't on screen.
 * Iframe isolation means this is the *only* channel between the two — no
 * shared globals, no shared DOM — which is what keeps one student's activity
 * from being able to affect another page (see plan §0.1).
 */

function isEmbedded() {
  return window.self !== window.top;
}

/** Call once from an activity page. Returns null if not embedded. */
function childInit(opts = {}) {
  if (!isEmbedded()) return null;
  const onVisibilityChange = opts.onVisibilityChange || function () {};

  function reportHeight() {
    const height = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: "activity:resize", height }, window.location.origin);
  }

  window.addEventListener("message", (evt) => {
    if (evt.origin !== window.location.origin) return;
    const data = evt.data;
    if (data && data.type === "activity:visibility") {
      // A hidden reveal.js slide (display:none) suspends layout inside its
      // iframe, so scrollHeight reads 0 while off-screen and a plain
      // ResizeObserver can't be trusted to fire again once the slide comes
      // back. Becoming visible is exactly the moment layout resumes, so
      // re-report height right then rather than relying on it alone.
      if (data.visible) reportHeight();
      onVisibilityChange(!!data.visible);
    }
  });

  if (window.ResizeObserver) {
    new ResizeObserver(reportHeight).observe(document.body);
  } else {
    window.addEventListener("resize", reportHeight);
  }
  window.addEventListener("load", reportHeight);
  setTimeout(reportHeight, 150);

  return { reportHeight };
}

/** Call once from the lecture deck, after Reveal.initialize(). */
function parentInit() {
  window.addEventListener("message", (evt) => {
    if (evt.origin !== window.location.origin) return;
    const data = evt.data;
    if (data && data.type === "activity:resize" && typeof data.height === "number") {
      // Cap well inside the visible slide, not just at some fixed pixel
      // value — Reveal.js slides don't grow or scroll to fit oversized
      // content, so a too-tall iframe bleeds off the bottom of the screen
      // with no way to reach it. Content taller than this cap gets its own
      // internal scrollbar inside the iframe instead, which stays reachable.
      const maxHeight = Math.max(320, Math.min(600, window.innerHeight - 220));
      document.querySelectorAll("iframe.activity-iframe").forEach((frame) => {
        if (frame.contentWindow === evt.source) {
          frame.style.height = Math.min(Math.max(data.height, 320), maxHeight) + "px";
        }
      });
    }
  });

  function postVisibility(slideEl, visible) {
    if (!slideEl) return;
    slideEl.querySelectorAll("iframe.activity-iframe").forEach((frame) => {
      if (frame.contentWindow) {
        frame.contentWindow.postMessage({ type: "activity:visibility", visible }, window.location.origin);
      }
    });
  }

  if (window.Reveal) {
    Reveal.on("slidechanged", (event) => {
      postVisibility(event.previousSlide, false);
      postVisibility(event.currentSlide, true);
    });
    Reveal.on("ready", (event) => postVisibility(event.currentSlide, true));
  }
}

/**
 * Reload the activity iframe nearest to a given button — used by the lecture
 * deck's per-slide "Reset this activity" button (a slide-level convenience
 * in addition to each activity's own in-page "Reset activity" control).
 */
function reloadIframe(button) {
  const wrapper = button.closest(".activity-embed");
  const iframe = wrapper && wrapper.querySelector("iframe.activity-iframe");
  if (iframe) iframe.src = iframe.src;
}

window.EmbedBridge = { isEmbedded, childInit, parentInit, reloadIframe };
