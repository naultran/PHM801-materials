/**
 * Content and Development Notice — single source of truth for the required
 * attribution wording. Every page that needs the notice loads this file with
 * a plain classic <script src="..."> (relative path adjusted per page depth)
 * and calls ContentNotice.render(...). Do not copy this wording elsewhere.
 */
(function () {
  "use strict";

  var TITLE = "Content and Development Notice";
  var BODY =
    "The educational materials, scientific content, examples, learning objectives, and " +
    "instructional design were developed by Rance Nault. Artificial intelligence tools " +
    "were used to assist in placing these materials into this interactive learning " +
    "experience and implementing portions of the software interface.";

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) node.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  /**
   * Render the notice into a mount element.
   * @param {string} mountId - id of an existing container element
   * @param {{expanded?: boolean}} opts
   */
  function render(mountId, opts) {
    opts = opts || {};
    var mount = document.getElementById(mountId);
    if (!mount) return;
    mount.innerHTML = "";
    mount.classList.add("content-notice");

    var details = el("details", { class: "content-notice__details" });
    if (opts.expanded) details.setAttribute("open", "");

    var summary = el("summary", { class: "content-notice__summary" }, [TITLE]);
    var body = el("p", { class: "content-notice__body" }, [BODY]);

    details.appendChild(summary);
    details.appendChild(body);
    mount.appendChild(details);
  }

  /**
   * Add a small fixed "About this material" link that opens the notice in a
   * lightweight overlay panel. Skipped automatically when the current page is
   * embedded in an iframe (an activity embedded in a lecture slide), so the
   * notice is not shown twice stacked on top of the parent lecture page.
   */
  function mountAboutLink(containerId) {
    if (window.self !== window.top) return; // embedded activity: parent page already shows it
    var container = containerId ? document.getElementById(containerId) : document.body;
    if (!container) return;

    var button = el("button", { type: "button", class: "about-material-link" }, ["ⓘ About this material"]);
    var panel = el("div", { class: "about-material-panel", hidden: "hidden", role: "dialog", "aria-label": TITLE });
    var panelInner = el("div", { class: "about-material-panel__inner" });
    var closeBtn = el("button", { type: "button", class: "about-material-panel__close", "aria-label": "Close" }, ["×"]);
    var mountDiv = el("div", { id: "about-material-notice-mount" });

    panelInner.appendChild(closeBtn);
    panelInner.appendChild(mountDiv);
    panel.appendChild(panelInner);

    button.addEventListener("click", function () {
      panel.hidden = !panel.hidden;
    });
    closeBtn.addEventListener("click", function () {
      panel.hidden = true;
      button.focus();
    });

    container.appendChild(button);
    container.appendChild(panel);
    render("about-material-notice-mount", { expanded: true });
  }

  window.ContentNotice = {
    TITLE: TITLE,
    BODY: BODY,
    render: render,
    mountAboutLink: mountAboutLink
  };
})();
