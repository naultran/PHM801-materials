/**
 * Drag-and-drop utilities for the Pathway/Mechanism Construction activity.
 *
 * Two independent interaction paths are provided — a pointer-based drag path
 * (makeDraggable, using the Pointer Events API so touch and mouse behave the
 * same way) and a keyboard-operable alternative (createKeyboardAltUI: select
 * an item, select a destination, press "Place"). Both are expected to call
 * the SAME application-level placement function, so the two paths can never
 * diverge in behavior — dnd-utils.js itself has no opinion on what a "valid"
 * placement is, that's left to the caller's onDrop/onPlace callback.
 */

function elementUnderPointIgnoring(x, y, ignoredEl) {
  const prevPointerEvents = ignoredEl.style.pointerEvents;
  ignoredEl.style.pointerEvents = "none";
  const found = document.elementFromPoint(x, y);
  ignoredEl.style.pointerEvents = prevPointerEvents;
  return found;
}

/**
 * Make an element pointer-draggable. On drop over an element matching
 * `dropzoneSelector`, calls onDrop(el, zoneEl). On drop elsewhere, the
 * element snaps back to whatever parent it had at the start of this drag.
 */
function makeDraggable(el, { onDrop, dropzoneSelector }) {
  el.classList.add("dnd-draggable");
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");

  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;
  let preDragParent = null;
  let preDragNextSibling = null;

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dragging = true;
    preDragParent = el.parentElement;
    preDragNextSibling = el.nextSibling;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* touch devices without capture support */ }

    const rect = el.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    origX = rect.left; origY = rect.top;

    el.classList.add("dnd-dragging");
    el.style.position = "fixed";
    el.style.left = origX + "px";
    el.style.top = origY + "px";
    el.style.width = rect.width + "px";
    el.style.zIndex = "1000";
    document.body.appendChild(el);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = origX + dx + "px";
    el.style.top = origY + dy + "px";

    document.querySelectorAll(dropzoneSelector).forEach((z) => z.classList.remove("dnd-dropzone-hover"));
    const under = elementUnderPointIgnoring(e.clientX, e.clientY, el);
    const zone = under && under.closest(dropzoneSelector);
    if (zone) zone.classList.add("dnd-dropzone-hover");
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("dnd-dragging");
    document.querySelectorAll(dropzoneSelector).forEach((z) => z.classList.remove("dnd-dropzone-hover"));

    const under = elementUnderPointIgnoring(e.clientX, e.clientY, el);
    const zone = under && under.closest(dropzoneSelector);

    el.style.position = "";
    el.style.left = "";
    el.style.top = "";
    el.style.width = "";
    el.style.zIndex = "";

    if (zone) {
      onDrop(el, zone);
    } else if (preDragParent) {
      preDragParent.insertBefore(el, preDragNextSibling);
    }
  }

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);
}

/**
 * Build the keyboard-operable alternative: item dropdown + destination
 * dropdown + "Place" button, all calling the same onPlace(itemId, destId).
 */
function createKeyboardAltUI({ items, destinations, onPlace, containerEl, itemLabel = "Item to place", destinationLabel = "Destination" }) {
  containerEl.innerHTML = "";
  containerEl.classList.add("keyboard-alt-panel");

  const hint = document.createElement("p");
  hint.className = "keyboard-alt-panel__hint";
  hint.textContent = "Keyboard alternative: choose an item and a destination, then press Place.";

  const itemSelect = document.createElement("select");
  itemSelect.setAttribute("aria-label", itemLabel);
  itemSelect.className = "touch-target";

  const destSelect = document.createElement("select");
  destSelect.setAttribute("aria-label", destinationLabel);
  destSelect.className = "touch-target";

  function fillOptions(select, options) {
    const prevValue = select.value;
    select.innerHTML = "";
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label;
      select.appendChild(opt);
    });
    if (options.some((o) => o.id === prevValue)) select.value = prevValue;
  }
  fillOptions(itemSelect, items);
  fillOptions(destSelect, destinations);

  const placeBtn = document.createElement("button");
  placeBtn.type = "button";
  placeBtn.className = "touch-target keyboard-alt-panel__place-btn";
  placeBtn.textContent = "Place";
  placeBtn.addEventListener("click", () => {
    if (itemSelect.value && destSelect.value) onPlace(itemSelect.value, destSelect.value);
  });

  containerEl.appendChild(hint);
  containerEl.appendChild(itemSelect);
  containerEl.appendChild(destSelect);
  containerEl.appendChild(placeBtn);

  return {
    refreshItems(newItems) { fillOptions(itemSelect, newItems); },
    refreshDestinations(newDestinations) { fillOptions(destSelect, newDestinations); }
  };
}

window.DndUtils = { makeDraggable, createKeyboardAltUI };
