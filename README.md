# TTS Review Copilot — v2.0.0

A Chrome extension **plus a full standalone workspace** that automates TTS audio-transcript review for `https://tts-review.sabi.com/`: it listens to the clip with AI, produces a verbatim, rule-compliant, emotion-tagged transcript, explains its reasoning, and tracks your Accepted / Fixed / Rejected statistics — all grounded in the official **Training Guide** and **Taxonomy sheet**.

**What's new in v2.0.0 (the big rebuild):** the cramped extension popup is now the launcher for a **full-window dashboard app** — sidebar navigation, a Dashboard with KPIs and charts, a two-pane Review workspace with a waveform, live rule highlighting, an original↔corrected diff, emotion-span timeline, and a **Hybrid Gemini + NVIDIA engine** where Gemini *listens* (Ear) and NVIDIA *formats* (Brain), with automatic fallback so the tool never leaves you empty-handed.

---

## Table of Contents

1. [How to download & extract](#1-how-to-download--extract)
2. [How to install & run](#2-how-to-install--run)
3. [How to use it — new-user walkthrough](#3-how-to-use-it--new-user-walkthrough)
4. [How the tool behaves (the Hybrid engine)](#4-how-the-tool-behaves-the-hybrid-engine)
5. [Feature reference](#5-feature-reference)
6. [How to test — end to end](#6-how-to-test--end-to-end)
7. [Troubleshooting](#7-troubleshooting)
8. [Privacy & permissions](#8-privacy--permissions)
9. [Developer notes](#9-developer-notes)
10. [Changelog](#10-changelog)

---

## 1. How to download & extract

**Option A — download as ZIP (no git needed):**

1. Go to **https://github.com/saran-github232/TTSV**.
2. Click the green **Code** button → **Download ZIP**.
3. Find `TTSV-main.zip` in your Downloads folder.
4. **Extract it:** right-click the ZIP → *Extract All…* → pick a location (e.g. `C:\Tools\`). You end up with a folder like `C:\Tools\TTSV-main\` that contains `manifest.json` at its top level. Remember this folder — it's the extension.

**Option B — clone with git:**

```bash
git clone https://github.com/saran-github232/TTSV.git
cd TTSV
```

The folder containing `manifest.json` is the extension. That's all you need — there is **no build step and nothing to install via npm**.

---

## 2. How to install & run

**One-time install (Chrome or any Chromium browser — Edge, Brave…):**

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** (top-left) and select the folder that contains `manifest.json`.
4. The card **"TTS Review AI Auto-Validator & Emotion Tagger" 2.0.0** appears with no errors. Pin it to the toolbar.

**Running it — there are two surfaces:**

| Surface | How to open | What it's for |
| :--- | :--- | :--- |
| 🚀 **Dashboard workspace** (the main app) | Click the extension icon → **"🚀 Open Dashboard (full workspace)"**. It opens in a **full browser tab** — a real app window, not a popup. | Everything: Dashboard, Review, Guide, Settings. |
| 🎧 **Portal companion** | Just browse `https://tts-review.sabi.com/` with the extension active. The floating Copilot panel + the ✨ button above the Corrected Transcript box appear on the page. | Quick in-page reviews while you work on the portal itself. |

> After updating the code: `chrome://extensions` → **Reload** ↻ → refresh the portal tab.

**First 3 minutes (setup):**

1. Open the Dashboard → **Settings** → paste your keys:
   - **Gemini** (free, from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)) — it *listens* to the audio.
   - **NVIDIA NIM** (free, from [build.nvidia.com](https://build.nvidia.com/), starts with `nvapi-`) — it *formats* the best-quality text.
   - One key alone is fine; no keys = offline heuristic mode.
2. Click **🔌 Test** on each → expect `✓ Connected`.
3. Keep **Engine mode = Auto** — the app picks the best routing from the keys you have.

---

## 3. How to use it — new-user walkthrough

### 3.1 Review a clip (the core loop)

1. Open the Dashboard → **Review** view.
2. **Load a clip**, three ways:
   - **⬇ Load clip from portal** — the moment a clip loads on `tts-review.sabi.com` (extension active), it's forwarded here and a banner offers to load it.
   - **Load sample clip…** — three bundled samples (numbers / contractions / proper nouns). Audio needs the simulator: run `python -m http.server 8080` inside `test-portal/`.
   - Or type/paste a transcript directly into the editor (AI review still works with the portal transcript; audio features need a clip).
3. Click **✨ AI Auto-Review** (or `Alt+A`). Watch the status line: `Engine mode: hybrid` → `Ear (Gemini): listening…` → `Brain (NVIDIA): formatting…`.
4. The corrected transcript fills the editor. Inspect it:
   - **Live Rule Check** — violations (word-numbers, lowercase acronyms, broken contractions, missing span…) appear as chips with one-click **Fix**.
   - **"Show original ↔ corrected diff"** — a word-level diff of exactly what changed.
   - **Insight card** — chosen emotion with a confidence bar, runner-up ("Try '…'"), and the vocal cues the model heard.
   - **Waveform** — click to seek, drag the splitter to resize panes, use 🔁 Loop and **A / B** points to re-listen to tricky moments; **▸ Open span / ◂ Close span** insert the emotion-span markers at your cursor, visualized on the span timeline.
5. Fix anything manually — 19 emotion chips re-wrap the span; 20 event chips insert at the cursor.
6. Finish: **✔ Accept as Corrected** (auto-logged as *Accepted* if nothing changed, *Fixed* if you edited), **✖ Reject**, or **🚩 Flag for QA** with a note.

### 3.2 Dashboard

The home view mirrors the portal's dashboard: **date filter** (Today / 7d / 30d / All / Custom range), four **KPI cards** (Accepted · Fixed · Rejected · Total Submitted), a **completions chart**, an **emotion-distribution donut**, and a **recent clips** table (click a row to reopen a cached result). Filter to flagged clips, **⬇ Export CSV**, or clear the log.

### 3.3 Guide & trainer

The **Guide** view is the searchable 19-emotion reference — definition, acoustic cues, lookalikes, and three official sample clips per emotion. **🎯 Practice quiz** shows you a definition + cues and asks you to pick the emotion, then reveals the answer with a reference clip — great for onboarding and calibration.

### 3.4 On the portal itself

Everything from earlier versions still works in-page: the floating Copilot panel, the ✨ button above the textarea, Alt+A / Alt+P / Alt+H, and every new portal clip is forwarded to the Dashboard automatically.

---

## 4. How the tool behaves (the Hybrid engine)

**Two roles, one result:**

| Role | Provider | Job |
| :--- | :--- | :--- |
| 👂 **Ear** | Gemini (native audio) | Listens to the clip → raw transcript + vocal cues (tone, events, first-guess emotion, confidence) |
| 🧠 **Brain** | NVIDIA Nemotron (text) | Applies every Training-Guide rule → clean transcript, event tags, emotion span, reasoning |

**Routing (auto-detected from your keys; you can pin a mode in Settings):**

| Keys present | Mode | Behavior |
| :--- | :--- | :--- |
| Gemini + NVIDIA | **Hybrid** (recommended) | Ear → Brain, streamed so text fills in live |
| Gemini only | **Gemini** | One audio-native call does both roles |
| NVIDIA only | **NVIDIA** (text) | Formats the portal transcript; result is labelled *"text-only (no audio listened)"* so you double-check the emotion |
| None / Force Offline | **Offline heuristic** | Local rule engine — never dead, never uses quota |

**Reliability rules the engine follows:** transient 503s are retried with backoff; quota errors surface as clear messages; if the Brain fails the chain degrades Hybrid → Gemini → NVIDIA → offline heuristic, so **you always get a result**; results are cached per clip for instant re-opens; the top-bar pill always shows the resolved mode (`● Hybrid: Gemini + NVIDIA`).

**Statuses logged** (Training Guide definitions): *Accepted* = no changes made; *Fixed* = you edited then approved (auto-detected via diff); *Rejected* = major violation; *Total Submitted* = everything.

---

## 5. Feature reference

| # | Feature | Where |
| :--- | :--- | :--- |
| F1 | Training knowledge base (upload .txt/.md/.csv/.json extracts → injected into prompts; export PDFs as text) | Settings |
| F2 | Live rule highlighting with one-click fixes | Review |
| F3 | Original ↔ corrected word diff | Review |
| F4 | Waveform player: click-to-seek, 0.5–2× speed, loop, **A–B repeat** | Review |
| F5 | Emotion-span timeline (visualizes where the span opens/closes) | Review |
| F6 | Confidence bars + vocal cues + runner-up | Review |
| F7 | History, undo/redo, revert, per-clip result cache | Review |
| F8 | Custom dictionary (proper nouns + never-change list) — injected into prompts *and* the offline engine | Settings |
| F9 | Analytics dashboard (KPIs, charts, table, date filter, flags) | Dashboard |
| F10 | Guided emotion trainer / quiz | Guide |
| F11 | Second opinion — cross-check emotion, flag disagreement (toggle in Settings) | Review |
| F12 | Light / Dark / System themes, compact density, keyboard nav, ARIA, reduced-motion | Everywhere |
| F13 | Export/import profile (JSON) + dashboard CSV export | Settings / Dashboard |
| F14 | Flag-for-QA with notes + flagged-only filter | Review / Dashboard |
| F15 | Command palette (**Ctrl/Cmd+K**) + first-run guided tour | Everywhere |

**Carried over from the extension:** verbatim preservation, contraction repair, digits/ordinals/acronyms/proper nouns, 20 event tags (never `<|breath|>`), 19-emotion span wrapping, primary-speaker-only, multi-provider keys with Test Connection, key-format hints, stealth mode (the dashboard's toasts/overlays are share-safe via the browser itself; on the portal `Alt+H` still hides all injected UI).

---

## 6. How to test — end to end

**Test A — automated logic tests (no browser):**

```bash
node tests/run-tests.mjs        # extension engine + heuristics  → 35 passed, 0 failed
node tests/dashboard-tests.mjs  # dashboard logic (lint, diff, modes, contract, aggregation) → 30 passed, 0 failed
```

**Test B — dashboard loads:** after installing, click the extension icon → **Open Dashboard**. Expected: full-window app, sidebar, engine pill shows `Offline heuristic` (no keys) or your resolved mode, welcome modal + guided tour on first run.

**Test C — offline review (no keys needed):** Review → **Load sample clip… → Sample 1** (serve `test-portal/` on `:8080` for audio) → **✨ AI Auto-Review** → expected transcript:
`<|style_open|>thoughtful<|style_body|>For a 10 dollar pass Verizon will pick this up here.<|style_close|>` — then **Rule Check** shows `no issues`, **Accept** logs *Accepted*, and the **Dashboard** KPIs update.

**Test D — hybrid engine (both keys):** Settings → paste Gemini + NVIDIA keys → **Test** both (`✓ Connected`) → engine pill flips to `● Hybrid: Gemini + NVIDIA` → run Sample 2 → status shows `Ear… → Brain…` → emotion comes from real audio, notes describe the fixes.

**Test E — portal end-to-end:** open the portal Review tab → panel + ✨ button appear → run a review in-page **or** click **Load clip from portal** in the Dashboard → accept/reject on the portal → the clip's stats appear in your Dashboard.

---

## 7. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Dashboard doesn't open | Reload the extension (`chrome://extensions` → ↻) and click the popup button again. |
| `✗ Invalid API key (401)` on NVIDIA | Key must start with `nvapi-` — re-check the NVIDIA tab in Settings. |
| Gemini quota/429 | Wait, switch to a Lite model, or enable billing; the engine falls back automatically. |
| Waveform empty | The audio host must be reachable (portal clips need the portal tab loaded once; samples need `python -m http.server 8080` in `test-portal/`). Playback can still work without the waveform. |
| Emotion looks wrong on NVIDIA-only mode | Expected — text can't hear tone. Add a Gemini key for audio-based emotion. |
| Panel missing on the portal | Refresh the tab, press `Alt+H` (stealth persists), or use the popup's Panel Status card. |
| Statues not showing on Dashboard | Statuses are logged only when you click Accept/Reject in the Dashboard's Review view (portal-side submissions aren't observable by any extension). |

---

## 8. Privacy & permissions

- **Keys** live in `chrome.storage.sync` on your profile and go **only** to the provider you configure. No backend, no telemetry.
- **Audio + transcripts** are sent only to your chosen providers (Gemini, NVIDIA NIM, OpenAI, Groq, OpenRouter, or your custom endpoint).
- **Permissions:** `storage`, `activeTab`; hosts: the portal, `localhost`, and the AI provider APIs. No `<all_urls>`.
- Review logs, flags, dictionary, and the knowledge base stay **on-device** (`chrome.storage.local`). Profile export includes keys only if you tick the box.

---

## 9. Developer notes

- **No build step** — the dashboard is hand-rolled vanilla ES modules: `dashboard/index.html` (shell), `app.js` (UI), `app.css` (design tokens), `lib-core.mjs` (pure logic), `guide-data.mjs` (Training-Guide data), `engine.js` (Hybrid engine). MV3 CSP forbids CDN libraries, so the waveform, charts, diff, and palette are dependency-free implementations.
- **Pure logic is node-testable** — `lib-core.mjs` never touches DOM/`chrome.*`, which is what `tests/dashboard-tests.mjs` exercises.
- Extension-side files unchanged in role: `background/background.js` (in-page engine + clip forwarding), `content/content.js`, `popup/`.
- Icons/WAV generators (`generate_*.py`) are optional dev tools, now path-independent.

---

## 10. Changelog

### 2.0.0 — the workspace rebuild (per ADDING_NEW_FEATURES.md v3)
- **Standalone dashboard app** opened in a full browser tab: sidebar (Dashboard · Review · Guide · Settings) + top bar with live engine-status pill; responsive (sidebar collapses on mobile), Light/Dark/System themes, compact density, `Ctrl+K` command palette, first-run guided tour.
- **Hybrid Gemini + NVIDIA engine**: Gemini = Ear (audio → transcript + vocal cues handoff), NVIDIA = Brain (streamed, rule-compliant formatting); auto mode detection, pinned modes with graceful degradation, fallback chain Hybrid → Gemini → NVIDIA → offline heuristic (never an empty result), 503 retry/backoff, per-clip result cache.
- **Review workspace**: waveform player with A-B repeat, emotion-span timeline, live Rule Check with one-click fixes, word-level diff, insight card (confidence + cues + runner-up), 19 emotion chips, 20 event chips, undo/redo/revert, Accept/Fixed/Reject auto-detection, Flag-for-QA.
- **Dashboard**: date-filtered KPIs (Accepted/Fixed/Rejected/Total), completions chart, emotion donut, recent-clips table with cached-result reopening, CSV export.
- **Settings**: 6 providers with real-endpoint connection tests, engine-mode pinning, custom dictionary, knowledge-base upload (.txt/.md/.csv/.json), JSON profile export/import.
- **Guide + trainer**: searchable 19-emotion reference with official sample clips, practice quiz with scoring.
- **Extension integration**: popup "Open Dashboard" launcher; portal clips auto-forwarded to the dashboard. All v1.x in-page features retained.

### 1.3.1 / 1.3.0 / 1.2.x / 1.1.0 / 1.0.0
- 1.3.1: Force Offline Mode toggle; path-independent asset scripts; README superset. 1.3.0: inline ✨ quick-bar above the textarea. 1.2.x: self-healing panel, Panel Status diagnostics, shortcut-error fix. 1.1.0: NVIDIA NIM provider, Rule Check, confidence/runner-up, sample clips, canonical emotion labels, key-format hints, speed/copy/counter. 1.0.0: initial release.
