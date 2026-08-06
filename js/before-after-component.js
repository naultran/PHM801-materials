/**
 * Reusable "Before/After Reveal Comparison" widget (spec experience #16).
 * Renders a "before" state plus a Reveal control; on activation swaps in the
 * "after" state with a brief crossfade (instant swap if the user has
 * prefers-reduced-motion enabled).
 */

function createBeforeAfter(containerEl, opts) {
  const { beforeRenderFn, afterRenderFn, revealLabel = "Reveal", onReveal } = opts;

  containerEl.innerHTML = "";
  containerEl.classList.add("before-after");

  const content = document.createElement("div");
  content.className = "before-after__content";

  const revealBtn = document.createElement("button");
  revealBtn.type = "button";
  revealBtn.className = "before-after__reveal-btn touch-target";
  revealBtn.textContent = revealLabel;

  containerEl.appendChild(content);
  containerEl.appendChild(revealBtn);

  let revealed = false;

  function renderBefore() {
    content.innerHTML = "";
    beforeRenderFn(content);
  }
  renderBefore();

  function doReveal() {
    if (revealed) return;
    revealed = true;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function swapIn() {
      content.innerHTML = "";
      afterRenderFn(content);
      content.classList.remove("before-after__content--swapping");
      revealBtn.disabled = true;
      revealBtn.textContent = "Revealed";
      if (onReveal) onReveal();
    }

    if (prefersReducedMotion) {
      swapIn();
    } else {
      content.classList.add("before-after__content--swapping");
      setTimeout(swapIn, 220);
    }
  }
  revealBtn.addEventListener("click", doReveal);

  function reset() {
    revealed = false;
    revealBtn.disabled = false;
    revealBtn.textContent = revealLabel;
    content.classList.remove("before-after__content--swapping");
    renderBefore();
  }

  return { reveal: doReveal, reset, isRevealed: () => revealed };
}

window.BeforeAfterComponent = { createBeforeAfter };
