# TTS Review AI Auto-Validator & Emotion Tagger (Chrome Extension) — v1.1.0

A Google Chrome Extension for **https://tts-review.sabi.com/** that listens to each audio clip with AI, cleans the transcript to the official Training Guide rules, inserts non-speech event tags, and wraps the text in the correct one of the **19 emotion spans** — then lets you verify everything with one click before submitting.

This README is a **complete step-by-step guide**: every step tells you exactly what to click and **exactly what you should see on screen**.

---

## 1. What this tool does

| Step | What happens |
| :--- | :--- |
| 1 | You open a clip on the review portal. A floating **TTS Review Copilot** panel appears. |
| 2 | You click **✨ AI Auto-Review & Tag** (or press `Alt + A`). |
| 3 | The extension fetches the clip's audio and sends it to your chosen AI provider with the full Training Guide rulebook. |
| 4 | The **Corrected Transcript** box is filled with the cleaned, tagged, emotion-wrapped text. |
| 5 | You check the result (**✅ Rule Check**, confidence, insights), adjust if needed, and submit on the portal. |

Supported AI providers:

| Provider | Listens to audio? | Recommended for |
| :--- | :--- | :--- |
| 🟩 **NVIDIA NIM** | No (text only) | Best cleanup quality per rupee/dollar — free `nvapi-` key |
| 🔷 **Google Gemini** | **Yes — native audio** | Best emotion detection (hears tone, pitch, pace) |
| 🟢 OpenAI (GPT-4o Audio) | **Yes — native audio** | Alternative audio model |
| ⚡ Groq | Yes, via Whisper transcription | Very fast |
| 🌐 OpenRouter | No | Access to 300+ models with one key |
| 🔧 Custom / Local | No | Ollama, LM Studio, vLLM on your own machine |

No provider configured? The extension still works in **Offline Heuristic Mode** (fixes contractions, casing, digits, punctuation locally).

---

## 2. Project structure

```
TTS-main/
├── manifest.json            ← Chrome extension manifest (v1.1.0)
├── background/background.js ← AI engine: providers, prompts, offline rules
├── content/content.js       ← In-page Copilot panel + portal automation
├── content/content.css      ← Panel styling (incl. stealth mode)
├── popup/popup.html|js|css  ← Toolbar popup: provider & key settings
├── test-portal/             ← Offline simulator of the review portal
├── reference/               ← Training Guide PDFs + taxonomy sheet
├── tests/run-tests.mjs      ← Offline test suite (33 checks)
└── icons/                   ← Extension icons
```

`generate_icons.py` / `generate_sample_wav.py` are optional dev utilities used to create the bundled assets — you don't need them to run the extension.

---

## 3. Install (one time) — step by step

1. Open Google Chrome.
2. Type this in the address bar and press Enter:
   ```text
   chrome://extensions
   ```
3. Turn **ON** the **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** (top-left).
5. Select the folder that contains this `manifest.json` file:
   ```text
   C:\AndroidPro\TTS-main
   ```
6. The card **"TTS Review AI Auto-Validator & Emotion Tagger" 1.1.0** appears with no errors.
7. Click the puzzle-piece icon in Chrome's toolbar and **pin** 🎙️ *TTS Review AI Assistant*.

> **After any code change:** come back to `chrome://extensions` and click the **↻ Reload** icon on the extension card, then refresh the portal tab.

---

## 4. Configure your AI key — step by step

### Option A — NVIDIA NIM (free key, great cleanup quality)

1. Go to **https://build.nvidia.com/** → sign in → click your avatar → **API Keys** (or go straight to `build.nvidia.com/settings/api-keys`).
2. Click **Generate API Key** and copy it. It starts with:
   ```text
   nvapi-...
   ```
3. In Chrome, click the pinned 🎙️ extension icon. The **TTS Review Copilot** popup opens with a blue **"Heuristics"** pill in the header (meaning: no AI key yet).
4. Click the **🟩 NVIDIA** tab.
5. Paste your key into **NVIDIA API Key**.
   - ✅ Correct: nothing extra happens.
   - ⚠️ If you pasted an NVIDIA key while on the *Gemini* tab (or vice versa), an orange warning appears:
     ```text
     ⚠️ That looks like a NVIDIA NIM key. Switch to the NVIDIA NIM tab — on this tab it will be rejected as invalid.
     ```
     **This warning is why "invalid API key" errors happened in the past** — each provider only accepts its own key on its own tab.
6. Leave **Model** on **Nemotron 3 Super 120B (Recommended — best balance)**.
7. Click **🔌 Test Connection**. Expected output next to the button:
   ```text
   ✓ Connected!
   ```
8. Click **Save Settings** (bottom). Expected:
   ```text
   Settings saved! ✓
   ```
   and the header pill changes to **NVIDIA NIM**.

> **Note:** NVIDIA models are text-only — they perfect the transcript and infer emotion from wording, but cannot hear the clip. For emotion detection from the actual voice, also configure Gemini (Option B) and switch tabs depending on the task.

### Option B — Google Gemini (native audio listening)

