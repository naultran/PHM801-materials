/**
 * Thin wrapper around the browser's built-in Web Speech API
 * (window.speechSynthesis) — free, no server, no API key. Voice quality
 * depends on the OS/browser, but it works out of the box everywhere modern.
 * Used for "read aloud" buttons on lecture slides and activity instructions.
 */
(function () {
  "use strict";

  function supported() {
    return typeof window.speechSynthesis !== "undefined";
  }

  function speak(text) {
    if (!supported() || !text) return;
    window.speechSynthesis.cancel(); // stop whatever was playing before
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    if (supported()) window.speechSynthesis.cancel();
  }

  function isSpeaking() {
    return supported() && window.speechSynthesis.speaking;
  }

  /**
   * Build a toggle button: click to speak getTextFn()'s current return
   * value, click again (while speaking) to stop. Returns null if the
   * browser has no speech synthesis support, so callers can skip adding a
   * button that wouldn't do anything.
   */
  function createReadAloudButton(getTextFn, opts) {
    opts = opts || {};
    if (!supported()) return null;

    const label = opts.label || "🔊 Read aloud";
    const stopLabel = opts.stopLabel || "⏹ Stop reading";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = opts.className || "touch-target read-aloud-btn";
    btn.textContent = label;

    let pollTimer = null;
    function resetLabel() {
      btn.textContent = label;
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    btn.addEventListener("click", () => {
      if (isSpeaking()) {
        stop();
        resetLabel();
        return;
      }
      const text = typeof getTextFn === "function" ? getTextFn() : getTextFn;
      if (!text) return;
      speak(text);
      btn.textContent = stopLabel;
      pollTimer = setInterval(() => {
        if (!isSpeaking()) resetLabel();
      }, 300);
    });

    return btn;
  }

  window.TextToSpeech = { supported, speak, stop, isSpeaking, createReadAloudButton };
})();
