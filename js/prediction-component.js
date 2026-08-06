/**
 * Reusable "Prediction, Commitment & Feedback" widget (spec experience #17).
 * Prompts a student to commit to a guess BEFORE an activity reveals its
 * computed result, then compares the guess to the actual outcome. Records
 * nothing outside the current page — no network calls.
 */

function createPredictionWidget(containerEl, opts) {
  const {
    prompt, inputType = "select", options = [], onCommit,
    commitLabel = "Commit Prediction", numberProps = {}
  } = opts;

  containerEl.innerHTML = "";
  containerEl.classList.add("prediction-widget");
  containerEl.setAttribute("data-committed", "false");

  const promptEl = document.createElement("p");
  promptEl.className = "prediction-widget__prompt";
  promptEl.textContent = prompt;

  const row = document.createElement("div");
  row.className = "prediction-widget__row";

  let inputEl;
  if (inputType === "select") {
    inputEl = document.createElement("select");
    options.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label;
      inputEl.appendChild(opt);
    });
  } else if (inputType === "number") {
    inputEl = document.createElement("input");
    inputEl.type = "number";
    Object.entries(numberProps).forEach(([k, v]) => inputEl.setAttribute(k, v));
  } else {
    inputEl = document.createElement("input");
    inputEl.type = "text";
  }
  inputEl.className = "touch-target";
  inputEl.setAttribute("aria-label", prompt);

  const commitBtn = document.createElement("button");
  commitBtn.type = "button";
  commitBtn.className = "touch-target";
  commitBtn.textContent = commitLabel;

  const feedback = document.createElement("div");
  feedback.className = "prediction-widget__feedback";
  feedback.setAttribute("aria-live", "polite");

  row.appendChild(inputEl);
  row.appendChild(commitBtn);
  containerEl.appendChild(promptEl);
  containerEl.appendChild(row);
  containerEl.appendChild(feedback);

  let committed = false;
  let committedValue = null;

  function commit() {
    if (committed) return;
    committedValue = inputEl.value;
    committed = true;
    inputEl.disabled = true;
    commitBtn.disabled = true;
    commitBtn.textContent = "Prediction locked in";
    containerEl.setAttribute("data-committed", "true");
    if (onCommit) onCommit(committedValue);
  }
  commitBtn.addEventListener("click", commit);

  function defaultFeedback(predicted, actual) {
    const isCorrect = String(predicted) === String(actual);
    return isCorrect
      ? { status: "correct", label: "Correct!", detail: `Your prediction (${predicted}) matched the result (${actual}).` }
      : { status: "incorrect", label: "Not quite", detail: `You predicted ${predicted}; the result was ${actual}.` };
  }

  /**
   * Show the real answer and feedback. If the student never clicked commit,
   * this forces a commit of whatever is currently selected first — a reveal
   * can never happen before some prediction is on record.
   */
  function reveal(actual, feedbackFn) {
    if (!committed) commit();
    const fb = (feedbackFn || defaultFeedback)(committedValue, actual);
    feedback.innerHTML = "";
    const badge = document.createElement("span");
    badge.className = `badge badge-${fb.status}`;
    badge.textContent = fb.label;
    feedback.appendChild(badge);
    if (fb.detail) {
      const detail = document.createElement("p");
      detail.textContent = fb.detail;
      detail.style.marginTop = "6px";
      feedback.appendChild(detail);
    }
  }

  function reset() {
    committed = false;
    committedValue = null;
    inputEl.disabled = false;
    commitBtn.disabled = false;
    commitBtn.textContent = commitLabel;
    containerEl.setAttribute("data-committed", "false");
    feedback.innerHTML = "";
  }

  return { getPrediction: () => committedValue, reveal, reset };
}

window.PredictionComponent = { createPredictionWidget };