1. Get a free key at **https://aistudio.google.com/app/apikey** (new keys start with `AQ.`).
2. Popup → **🔷 Gemini** tab → paste key → **Model**: *Gemini 3.8 Flash (Best quality — Native Audio)*.
3. **🔌 Test Connection** → `✓ Connected!` → **Save Settings**.

You can switch providers anytime — the last saved tab wins.

---

## 5. Run the automated tests — step by step

1. Open a terminal (Command Prompt / PowerShell / Git Bash).
2. Run:
   ```bash
   cd C:\AndroidPro\TTS-main
   node tests/run-tests.mjs
   ```
3. Expected output (abbreviated):
   ```text
   Model remapping:
     ✓ null model → default
     ...
   Offline heuristic (guide rules):
     ✓ number word → digits
     ✓ 'no one' is preserved (lookbehind guard)
     ...
   33 passed, 0 failed
   ```
4. If the last line shows **`0 failed`**, the offline engine is healthy. If `node` is not installed, install it from https://nodejs.org first.

---

## 6. Use it on the portal — step by step

1. Go to **https://tts-review.sabi.com/**, log in, and open the **Review** tab.
2. When a clip loads, the **TTS Review Copilot** panel appears (bottom-right by default — drag the header to move it; position is remembered). Its status line shows:
   ```text
   Ready to validate current clip.
   ```
3. Click **✨ AI Auto-Review & Tag** (or press **`Alt + A`**). Status changes to:
   ```text
   Fetching audio & analyzing voice with AI...
   ```
   and the button shows ⏳ *Analyzing Audio...*
4. **Success** — the Corrected Transcript box fills automatically, e.g.:
   ```text
   <|style_open|>anger<|style_body|>For a 10 dollar pass, Verizon will pick this up here.<|style_close|>
   ```
   The status turns green with the provider and emotion named:
   ```text
   ✓ Validated by NVIDIA NIM (nvidia/nemotron-3-super-120b-a12b) (anger)
   ```
   The panel now shows:
   - **Validation Insights** — the vocal cues the AI heard and the fixes it made.
   - **★ anger** badge and, if you used Gemini/OpenAI-Audio, a **Confidence** row like `🟢 high  [Try 'annoyed']`.
   - **Clips: N** counter in the footer increases by 1.
5. **No key configured?** You'll instead see the yellow-ish message — the cleanup still ran locally:
   ```text
   ✓ Rule-based cleaned (thoughtful) [Add an API key for AI audio analysis]
   ```
6. **Verify before submitting** — click **✅ Rule Check**:
   - All good → the panel shows:
     ```text
     ✅ All Training Guide rules pass
     ```
   - Problems found → each failed rule is listed with a **Fix** button:
     ```text
     ⚠️ Rule Check (Training Guide)
     ✗ Number written as a word: "ten" — must be digits  [Fix]
     ✗ No forbidden <|breath|> tag ...                    [Fix]
     ✓ Acronyms UPPERCASE
     ```
     Click **Fix** to repair just that rule, and the check re-runs instantly.
7. **Manual adjustments** (all buttons explained in section 7):
   - Click any **emotion pill** to rewrap the span — status: `Emotion updated to 'anger'`.
   - Click any **event tag** (`laugh`, `um`, `inhale`, …) to insert it exactly at your cursor.
8. **Submit on the portal itself** — click the portal's **Accept as Corrected** or **Reject** button. The next clip loads automatically. With **Auto-Run on Next** enabled in the panel footer, the AI reviews the next clip by itself.

---

## 7. Panel controls reference (what each button does and outputs)

| Control | What it does | Output you'll see |
| :--- | :--- | :--- |
| ✨ **AI Auto-Review & Tag** | Full AI validation of the current clip | Fills the transcript box; green status names the provider + emotion |
| ▶ / ⏸ | Play or pause the clip | — |
| ⬇ **Load Original** | Copy the system transcript into the Corrected box verbatim | `Loaded the Original Transcript into the box.` |
| **Toggle Style Wrap** | Switch between emotion-span text and plain text | `Unwrapped: Clean text mode` / `Wrapped with 'thoughtful' style` |
| ✅ **Rule Check** | Lint the text against the Training Guide rules | `✅ All Training Guide rules pass` or per-rule ✗ list with **Fix** buttons |
| 📋 **Copy** | Copy the final transcript to the clipboard | `Transcript copied to clipboard.` |
| **Emotion pills (19)** | Rewrap the whole text in that emotion's span | `Emotion updated to '<emotion>'` |
| **Event tag pills (20)** | Insert `<\|tag\|>` at the cursor position | Tag appears in the text at the cursor |
| 📖 (header) | Emotion training guide with definitions, cues, lookalikes **and reference sample clips** from the taxonomy sheet | Opens a searchable modal; each card has **Apply This Style** |
| ⚙️ (header) | Quick Gemini settings (key + model) | `API Settings saved successfully!` |
| 🙈 (header) / `Alt + H` | Stealth: hide all extension UI for screen sharing | Everything disappears; press `Alt + H` to restore |
| 🔊 speed dropdown | Playback speed 0.5×–2× (remembered) | `Playback speed: 1.5×` |
| **Style Span Mode / Auto-Run on Next / Auto-Play** | Preference toggles | Saved per Chrome profile |

