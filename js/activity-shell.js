/**
 * Common bootstrap every activity page uses: renders the header, seed
 * controls, fetches the activity's data JSON (with a real error message
 * instead of a silent failure), and calls the activity's own render()
 * function. Keeps this boilerplate out of every individual activity file.
 *
 * Depends on: prng.js, mode-manager.js, embed-bridge.js, content-notice.js
 * (all loaded first as classic <script> tags).
 */

function buildActivityHeader({ title, instructions, galleryHref }) {
  const header = document.createElement("header");
  header.className = "activity-header";

  const topRow = document.createElement("div");
  topRow.className = "activity-header__top";

  const homeLink = document.createElement("a");
  homeLink.className = "activity-header__home touch-target";
  homeLink.href = galleryHref || "../index.html";
  homeLink.textContent = "← Activity Gallery";

  topRow.appendChild(homeLink);

  const h1 = document.createElement("h1");
  h1.textContent = title;

  header.appendChild(topRow);
  header.appendChild(h1);

  if (instructions) {
    const instr = document.createElement("p");
    instr.className = "activity-instructions";
    instr.textContent = instructions;
    header.appendChild(instr);
  }

  return { header };
}

function buildReadAloudButton(title, instructions) {
  if (!window.TextToSpeech) return null;
  return TextToSpeech.createReadAloudButton(
    () => [title, instructions].filter(Boolean).join(". "),
    { label: "🔊 Read instructions", className: "touch-target read-aloud-btn" }
  );
}

function buildControlsBar(controller, { defaultSeed, readAloudBtn }) {
  const bar = document.createElement("div");
  bar.className = "activity-controls-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Activity controls");

  const seedGroup = document.createElement("div");
  seedGroup.className = "activity-controls-bar__item seed-controls";

  const seedDisplay = document.createElement("span");
  seedDisplay.className = "seed-controls__value";

  const randomBtn = document.createElement("button");
  randomBtn.type = "button";
  randomBtn.className = "touch-target";
  randomBtn.textContent = "New random seed";
  randomBtn.addEventListener("click", () => controller.setSeed(PRNG.randomSeed()));

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "touch-target";
  copyBtn.textContent = "Copy seed link";
  copyBtn.addEventListener("click", async () => {
    const url = controller.shareableURL();
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = "Copied!";
    } catch (err) {
      window.prompt("Copy this link:", url);
    }
    setTimeout(() => { copyBtn.textContent = "Copy seed link"; }, 1500);
  });

  const resetSeedBtn = document.createElement("button");
  resetSeedBtn.type = "button";
  resetSeedBtn.className = "touch-target";
  resetSeedBtn.textContent = "Reset to default seed";
  resetSeedBtn.addEventListener("click", () => controller.setSeed(defaultSeed));

  seedGroup.appendChild(seedDisplay);
  seedGroup.appendChild(randomBtn);
  seedGroup.appendChild(copyBtn);
  seedGroup.appendChild(resetSeedBtn);

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "touch-target activity-reset-btn";
  resetBtn.textContent = "Reset activity";

  bar.appendChild(seedGroup);
  if (readAloudBtn) bar.appendChild(readAloudBtn);
  bar.appendChild(resetBtn);

  return { bar, seedDisplay, resetBtn };
}

function showActivityError(container, message) {
  container.innerHTML = "";
  const box = document.createElement("div");
  box.className = "activity-error-box";
  box.setAttribute("role", "alert");
  const strong = document.createElement("strong");
  strong.textContent = "This activity ran into a problem. ";
  const span = document.createElement("span");
  span.textContent = message;
  box.appendChild(strong);
  box.appendChild(span);
  container.appendChild(box);
}

/**
 * @param {{rootId?:string, title:string, dataUrl?:string, defaultSeed?:number,
 *   instructions?:string, galleryHref?:string,
 *   render: (data:any, ctx:object) => (undefined|{reset?:Function})}} opts
 */
async function initActivityShell(opts) {
  const {
    rootId = "activity-root",
    title,
    dataUrl,
    defaultSeed = 12345,
    instructions = "",
    render
  } = opts;

  const root = document.getElementById(rootId);
  if (!root) {
    console.error("ActivityShell: root element not found:", rootId);
    return;
  }
  root.innerHTML = "";

  const controller = ModeManager.createSeedController({ defaultSeed });
  const { header } = buildActivityHeader({ title, instructions, galleryHref: opts.galleryHref });
  const readAloudBtn = buildReadAloudButton(title, instructions);
  const { bar, seedDisplay, resetBtn } = buildControlsBar(controller, { defaultSeed, readAloudBtn });

  const mount = document.createElement("main");
  mount.className = "activity-mount";
  mount.id = "activity-mount";

  // Seed/copy-link/read-aloud controls sit below the activity, not above —
  // they're utility controls, not the first thing a student should see.
  root.appendChild(header);
  root.appendChild(mount);
  root.appendChild(bar);

  function updateChrome() {
    seedDisplay.textContent = `Seed: ${controller.seed}`;
  }

  let data = null;
  if (dataUrl) {
    try {
      const resp = await fetch(dataUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} while loading ${dataUrl}`);
      data = await resp.json();
    } catch (err) {
      console.error(err);
      updateChrome();
      showActivityError(
        mount,
        `Could not load ${dataUrl}. If you opened this file directly from disk (a file:// URL), ` +
        `browsers block local data loading — open it via "quarto preview" or a local web server ` +
        `instead. Details: ${err && err.message ? err.message : err}`
      );
      return { controller };
    }
  }

  let currentRenderResult = null;
  function doRender() {
    mount.innerHTML = "";
    updateChrome();
    const rng = PRNG.createRNG(controller.seed);
    try {
      currentRenderResult = render(data, {
        seed: controller.seed, rng, container: mount, controller
      }) || null;
    } catch (err) {
      console.error(err);
      showActivityError(mount, err && err.message ? err.message : String(err));
    }
  }

  controller.subscribe(doRender);
  resetBtn.addEventListener("click", () => {
    if (currentRenderResult && typeof currentRenderResult.reset === "function") currentRenderResult.reset();
    else doRender();
  });

  doRender();

  if (window.EmbedBridge) EmbedBridge.childInit();
  if (window.ContentNotice) ContentNotice.mountAboutLink();

  return { controller, rerender: doRender };
}

window.ActivityShell = { init: initActivityShell, showActivityError };
