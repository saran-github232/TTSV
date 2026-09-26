# TTS Review Copilot — v2.1.0

A professional Chrome (Manifest V3) extension for **https://tts-review.sabi.com/** that automates TTS audio-transcript review: it listens to each clip with AI, produces a verbatim, rule-compliant, emotion-tagged transcript, and hands you a compact, polished in-page workspace to verify and fine-tune everything before you submit.

**v2.1.0 focus:** a fully redesigned floating Copilot panel — slightly larger, sharper typography, a calm navy + indigo design system, smoother animations, and responsive behavior on small screens. Extension-only, simple, and fast.

---

## 1. How to download & extract

1. Go to **https://github.com/saran-github232/TTSV**.
2. Click **Code → Download ZIP**.
3. Right-click `TTSV-main.zip` → **Extract All…** → choose a location.
4. You now have a folder containing `manifest.json` at its top level — that folder *is* the extension.

(Or `git clone https://github.com/saran-github232/TTSV.git`.)

> If Chrome ever refuses to load the folder with *"Cannot load extension with file or directory name `__pycache__`"*, a stray build-artifact folder exists — delete it. v2.1.0+ ships clean.

## 2. How to install & run

1. Open `chrome://extensions` in Chrome (or Edge/Brave).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. The card **"TTS Review AI Auto-Validator & Emotion Tagger" 2.1.0** loads with no errors — pin it to the toolbar.
5. Open **https://tts-review.sabi.com/** → the **TTS Review Copilot** panel appears bottom-right (drag its header anywhere; the position is remembered), and the **✨ AI Auto-Validate** bar appears above the Corrected Transcript box.

> After updating the code: `chrome://extensions` → **Reload** ↻ → refresh the portal tab.

**Setup (2 minutes):** click the extension icon → pick a provider tab → paste your key → **🔌 Test Connection** (`✓ Connected!`) → **Save Settings**. Recommended: **Gemini** (free, [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)) — it natively *listens* to the audio. **NVIDIA NIM** (free, `nvapi-` key from [build.nvidia.com](https://build.nvidia.com/)) and OpenAI / Groq / OpenRouter / Custom (Ollama, LM Studio) are also supported. No key? The offline heuristic engine still cleans transcripts.

## 3. How to use it

1. Open the **Review** tab on the portal so a clip + transcript are loaded.
2. Click **✨ AI Auto-Validate** (above the transcript box) or **AI Auto-Review & Tag** in the panel — or press `Alt + A`. Status shows `Fetching audio & analyzing voice with AI…`, then the box fills with the cleaned, tagged, emotion-wrapped transcript.
3. Check the **Validation Insights**: the emotion with a confidence level, runner-up suggestion, vocal cues, and exactly what was fixed.
4. Fine-tune: click any of the **19 emotion pills** to re-wrap the span; click any of the **20 event pills** (`laugh`, `inhale`, `um`…) to insert at your cursor; run **✅ Rule Check** for a Training-Guide lint with one-click fixes; **📋 Copy** or **⬇ Load Original** / **Toggle Style Wrap** as needed.
5. Submit with the portal's own Accept / Reject button. The **Clips: N** counter tracks your session.

**Keyboard shortcuts:** `Alt + A` run review · `Alt + P` play/pause · `Alt + H` stealth (hide all extension UI — persists until toggled back).

## 4. How the tool behaves

- **Provider routing:** your configured provider is used for every review; with no key (or **Force Offline Mode** on in the popup) the local heuristic engine takes over — contractions, casing, digits, ordinals, acronyms, punctuation, default `thoughtful` span. The tool is never dead.
- **Rules enforced** (from the official Training Guide): numbers as digits, ordinals (`1st/22nd`), acronyms UPPERCASE, proper nouns Title Case, broken contractions repaired, stutters/repeats kept verbatim, letter-by-letter spaced, `hmm` → `<|hum_tune|>`, primary speaker only, and the **breathing rule** — never `<|breath|>`; `<|inhale|>`/`<|exhale|>` only for long, clearly audible breaths.
- **Emotion output:** exactly one span — `<|style_open|>label<|style_body|>…<|style_close|>` — using the guide's exact spellings (`anger`, `mischievous`, `whisper`; legacy labels auto-map).
- **Resilience:** Gemini 503s auto-retry with backoff; 429 quota errors become clear guidance; retired Gemini models auto-remap; panel and inline bar self-heal if the portal's framework re-renders the page.

## 5. The panel at a glance

| Control | What it does |
| :--- | :--- |
| ✨ AI Auto-Review & Tag / ✨ AI Auto-Validate | Full AI review of the current clip |
| ▶/⏸ · 🔊 speed | Playback controls (0.5×–2×) |
| ⬇ Load Original · Toggle Style Wrap · 📋 Copy | Transcript helpers |
| ✅ Rule Check | Training-Guide lint with one-click fixes |
| 19 emotion pills / 20 event pills | Re-wrap the span / insert at cursor |
| 📖 Guide | Searchable emotion reference with official sample clips + Apply This Style |
| ⚙️ Settings | Quick Gemini key/model config |
| 🙈 / `Alt + H` | Stealth mode for screen sharing |
| Clips: N | Session counter |

## 6. How to test

```bash
node tests/run-tests.mjs   # → 35 passed, 0 failed
```

Covers model remapping, emotion normalization, every heuristic rule, JSON/fence parsing, provider routing (offline + missing-key fallback), and error messaging. Then on the portal: load a clip → `Alt + A` → verify the transcript fills and the status names your provider and emotion.

## 7. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| *"Cannot load extension … `__pycache__`"* | A `_`-prefixed artifact folder exists in the extension folder — delete it (fixed/clean since v2.1.0). |
| "Invalid API key (401)" (NVIDIA) | Key must start with `nvapi-` and be pasted in the NVIDIA tab — the popup warns on wrong-tab pastes. |
| Gemini 429 / 503 | Quota: wait or switch to a Lite model. Overload: auto-retried, just retry shortly. |
| Panel/bar missing on the page | Refresh the tab; press `Alt + H` (stealth persists); or use the popup's **Panel Status** card → **🩹 Show panel**. |
| `Receiving end does not exist` | Harmless shortcut-on-wrong-page noise — silenced since v1.2.1. |

## 8. Privacy & permissions

Keys are stored in `chrome.storage.sync` on your profile and sent **only** to the provider you configure. Audio + transcripts go only to that provider. Permissions: `storage`, `activeTab`; hosts: the portal, `localhost`, and the AI APIs — no `<all_urls>`.

## 9. Changelog

### 2.1.0
- **Panel redesign**: professional navy + indigo design system, larger-but-compact 384px panel, refined typography (Inter/Segoe UI Variable), gradient header with subtitle, polished buttons/pills/status animations, custom scrollbar, responsive down to small screens, reduced-motion support.
- **Removed the standalone dashboard app** (v2.0.0 experiment) and all its glue code — the extension is again a single, simple, in-page tool, per feedback.
- Fixed Chrome's *"Cannot load extension with file or directory name `__pycache__`"* by removing the stray artifact folder (and it is git-ignored so it can't return).

### 2.0.0 / 1.3.x / 1.2.x / 1.1.0 / 1.0.0
- 2.0.0: standalone dashboard experiment (superseded by 2.1.0). 1.3.x: inline ✨ quick-bar; Force Offline Mode. 1.2.x: self-healing panel, Panel Status diagnostics. 1.1.0: NVIDIA NIM provider, Rule Check, confidence/runner-up, sample clips, canonical emotion labels, key hints. 1.0.0: initial release.
