/**
 * Activity 3 — Drag-and-Drop Pathway & Mechanism Construction.
 * Data: ../../data/pathway-construction.json (stage1: pathway sort; stage2: mechanistic sequence)
 * Teaching point: some genes/events genuinely belong to more than one
 * category — biology isn't always cleanly discrete.
 *
 * Both the pointer-drag path (dnd-utils.makeDraggable) and the keyboard
 * alternative (dnd-utils.createKeyboardAltUI) call the same placeItem()
 * mutator below, so the two interaction methods can never diverge.
 */

function buildStage(stageConfig, containerEl) {
  const { heading, instructions, slots, items } = stageConfig;
  const placements = {}; // itemId -> slotId | undefined (undefined = in tray)
  let checked = false;
  let hintItemId = null;

  const section = document.createElement("section");
  section.className = "pw-stage";
  const h = document.createElement("h3");
  h.textContent = heading;
  const instr = document.createElement("p");
  instr.className = "pw-instructions";
  instr.textContent = instructions;
  section.appendChild(h);
  section.appendChild(instr);

  const hintNote = document.createElement("p");
  hintNote.className = "pw-hint-note";
  hintNote.hidden = true;
  hintNote.setAttribute("aria-live", "polite");
  section.appendChild(hintNote);

  const trayHeading = document.createElement("p");
  trayHeading.className = "field-label";
  trayHeading.textContent = "Unplaced cards";
  section.appendChild(trayHeading);
  const trayEl = document.createElement("div");
  trayEl.className = "pw-tray pw-dropzone";
  trayEl.dataset.slotId = "tray";
  section.appendChild(trayEl);

  const slotsGrid = document.createElement("div");
  slotsGrid.className = "pw-slots-grid";
  const slotBodies = {};
  slots.forEach((slot) => {
    const slotEl = document.createElement("div");
    slotEl.className = "pw-slot";
    const header = document.createElement("div");
    header.className = "pw-slot__header";
    header.textContent = slot.label;
    const body = document.createElement("div");
    body.className = "pw-slot__body pw-dropzone";
    body.dataset.slotId = slot.id;
    slotEl.appendChild(header);
    slotEl.appendChild(body);
    slotsGrid.appendChild(slotEl);
    slotBodies[slot.id] = body;
  });
  section.appendChild(slotsGrid);

  const actionsRow = document.createElement("div");
  actionsRow.className = "pw-actions-row";
  const checkBtn = document.createElement("button");
  checkBtn.type = "button"; checkBtn.className = "touch-target";
  checkBtn.textContent = "Check arrangement";
  const hintBtn = document.createElement("button");
  hintBtn.type = "button"; hintBtn.className = "touch-target";
  hintBtn.textContent = "Give me a hint";
  const resetBtn = document.createElement("button");
  resetBtn.type = "button"; resetBtn.className = "touch-target";
  resetBtn.textContent = "Reset this stage";
  actionsRow.appendChild(checkBtn);
  actionsRow.appendChild(hintBtn);
  actionsRow.appendChild(resetBtn);
  section.appendChild(actionsRow);

  const feedback = document.createElement("div");
  feedback.className = "pw-feedback";
  feedback.hidden = true;
  feedback.setAttribute("aria-live", "polite");
  section.appendChild(feedback);

  const keyboardMount = document.createElement("div");
  section.appendChild(keyboardMount);

  containerEl.appendChild(section);

  function isResolvedCorrectly(item) {
    const placedSlot = placements[item.id];
    if (item.correctSlots.length === 0) return !placedSlot;
    return placedSlot && item.correctSlots.includes(placedSlot);
  }

  function renderCard(item) {
    const card = document.createElement("div");
    card.className = "pw-card touch-target";
    card.textContent = item.label;
    card.dataset.itemId = item.id;
    if (checked) {
      const placedSlot = placements[item.id];
      if (placedSlot) card.classList.add(item.correctSlots.includes(placedSlot) ? "pw-card--correct" : "pw-card--incorrect");
    }
    if (hintItemId === item.id) card.classList.add("pw-card--hint");
    DndUtils.makeDraggable(card, {
      onDrop: (el, zone) => placeItem(item.id, zone.dataset.slotId),
      dropzoneSelector: ".pw-dropzone"
    });
    return card;
  }

  let kbdUI = null;

  function render() {
    trayEl.innerHTML = "";
    items.filter((it) => !placements[it.id]).forEach((it) => trayEl.appendChild(renderCard(it)));

    slots.forEach((slot) => {
      slotBodies[slot.id].innerHTML = "";
      items.filter((it) => placements[it.id] === slot.id).forEach((it) => slotBodies[slot.id].appendChild(renderCard(it)));
    });

    const destinations = [{ id: "tray", label: "(Remove — back to tray)" }, ...slots];
    if (kbdUI) {
      kbdUI.refreshItems(items.map((it) => ({ id: it.id, label: it.label })));
      kbdUI.refreshDestinations(destinations);
    } else {
      kbdUI = DndUtils.createKeyboardAltUI({
        items: items.map((it) => ({ id: it.id, label: it.label })),
        destinations,
        onPlace: (itemId, slotId) => placeItem(itemId, slotId),
        containerEl: keyboardMount
      });
    }
  }

  function placeItem(itemId, slotId) {
    placements[itemId] = slotId === "tray" ? undefined : slotId;
    checked = false;
    hintItemId = null;
    hintNote.hidden = true;
    feedback.hidden = true;
    render();
  }

  checkBtn.addEventListener("click", () => {
    checked = true;
    const placedItems = items.filter((it) => placements[it.id]);
    const correctCount = items.filter(isResolvedCorrectly).length;
    feedback.hidden = false;
    feedback.innerHTML = "";
    const summary = document.createElement("p");
    summary.innerHTML = `<strong>${correctCount} of ${items.length} cards are correctly resolved.</strong>`;
    feedback.appendChild(summary);
    placedItems.forEach((it) => {
      const p = document.createElement("p");
      const correct = it.correctSlots.includes(placements[it.id]);
      p.innerHTML = `<span class="badge ${correct ? "badge-correct" : "badge-incorrect"}">${it.label}</span> ${it.explanation}`;
      feedback.appendChild(p);
    });
    render();
  });

  hintBtn.addEventListener("click", () => {
    const unresolved = items.filter((it) => !isResolvedCorrectly(it));
    if (unresolved.length === 0) {
      hintNote.hidden = false;
      hintNote.textContent = "Everything is already placed correctly!";
      hintItemId = null;
    } else {
      const target = unresolved[Math.floor(Math.random() * unresolved.length)];
      hintItemId = target.id;
      hintNote.hidden = false;
      hintNote.textContent = target.correctSlots.length === 0
        ? `Hint: "${target.label}" doesn't belong in any of these categories — leave it in the tray.`
        : `Hint: "${target.label}" fits in: ${target.correctSlots.map((sid) => slots.find((s) => s.id === sid).label).join(" or ")}.`;
    }
    render();
  });

  resetBtn.addEventListener("click", () => {
    Object.keys(placements).forEach((k) => delete placements[k]);
    checked = false;
    hintItemId = null;
    hintNote.hidden = true;
    feedback.hidden = true;
    render();
  });

  render();
}

ActivityShell.init({
  rootId: "activity-root",
  title: "Drag-and-Drop Pathway & Mechanism Construction",
  dataUrl: "../../data/pathway-construction.json",
  defaultSeed: 3141,
  instructions:
    "Drag cards into place, or use the keyboard-friendly item/destination dropdowns below each stage. " +
    "Incorrect placement is not immediately penalized — use Check and Hint freely while you work it out.",

  render(data, { rng, container }) {
    const stage1 = { ...data.stage1, items: rng.shuffle(data.stage1.items) };
    const stage2 = { ...data.stage2, items: rng.shuffle(data.stage2.items) };
    buildStage(stage1, container);
    buildStage(stage2, container);
  }
});