---

## 8. Keyboard shortcuts

| Shortcut | Action |
| :--- | :--- |
| **`Alt + A`** | Run AI Auto-Review & Tag on the current clip |
| **`Alt + P`** | Play / Pause the audio |
| **`Alt + H`** | Stealth mode — instantly hide/show all extension UI |

---

## 9. Try it offline first — the test simulator

The simulator copies the portal's layout so you can test without logging in.

1. In a terminal:
   ```bash
   cd C:\AndroidPro\TTS-main\test-portal
   python -m http.server 8080
   ```
2. Open **http://localhost:8080/** in Chrome. You'll see the dark **TTS Review** simulator with a sample clip (`Clip: ZyG8FSeTFKA_speaker_0_1340`), the original transcript *"for a ten dollar pass verizon will pick this up here"*, and Prev/Next sample buttons (3 clips).
3. The Copilot panel appears — click **✨ AI Auto-Review & Tag**. The Corrected Transcript fills and the emotion/event buttons behave exactly like the real portal.
4. Use **Next →** to move between the 3 sample clips (one per rule scenario: numbers, contractions, proper nouns).

> ⚠️ **Must be `http://localhost`** — Chrome does not inject content scripts into `file://` pages, so double-clicking `index.html` will show the simulator **without** the panel. If the panel is missing, check the address bar starts with `http://localhost`.
>
> ℹ️ The bundled `sample.wav` is a synthesized tone, so AI emotion results on the simulator are illustrative only.

---

## 10. Troubleshooting

| Message / symptom | Cause | Fix |
| :--- | :--- | :--- |
| `✗ NVIDIA: invalid API key (401). Keys from build.nvidia.com start with 'nvapi-'` | Key pasted in the wrong provider tab, key is not an NVIDIA key, or it was revoked | Use the 🟩 **NVIDIA** tab; regenerate the key at build.nvidia.com |
| Orange **"That looks like a … key"** warning in the popup | Key prefix doesn't match the open tab | Switch to the suggested tab before saving |
| `Free-tier quota reached …` (Gemini) | Daily free quota used (429) | Wait the shown time, switch to a **Flash Lite** model, or enable billing |
| `Gemini is temporarily overloaded (503)` | Google-side congestion (auto-retried 3×) | Just retry in a moment |
| `NVIDIA: model unavailable (end-of-life or not found)` | Chosen model was retired (e.g. `meta/llama-3.3-70b-instruct` died 2026-08-26) | Pick another model in the NVIDIA dropdown |
| `⚠️ No audio element or transcript found on page.` | Ran the review before the clip loaded | Wait for the clip + transcript, then run again |
| Panel doesn't appear | Extension reloaded but tab is stale | Refresh the portal tab; confirm the extension is enabled |
| Simulator shows but no panel | Page opened as `file://` | Serve it: `python -m http.server 8080` → `http://localhost:8080/` |
| Emotion label looks different (`anger` vs `angry`) | v1.1.0 uses the Training Guide's exact spellings | Nothing to do — old labels are auto-mapped on save/output |

---

## 11. The 19 emotion labels (exact portal spellings)

`anger` · `annoyed` · `awe` · `curious` · `excited` · `fearful` · `flirty` · `joyful` · `loud` · `menacing` · `mischievous` · `nervous` · `sad` · `sarcastic` · `smug` · `surprised` · `tender` · `thoughtful` · `whisper`

Legacy labels `angry`, `mischievously`, `whispers` are accepted anywhere (input, saved settings, AI output) and converted automatically.

**Key transcription rules enforced:** numbers in digits (`10 dollar`), ordinals (`22nd`), uppercase acronyms (`ATM`, `CIBIL`), Title Case proper nouns (`Verizon`), letter-by-letter spaced (`h e a t`), stutters/repeats kept exactly (`I think I think`, `d de decide`), no `<|breath|>` tag (only `<|inhale|>`/`<|exhale|>` for clearly audible long breaths), primary speaker only.

---

## 12. Changelog

### 1.1.0
- **NVIDIA NIM provider** (`integrate.api.nvidia.com`) with curated live models; keys validated with a real completion; end-of-life model errors surfaced clearly.
- **Key-format hints** in the popup — catches NVIDIA/Gemini/OpenAI/Groq/OpenRouter keys pasted into the wrong tab.
- **✅ Rule Check** linter + one-click fixes based on the Training Guide.
- **Emotion confidence + runner-up** display with quick-apply.
- **Reference sample clips** (taxonomy sheet) inside the Emotion Guide modal.
- **Canonical emotion labels** (`anger`, `mischievous`, `whisper`) per the Training Guide; legacy labels auto-mapped.
- **Playback speed**, **Copy** button, **clips counter**.
- Fixes: AI-success status never naming the provider; API key injected via `innerHTML`; removed `<all_urls>` permission; heuristic engine writing "no 1" for "no one", appending periods after event tags, or "capitalizing" leading tags; Groq uploading WAV as `.mp3`; JSON parsing now tolerates markdown fences/prose; added `don't` / `wasn't` / `hasn't` repairs.
