# TTS Review AI Auto-Validator & Emotion Tagger (Chrome Extension) — v1.3.1

A Google Chrome (Manifest V3) extension that automates audio-transcript review for the **TTS Audio Review** workflow on `https://tts-review.sabi.com/`. It listens to the audio clip with a multimodal AI model, cleans up the ASR transcript verbatim, inserts point-in-time non-speech event tags, and wraps the result in the correct **19-emotion style span** — directly inside the portal's *Corrected Transcript* box.

It supports **six AI providers** (Google Gemini, NVIDIA NIM, OpenAI, Groq, OpenRouter, and any custom OpenAI-compatible endpoint), and falls back to a fully **offline rule-based engine** when no API key is configured (or when **Force Offline Mode** is on), so it is always usable.

This README is a **complete guide**: what it does, how it works, step-by-step install/config/use, an end-to-end test plan with exact expected outputs, and full reference sections.

> **Scope note:** This is a browser extension. Its runtime is Chrome — there is no build step, server, or package to install. The `.py` scripts in the repo are one-off asset generators (icons and the placeholder WAV) and are **not** required to run the extension; the assets they produce are already committed.

---

## Table of Contents

- [What it does](#1-what-it-does)
- [Features](#2-features)
- [How it works (architecture)](#3-how-it-works-architecture)
- [Repository layout](#4-repository-layout)
- [Installation](#5-installation)
- [Configuration (API keys & providers)](#6-configuration-api-keys--providers)
- [How to use on the portal](#7-how-to-use-on-the-portal)
- [Panel controls reference](#8-panel-controls-reference)
- [Keyboard shortcuts](#9-keyboard-shortcuts)
- [How to test — end to end](#10-how-to-test--end-to-end-clear-guide)
- [The 19 emotions & 20 event tags](#11-the-19-emotions--20-event-tags)
- [Transcription rules enforced](#12-transcription-rules-enforced)
- [Privacy & permissions](#13-privacy--permissions)
- [Troubleshooting](#14-troubleshooting)
- [Developer notes & regenerating assets](#15-developer-notes--regenerating-assets)
- [Verification status](#16-verification-status)
- [Changelog](#17-changelog)

---

## 1. What it does

When you are reviewing an audio clip on the portal, one click (or `Alt+A`) will:

1. Fetch the audio clip loaded on the page and read the on-page *Original Transcript*.
2. Send both to your chosen AI provider, which listens to the speaker's tone, pace, pitch, and pauses.
3. Return a cleaned transcript with correct casing, digits, and punctuation, with non-speech event tags inserted at the right moments.
4. Pick the best-fitting label from the **19 standard emotions** (with a confidence score and runner-up suggestion) and wrap everything in the required span:

   ```text
   <|style_open|>thoughtful<|style_body|>For a 10 dollar pass, Verizon will pick this up here.<|style_close|>
   ```

5. Write that value straight into the *Corrected Transcript* textarea using framework-safe setters (works with React/Vue-managed inputs), and show the reasoning in the floating **Copilot** panel.

---

## 2. Features

**Portal integration**

- Injects a **✨ AI Auto-Validate** button directly above the *Corrected Transcript* textarea (plus ▶/⏸) — re-attached automatically if the portal's SPA mounts the textarea late or removes it.
- Adds a floating, **draggable** *TTS Review Copilot* panel to the page. Grab its header to move it anywhere; the position is remembered across reloads. The panel **self-heals**: if the site's framework wipes it from the DOM, it re-attaches automatically.
- Writes into the portal's *Corrected Transcript* box using native property setters plus `input`/`change` events, so React/Vue state management registers the change immediately.
- **Auto-detects new clips**: a watcher polls the clip title and audio source every 1.2 s and can auto-run the review when you move to the next clip (optional toggle).

**Multimodal audio AI (6 providers)**

| Provider | Audio listening | Notes |
| :--- | :--- | :--- |
| 🟩 **NVIDIA NIM** (build.nvidia.com) | No (text-only) | Strong LLMs — Nemotron 3 Super 120B recommended; free `nvapi-` key |
| 🔷 **Google Gemini** (default) | **Yes — native audio** | Best emotion detection. Models: 3.8 Flash, Flash Lite, 3.5 Flash Lite, Flash (latest) |
| 🟢 **OpenAI** | **Yes — native audio** | `gpt-4o-audio-preview`, plus GPT-4o / 4o-mini / 4.1-mini |
| ⚡ **Groq** | Yes, via transcription | **Whisper Large v3** → Llama 3.3 / 3.1 / Gemma 2 / Mixtral |
| 🌐 **OpenRouter** | No | One key routes to 300+ models |
| 🔧 **Custom / local** | No | Any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, LocalAI) |

**Resilience**

- **Offline / heuristic mode** — with no API key (or **Force Offline Mode** enabled in the popup), a local rule engine still fixes contractions, casing, numbers-to-digits, ordinals, acronyms, common proper nouns, and punctuation, and wraps the text in a default `thoughtful` span.
- **Gemini retry & error handling** — retries transient `503` (overloaded) with escalating backoff; turns `429` quota errors into a clear, actionable message; auto-remaps retired Gemini model IDs to the current default so saved settings never point at a dead model.
- **NVIDIA key/model errors surfaced clearly** — invalid key (401) and end-of-life model IDs (410) produce specific, fixable messages.

**Reviewer productivity**

- **✅ Rule Check** — one click lints the transcript against the Training Guide (missing style span, forbidden `<|breath|>`, word-numbers, lowercase acronyms, broken contractions, lowercase `i`) with one-click **Fix** buttons.
- **Emotion confidence + runner-up** — the AI reports `high/medium/low` confidence and a second-best emotion, shown with a "Try '…'" button.
- **19-emotion quick selector** — click any emotion to instantly re-wrap the current text with that style label.
- **Insert event at cursor** — click any of the 20 event tags (`laugh`, `sigh`, `um`, `inhale`, …) to drop it exactly where your caret is.
- **Load Original** — copy the page's Original Transcript into the Corrected box verbatim.
- **Toggle Style Wrap** — switch the box between the full style span and clean text.
- **19-Emotion Training Guide** — a searchable in-page reference with each emotion's definition, acoustic cues, lookalikes, **and reference sample clips from the official Taxonomy sheet**; "Apply This Style" applies it in one click.
- **Playback speed** (0.5×–2×, remembered), **📋 Copy** button, and a **Clips: N** counter.
- **Style Span Mode / Auto-Run on Next / Auto-Play / Force Offline Mode** preference toggles, saved to Chrome sync storage.

**Stealth mode**

- `Alt+H` (or the 🙈 button) instantly hides **all** extension UI — the panel, the inline bar, and any open modals — for clean screen sharing. State persists across reloads, and UI injected while stealth is on stays hidden too.

**Popup control center**

- Toolbar popup with six provider tabs, per-provider API key + model selection, show/hide key toggle, a **Test Connection** button, automation preferences, and a live status pill (active provider, or "Heuristics" / "Heuristics (offline)").
- **Key-format hints** — detects the key prefix (`nvapi-`, `AQ.`/`AIzaSy`, `sk-`, `gsk_`, `sk-or-`) and warns if you paste a key into the wrong provider tab (the #1 cause of "invalid API key" errors).
- **Panel Status (current tab)** — live per-tab diagnosis (`✓ panel active` / `🙈 stealth on` / `✗ not connected` / `○ not a supported page`) with a one-click **🩹 Show panel / fix injection** button.

---

## 3. How it works (architecture)

The extension has three coordinated parts that communicate via `chrome.runtime` messaging:

| Component | File | Role |
| :--- | :--- | :--- |
| **Content script** | `content/content.js` (+ `content/content.css`) | Injected into portal/localhost pages. Builds the floating Copilot UI + inline bar, locates the audio element / transcript / textarea, fetches the audio, and applies AI results back into the page. |
| **Service worker** | `background/background.js` | Central AI router for 6 providers. Holds the system prompt, calls the selected provider, handles retries/errors, runs the offline heuristic, and answers keyboard-command events. |
| **Popup** | `popup/popup.html` + `popup/popup.js` (+ `popup.css`) | Settings UI, key-format hints, panel diagnostics. Saves provider/keys/models and preferences to `chrome.storage.sync`, and runs connection tests. |

**Message flow**

```text
Popup ──TEST_API_KEY──▶ Background ──▶ provider endpoint (real completion validation)

Content ──ANALYZE_AUDIO {transcript, audioSrc, audioBase64, mimeType}──▶ Background
Background ──▶ chosen provider (or offline heuristic) ──▶ parsed JSON result ──▶ Content ──▶ textarea + Copilot panel
Content ──FETCH_AUDIO_AS_BASE64──▶ Background        (fallback when the page's CORS blocks the fetch)

Keyboard shortcut ──▶ Background (chrome.commands) ──TRIGGER_AUTO_REVIEW / TOGGLE_PLAYBACK / TOGGLE_STEALTH──▶ Content
Popup ──PANEL_PING / SHOW_PANEL──▶ Content           (panel diagnostics + one-click fix)
```

Every provider is asked to return strict JSON with the same shape, which the background parser normalizes (tolerating markdown fences/prose, with an unstructured-text fallback):

```json
{
  "corrected_transcript_clean": "Clean text with casing, digits, punctuation, and event tags",
  "emotion": "one of the 19 labels",
  "emotion_confidence": "high | medium | low",
  "runner_up_emotion": "second-best label or empty",
  "tagged_transcript": "<|style_open|>emotion<|style_body|>…<|style_close|>",
  "review_notes": {
    "text_fixes": "…",
    "event_tags_inserted": ["…"],
    "emotion_and_vocal_cues": "why this emotion, which lookalikes were ruled out"
  }
}
```

---

## 4. Repository layout

```text
TTS-main/
├── manifest.json              # MV3 manifest: permissions, scripts, commands, icons
├── background/
│   └── background.js          # Service worker: AI router, 6 providers, heuristic, retries
├── content/
│   ├── content.js             # Injected Copilot UI, inline bar, page integration, Rule Check
│   └── content.css            # Styles for the floating panel, inline bar, pills, modals
├── popup/
│   ├── popup.html             # Toolbar settings UI + Panel Status card
│   ├── popup.js               # Settings load/save, key hints, panel diagnostics
│   └── popup.css              # Popup styling
├── icons/
│   ├── icon16.png / icon48.png / icon128.png
├── test-portal/               # Offline simulator of the real portal
│   ├── index.html             # 3-clip review page mirroring tts-review.sabi.com
│   ├── style.css
│   └── sample.wav             # Synthesized placeholder audio
├── reference/                 # Training Guide PDFs + taxonomy sheet + older README snapshot
├── tests/
│   └── run-tests.mjs          # 35-check offline suite for the background logic
├── generate_icons.py          # (dev) regenerate the toolbar icons — needs Pillow
├── generate_sample_wav.py     # (dev) regenerate the placeholder WAV — stdlib only
└── README.md
```

---

## 5. Installation

This is an unpacked developer extension — no build, no `npm install`.

1. Download or clone this repository to a folder on your computer. Note the folder that **contains `manifest.json`** (the top-level folder).
2. Open Google Chrome and go to:
   ```text
   chrome://extensions
   ```
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** (top-left).
5. In the picker, select the folder that contains `manifest.json`.
6. The card **"TTS Review AI Auto-Validator & Emotion Tagger" 1.3.1** appears with no errors. Pin it to the toolbar for quick access.

> Works in Chrome and other Chromium browsers that support Manifest V3 (Edge, Brave, etc.). After editing any source file, return to `chrome://extensions` and click the extension's **Reload** ↻ button, then refresh the portal tab.

---

## 6. Configuration (API keys & providers)

You can configure the extension from **either** the toolbar popup **or** the ⚙️ gear on the in-page Copilot panel (the gear is a Gemini quick-config; the popup exposes all six providers).

**From the popup (full control):**

1. Click the extension icon 🎙️ in the toolbar.
2. Pick a provider tab: **Gemini / NVIDIA / OpenAI / Groq / OpenRouter / Custom**.
3. Paste the API key for that provider and choose a model. (Use the 👁️ button to reveal the key while typing. If the key's prefix doesn't match the open tab, an orange warning tells you which tab it belongs to.)
4. Click **🔌 Test Connection** → you should see **✓ Connected!**
5. Click **Save Settings**. The status pill shows the active provider.

**Where to get a key**

| Provider | Get a key | Notes |
| :--- | :--- | :--- |
| **Gemini** (best emotion detection) | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | Free tier. Native audio analysis. Supports new `AQ.…` keys and legacy `AIzaSy…` keys. |
| **NVIDIA NIM** | [build.nvidia.com](https://build.nvidia.com/) → API Keys | Free key, starts with `nvapi-`. Text-only. |
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Use `gpt-4o-audio-preview` for native audio input. |
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | Free & very fast; audio auto-transcribed via Whisper Large v3. |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | One key → 300+ models. |
| **Custom / local** | — | Point Base URL at Ollama/LM Studio/vLLM (e.g. `http://localhost:11434/v1`); API key optional. |

> **No key?** The extension automatically runs its **offline heuristic** engine instead — you still get contraction repair, digit/ordinal conversion, acronym/proper-noun casing, punctuation, and a default `thoughtful` style wrap. You can also enable **Force Offline Mode** in the popup to skip AI providers deliberately (no quota used) — the status pill then shows **Heuristics (offline)**.

---

## 7. How to use on the portal

1. Log in to **https://tts-review.sabi.com/** and open the **Review** tab so a clip and its transcript are on screen. The Copilot panel (and the inline ✨ bar above the transcript box) appears on **every** portal page, including the login screen.
2. Click **✨ AI Auto-Validate** above the Corrected Transcript box, or **✨ AI Auto-Review & Tag** in the Copilot panel — or press **`Alt+A`**.
3. The extension fetches the audio, analyzes it, and fills the *Corrected Transcript* box with the tagged output. The status line names the provider and emotion, e.g. `✓ Validated by NVIDIA NIM (…) (anger)`.
4. Review the results in the Copilot panel:
   - **Validation Insights** — chosen emotion, vocal cues, and which lookalike emotions were ruled out.
   - **Confidence** — 🟢/🟡/🟠 score with a one-click runner-up suggestion.
   - **Contractions & Verbatim Fixes** — what casing/number/contraction changes were made.
   - **Output Preview** — the exact string written to the box.
5. Verify with **✅ Rule Check** (section 8), adjust if needed:
   - Click a different **emotion pill** to re-wrap with another style.
   - Put your caret where you want and click an **event tag** (`laugh`, `inhale`, `um`, …) to insert it.
   - Use **Toggle Style Wrap** to strip/re-add the span, or **Load Original** to reset from the page transcript.
6. Submit/save the review on the portal. The **Clips: N** counter increments on every successful review.

Turn on **Auto-Run on Next Clip** to have the review fire automatically each time a new clip loads, and **Auto-Play** to start playback when analysis finishes.

---

## 8. Panel controls reference

| Control | What it does | Output you'll see |
| :--- | :--- | :--- |
| ✨ **AI Auto-Validate** (inline bar) | Same review, from the button above the transcript box | Button shows `⏳ Analyzing Audio...` while working |
| ✨ **AI Auto-Review & Tag** | Full AI validation of the current clip | Fills the transcript box; green status names the provider + emotion |
| ▶ / ⏸ | Play or pause the clip | — |
| ⬇ **Load Original** | Copy the system transcript into the Corrected box verbatim | `Loaded the Original Transcript into the box.` |
| **Toggle Style Wrap** | Switch between emotion-span text and plain text | `Unwrapped: Clean text mode` / `Wrapped with 'thoughtful' style` |
| ✅ **Rule Check** | Lint the text against the Training Guide rules | `✅ All Training Guide rules pass` or per-rule ✗ list with **Fix** buttons |
| 📋 **Copy** | Copy the final transcript to the clipboard | `Transcript copied to clipboard.` |
| **Emotion pills (19)** | Rewrap the whole text in that emotion's span | `Emotion updated to '<emotion>'` |
| **Event tag pills (20)** | Insert `<\|tag\|>` at the cursor position | Tag appears in the text at the cursor |
| 📖 (header) | Emotion training guide with definitions, cues, lookalikes **and reference sample clips** | Opens a searchable modal; each card has **Apply This Style** |
| ⚙️ (header) | Quick Gemini settings (key + model) | `API Settings saved successfully!` |
| 🙈 (header) / `Alt + H` | Stealth: hide all extension UI for screen sharing | Everything disappears; press `Alt + H` to restore |
| 🔊 speed dropdown | Playback speed 0.5×–2× (remembered) | `Playback speed: 1.5×` |
| **Style Span Mode / Auto-Run on Next / Auto-Play** | Preference toggles | Saved per Chrome profile |

---

## 9. Keyboard shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Alt + A`** | Run AI Auto-Review & tag the current clip |
| **`Alt + P`** | Play / pause the audio clip |
| **`Alt + H`** | Stealth mode — hide/show all extension UI (for screen sharing) |

Shortcuts are declared in `manifest.json` under `commands`. You can remap them at `chrome://extensions/shortcuts`.

---

## 10. How to test — end to end (clear guide)

Run these five tests in order. Each one has the exact expected output.

### Test A — Automated logic tests (no browser needed)

1. In a terminal:
   ```bash
   cd <repo folder>
   node tests/run-tests.mjs
   ```
2. **Expected:** the last line is `35 passed, 0 failed` — covering model remapping, emotion-label normalization, all heuristic rules, JSON/fence parsing, Gemini error messaging, NVIDIA config, and provider routing (offline mode + missing-key fallback).

### Test B — Is the panel showing on the page? (the #1 check)

The floating panel and inline bar must appear on **every** `tts-review.sabi.com` page — including the login screen.

1. Open **https://tts-review.sabi.com/** and **press F5** (refresh).
   > Content scripts only inject when a page *loads*. If you installed or reloaded the extension while the tab was already open, the old tab knows nothing about it — refreshing always fixes that. This is the most common cause of "the panel is not showing".
2. Look at the page: the **TTS Review Copilot** panel should be visible (bottom-right by default), and the ✨ bar should sit above the Corrected Transcript box when a review screen is loaded.
3. Open the extension popup and read the **Panel Status (current tab)** card:

   | Card says | Meaning | Fix |
   | :--- | :--- | :--- |
   | `✓ Copilot panel is active on this tab…` | Everything works | Nothing — go to Test C |
   | `🙈 Stealth mode is ON…` | `Alt + H` was pressed earlier; stealth **stays on across page loads** | Press `Alt + H` on the page, or click **🩹 Show panel / fix injection** |
   | `✗ Extension is not connected to this tab…` | Tab loaded before the extension (stale tab) | Refresh the page (F5), reopen the popup |
   | `✗ Panel is missing on this tab…` | The site's framework removed the panel (v1.2.0+ auto-re-attaches it) | Click **🩹 Show panel / fix injection** |
   | `○ Not a supported page…` | You're on some other website | Open tts-review.sabi.com or the localhost simulator |

4. **Expected:** green `✓ Copilot panel is active on this tab.`

### Test C — Provider connection

1. Popup → 🟩 **NVIDIA** tab → **🔌 Test Connection**.
2. **Expected:** `✓ Connected!` next to the button. Any ✗ message is explained in section 14.

### Test D — Offline simulator (safe practice run)

1. In a terminal:
   ```bash
   cd <repo folder>\test-portal
   python -m http.server 8080
   ```
2. Open **http://localhost:8080/** in Chrome. You'll see the dark **TTS Review** simulator with a sample clip (`Clip: ZyG8FSeTFKA_speaker_0_1340`) and the original transcript *"for a ten dollar pass verizon will pick this up here"*.
3. Confirm the Copilot panel is visible (popup Panel Status should also say ✓). Click **✨ AI Auto-Validate** above the Corrected Transcript box (or **✨ AI Auto-Review & Tag** in the panel).
4. **Expected:** the Corrected Transcript fills with:
   ```text
   <|style_open|>thoughtful<|style_body|>For a 10 dollar pass, Verizon will pick this up here.<|style_close|>
   ```
   (`thoughtful` is the offline default; with an AI key configured you get a real detected emotion.) The status line shows `✓ Validated by …` or `✓ Rule-based cleaned …`, and **Clips: 1** appears in the footer.
5. Click **✅ Rule Check** → **Expected:** `✅ All Training Guide rules pass`.
6. Click an emotion pill (e.g. `joyful`) → the span re-wraps. Click **📋 Copy** → paste anywhere to verify.
7. Press **`Alt + H`** → all extension UI vanishes. Press **`Alt + H`** again → it returns.
8. Use **Next →** for the other 2 sample clips (contraction and proper-noun scenarios).

> ⚠️ **Must be `http://localhost`** — Chrome does not inject content scripts into `file://` pages, so opening `index.html` directly shows the simulator **without** the panel. Check the address bar starts with `http://localhost`.
>
> ℹ️ The bundled `sample.wav` is a synthesized tone, so AI emotion results on the simulator are illustrative only.

### Test E — Live on the portal

1. Log in at **https://tts-review.sabi.com/** and open the **Review** tab.
2. Panel status line reads `Ready to validate current clip.`
3. Run the review (`Alt + A`). Status → `Fetching audio & analyzing voice with AI…`, then the box fills and the status names your provider and emotion.
4. Run **✅ Rule Check**, adjust the emotion if needed, then submit with the portal's own **Accept as Corrected** / **Reject** button. The **Clips** counter increments on every successful AI review.

---

## 11. The 19 emotions & 20 event tags

**19 emotion labels** — exact spellings from the official Training Guide / portal chips, used in `<|style_open|>label<|style_body|>…<|style_close|>`:

`anger`, `annoyed`, `awe`, `curious`, `excited`, `fearful`, `flirty`, `joyful`, `loud`, `menacing`, `mischievous`, `nervous`, `sad`, `sarcastic`, `smug`, `surprised`, `tender`, `thoughtful`, `whisper`

> Legacy labels `angry`, `mischievously`, `whispers` are accepted anywhere (input, saved settings, AI output) and auto-mapped to the canonical spellings.

The in-page **📖 Training Guide** gives each label a definition, the acoustic cues to listen for, the lookalike emotions to avoid confusing it with, and **reference sample clips** from the Taxonomy sheet (searchable, with **Apply This Style**).

**20 non-speech event tags** (inserted inline at the caret):

`<|laugh|>`, `<|chuckle|>`, `<|giggle|>`, `<|sigh|>`, `<|sniff|>`, `<|cough|>`, `<|throat_clear|>`, `<|lip_smack|>`, `<|gulp|>`, `<|gasp|>`, `<|yawn|>`, `<|snort|>`, `<|cry|>`, `<|woo|>`, `<|hum_tune|>`, `<|tsk|>`, `<|um|>`, `<|uh|>`, `<|inhale|>`, `<|exhale|>`

> There is deliberately **no** `<|breath|>` tag — see the breathing rule below.

---

## 12. Transcription rules enforced

Both the AI system prompt and the offline heuristic aim to follow these annotation rules:

- **Primary speaker only** — transcribe only the first speaker; ignore background/overlapping talkers.
- **Numbers in digits** — always numeric (`10`, not "ten"; `23`, `101`).
- **Ordinals** — number + suffix (`1st`, `2nd`, `22nd`, `34th`, `98th`).
- **Breathing rule** — never add `<|breath|>`; add `<|inhale|>` / `<|exhale|>` **only** for long, clearly audible breaths (normal breaths are ignored).
- **Hum tone** — tag "hmm" / "hmm-hmm" sounds with `<|hum_tune|>`.
- **Letter-by-letter** — keep space-separated (`h e a t`).
- **Acronyms** — UPPERCASE (`ATM`, `CIBIL`, `PAN`, `UFC`, `USA`, …).
- **Proper nouns** — Title/Sentence case (`Verizon`, `Los Angeles`, `Kyiv Independent`, `Montreal Protocol`).
- **Verbatim preservation** — keep stutters, repeats, misspeaks, and ungrammatical phrasing exactly as spoken (`I think I think`, `d de decide`).
- **Contraction repair** — fix broken ASR contractions (`doesn t`→`doesn't`, `it s`→`it's`, `i m`→`I'm`, `they re`→`they're`, `won t`→`won't`, …) and capitalize sentence starts and isolated "I".

> The **offline heuristic** covers a fixed dictionary of contractions, number words, ordinals, acronyms, and common brand proper nouns. Full audio-driven emotion selection and context-aware proper-noun casing require an AI provider with a configured key.

---

## 13. Privacy & permissions

- **What is sent where:** when you run a review, the audio clip and the transcript are sent **only** to the AI provider you selected (Gemini / NVIDIA NIM / OpenAI / Groq / OpenRouter, or your own custom endpoint). Nothing is sent to any third party otherwise.
- **API keys** are stored in `chrome.storage.sync` (synced to your Chrome profile) and are sent only to the matching provider. The Gemini key is sent via the `x-goog-api-key` header (not the URL) to avoid leaking it in logs.
- **Permissions requested** (`manifest.json`): `storage` (save settings), `activeTab`, and host access to the portal (`tts-review.sabi.com`, `*.sabi.com`), the local simulator (`localhost`, `127.0.0.1`), and the AI provider API domains (`generativelanguage.googleapis.com`, `integrate.api.nvidia.com`, `api.openai.com`, `api.groq.com`, `api.anthropic.com`, `openrouter.ai`). There is **no** `<all_urls>` permission — the extension cannot act on arbitrary sites.

---

## 14. Troubleshooting

| Symptom | Likely cause / fix |
| :--- | :--- |
| Panel shows "Rule-based cleaned" instead of AI | No API key saved for the active provider, or **Force Offline Mode** is on → add a key in the popup or turn the toggle off. |
| `✗ NVIDIA: invalid API key (401)` | Key pasted in the wrong provider tab, not an NVIDIA key, or revoked → use the 🟩 **NVIDIA** tab; the popup's orange key-hint warning catches this before saving. |
| Orange **"That looks like a … key"** warning | Key prefix doesn't match the open tab → switch to the suggested tab. |
| `429` / "Free-tier quota reached" (Gemini) | Daily free limit hit. Wait the suggested time, switch to a **Lite** model, or enable billing. |
| `503` / "Gemini is temporarily overloaded" | Transient capacity issue — the extension already retries; try again in a moment. |
| `NVIDIA: model unavailable (end-of-life or not found)` | Chosen model was retired → pick another model in the NVIDIA dropdown. |
| "No audio element or transcript found" | The page hadn't finished loading the clip — reload the clip and retry. |
| Retired Gemini model error | Saved model was sunset; the extension auto-remaps to the current default — just re-save settings. |
| Panel / inline bar missing on the page | Run **Test B in section 10**: refresh the tab (stale), press `Alt + H` (stealth persists!), or use the popup's **🩹 Show panel / fix injection**. Since v1.2.0 the panel self-heals; since v1.3.0 the inline bar does too. |
| `Could not establish connection. Receiving end does not exist.` | A shortcut was pressed on a tab without the panel — harmless, and silenced since v1.2.1. |
| Text goes into the box but the portal "doesn't see it" | Rare with framework inputs; try **Toggle Style Wrap** or edit one character so the portal re-reads the field. |
| Emotion label looks different (`anger` vs `angry`) | v1.1.0+ uses the Training Guide's exact spellings — old labels are auto-mapped on save/output. |

---

## 15. Developer notes & regenerating assets

- **No build system.** Edit files and hit **Reload** on `chrome://extensions`, then refresh the tab.
- **Icons** — `generate_icons.py` regenerates `icons/icon16|48|128.png`. Requires Pillow (`pip install Pillow`). It writes to the `icons/` folder **next to the script** (path-independent since v1.3.1).
- **Sample audio** — `generate_sample_wav.py` regenerates `test-portal/sample.wav` using only the Python standard library, writing next to the script.
- **Tests** — `node tests/run-tests.mjs` (35 checks). Extend it when you change the background logic.

---

## 16. Verification status

Verified by static analysis, a 35-check offline test suite, and end-to-end logic tracing:

- **Manifest (MV3)** is well-formed (v1.3.1); every referenced file exists (service worker, content script + CSS, popup, all three icons); there is **no** `<all_urls>` permission.
- **Messaging is consistent** — every action name sent (`ANALYZE_AUDIO`, `TEST_API_KEY`, `FETCH_AUDIO_AS_BASE64`, `TRIGGER_AUTO_REVIEW`, `TOGGLE_PLAYBACK`, `TOGGLE_STEALTH`, `PANEL_PING`, `SHOW_PANEL`) has a matching listener.
- **Storage keys** written by the popup match those read by the background worker and content script (including `offlineMode`, now user-controllable via **Force Offline Mode**).
- **Taxonomy is aligned** — 19 canonical emotion labels across the content script, the system prompt, the training-guide reference, and the test portal; 20 event tags in the extension.
- **Provider routing tested** — forced offline mode overrides a configured key and routes to the heuristic; a missing key falls back to the heuristic; Gemini retry/backoff plus quota-error messaging behave as designed.
- **Offline heuristic traced** against the three bundled sample transcripts produces the expected results (e.g. `for a ten dollar pass verizon…` → `For a 10 dollar pass, Verizon will pick this up here.`).
- **Automated suite:** `node tests/run-tests.mjs` → `35 passed, 0 failed`.

Because this is a Chrome extension, **live** end-to-end testing must be done by loading it in Chrome — follow **Tests B–E** in section 10 to exercise it interactively.

---

## 17. Changelog

### 1.3.1
- **Force Offline Mode** — new popup toggle that skips AI providers and uses the local heuristic engine (no API quota); the status pill shows "Heuristics (offline)". Makes the previously dead `offlineMode` storage key user-controllable, verified by new provider-routing tests.
- **Asset scripts fixed** — `generate_icons.py` / `generate_sample_wav.py` now write next to the script instead of the original author's hard-coded path.
- **README expanded & corrected** — merged the architecture, privacy & permissions, developer-notes, and verification-status documentation; fixed outdated claims (provider count, `<all_urls>`, emotion labels, `file://` simulator note, JSON result shape).

### 1.3.0
- **Inline quick-bar implemented**: the ✨ AI Auto-Validate button (plus ▶/⏸) is now genuinely injected directly above the Corrected Transcript textarea — earlier versions only advertised it. Re-attaches automatically if the portal's SPA moves or removes it.

### 1.2.1
- Fixed the benign `Could not establish connection. Receiving end does not exist.` error from keyboard shortcuts on tabs without the panel.

### 1.2.0
- **Self-healing panel** (auto re-attach if the site wipes `<body>`), **Panel Status card** in the popup with one-click **🩹 Show panel / fix injection**, end-to-end testing guide.

### 1.1.0
- **NVIDIA NIM provider** with curated live models; **key-format hints**; **✅ Rule Check** linter + fixes; **emotion confidence + runner-up**; **reference sample clips** in the guide; canonical emotion labels (`anger`, `mischievous`, `whisper`); playback speed, copy button, clips counter; removed `<all_urls>`; JSON parsing tolerates fences/prose; heuristic guards (no "no 1", no periods after tags); Groq WAV filename; added `don't`/`wasn't`/`hasn't` repairs.
