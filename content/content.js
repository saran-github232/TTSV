// Content Script for TTS Review AI Auto-Validator & Emotion Tagger

(function () {
  console.log("[TTS AI Reviewer] Content script initializing...");

  // Allowed 19 Emotions — exact spellings from the official Training Guide /
  // portal tag chips. Legacy labels ("angry", "mischievously", "whispers")
  // are mapped onto these by normalizeEmotion().
  const EMOTIONS = [
    "anger", "annoyed", "awe", "curious", "excited",
    "fearful", "flirty", "joyful", "loud", "menacing",
    "mischievous", "nervous", "sad", "sarcastic", "smug",
    "surprised", "tender", "thoughtful", "whisper"
  ];

  const EMOTION_ALIASES = {
    angry: "anger", anger: "anger",
    mischievously: "mischievous", mischievous: "mischievous",
    whispers: "whisper", whisper: "whisper"
  };

  function normalizeEmotion(label) {
    const l = (label || "").toLowerCase().trim();
    return EMOTION_ALIASES[l] || (EMOTIONS.includes(l) ? l : "");
  }

  // Allowed Non-Speech Event Tags
  const EVENT_TAGS = [
    "<|laugh|>", "<|chuckle|>", "<|giggle|>", "<|sigh|>", "<|sniff|>",
    "<|cough|>", "<|throat_clear|>", "<|lip_smack|>", "<|gulp|>", "<|gasp|>",
    "<|yawn|>", "<|snort|>", "<|cry|>", "<|woo|>", "<|hum_tune|>",
    "<|tsk|>", "<|um|>", "<|uh|>", "<|inhale|>", "<|exhale|>"
  ];

  let currentAnalysis = null;
  let isProcessing = false;
  let lastClipIdentifier = "";

  // Wait for page elements to mount
  function init() {
    applyStealth(isStealthOn()); // restore hidden state before any UI is drawn
    setupInPageWidget();
    observeClipChanges();
    listenToBackgroundMessages();
  }

  // --- Element Resolvers ---
  function getAudioElement() {
    return document.querySelector("audio");
  }

  function getCorrectedTextarea() {
    // Check specific class on live portal
    const specific = document.querySelector("textarea.te-input");
    if (specific) return specific;

    // Look for textarea in "Your Review" section or any primary textarea on page
    const textareas = document.querySelectorAll("textarea");
    if (textareas.length === 1) return textareas[0];
    
    // If multiple, find one preceded by "Corrected Transcript"
    for (const ta of textareas) {
      const parent = ta.closest(".review-panel, .your-review, div, section");
      if (parent && /Corrected Transcript/i.test(parent.textContent)) {
        return ta;
      }
    }
    return textareas[0] || null;
  }

  function getOriginalTranscript() {
    // Strategy 1: Find the "Original Transcript" heading/label, then read the
    // text that follows it (next sibling, or the text-bearing node just after).
    const allEls = document.querySelectorAll("h1, h2, h3, h4, h5, h6, div, p, span, label, strong");
    for (const el of allEls) {
      if (/^original transcript\b/i.test(el.textContent.trim())) {
        // Prefer a following sibling that carries text.
        let node = el.nextElementSibling;
        while (node && !node.textContent.trim()) node = node.nextElementSibling;

        // Otherwise look just below within the shared container.
        if (!node && el.parentElement) {
          node = el.parentElement.querySelector("textarea, [contenteditable], p, div, span");
        }
        if (node) {
          const txt = (node.tagName === "TEXTAREA" ? node.value : node.textContent).trim();
          // Guard against grabbing the heading itself.
          if (txt && !/^original transcript$/i.test(txt)) return txt;
        }
      }
    }

    // Strategy 2: Look for elements with class/id/data-testid hinting "original".
    const candidate = document.querySelector(
      ".original-transcript, [data-testid='original-transcript'], #original-transcript, [class*='original']"
    );
    if (candidate) {
      const txt = (candidate.tagName === "TEXTAREA" ? candidate.value : candidate.textContent).trim();
      if (txt) return txt;
    }

    return "";
  }

  function getClipMetadata() {
    const audio = getAudioElement();
    const clipEl = Array.from(document.querySelectorAll("h1, h2, h3, h4, div, span"))
      .find(el => el.textContent.includes("Clip:"));
    const clipId = clipEl ? clipEl.textContent.trim() : (audio?.src || "unknown_clip");
    return { clipId, audioSrc: audio?.currentSrc || audio?.src || "" };
  }

  // --- React / Vue Safe Value Setter ---
  function updateTextareaValue(textarea, newValue, { resetScroll = true } = {}) {
    if (!textarea) return;

    // Use native prototype descriptor to bypass React 16+ setter interception
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(textarea, newValue);
    } else {
      textarea.value = newValue;
    }

    // Dispatch standard events so frameworks re-render / recognize change
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));

    // Writing a long value leaves the caret (and scroll) at the very end, so
    // the box shows only the tail (e.g. "...<|style_close|>") and the actual
    // transcript looks missing. Put the caret and scroll back at the start so
    // the user sees the beginning. rAF re-applies it after any framework re-render.
    // (Skipped for cursor inserts, which manage their own caret position.)
    if (resetScroll) {
      try { textarea.setSelectionRange(0, 0); } catch (_) {}
      textarea.scrollTop = 0;
      requestAnimationFrame(() => { textarea.scrollTop = 0; });
    }
  }

  // Insert event tag or text at cursor
  function insertAtCursor(textarea, textToInsert) {
    if (!textarea) return;
    textarea.focus();

    const startPos = textarea.selectionStart ?? textarea.value.length;
    const endPos = textarea.selectionEnd ?? textarea.value.length;
    const currentVal = textarea.value;

    const newVal = currentVal.substring(0, startPos) + textToInsert + currentVal.substring(endPos);
    updateTextareaValue(textarea, newVal, { resetScroll: false });

    // Reposition cursor
    const newCursor = startPos + textToInsert.length;
    textarea.setSelectionRange(newCursor, newCursor);
  }

  // --- Auto-Review Execution ---
  async function runAutoReview() {
    if (isProcessing) return;
    const textarea = getCorrectedTextarea();
    const audio = getAudioElement();
    const originalText = getOriginalTranscript() || textarea?.value || "";

    if (!audio && !originalText) {
      showStatus("⚠️ No audio element or transcript found on page.", "error");
      return;
    }

    isProcessing = true;
    updateRunButtonState(true);
    showStatus("Fetching audio & analyzing voice with AI...", "working");

    try {
      const audioSrc = audio?.currentSrc || audio?.src || "";
      let audioBase64 = null;
      let mimeType = "audio/mp3";

      // Attempt to read audio data directly if possible (same-origin or blob)
      if (audioSrc) {
        try {
          const resp = await fetch(audioSrc);
          if (resp.ok) {
            const blob = await resp.blob();
            mimeType = blob.type || "audio/mp3";
            audioBase64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result.split(",")[1]);
              reader.readAsDataURL(blob);
            });
          }
        } catch (fetchErr) {
          console.log("[TTS AI Reviewer] Will fetch via background worker:", fetchErr.message);
        }
      }

      // Send analysis request to background service worker
      chrome.runtime.sendMessage(
        {
          action: "ANALYZE_AUDIO",
          payload: {
            originalTranscript: originalText,
            audioSrc: audioSrc,
            audioBase64: audioBase64,
            mimeType: mimeType
          }
        },
        (response) => {
          void chrome.runtime.lastError; // extension reloading mid-request → response is undefined; handled below
          isProcessing = false;
          updateRunButtonState(false);

          if (!response || !response.success) {
            const err = response?.error || "Unknown analysis error";
            showStatus(`Error: ${err}`, "error");
            return;
          }

          const result = response.data;
          currentAnalysis = result;

          // Inject into textarea
          const modeTagged = document.getElementById("tts-ai-pref-tagged")?.checked ?? true;
          const textToSet = modeTagged ? result.tagged_transcript : result.corrected_transcript_clean;
          
          if (textarea) {
            updateTextareaValue(textarea, textToSet);
          }

          // Update UI Card
          renderReviewNotes(result);
          // source is e.g. "Gemini (gemini-3.8-flash)" or "NVIDIA NIM (...)"
          // for AI results, "heuristic" when no key is configured.
          const isAI = result.source && result.source.toLowerCase() !== "heuristic";
          showStatus(
            isAI
              ? `✓ Validated by ${result.source} (${result.emotion})`
              : `✓ Rule-based cleaned (${result.emotion}) [Add an API key for AI audio analysis]`,
            "active"
          );
          bumpClipStats();

          // Check if auto-play is requested
          const autoPlayPref = document.getElementById("tts-ai-pref-autoplay")?.checked;
          if (autoPlayPref && audio && audio.paused) {
            audio.play().catch(() => {});
          }
        }
      );
    } catch (err) {
      isProcessing = false;
      updateRunButtonState(false);
      showStatus(`Unexpected error: ${err.message}`, "error");
    }
  }

  // Replace or Wrap emotion on existing text in textarea
  function setEmotionSpan(emotion) {
    emotion = normalizeEmotion(emotion) || emotion;
    const textarea = getCorrectedTextarea();
    if (!textarea) return;

    let text = textarea.value.trim();
    // Check if already has style open/close
    const match = text.match(/<\|style_open\|>[a-z_]+<\|style_body\|>([\s\S]*?)<\|style_close\|>/i);
    
    let innerContent = text;
    if (match) {
      innerContent = match[1];
    } else {
      // Strip any loose tags
      innerContent = text
        .replace(/<\|style_open\|>[a-z_]+/gi, "")
        .replace(/<\|style_body\|>/gi, "")
        .replace(/<\|style_close\|>/gi, "")
        .trim();
    }

    const wrapped = `<|style_open|>${emotion}<|style_body|>${innerContent}<|style_close|>`;
    updateTextareaValue(textarea, wrapped);

    // Update UI badge
    const badge = document.getElementById("tts-ai-active-emotion-badge");
    if (badge) {
      badge.textContent = `★ ${emotion}`;
    }
    showStatus(`Emotion updated to '${emotion}'`, "active");
  }

  // Copy the page's Original Transcript verbatim into the Corrected box, so the
  // reviewer can start from the system-generated text without running the AI.
  function loadOriginalIntoCorrected() {
    const textarea = getCorrectedTextarea();
    if (!textarea) {
      showStatus("⚠️ Couldn't find the Corrected Transcript box.", "error");
      return;
    }
    const original = getOriginalTranscript();
    if (!original) {
      showStatus("⚠️ Couldn't find an Original Transcript on this page.", "error");
      return;
    }
    updateTextareaValue(textarea, original);
    showStatus("Loaded the Original Transcript into the box.", "active");
  }

  function toggleStyleWrap() {
    const textarea = getCorrectedTextarea();
    if (!textarea) return;
    const text = textarea.value.trim();
    const match = text.match(/<\|style_open\|>([a-z_]+)<\|style_body\|>([\s\S]*?)<\|style_close\|>/i);

    if (match) {
      // Un-wrap to clean
      updateTextareaValue(textarea, match[2].trim());
      showStatus("Unwrapped: Clean text mode", "active");
    } else {
      // Wrap with current emotion or default thoughtful
      const emotion = currentAnalysis?.emotion || "thoughtful";
      updateTextareaValue(textarea, `<|style_open|>${emotion}<|style_body|>${text}<|style_close|>`);
      showStatus(`Wrapped with '${emotion}' style`, "active");
    }
  }

  // --- Floating Copilot Dock UI ---
  function setupInPageWidget() {
    if (document.getElementById("tts-ai-copilot-panel")) return;

    const panel = document.createElement("div");
    panel.id = "tts-ai-copilot-panel";
    panel.innerHTML = `
      <div class="tts-ai-header" id="tts-ai-header-drag">
        <div class="tts-ai-logo-group">
          <div class="tts-ai-badge-icon">🎙️</div>
          <div class="tts-ai-title">
            TTS Review Copilot
            <span class="tts-ai-version">AI Pro</span>
          </div>
        </div>
        <div class="tts-ai-controls">
          <button class="tts-ai-icon-btn" id="tts-ai-btn-guide" title="19-Emotion Training Guide & Lookalikes Reference">📖</button>
          <button class="tts-ai-icon-btn" id="tts-ai-btn-stealth" title="Hide all UI for screen sharing (Alt+H to bring it back)">🙈</button>
          <button class="tts-ai-icon-btn" id="tts-ai-btn-settings" title="Settings / API Key">⚙️</button>
          <button class="tts-ai-icon-btn" id="tts-ai-btn-minimize" title="Minimize / Expand">—</button>
        </div>
      </div>

      <div class="tts-ai-body">
        <!-- Main Actions -->
        <div class="tts-ai-action-row">
          <button class="tts-ai-btn-primary" id="tts-ai-run-btn">
            <span id="tts-ai-run-icon">✨</span>
            <span id="tts-ai-run-text">AI Auto-Review & Tag</span>
            <span style="font-size: 10px; opacity: 0.8; background: rgba(0,0,0,0.25); padding: 1px 5px; border-radius: 4px;">Alt+A</span>
          </button>
          <button class="tts-ai-btn-secondary" id="tts-ai-play-btn" title="Toggle Audio Playback (Alt+P)">
            ▶ / ⏸
          </button>
        </div>

        <!-- Secondary Actions (moved here from the removed inline bar) -->
        <div class="tts-ai-action-row">
          <button class="tts-ai-btn-secondary" id="tts-ai-load-original-btn" title="Copy the page's Original Transcript into the Corrected box, verbatim">
            ⬇ Load Original
          </button>
          <button class="tts-ai-btn-secondary" id="tts-ai-toggle-style-btn" title="Switch between Style Span and Clean Text">
            Toggle Style Wrap
          </button>
          <button class="tts-ai-btn-secondary" id="tts-ai-rulecheck-btn" title="Check the current text against the Training Guide rules (digits, acronyms, contractions, breath tag, style span)">
            ✅ Rule Check
          </button>
          <button class="tts-ai-btn-secondary" id="tts-ai-copy-btn" title="Copy the corrected transcript to the clipboard">
            📋 Copy
          </button>
        </div>

        <!-- Status Banner -->
        <div class="tts-ai-status-banner">
          <div class="tts-ai-status-dot" id="tts-ai-status-indicator"></div>
          <span id="tts-ai-status-msg" style="flex:1;">Ready to validate current clip.</span>
        </div>

        <!-- Review Notes / Details Card -->
        <div class="tts-ai-notes-card" id="tts-ai-notes-container">
          <div class="tts-ai-notes-header">
            <span class="tts-ai-notes-title">Validation Insights</span>
            <span class="tts-ai-emotion-pill" id="tts-ai-active-emotion-badge">★ thoughtful</span>
          </div>

          <div class="tts-ai-note-row">
            <span class="tts-ai-note-label">Vocal Cues & Sentiment:</span>
            <span class="tts-ai-note-val" id="tts-ai-notes-cues">Click Auto-Review to analyze vocal tone & acoustic characteristics.</span>
          </div>

          <div class="tts-ai-note-row">
            <span class="tts-ai-note-label">Contractions & Verbatim Fixes:</span>
            <span class="tts-ai-note-val" id="tts-ai-notes-fixes">No modifications yet.</span>
          </div>

          <div class="tts-ai-note-row">
            <span class="tts-ai-note-label">Output Preview:</span>
            <div class="tts-ai-preview-box" id="tts-ai-preview-text">Awaiting validation...</div>
          </div>

          <div class="tts-ai-note-row" id="tts-ai-confidence-row" style="display:none;">
            <span class="tts-ai-note-label">Confidence:</span>
            <span class="tts-ai-note-val" id="tts-ai-confidence-val"></span>
          </div>
        </div>

        <!-- Training Guide Rule Check results -->
        <div class="tts-ai-rulecheck" id="tts-ai-rulecheck-box" style="display:none;"></div>

        <!-- Quick 19 Emotion Picker -->
        <div>
          <div class="tts-ai-subhead">Quick Emotion Selector (19 Styles)</div>
          <div class="tts-ai-pills-wrap" id="tts-ai-emotions-list"></div>
        </div>

        <!-- Quick Event Tag Inserter -->
        <div>
          <div class="tts-ai-subhead">Insert Event at Cursor</div>
          <div class="tts-ai-pills-wrap" id="tts-ai-events-list"></div>
        </div>

        <!-- Preferences & Toggles -->
        <div class="tts-ai-footer-row">
          <label class="tts-ai-toggle-label" title="Wrap text with <|style_open|>emotion<|style_body|>...<|style_close|>">
            <input type="checkbox" id="tts-ai-pref-tagged" checked>
            Style Span Mode
          </label>
          <label class="tts-ai-toggle-label" title="Automatically trigger AI when moving to next clip">
            <input type="checkbox" id="tts-ai-pref-autorun">
            Auto-Run on Next
          </label>
          <label class="tts-ai-toggle-label" title="Auto play clip after AI review">
            <input type="checkbox" id="tts-ai-pref-autoplay">
            Auto-Play
          </label>
        </div>
        <div class="tts-ai-footer-row">
          <label class="tts-ai-toggle-label" title="Audio playback speed">
            🔊
            <select id="tts-ai-speed" class="tts-ai-speed-select">
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1" selected>1×</option>
              <option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </label>
          <span class="tts-ai-stat" id="tts-ai-stat" title="Clips processed by this extension on this Chrome profile">Clips: 0</span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // SPA self-healing: some frameworks rebuild <body> after load, which
    // would orphan (remove) the panel. Watch for the panel being detached
    // and re-attach it automatically.
    const panelObserver = new MutationObserver(() => {
      if (!panel.isConnected && document.body) {
        document.body.appendChild(panel);
        applyStealth(isStealthOn());
      }
    });
    panelObserver.observe(document.body, { childList: true, subtree: false });

    // Populate Emotion Buttons
    const emotionsList = panel.querySelector("#tts-ai-emotions-list");
    EMOTIONS.forEach(emo => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tts-ai-pill-btn emotion-pill";
      btn.textContent = emo;
      btn.addEventListener("click", () => setEmotionSpan(emo));
      emotionsList.appendChild(btn);
    });

    // Populate Event Buttons
    const eventsList = panel.querySelector("#tts-ai-events-list");
    EVENT_TAGS.forEach(tag => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tts-ai-pill-btn";
      btn.textContent = tag.replace(/<\||\|>/g, "");
      btn.title = `Insert ${tag} at cursor`;
      btn.addEventListener("click", () => {
        const ta = getCorrectedTextarea();
        insertAtCursor(ta, tag);
      });
      eventsList.appendChild(btn);
    });

    // Wire Buttons
    panel.querySelector("#tts-ai-run-btn").addEventListener("click", runAutoReview);

    panel.querySelector("#tts-ai-play-btn").addEventListener("click", () => {
      const audio = getAudioElement();
      if (!audio) return;
      if (audio.paused) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });

    panel.querySelector("#tts-ai-load-original-btn").addEventListener("click", loadOriginalIntoCorrected);
    panel.querySelector("#tts-ai-toggle-style-btn").addEventListener("click", toggleStyleWrap);
    panel.querySelector("#tts-ai-rulecheck-btn").addEventListener("click", runRuleCheck);
    panel.querySelector("#tts-ai-copy-btn").addEventListener("click", copyTranscript);

    // Playback speed preference, applied to the current clip immediately.
    const speedSelect = panel.querySelector("#tts-ai-speed");
    chrome.storage.sync.get(["playbackRate"], (items) => {
      if (items.playbackRate) speedSelect.value = String(items.playbackRate);
    });
    speedSelect.addEventListener("change", () => {
      const rate = parseFloat(speedSelect.value) || 1;
      chrome.storage.sync.set({ playbackRate: rate });
      const audio = getAudioElement();
      if (audio) audio.playbackRate = rate;
      showStatus(`Playback speed: ${rate}×`, "active");
    });

    // Minimize / Expand
    const minBtn = panel.querySelector("#tts-ai-btn-minimize");
    minBtn.addEventListener("click", () => {
      panel.classList.toggle("minimized");
      minBtn.textContent = panel.classList.contains("minimized") ? "+" : "—";
    });

    // Settings & Guide Modals
    panel.querySelector("#tts-ai-btn-settings").addEventListener("click", openQuickSettingsModal);
    panel.querySelector("#tts-ai-btn-guide").addEventListener("click", openTaxonomyGuideModal);

    // Stealth: hide all extension UI for screen sharing (Alt+H brings it back).
    panel.querySelector("#tts-ai-btn-stealth").addEventListener("click", toggleStealth);

    // --- Draggable panel: grab the header to reposition it anywhere on screen ---
    (function enableDrag() {
      const handle = panel.querySelector("#tts-ai-header-drag");
      const STORAGE_KEY = "ttsCopilotPos";
      let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

      // Switch from the default bottom/right anchoring to explicit left/top,
      // clamped so the panel always stays fully within the viewport.
      function applyPosition(left, top) {
        const w = panel.offsetWidth, h = panel.offsetHeight;
        left = Math.max(0, Math.min(left, window.innerWidth - w));
        top = Math.max(0, Math.min(top, window.innerHeight - h));
        panel.style.left = left + "px";
        panel.style.top = top + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      }

      // Restore a previously saved position across page loads.
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
          applyPosition(saved.left, saved.top);
        }
      } catch (_) {}

      function onPointerMove(e) {
        if (!dragging) return;
        applyPosition(startLeft + (e.clientX - startX), startTop + (e.clientY - startY));
      }

      function endDrag() {
        if (!dragging) return;
        dragging = false;
        panel.style.transition = "";
        document.body.style.userSelect = "";
        handle.classList.remove("tts-ai-dragging");
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            left: parseInt(panel.style.left, 10) || 0,
            top: parseInt(panel.style.top, 10) || 0
          }));
        } catch (_) {}
      }

      // Pointer events + pointer capture: the header keeps receiving move/up
      // events even when the cursor leaves it or the portal's own handlers
      // would otherwise swallow the drag. More reliable than mouse events on SPAs.
      handle.addEventListener("pointerdown", (e) => {
        // Left/primary button only, and never start a drag from the control buttons.
        if (e.button !== 0 || e.target.closest(".tts-ai-icon-btn")) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startLeft = rect.left; startTop = rect.top;
        panel.style.transition = "none"; // follow the cursor without easing lag
        document.body.style.userSelect = "none";
        handle.classList.add("tts-ai-dragging");
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
      });
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);

      // Keep it on-screen if the window is later resized smaller.
      window.addEventListener("resize", () => {
        if (panel.style.left) {
          applyPosition(parseInt(panel.style.left, 10) || 0, parseInt(panel.style.top, 10) || 0);
        }
      });
    })();

    // Load saved preferences
    chrome.storage.sync.get(["autoRunOnNext", "autoPlayAudio", "styleSpanPref", "clipsProcessed", "playbackRate"], (items) => {
      const statEl = document.getElementById("tts-ai-stat");
      if (statEl) statEl.textContent = `Clips: ${items.clipsProcessed || 0}`;
      const audio = getAudioElement();
      if (audio && items.playbackRate) audio.playbackRate = items.playbackRate;
      if (items.autoRunOnNext !== undefined) {
        const el = document.getElementById("tts-ai-pref-autorun");
        if (el) el.checked = items.autoRunOnNext;
      }
      if (items.autoPlayAudio !== undefined) {
        const el = document.getElementById("tts-ai-pref-autoplay");
        if (el) el.checked = items.autoPlayAudio;
      }
      if (items.styleSpanPref !== undefined) {
        const el = document.getElementById("tts-ai-pref-tagged");
        if (el) el.checked = items.styleSpanPref;
      }
    });

    // Save preferences on change
    panel.querySelector("#tts-ai-pref-autorun").addEventListener("change", (e) => {
      chrome.storage.sync.set({ autoRunOnNext: e.target.checked });
    });
    panel.querySelector("#tts-ai-pref-autoplay").addEventListener("change", (e) => {
      chrome.storage.sync.set({ autoPlayAudio: e.target.checked });
    });
    panel.querySelector("#tts-ai-pref-tagged").addEventListener("change", (e) => {
      chrome.storage.sync.set({ styleSpanPref: e.target.checked });
    });
  }

  // --- UI Helpers ---
  function showStatus(message, state = "normal") {
    const msgEl = document.getElementById("tts-ai-status-msg");
    const dot = document.getElementById("tts-ai-status-indicator");
    if (!msgEl || !dot) return;

    msgEl.textContent = message;
    dot.className = "tts-ai-status-dot";
    if (state === "active") dot.classList.add("active");
    if (state === "working") dot.classList.add("working");
    if (state === "error") dot.classList.add("error");
  }

  function updateRunButtonState(loading) {
    const btn = document.getElementById("tts-ai-run-btn");
    const icon = document.getElementById("tts-ai-run-icon");
    const txt = document.getElementById("tts-ai-run-text");
    if (!btn) return;

    if (loading) {
      btn.classList.add("loading");
      if (icon) icon.textContent = "⏳";
      if (txt) txt.textContent = "Analyzing Audio...";
    } else {
      btn.classList.remove("loading");
      if (icon) icon.textContent = "✨";
      if (txt) txt.textContent = "AI Auto-Review & Tag";
    }
  }

  function renderReviewNotes(result) {
    const badge = document.getElementById("tts-ai-active-emotion-badge");
    const cues = document.getElementById("tts-ai-notes-cues");
    const fixes = document.getElementById("tts-ai-notes-fixes");
    const preview = document.getElementById("tts-ai-preview-text");

    if (badge) badge.textContent = `★ ${result.emotion}`;
    if (cues) {
      const cueText = result.review_notes?.emotion_and_vocal_cues || `Emotion: ${result.emotion}`;
      cues.textContent = cueText;
    }
    if (fixes) {
      const fixesText = result.review_notes?.text_fixes || "Punctuation & casing standardized";
      const tagsText = (result.review_notes?.event_tags_inserted || []).join(", ");
      fixes.textContent = tagsText ? `${fixesText} | Tags: ${tagsText}` : fixesText;
    }
    if (preview) {
      preview.textContent = result.tagged_transcript || result.corrected_transcript_clean;
    }

    // Emotion confidence + runner-up (when the AI provides them)
    const confRow = document.getElementById("tts-ai-confidence-row");
    const confVal = document.getElementById("tts-ai-confidence-val");
    if (confRow && confVal) {
      const conf = (result.emotion_confidence || "").toLowerCase();
      const runner = normalizeEmotion(result.runner_up_emotion);
      if (!conf && !runner) {
        confRow.style.display = "none";
      } else {
        confRow.style.display = "";
        confVal.textContent = "";
        const icon = conf === "high" ? "🟢 " : conf === "medium" ? "🟡 " : conf === "low" ? "🟠 " : "";
        confVal.append(`${icon}${conf || "n/a"}`);
        if (runner) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "tts-ai-btn-secondary";
          btn.style.cssText = "margin-left:8px; padding:1px 8px; font-size:10px;";
          btn.textContent = `Try '${runner}'`;
          btn.addEventListener("click", () => setEmotionSpan(runner));
          confVal.appendChild(btn);
        }
      }
    }
  }

  // --- Quick Settings Modal ---
  function openQuickSettingsModal() {
    if (document.getElementById("tts-ai-settings-modal")) return;

    chrome.storage.sync.get(["geminiApiKey", "selectedModel"], (data) => {
      const modal = document.createElement("div");
      modal.id = "tts-ai-settings-modal";
      modal.className = "tts-ai-modal-overlay";
      modal.innerHTML = `
        <div class="tts-ai-modal">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0; font-size:15px; color:#fff;">⚙️ Gemini AI Settings</h3>
            <button id="tts-modal-close" style="background:none; border:none; color:#94a3b8; font-size:18px; cursor:pointer;">&times;</button>
          </div>
          
          <label style="font-size:12px; color:#cbd5e1; font-weight:600;">Google Gemini API Key:</label>
          <input type="password" id="tts-modal-key" class="tts-ai-input" placeholder="AQ.Ab... or AIzaSy..." autocomplete="off" />
          <p style="font-size:11px; color:#94a3b8; margin:-8px 0 12px 0;">
            A key from <a href="https://aistudio.google.com/" target="_blank" style="color:#60a5fa;">aistudio.google.com</a> is free and enables native audio emotion and speech analysis.
            Using <a href="https://build.nvidia.com/models" target="_blank" style="color:#60a5fa;">NVIDIA NIM</a> instead? Keys start with <code>nvapi-</code> — set them in the popup's <strong>NVIDIA</strong> tab (text-only, no audio listening).
          </p>

          <label style="font-size:12px; color:#cbd5e1; font-weight:600;">AI Model:</label>
          <select id="tts-modal-model" class="tts-ai-input" style="cursor:pointer;">
            <option value="gemini-3.8-flash" ${data.selectedModel === 'gemini-3.8-flash' || !data.selectedModel ? 'selected' : ''}>Gemini 3.8 Flash (Best quality - Native Audio)</option>
            <option value="gemini-flash-lite-latest" ${data.selectedModel === 'gemini-flash-lite-latest' ? 'selected' : ''}>Gemini Flash Lite (Higher free quota - Audio)</option>
            <option value="gemini-3.5-flash-lite" ${data.selectedModel === 'gemini-3.5-flash-lite' ? 'selected' : ''}>Gemini 3.5 Flash Lite (Higher free quota)</option>
            <option value="gemini-flash-latest" ${data.selectedModel === 'gemini-flash-latest' ? 'selected' : ''}>Gemini Flash (Latest - auto-updates)</option>
          </select>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
            <button type="button" id="tts-modal-cancel" class="tts-ai-btn-secondary" style="padding:6px 12px;">Cancel</button>
            <button type="button" id="tts-modal-save" class="tts-ai-btn-primary" style="padding:6px 16px;">Save Settings</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      // Set the stored key via the DOM — never via innerHTML interpolation.
      modal.querySelector("#tts-modal-key").value = data.geminiApiKey || "";

      const closeModal = () => modal.remove();
      modal.querySelector("#tts-modal-close").addEventListener("click", closeModal);
      modal.querySelector("#tts-modal-cancel").addEventListener("click", closeModal);

      modal.querySelector("#tts-modal-save").addEventListener("click", () => {
        const apiKey = modal.querySelector("#tts-modal-key").value.trim();
        const selectedModel = modal.querySelector("#tts-modal-model").value;
        chrome.storage.sync.set({ geminiApiKey: apiKey, selectedModel: selectedModel }, () => {
          showStatus("API Settings saved successfully!", "active");
          closeModal();
        });
      });
    });
  }

  // --- 19 Emotion Reference Guide (from Official Training Guide) ---
  const TAXONOMY_REFERENCE = [
    {
      label: "anger",
      name: "Anger",
      def: "The speaker sounds very mad or upset. The voice may sound strong, sharp, or tense.",
      listenFor: "Forceful or tense voice; sharp stress; clipped phrasing; raised intensity.",
      notConfuse: "Annoyed (usually milder) · Loud (only volume) · Menacing (involves a threat)"
    },
    {
      label: "annoyed",
      name: "Annoyed",
      def: "The speaker sounds irritated or tired of something, but not strongly angry.",
      listenFor: "Exasperated or flat tone; drawn-out words; sighing quality; restrained sharpness.",
      notConfuse: "Anger (much stronger) · Sarcastic (may mean opposite of words) · Sad (unhappy, not irritated)"
    },
    {
      label: "awe",
      name: "Awe",
      def: "The speaker sounds amazed by something beautiful, impressive, or wonderful.",
      listenFor: "Breathy or open tone; slower pace; widened pitch range; reverent emphasis.",
      notConfuse: "Surprised (unexpected, but may not admire it) · Joyful (happy, but not necessarily amazed) · Excited (more energy/eagerness)"
    },
    {
      label: "curious",
      name: "Curious",
      def: "The speaker wants to know, learn, or understand something.",
      listenFor: "Questioning intonation; attentive energy; upward inflection; inviting pace.",
      notConfuse: "Thoughtful (thinking carefully, not looking for answer) · Surprised (unexpected reaction) · Nervous (worried, not interested)"
    },
    {
      label: "excited",
      name: "Excited",
      def: "The speaker sounds very eager, happy, and full of energy.",
      listenFor: "Faster pace; higher pitch; lively rhythm; strong positive emphasis.",
      notConfuse: "Joyful (happy, but may sound calmer) · Surprised (sudden reaction) · Loud (only about volume)"
    },
    {
      label: "fearful",
      name: "Fearful",
      def: "The speaker sounds afraid because something dangerous or bad may happen.",
      listenFor: "Shaky or breathy voice; urgency; higher pitch; pauses, gasps, or strained delivery.",
      notConfuse: "Nervous (worried, but no clear danger) · Surprised (unexpected, but not afraid) · Whisper (only quiet voice)"
    },
    {
      label: "flirty",
      name: "Flirty",
      def: "The speaker sounds playful and shows romantic interest in someone.",
      listenFor: "Teasing warmth; suggestive stress; playful rhythm; soft or inviting delivery.",
      notConfuse: "Tender (gentle/caring, not romantic) · Mischievous (playfully causing trouble) · Joyful (happy, not romantic)"
    },
    {
      label: "joyful",
      name: "Joyful",
      def: "The speaker sounds clearly happy, pleased, or delighted.",
      listenFor: "Smiling voice; bright resonance; buoyant rhythm; warm positive energy.",
      notConfuse: "Excited (more energy/eagerness) · Smug (pleased with self/superior) · Tender (soft and caring)"
    },
    {
      label: "loud",
      name: "Loud",
      def: "The speaker talks at a high volume or sounds like shouting. The emotion can be different.",
      listenFor: "Strong amplitude and projection; voice carries forcefully; may sound shouted.",
      notConfuse: "Anger (mad/upset) · Excited (strong positive energy) · Menacing (sounds threatening)"
    },
    {
      label: "menacing",
      name: "Menacing",
      def: "The speaker sounds threatening or dangerous, as if they may harm or scare someone.",
      listenFor: "Controlled low tone; deliberate pacing; ominous stress; cold or restrained intensity.",
      notConfuse: "Anger (mad, but not threatening) · Loud (only about volume) · Smug (superior, but not threatening)"
    },
    {
      label: "mischievous",
      name: "Mischievous",
      def: "The speaker sounds playful or cheeky and may be planning harmless trouble.",
      listenFor: "Conspiratorial or cheeky tone; playful stress; restrained amusement; knowing rhythm.",
      notConfuse: "Menacing (may cause harm/threat) · Flirty (romantic interest) · Sarcastic (mocking/means opposite)"
    },
    {
      label: "nervous",
      name: "Nervous",
      def: "The speaker sounds worried, unsure, or uncomfortable. The voice may shake or hesitate.",
      listenFor: "Hesitations; uneven rhythm; tight or shaky pitch; rushed words or fillers.",
      notConfuse: "Fearful (clear danger or strong fear) · Whisper (only a quiet voice)"
    },
    {
      label: "sad",
      name: "Sad",
      def: "The speaker sounds unhappy, hurt, disappointed, or low in energy.",
      listenFor: "Lower energy; slower pace; softer volume; falling pitch; heavy or tearful quality.",
      notConfuse: "Tender (gentle and caring) · Nervous (worried or unsure) · Whisper (only a quiet voice)"
    },
    {
      label: "sarcastic",
      name: "Sarcastic",
      def: "The speaker sounds mocking or means the opposite of the words they say.",
      listenFor: "Exaggerated stress; dry or flat tone; stretched words; noticeable mismatch with wording.",
      notConfuse: "Annoyed (directly shows irritation) · Smug (pleased with self/superior) · Mischievous (playful teasing)"
    },
    {
      label: "smug",
      name: "Smug",
      def: "The speaker sounds very pleased with themselves and may feel better than others.",
      listenFor: "Knowing tone; relaxed certainty; slight drawl; condescending or pleased emphasis.",
      notConfuse: "Joyful (simple happiness without superiority) · Sarcastic (mocking/opposite) · Menacing (threatening)"
    },
    {
      label: "surprised",
      name: "Surprised",
      def: "The speaker reacts to something they did not expect.",
      listenFor: "Sudden pitch jump; sharp onset; widened intensity; brief gasp or pause.",
      notConfuse: "Awe (surprise includes wonder/admiration) · Excited (positive energy lasts longer) · Fearful (afraid of danger)"
    },
    {
      label: "tender",
      name: "Tender",
      def: "The speaker sounds soft, gentle, caring, or loving.",
      listenFor: "Soft warm tone; smooth pace; delicate emphasis; calm, intimate delivery.",
      notConfuse: "Flirty (shows romantic interest) · Sad (feels sorrow/unhappiness) · Whisper (only a quiet voice)"
    },
    {
      label: "thoughtful",
      name: "Thoughtful",
      def: "The speaker sounds calm and is carefully thinking about something.",
      listenFor: "Measured pace; intentional pauses; calm control; emphasis on key ideas.",
      notConfuse: "Curious (wants answer/information) · Nervous (worried/unsure) · Sad (unhappy/low)"
    },
    {
      label: "whisper",
      name: "Whisper",
      def: "The speaker uses a very quiet, soft, and breathy voice.",
      listenFor: "Breathy phonation; minimal vocal projection; close, soft delivery; reduced voicing.",
      notConfuse: "Tender (gentle/caring emotion) · Fearful (afraid) · Nervous (worried/unsure)"
    }
  ];

  // Reference sample clips per emotion, transcribed from the official
  // Taxonomy sheet (reference/pdf.pdf) so reviewers can train their ear on
  // each style before tagging. Keys are canonical emotion labels.
  const EMOTION_SAMPLES = {
    anger: ["1sNvEhdtZ5gqxrARpj1m-ZpK_OszsjCuE", "1PlfjECwcOBTIO71V52Ui58DMflvXWU-k", "1sPJzajHQE7ZAm-BYPrX8b-bUhqGJQ7Yh"],
    annoyed: ["1sYUZoooNei9H9dKHQtsC8lWX_rYnPOYU", "1i0D_OEErnP-6OQWQoa0XB33GP5oUTrGW", "11-pyaD05MG7cVKijwzPiDpReXigO5jhq"],
    awe: ["1Xt5wD07oPPs5i2ioW67FFCS9t-0ftUvB", "1C6sNneKZJunqyWl6c5W60Rp3H7Cm-xao", "1EmDrj3CXpUVD41_bZeeh4QPDRQkrZyOv"],
    curious: ["1eJ-DmIzJb8AN5B3YRXfnfI5nGWdV69tj", "178LAUisk6iKbUr4oSnQumdxGJpAOZZJ2", "1MztgVQleyx8E0Fox0x_cQtb4rv3ypzRD"],
    excited: ["10ymKSkD1tkAgJzDZZliVJc-bFb2GAXOK", "1mZuTL_56TR6cqjQhvz1d1TQZnxdFJAmF", "1Jpgu91TQsHLHgph0AB66mgERBfJBOO7d"],
    fearful: ["1-21X_la2wvjTuYGklmiapfPTfs79IZmO", "1etpZgM9ADaWKjvvNHfOmVPZWHrGSRVzb", "11-Jowpp2ZVMimQDctxulR3_eXHcp3H4o"],
    flirty: ["1nGGozA7VUBacgRuxe_hNglpec_Ddjp6l", "1oZGn4B9d4lhuvPPOnImFnNWGWJ1ys46r", "1HBJPH4z58RsKN1fg3SWNU9WEjBuz8jgb"],
    joyful: ["1R5jaoFmp95yUB8cl0dZseziXLfXzLX-A", "1YEaoDiAY_TkWfTc1oSGpxiln0BDHRP2L", "1_FCMpfk90iXT4pHs3bzAb_V53BwmrIqV"],
    loud: ["1E3NCyxLUK7PlFPdXqF0hS3x5T4kMHyOP", "1Md5GFQbGvvlbEsNdf-Iy0dmbJjSTfr7n", "1qgDM6cyH8V6Wjrvx9bOUqQElEk52fBwi"],
    menacing: ["1PSQlztcf6Lnzs3g2IhefnfmEzIp0U1rW", "1f9xeDaRk_aVRYP-7oirHzfh6hDn07TXq", "1IYBvj7PW2J5aSD2YsiGW4WnEez-NKcXH"],
    mischievous: ["14MH9BRtq0pRD5hXEtR7wv_bNLFy4UNai", "1tC5UlRs1NyFSzAWCPgcFIyThvDDzEq3y", "1u4aGskPzBi4Od4ywv96j25oupWHuSrc-"],
    nervous: ["1jAhjRVBFCuO_aemNuNBq87d4vo3_xKYE", "11_9UtTws5Z4N_YI_leqZOTGDtWI44x8X", "1TovoJU7mg9mM0cl9S_UcVy1OqCStaNFb"],
    sad: ["1Rb9qKTP8pPOc9RwPOrRxPDaY6goVdhOe", "19xYgeol9LYWJXHpreaYI3Q8xfwoMiCFt", "14SmhlmxgF2LFayRF243WZrcBdTRWROG8"],
    sarcastic: ["1ew4gGYOgQlsQTgCLpxa9uk5XKgDVLQui", "1IRXLouh9RE7bpJX31SWgqyZmcP9r_L3B", "1q6hDwouBlcmpIsOvUuu_EmM4_Eoc-WLu"],
    smug: ["1IFwR7sJ-pN6Q30y7jLiMRknhecHwwRMR", "1h51SKBa0VTNtpU6mI6nNP2dbkm8snEmf", "1dRqiGsfiisTw1b_8GitD2OwEk0UvxO0l"],
    surprised: ["1EAD-ai91NLejNbtX-QHoGz_LEYD5V_vy", "1jMVi613VRPvXYUuFEsQPhEJp3d5ozMWx", "1faD7vETERlAkUCTllWX6AJTOv49CFp5G"],
    tender: ["1ctW_EppmD0HaSbJ16DkmYuHmE0zuh8em", "1_N26T9UtwcyeTe114mcGAD_p5cldzko9", "1nYl9vfF97eMUOchwOPWcG6AFC3LCK3vc"],
    thoughtful: ["1TeyMeHJp2pwJsNYV9hp3gxV_BZp0KJne", "1b9xd9k9nkNVpbhYT8YSc7Zxl0pN1Jg6u", "1Ox97FHdBuBx49DulKpnn1EZjSzfkcC5y"],
    whisper: ["1zjNtOA0IZcY8sD3ul0i8fU50J-Ukuytk", "1WY7IIrtwF66I9w4LfggRSwlWSY26aqF2", "1dQKFID1HpxHcQKk1qOvy59EgFbFfwWZ4"]
  };

  function renderSampleLinks(item) {
    const samples = EMOTION_SAMPLES[normalizeEmotion(item.label) || item.label];
    if (!samples || !samples.length) return "";
    const links = samples
      .map((id, i) => `<a href="https://drive.google.com/file/d/${id}/view" target="_blank" rel="noopener" class="tts-ai-sample-link">Sample ${i + 1}</a>`)
      .join(" · ");
    return `<div style="font-size:11.5px; color:#93c5fd; margin-top:6px;">🎯 <strong>Reference clips:</strong> ${links}</div>`;
  }

  function openTaxonomyGuideModal() {
    if (document.getElementById("tts-ai-guide-modal")) return;

    const modal = document.createElement("div");
    modal.id = "tts-ai-guide-modal";
    modal.className = "tts-ai-modal-overlay";
    modal.innerHTML = `
      <div class="tts-ai-modal tts-ai-modal-large">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h3 style="margin:0; font-size:16px; color:#fff; display:flex; align-items:center; gap:8px;">
              <span>📖</span> 19-Emotion Training Guide & Reference
            </h3>
            <p style="margin:2px 0 0 0; font-size:11.5px; color:#94a3b8;">
              Definitions, acoustic cues to listen for, and lookalikes not to confuse.
            </p>
          </div>
          <button id="tts-guide-close" style="background:none; border:none; color:#94a3b8; font-size:22px; cursor:pointer;">&times;</button>
        </div>

        <input type="text" id="tts-guide-search" class="tts-ai-input" placeholder="Search emotions or cues (e.g. mad, threat, calm, happy)..." style="margin-bottom:12px;" />

        <div id="tts-guide-cards-container" style="max-height:60vh; overflow-y:auto; display:flex; flex-direction:column; gap:10px; padding-right:4px;">
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const container = modal.querySelector("#tts-guide-cards-container");
    const searchInput = modal.querySelector("#tts-guide-search");

    function renderCards(filter = "") {
      container.innerHTML = "";
      const query = filter.toLowerCase().trim();
      const filtered = TAXONOMY_REFERENCE.filter(item => 
        !query || 
        item.name.toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query) ||
        item.def.toLowerCase().includes(query) ||
        item.listenFor.toLowerCase().includes(query) ||
        item.notConfuse.toLowerCase().includes(query)
      );

      if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8; font-size:13px;">No matching emotions found.</div>';
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement("div");
        card.className = "tts-ai-guide-card";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="tts-ai-emotion-pill" style="font-size:12px; padding:3px 10px;">★ ${item.label}</span>
              <strong style="font-size:13.5px; color:#f8fafc;">${item.name}</strong>
            </div>
            <button type="button" class="tts-ai-btn-secondary tts-guide-apply-btn" style="padding:3px 10px; font-size:11px;" data-emo="${item.label}">
              Apply This Style
            </button>
          </div>
          <div style="font-size:12px; color:#e2e8f0; margin-bottom:4px; line-height:1.4;">
            <strong>Definition:</strong> ${item.def}
          </div>
          <div style="font-size:12px; color:#93c5fd; margin-bottom:4px; line-height:1.4;">
            <strong>Listen For:</strong> ${item.listenFor}
          </div>
          <div style="font-size:11.5px; color:#fbbf24; line-height:1.4; background:rgba(245,158,11,0.08); padding:5px 8px; border-radius:5px; border-left:3px solid #f59e0b;">
            ⚠️ <strong>Do NOT confuse with:</strong> ${item.notConfuse}
          </div>
          ${renderSampleLinks(item)}
        `;

        card.querySelector(".tts-guide-apply-btn").addEventListener("click", () => {
          setEmotionSpan(item.label);
          modal.remove();
        });

        container.appendChild(card);
      });
    }

    renderCards();

    searchInput.addEventListener("input", (e) => {
      renderCards(e.target.value);
    });

    const closeModal = () => modal.remove();
    modal.querySelector("#tts-guide-close").addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // --- Copy / Stats / Training Guide Rule Check ---
  function copyTranscript() {
    const ta = getCorrectedTextarea();
    if (!ta || !ta.value) { showStatus("Nothing to copy yet.", "error"); return; }
    navigator.clipboard.writeText(ta.value).then(
      () => showStatus("Transcript copied to clipboard.", "active"),
      () => showStatus("Clipboard copy failed — select & copy manually.", "error")
    );
  }

  function bumpClipStats() {
    chrome.storage.sync.get(["clipsProcessed"], (items) => {
      const n = (items.clipsProcessed || 0) + 1;
      chrome.storage.sync.set({ clipsProcessed: n }, () => {
        const el = document.getElementById("tts-ai-stat");
        if (el) el.textContent = `Clips: ${n}`;
      });
    });
  }

  // Safe, guide-compliant fixes the linter can apply with one click.
  const RULE_CONTRACTIONS = [
    ["doesn", "t", "doesn't"], ["it", "s", "it's"], ["i", "m", "I'm"],
    ["that", "s", "that's"], ["haven", "t", "haven't"], ["they", "re", "they're"],
    ["won", "t", "won't"], ["don", "t", "don't"], ["wasn", "t", "wasn't"],
    ["hasn", "t", "hasn't"], ["can", "t", "can't"], ["didn", "t", "didn't"],
    ["couldn", "t", "couldn't"], ["wouldn", "t", "wouldn't"], ["isn", "t", "isn't"],
    ["aren", "t", "aren't"], ["we", "re", "we're"], ["you", "re", "you're"],
    ["what", "s", "what's"], ["there", "s", "there's"], ["who", "s", "who's"],
    ["let", "s", "let's"]
  ];
  const RULE_ACRONYMS = ["atm", "cibil", "pan", "ufc", "usa", "uk", "fbi", "cia", "kyc", "gst", "ai", "tts", "asr"];
  const RULE_NUMBER_WORDS = [
    [/\bzero\b/gi, "0"], [/\b(?<!no\s)(?<!some\s)(?<!any\s)one\b/gi, "1"], [/\btwo\b/gi, "2"],
    [/\bthree\b/gi, "3"], [/\bfour\b/gi, "4"], [/\bfive\b/gi, "5"], [/\bsix\b/gi, "6"],
    [/\bseven\b/gi, "7"], [/\beight\b/gi, "8"], [/\bnine\b/gi, "9"], [/\bten\b/gi, "10"],
    [/\beleven\b/gi, "11"], [/\btwelve\b/gi, "12"], [/\bthirteen\b/gi, "13"],
    [/\bfourteen\b/gi, "14"], [/\bfifteen\b/gi, "15"], [/\bsixteen\b/gi, "16"],
    [/\bseventeen\b/gi, "17"], [/\beighteen\b/gi, "18"], [/\bnineteen\b/gi, "19"],
    [/\btwenty\b/gi, "20"], [/\bthirty\b/gi, "30"], [/\bforty\b/gi, "40"],
    [/\bfifty\b/gi, "50"], [/\bsixty\b/gi, "60"], [/\bseventy\b/gi, "70"],
    [/\beighty\b/gi, "80"], [/\bninety\b/gi, "90"], [/\bhundred\b/gi, "100"]
  ];
  const RULE_ORDINALS = [
    [/\bfirst\b/gi, "1st"], [/\bsecond\b/gi, "2nd"], [/\bthird\b/gi, "3rd"],
    [/\bfourth\b/gi, "4th"], [/\bfifth\b/gi, "5th"], [/\bsixth\b/gi, "6th"],
    [/\bseventh\b/gi, "7th"], [/\beighth\b/gi, "8th"], [/\bninth\b/gi, "9th"],
    [/\btenth\b/gi, "10th"]
  ];

  function runRuleCheck() {
    const ta = getCorrectedTextarea();
    const box = document.getElementById("tts-ai-rulecheck-box");
    if (!ta || !box) return;
    const text = ta.value;
    const checks = [];

    checks.push({
      label: "Style span present (<|style_open|>…<|style_close|>)",
      pass: /<\|style_open\|>[a-z_]+<\|style_body\|>[\s\S]*<\|style_close\|>/.test(text),
      fix: "span"
    });

    checks.push({
      label: "No forbidden <|breath|> tag (use <|inhale|>/<|exhale|> only when clearly audible)",
      pass: !/<\|breath\|>/i.test(text),
      fix: "breath"
    });

    const numHit = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|first|second|third)\b/i.exec(text);
    checks.push({
      label: numHit ? `Number written as a word: "${numHit[0]}" — must be digits` : "Numbers in digit form",
      pass: !numHit,
      fix: "digits"
    });

    const badAcro = RULE_ACRONYMS.filter((a) => {
      const anyCase = new RegExp(`\\b${a}\\b`, "i").test(text);
      const upperCase = new RegExp(`\\b${a.toUpperCase()}\\b`).test(text);
      return anyCase && !upperCase;
    });
    checks.push({
      label: badAcro.length ? `Acronyms not UPPERCASE: ${badAcro.map((a) => a.toUpperCase()).join(", ")}` : "Acronyms UPPERCASE",
      pass: !badAcro.length,
      fix: "acronyms"
    });

    const brokenContraction = RULE_CONTRACTIONS.some(([a, b]) => new RegExp(`\\b${a}\\s+${b}\\b`, "i").test(text));
    checks.push({
      label: brokenContraction ? "Broken ASR contraction found (e.g. 'doesn t')" : "No broken contractions",
      pass: !brokenContraction,
      fix: "contractions"
    });

    const lowI = /\bi\b/.test(text); // no case flags → matches lowercase i only
    checks.push({ label: lowI ? "Lowercase 'i' found" : "Isolated 'I' capitalized", pass: !lowI, fix: "i" });

    renderRuleCheck(checks);
  }

  function renderRuleCheck(checks) {
    const box = document.getElementById("tts-ai-rulecheck-box");
    if (!box) return;
    box.style.display = "";
    const allPass = checks.every((c) => c.pass);
    const rows = checks.map((c) =>
      `<div class="tts-ai-rc-item ${c.pass ? "pass" : "fail"}">${c.pass ? "✓" : "✗"} ${c.label}${!c.pass && c.fix ? ` <button type="button" class="tts-ai-rc-fix" data-fix="${c.fix}">Fix</button>` : ""}</div>`
    ).join("");
    box.innerHTML = `<div class="tts-ai-rc-head">${allPass ? "✅ All Training Guide rules pass" : "⚠️ Rule Check (Training Guide)"}<button type="button" id="tts-ai-rc-close" title="Close">×</button></div>${rows}`;
    box.querySelector("#tts-ai-rc-close").addEventListener("click", () => { box.style.display = "none"; });
    box.querySelectorAll(".tts-ai-rc-fix").forEach((btn) => {
      btn.addEventListener("click", () => {
        const ta = getCorrectedTextarea();
        if (!ta) return;
        applySafeFixes(ta, btn.dataset.fix);
        runRuleCheck();
      });
    });
  }

  function applySafeFixes(ta, fix) {
    let text = ta.value;
    if (fix === "contractions") RULE_CONTRACTIONS.forEach(([a, b, full]) => { text = text.replace(new RegExp(`\\b${a}\\s+${b}\\b`, "gi"), full); });
    if (fix === "i") text = text.replace(/\bi\b/g, "I");
    if (fix === "acronyms") RULE_ACRONYMS.forEach((a) => { text = text.replace(new RegExp(`\\b${a}\\b`, "gi"), a.toUpperCase()); });
    if (fix === "digits") {
      RULE_NUMBER_WORDS.forEach(([re, d]) => { text = text.replace(re, d); });
      RULE_ORDINALS.forEach(([re, o]) => { text = text.replace(re, o); });
    }
    if (fix === "breath") text = text.replace(/<\|breath\|>\s*/gi, "");
    if (fix === "span") {
      const emotion = normalizeEmotion(currentAnalysis?.emotion) || "thoughtful";
      const m = text.match(/<\|style_open\|>[a-z_]+<\|style_body\|>([\s\S]*?)<\|style_close\|>/i);
      if (m) {
        text = `<|style_open|>${emotion}<|style_body|>${m[1]}<|style_close|>`;
      } else {
        const bare = text.replace(/<\|style_open\|>[a-z_]*/gi, "").replace(/<\|style_body\|>/gi, "").replace(/<\|style_close\|>/gi, "").trim();
        text = `<|style_open|>${emotion}<|style_body|>${bare}<|style_close|>`;
      }
    }
    updateTextareaValue(ta, text);
    showStatus("Applied safe fix.", "active");
  }

  // --- Automatic Clip Change Observer ---
  function observeClipChanges() {
    const checkClip = () => {
      const meta = getClipMetadata();
      const currentId = meta.clipId + "::" + meta.audioSrc;
      if (lastClipIdentifier && currentId !== lastClipIdentifier) {
        lastClipIdentifier = currentId;
        console.log("[TTS AI Reviewer] New clip detected:", currentId);

        // Check if auto-run on next is enabled
        const autoRunPref = document.getElementById("tts-ai-pref-autorun")?.checked;
        if (autoRunPref) {
          setTimeout(() => runAutoReview(), 500);
        }
      } else {
        lastClipIdentifier = currentId;
      }
    };

    setInterval(checkClip, 1200);
  }

  // --- Listen to Background Messages (Keyboard shortcuts) ---
  function listenToBackgroundMessages() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "TRIGGER_AUTO_REVIEW") {
        runAutoReview();
        sendResponse({ received: true });
      } else if (request.action === "TOGGLE_PLAYBACK") {
        const audio = getAudioElement();
        if (audio) {
          if (audio.paused) audio.play().catch(() => {});
          else audio.pause();
        }
        sendResponse({ received: true });
      } else if (request.action === "TOGGLE_STEALTH") {
        toggleStealth();
        sendResponse({ received: true });
      } else if (request.action === "PANEL_PING") {
        // Used by the popup's Panel Status card to diagnose the tab.
        sendResponse({
          alive: !!document.getElementById("tts-ai-copilot-panel"),
          stealth: isStealthOn(),
          url: location.href
        });
      } else if (request.action === "SHOW_PANEL") {
        // One-click fix from the popup: force the panel visible.
        applyStealth(false);
        const panel = document.getElementById("tts-ai-copilot-panel");
        if (panel) {
          panel.classList.remove("minimized");
          if (document.body && !panel.isConnected) document.body.appendChild(panel);
        }
        sendResponse({
          alive: !!document.getElementById("tts-ai-copilot-panel"),
          stealth: false
        });
      }
    });
  }

  // --- Stealth mode: hide every trace of the extension from the page ---
  // For screen sharing / presenting. When on, the floating panel, the inline
  // bar, and any open modals are set to display:none so nothing shows on a
  // shared screen. Toggle with Alt+H. State persists across reloads.
  const STEALTH_KEY = "ttsStealthOn";

  function applyStealth(on) {
    // data attribute drives a CSS rule that hides all extension nodes at once,
    // including UI injected later while stealth is active.
    document.documentElement.setAttribute("data-tts-stealth", on ? "1" : "0");
    try { localStorage.setItem(STEALTH_KEY, on ? "1" : "0"); } catch (_) {}
  }

  function isStealthOn() {
    try { return localStorage.getItem(STEALTH_KEY) === "1"; } catch (_) { return false; }
  }

  function toggleStealth() {
    applyStealth(!isStealthOn());
  }

  // Start initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
