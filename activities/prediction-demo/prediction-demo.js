/**
 * Standalone demo/reference implementation for js/prediction-component.js.
 * Not a graded activity — just shows the commit-then-reveal pattern that
 * Activity 1 (Signature Matcher) reuses.
 */
ActivityShell.init({
  rootId: "activity-root",
  title: "Component Demo: Prediction, Commitment & Feedback",
  defaultSeed: 4242,
  instructions:
    "This page demonstrates the reusable prediction widget used inside other activities " +
    "(for example, the Biological Signature Matcher). Predict which fictional tissue will " +
    "show the highest expression of a made-up gene, commit your guess, then reveal the " +
    "simulated values.",
  render(data, { rng, container }) {
    const tissues = [
      { id: "tissue_a", label: "Tissue A" },
      { id: "tissue_b", label: "Tissue B" },
      { id: "tissue_c", label: "Tissue C" }
    ];
    const values = tissues.map((t) => ({ ...t, value: rng.range(1, 10) }));

    const widgetMount = document.createElement("div");
    container.appendChild(widgetMount);

    const widget = PredictionComponent.createPredictionWidget(widgetMount, {
      prompt: "Which tissue will show the highest expression of fictional Gene Z?",
      inputType: "select",
      options: tissues
    });

    const revealBtn = document.createElement("button");
    revealBtn.type = "button";
    revealBtn.className = "touch-target";
    revealBtn.textContent = "Reveal simulated values";
    container.appendChild(revealBtn);

    const resultsDiv = document.createElement("div");
    resultsDiv.style.marginTop = "16px";
    container.appendChild(resultsDiv);

    revealBtn.addEventListener("click", () => {
      const best = values.reduce((a, b) => (b.value > a.value ? b : a));

      const table = document.createElement("table");
      table.className = "data-table";
      const thead = document.createElement("thead");
      thead.innerHTML = "<tr><th>Tissue</th><th>Simulated Gene Z expression</th></tr>";
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      values.forEach((v) => {
        const tr = document.createElement("tr");
        const isBest = v.id === best.id;
        tr.innerHTML =
          `<td>${v.label}${isBest ? ' <span class="badge badge-correct">Highest</span>' : ""}</td>` +
          `<td>${MathUtils.formatNumber(v.value, 2)}</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      resultsDiv.innerHTML = "";
      resultsDiv.appendChild(table);

      widget.reveal(best.id);
      revealBtn.disabled = true;
    });
  }
});
