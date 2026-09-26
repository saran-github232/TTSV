<!--
  ADDING_NEW_FEATURES.md  —  TTS Review Copilot
  Single, self-contained, build-ready spec for rebuilding the tool with an AI code
  editor (Z.ai). v3 — grounded in the official Training Guide + Taxonomy sheet
  (reference/pdff.pdf, reference/pdf.pdf, reference/readme.md). Turns the cramped
  extension popup into a full, professional, standalone dashboard + review window,
  and runs Gemini + NVIDIA together as one responsive hybrid engine.
  This .md is the ONLY deliverable — everything needed to build is inside it.
-->

# TTS Review Copilot — Product & Feature Guide (v3)

> **Read me first.** This is the **single, self-contained source of truth** for rebuilding the tool as a professional, standalone app (built with an AI code editor such as Z.ai). No companion files are needed — the UI structure, design tokens, wireframes, workflow, features, model logic, and technical requirements are all specified below. It is grounded in the **official Training Guide** and **Taxonomy sheet**, so it describes the *real* review workflow the tool automates. It has four big parts:
>
> 1. **What the tool is + the real portal workflow** (so the app matches how reviewers actually work).
> 2. **The redesign** — replace the tiny extension popup with a clear, beautiful, professional **standalone dashboard + review workspace window**.
> 3. **The features** — everything that exists today, improved, plus the useful new features, including the **Hybrid Gemini + NVIDIA engine**.
> 4. **The reference + technical spec** — exact data, model logic, API-key handling, and requirements a developer/AI can implement directly.

---

## 1. What this tool actually is

The **TTS Review Copilot** assists human reviewers on the **TTS Review** platform (`tts-review.sabi.com`). On that platform a reviewer listens to a short speech clip and turns the raw machine transcript into a clean, faithful, fully-tagged transcript, then marks the clip **Accepted**, **Fixed**, or **Rejected**.

For every clip the reviewer must:

1. **Transcribe the primary speaker only**, verbatim — keep stutters, repeats and misspeaks; fix only casing, punctuation and broken/garbled words.
2. **Apply strict formatting** — numbers as digits (`10`, not "ten"), ordinals as `1st/2nd/34th`, acronyms UPPERCASE (`ATM`, `UFC`), proper nouns Title Case (`Verizon`, `Los Angeles`), and repair broken contractions (`doesn t → doesn't`).
3. **Insert event tags** at the exact instant a non-speech sound occurs (`<|laugh|>`, `<|sigh|>`, `<|inhale|>` …).
4. **Wrap speech in an emotion span** — open the span where an emotion begins and close it where it ends, choosing from the **19 official emotions**:

```text
<|style_open|>curious<|style_body|>For a 10 dollar pass, Verizon will pick this up here.<|style_close|>
```

The Copilot **automates all four steps**: it listens to the clip with AI, returns the cleaned + tagged + emotion-wrapped text, explains its reasoning, and lets the reviewer verify and fine-tune everything — then the reviewer submits on the portal. The tool never changes the required output format; it only makes producing it faster and more accurate.

**Its purpose in one line:** *make each clip review faster, more consistent, and more confident, while keeping the output exactly to the Training Guide's rules.*

---

## 2. The real portal workflow (ground truth from the Training Guide)

The rebuild should mirror these four stages so the Copilot feels native to how reviewers work. This is exactly what the official guide describes.

### Stage 1 — Log in
Sign in with email + one-time password (OTP), then set a new password. *(The portal owns auth; the Copilot does not replace it — but the app's own dashboard should feel like a natural companion to it.)*

### Stage 2 — Dashboard
A production overview the reviewer opens first:
- **Date filter:** Today · Last 7 days · Last 30 days · All time · Custom range.
- **Four status counters:** **Accepted**, **Fixed**, **Rejected**, **Total Submitted** — each shows how many clips landed in that bucket.
- **A completions chart** over the selected period.
- **Fully responsive** — the same filters and counters stack cleanly on mobile.

**What each status means (use these exact definitions):**

| Status | Meaning |
| :--- | :--- |
| **Accepted** | The clip was accepted **without any changes** to the transcription or tags. |
| **Fixed** | You corrected the transcription, event tags, or emotion tags, **then approved**. |
| **Rejected** | The clip was rejected outright due to a **major violation**. |
| **Total Submitted** | The total number of clips worked on across your sessions. |

### Stage 3 — Review Task
A **two-part layout**:
- **Section 1** — the audio clip + its original transcript.
- **Section 2** — your corrected transcript, plus the **event tag** and **emotion tag** lists.

The review steps: **① Listen & correct** the transcript → **② Tag events** at the exact instant each occurs → **③ Identify the emotion** and place it where it begins → **④ Set the emotion's duration** by closing the span where it ends → **⑤ Mark the final status** (Accept as Corrected / Reject / Revert edit) → **⑥ Move to the next clip** (a new clip auto-loads).

**Emotion is a span, not a point.** You *open* a span (`<|style_open|>curious<|style_body|>`), and a chip shows "`curious · open span`" until you *close* it (`<|style_close|>`) where the emotion ends. Then submit with **Fix & Accept**. The rebuild must support open/close span mechanics, not just a single wrap.

On mobile the two sections stack into one scroll; Accept / Reject / Revert stay pinned at the bottom.

### Stage 4 — Emotion reference
The full 19-tag library (definition, listen-for cues, lookalikes, and reference sample clips) — reproduced in the **Appendix (§7.1)** of this doc.

### Transcription guidelines (the rules the tool enforces)
- **Primary speaker only** — ignore overlapping/background speakers.
- **What counts as a correction** — fix casing, punctuation, and broken/garbled words.
- **Keep the audio true to itself** — don't "fix" grammar the speaker actually used; keep letter-by-letter sounds as-is (`h e a t`).
- Plus the strict formatting from §1 (digits, ordinals, acronyms, proper nouns, contraction repair) and the **breathing rule**: never emit `<|breath|>`; use `<|inhale|>`/`<|exhale|>` only for long, clearly audible breaths.

---

## 3. The redesign — from a cramped popup to a professional workspace ⭐

**The problem today.** The tool lives in a tiny floating panel and a small toolbar popup. Everything is squeezed into a narrow column, controls are crowded, and there is no sense of "product." It is hard to see, hard to scan, and does not communicate what the app can do.

**The goal.** A **clear, spacious, professional dashboard + review window** — a real app surface, not a widget. Anyone who opens it should immediately understand what it does. Generous spacing, a proper layout grid, a calm color system, clear typography, and obvious primary actions.

### 3.1 Three clear views

The app is organised into three top-level views behind a persistent left sidebar (or top nav on mobile):

```
┌───────────────────────────────────────────────────────────────────────┐
│  TTS Review Copilot            ● Hybrid: Gemini + NVIDIA     [⚙ Settings]│  ← top bar
├──────────┬────────────────────────────────────────────────────────────┤
│          │                                                              │
│  ▸ Dash  │                    ACTIVE VIEW RENDERS HERE                  │
│  ▸ Review│                                                              │
│  ▸ Guide │                                                              │
│  ▸ Setup │                                                              │
│          │                                                              │
└──────────┴────────────────────────────────────────────────────────────┘
```

**View A — Dashboard** (mirrors the portal, made beautiful):
- A header with the **date filter** (Today / 7d / 30d / All / Custom).
- Four **KPI cards**: Accepted · Fixed · Rejected · Total Submitted — big number, small trend, subtle accent color each.
- A **completions chart** (area/bar over time) and an **emotion-distribution donut**.
- A **recent clips** table (clip id, status, emotion, confidence, time) with row → open in Review.

**View B — Review Workspace** (the core, redesigned two-pane):
```
┌─────────────────────────────┬───────────────────────────────────────┐
│  SECTION 1 — SOURCE         │  SECTION 2 — YOUR REVIEW              │
│  ─────────────────────────  │  ───────────────────────────────────  │
│  Clip: ZyG8FSeTFKA…         │  [ ✨ AI Auto-Review ]  [▶ Play] [Loop]│
│  ~~ waveform ~~ 0:03        │  ┌─────────────────────────────────┐  │
│  speed 1×  loop  A-B        │  │ corrected transcript (rich)     │  │
│                             │  │ live rule highlights + diff     │  │
│  Original transcript:       │  └─────────────────────────────────┘  │
│  "for a ten dollar pass…"   │  Emotion span: curious · open ▸ close  │
│                             │  Confidence ▓▓▓▓▓░ 72%  cues: …        │
│  Metadata: speaker, source  │  [19 emotion chips]  [21 event chips]  │
│                             │  [ Accept as Corrected ] [ Reject ]    │
└─────────────────────────────┴───────────────────────────────────────┘
```
- Left = audio + waveform + original transcript + metadata.
- Right = the corrected-transcript editor (with live rule highlighting and an Original↔Corrected diff toggle), the emotion-span controls (open/close), the AI insight card (cues, confidence bars), the emotion + event chip rows, and the **Accept / Reject / Revert** actions pinned at the bottom.

**View C — Settings & Knowledge Base:** provider keys (Gemini, NVIDIA, …), the **Hybrid engine** switch (§4), automation preferences, the uploaded guideline documents, and the custom dictionary.

**Plus the Guide view:** the searchable 19-emotion reference with sample clips (Appendix §7.1).

### 3.2 Design system (tokens to build with)
- **Layout:** 12-col responsive grid; max content width ~1200px; comfortable 16–24px gutters; cards with 12–16px radius and soft shadow.
- **Color:** one calm neutral base (light + dark), a single brand accent (e.g. indigo/violet), and semantic status colors — **Accepted = green**, **Fixed = amber**, **Rejected = red**, **Submitted = blue**.
- **Typography:** one clean sans (Inter/system UI); clear scale (28 / 20 / 16 / 14 / 12); transcripts in a slightly monospaced or larger reading size for legibility.
- **Components:** KPI card, chart card, data table, chip/pill, toggle, modal, toast, waveform, split-pane. Build them once, reuse everywhere.
- **Motion:** subtle only — 120–200ms ease on hover/state; no bouncing. Respect `prefers-reduced-motion`.
- **Density:** default = spacious; offer a **compact** toggle for power users on small screens.

### 3.3 Responsive & modes
- **Desktop:** sidebar + two-pane review.
- **Tablet/mobile:** sidebar collapses to a top bar; the review panes **stack** (Section 1 above Section 2), actions pin to the bottom — exactly like the portal's mobile view.
- **Themes:** Light / Dark / System. **Stealth mode** (hide-all for screen sharing) is kept.
- **Accessibility:** full keyboard nav, visible focus rings, ARIA labels on chips/toggles, WCAG-AA contrast.

### 3.4 Window behavior — a standalone app, not a popup
This is the core of the redesign request: it must **feel like a complete desktop application**, not a browser-extension popup.
- **Full-surface window.** The app fills its window (min ~1024×640) with the persistent sidebar + top bar shell; content has a comfortable max width (~1200px) and centers on very wide screens. No cramped fixed 360px popup.
- **How it can ship:** (a) a normal web app / SPA opened in a full browser tab, (b) a PWA installed to its own OS window, or (c) an Electron/Tauri desktop wrapper. The same React build serves all three; only the shell host differs.
- **Persistent navigation.** The sidebar (Dashboard · Review · Guide · Settings) is always present on desktop and does not disappear between actions; the active view is restored on reload.
- **Resizable panes.** The review split-pane is draggable (Source ↔ Review) with a sensible min width per side; the choice persists.
- **State survives reload.** Active view, filters, theme, density, last clip, and cached AI results persist (see §7.4) so reopening the window feels continuous.
- **Companion/injected mode (optional).** For working directly on `tts-review.sabi.com`, the same components can run as a docked side panel that writes back to the portal via the React-safe setter (§5) — but the *primary* experience is the standalone window.
- **Window chrome details.** Top bar shows the app name, the live engine-status pill (`● Hybrid: Gemini + NVIDIA`), and quick actions (theme, settings, command palette). Toasts appear bottom-right; modals center with a scrim.

---

## 4. The Hybrid engine — Gemini + NVIDIA working as one ⭐


You asked to run **both** models together and switch between them: one model **listens to the audio** (speech-to-text + vocal cues) and the other produces the **best-quality, rule-compliant text**. If only one key is provided, the app must still work. This section is the contract for that engine.

### 4.1 The two roles

| Role | What it does | Best model | Why |
| :--- | :--- | :--- | :--- |
| **Ear** (audio → text + cues) | Fetches the clip, listens, returns a raw transcript **plus** vocal signals: tone, pitch, pace, pauses, laughs/breaths, and a first-guess emotion. | **Gemini** (native multimodal audio: 2.5 / 2.0 / 1.5 Flash) | Only the audio-native model can actually *hear* emotion and non-speech events. |
| **Brain** (text → clean output) | Takes the raw transcript + cues and applies every Training-Guide rule: digits, ordinals, acronyms, proper nouns, contraction repair, event-tag placement, and the final **emotion span**. Explains its reasoning. | **NVIDIA Nemotron** (NIM, text-only) | A strong reasoning LLM is better and cheaper at exact rule-following and clean formatting than re-using the audio model. |

The "Ear" hands a structured handoff to the "Brain":

```json
{
  "raw_transcript": "for a ten dollar pass verizon will pick this up here",
  "audio_cues": {
    "emotion_guess": "curious",
    "runner_up": "thoughtful",
    "events": [{ "tag": "inhale", "at_ms": 40 }],
    "tone": "rising pitch, light, unhurried",
    "confidence": 0.72
  }
}
```

The "Brain" returns the final standardized JSON contract (§7.5).

### 4.2 Routing modes (chosen in Settings)

- **Hybrid (recommended, both keys present):** Gemini = Ear → NVIDIA = Brain. Best quality.
- **Gemini-only (only Gemini key):** Gemini does *both* roles in one call (it already can). Fully functional.
- **NVIDIA-only (only NVIDIA key):** NVIDIA can't hear audio, so the app feeds it the **portal's original transcript** as the raw text and runs Brain-only. It still cleans, formats, tags text-inferable events, and picks a defensible emotion — clearly labelled "text-only (no audio listened)" so the reviewer double-checks emotion.
- **Offline heuristic (no keys):** the local linter (contractions, casing, digits, punctuation) runs so the tool is never dead.

The engine **auto-detects** which keys exist and picks the best available mode, but the user can pin a mode. Show the active mode in the top bar: `● Hybrid: Gemini + NVIDIA`.

### 4.3 Speed & resilience (make it feel instant)
- **Parallel where safe:** kick off the Gemini audio fetch immediately when a clip loads (prefetch), so by the time the reviewer clicks Auto-Review the transcript is often already in hand.
- **Stream the Brain:** stream NVIDIA's output so the corrected transcript fills in live instead of waiting for the whole response.
- **Graceful fallback chain:** if the Brain call fails or times out, fall back to Gemini-only; if that fails, fall back to the offline heuristic — never show an empty result.
- **Retry/backoff** on 429/5xx (already present for Gemini in the current worker — reuse it for NVIDIA).
- **Cache** the last result per clip id so re-opening a clip is instant and Revert is free.

### 4.4 Provider abstraction (build once)
Keep a single `runHybrid(clip, settings)` entry point with a provider registry:
- `audioProviders`: Gemini (default), OpenAI audio, Groq Whisper.
- `textProviders`: NVIDIA Nemotron (default), OpenRouter, Custom/local endpoint.
Adding a provider = adding one adapter, not touching the UI. Every adapter normalizes to the §7.5 JSON contract so the React app only ever sees one shape.

### 4.5 API-key handling
- **Where keys live:** entered in Settings, stored locally only (`ttsc.settings`, see §7.4) — never sent anywhere except the provider's own endpoint. No backend, no telemetry.
- **Per-provider fields:** Gemini key, NVIDIA (NIM) key, plus optional OpenAI / Groq / OpenRouter / Custom endpoint + key. Each has a **Test connection** button that pings a cheap endpoint and shows `✓ Connected` / a clear error.
- **Presence drives mode:** the engine reads which keys exist and auto-selects the best routing mode (§4.2). Show the resolved mode in the top-bar pill; let the user override/pin it.
- **Missing / invalid keys:** if a key is absent the app silently drops to the next available tier (hybrid → single-model → offline heuristic) and never blocks the reviewer. An invalid/expired key surfaces a non-modal toast with a "fix in Settings" link, in the interface's own voice — not an alarm.
- **Security niceties:** mask key fields by default with a reveal toggle; allow clearing a key; optional "session-only" storage that forgets keys on close for shared machines; keys are included in export/import only if the user opts in (§F13).
- **Model selection:** each provider exposes a model dropdown with sensible defaults (Gemini Flash for audio; NVIDIA Nemotron for text) and remaps retired model ids automatically.

---

## 5. Existing features (carried into the React rebuild)

Everything the current extension does must survive the rebuild. Here is the full inventory, grouped, so nothing is lost.

**Portal integration & input**
- One-click **✨ AI Auto-Review** (was "Auto-Validate") that fetches the clip audio, runs the engine, and fills the corrected transcript.
- **React-safe writes:** uses the native value setter + dispatches `input`/`change` so the host portal's state registers the change. *(In the standalone React app this becomes internal state; keep the portal-write path for the injected/companion mode.)*
- **Keyboard shortcuts:** `Alt+A` run review, `Alt+P` play/pause, `Alt+H` toggle stealth.
- **Live clip observer** that detects when a new clip loads and resets the panel.

**AI transcription & cleanup**
- Verbatim preservation of stutters, repeats, misspeaks, and speaker grammar.
- Automatic fixes: broken contraction repair (`doesn t → doesn't`, `i m → I'm`, `they re → they're`, …), casing, sentence starts, and "I".
- **Strict formatting:** numbers → digits, ordinals (`1st/2nd/34th`), acronyms UPPERCASE, proper nouns Title Case, letter-by-letter kept spaced (`h e a t`), `hmm` → `<|hum_tune|>`.
- **Primary-speaker-only** transcription; background/overlapping speakers ignored.

**Tagging**
- Point-in-time **event tags** (20 usable; `<|breath|>` never emitted — breathing rule).
- **Emotion style-wrap** using `<|style_open|>emotion<|style_body|>…<|style_close|>`.
- **19-emotion quick-switch** chips and **event-tag insert** chips (insert at cursor).

**Assist & insight**
- Copilot panel with **review notes** (why an emotion was chosen, what was fixed), **confidence**, and **runner-up** emotion.
- **Offline heuristic engine** when no key is set.
- **Multi-provider settings** with Test Connection.

**UX modes**
- **Stealth mode** (hide everything for screen-sharing).
- Draggable floating panel *(replaced by the docked, resizable workspace in the redesign, but the underlying actions are the same)*.

---

## 6. New features (what makes the rebuild beautiful *and* more useful)

Each feature has a **What / Why / Build** note so it drops straight into the React work. Priority: ⭐ = do first.

### F1 ⭐ Training Knowledge Base (grounding the AI in *your* guide)
- **What:** a Settings area to upload the guideline docs (the Training Guide PDF, the Taxonomy sheet, custom notes). The app parses them and injects the relevant rules + emotion definitions into the system prompt.
- **Why:** the AI's answers become grounded in the *actual* rubric the reviewers are graded on, not generic knowledge.
- **Build:** parse PDFs with `pdfjs-dist`, DOCX with `mammoth`, CSV with `papaparse`; chunk + store in state/IndexedDB; prepend a distilled "house rules" block to the prompt.

### F2 ⭐ Live rule highlighting in the editor
- **What:** as text appears, highlight rule hits inline — a number spelled as a word, a lowercase acronym, a broken contraction, a proper noun that needs casing — each with a one-click fix.
- **Why:** turns the linter from a silent pass into a visible, teachable safety net.
- **Build:** a controlled rich editor (contentEditable or CodeMirror) + the existing lint rules as decorators; click a marker → apply the safe fix.

### F3 ⭐ Original ↔ Corrected diff view
- **What:** toggle a word-level diff so the reviewer sees exactly what the AI changed before accepting.
- **Why:** trust and speed — accept confidently, catch over-corrections.
- **Build:** `jsdiff` (`diffWords`); render insert/delete spans; drives the Accept-vs-Fixed decision.

### F4 ⭐ Waveform audio player
- **What:** real waveform with play/pause, speed (0.5–2×), loop, and **A–B repeat** to re-listen to a tricky moment; click the waveform to seek.
- **Why:** placing event tags and emotion span boundaries accurately needs precise scrubbing.
- **Build:** `wavesurfer.js`; expose current-time so event tags can be stamped "at playhead."

### F5 Emotion-span timeline (open/close made visual)
- **What:** a slim track under the waveform where the reviewer drags the **start (open)** and **end (close)** of the emotion span; multiple spans allowed if emotion shifts.
- **Why:** emotion is a span, not a point — this makes open/close obvious and precise.
- **Build:** map span handles to `<|style_open|>…<|style_body|>…<|style_close|>` insertion points in the text.

### F6 Confidence & cues card
- **What:** confidence bars for the chosen emotion + runner-up, and the vocal cues the AI heard ("rising pitch, light, unhurried").
- **Why:** helps the reviewer agree or override quickly.
- **Build:** render from the JSON contract's `confidence`, `runner_up`, `audio_cues`.

### F7 History, undo & Revert
- **What:** per-clip history of every AI run and manual edit, with one-click **Revert to original** and step undo/redo.
- **Why:** the portal has a "Revert edit" action; match it and make experimentation safe.
- **Build:** keep an edit stack in state; cache AI results per clip id.

### F8 Custom dictionary / never-change list
- **What:** user-maintained lists of proper nouns, brand casings, and acronyms the AI must respect (`Verizon`, `Kyiv Independent`, `CIBIL`), plus "never autocorrect" words.
- **Why:** stops repeat mistakes on domain-specific terms.
- **Build:** store list; inject into prompt and into the lint rules.

### F9 ⭐ Analytics dashboard (the beautiful Dashboard view)
- **What:** the Dashboard in §3 — KPI cards (Accepted/Fixed/Rejected/Total), completions-over-time chart, emotion-distribution donut, recent-clips table, all behind the date filter.
- **Why:** the tool becomes a *product* with a home screen that mirrors the portal but looks great.
- **Build:** `recharts`; feed from locally logged review events; date-range filter in state.

### F10 Guided emotion trainer / quiz
- **What:** an optional practice mode that plays a sample clip (from the Taxonomy sheet's Drive links) and asks the reviewer to pick the emotion, then reveals the answer + cues.
- **Why:** onboards new reviewers and keeps calibration sharp.
- **Build:** pull sample clip IDs from §7.1; simple scored flashcard flow.

### F11 Second-opinion / cross-check
- **What:** optionally ask the Brain to critique the Ear's emotion (or ask a second text provider) and flag disagreement.
- **Why:** catches low-confidence or ambiguous emotions before submit.
- **Build:** reuse the provider registry; show a "models disagree" banner when they differ.

### F12 Themes & accessibility
- **What:** Light / Dark / System, compact density, full keyboard nav, ARIA, WCAG-AA. Stealth mode retained.
- **Why:** long review sessions, varied environments, screen-sharing.
- **Build:** CSS variables for tokens; `prefers-color-scheme`; focus management.

### F13 Export / import & session config
- **What:** export settings, dictionary, and KB as a JSON profile; import to a new machine. Optional CSV export of the analytics log.
- **Why:** portability across reviewers/machines.
- **Build:** serialize state to a file; validate on import.

### F14 Flag-for-QA
- **What:** a one-click "flag this clip" with a note, collected into a review queue.
- **Why:** surfaces tricky clips for a lead without leaving the flow.
- **Build:** add a `flagged` field to the clip log; filter in the dashboard table.

### F15 Command palette & onboarding tour
- **What:** `Ctrl/Cmd+K` palette (jump to view, run review, insert tag, switch emotion) and a first-run guided tour.
- **Why:** power-user speed + a gentle start for newcomers.
- **Build:** `cmdk` + `fuse.js` for fuzzy search; `react-joyride` for the tour.

---

## 7. Reference appendix (build data — copy straight into code)

Everything here is extracted from the official **Taxonomy sheet** (`reference/pdf.pdf`) and **Training Guide** (`reference/pdff.pdf`). This is the ground-truth data the React app and the AI prompt must use.

### 7.1 The 19 official emotions

| Emotion | What it means | Listen for | Don't confuse with |
| :--- | :--- | :--- | :--- |
| **Anger** | Very mad or upset; strong, sharp, tense voice. | Forceful/tense voice; sharp stress; clipped phrasing. | Annoyed (milder) · Loud (only volume) · Menacing (a threat) |
| **Annoyed** | Irritated or tired of something, not strongly angry. | Exasperated/flat tone; drawn-out words; sighing quality. | Anger (stronger) · Sarcastic (opposite of words) · Sad |
| **Awe** | Amazed by something beautiful or impressive. | Breathy/open tone; slower pace; wider pitch; reverent. | Surprised · Joyful · Excited (more energy) |
| **Curious** | Wants to know, learn, or understand something. | Questioning intonation; upward inflection; inviting pace. | Thoughtful · Surprised · Nervous |
| **Excited** | Very eager, happy, full of energy. | Faster pace; higher pitch; lively rhythm; positive emphasis. | Joyful (calmer) · Surprised · Loud |
| **Fearful** | Afraid because something bad may happen. | Shaky/breathy voice; urgency; higher pitch; gasps. | Nervous (no clear danger) · Surprised · Whisper |
| **Flirty** | Playful, shows romantic interest. | Teasing warmth; suggestive stress; soft/inviting delivery. | Tender (not romantic) · Mischievous · Joyful |
| **Joyful** | Clearly happy, pleased, delighted. | Smiling voice; bright resonance; buoyant, warm energy. | Excited (more energy) · Smug · Tender |
| **Loud** | High volume / shouting; emotion may differ. | Strong amplitude; voice carries forcefully; shouted. | Anger · Excited · Menacing |
| **Menacing** | Threatening or dangerous. | Controlled low tone; deliberate pacing; ominous stress. | Anger (not threatening) · Loud · Smug |
| **Mischievous** | Playful/cheeky; planning harmless trouble. | Conspiratorial/cheeky tone; playful stress; knowing rhythm. | Menacing · Flirty · Sarcastic |
| **Nervous** | Worried, unsure, uncomfortable; may shake/hesitate. | Hesitations; uneven rhythm; tight/shaky pitch; fillers. | Fearful (clear danger) · Whisper |
| **Sad** | Unhappy, hurt, disappointed, low energy. | Lower energy; slower pace; softer volume; falling pitch. | Tender · Nervous · Whisper |
| **Sarcastic** | Mocking; means the opposite of the words. | Exaggerated stress; dry/flat tone; mismatch with wording. | Annoyed · Smug · Mischievous |
| **Smug** | Very pleased with self; feels superior. | Knowing tone; relaxed certainty; condescending emphasis. | Joyful · Sarcastic · Menacing |
| **Surprised** | Reacts to something unexpected. | Sudden pitch jump; sharp onset; brief gasp or pause. | Awe · Excited · Fearful |
| **Tender** | Soft, gentle, caring, loving. | Soft warm tone; smooth pace; calm, intimate delivery. | Flirty · Sad · Whisper |
| **Thoughtful** | Calm and carefully thinking. | Measured pace; intentional pauses; emphasis on key ideas. | Curious · Nervous · Sad |
| **Whisper** | Very quiet, soft, breathy voice. | Breathy phonation; minimal projection; close, soft delivery. | Tender · Fearful · Nervous |

### 7.2 Reference sample clips (from the Taxonomy sheet)

Three reference clips per emotion for ear-training (used by **F10** and the Guide view). Links are Google Drive `file/d/{id}/view`.

| Emotion | Sample 1 | Sample 2 | Sample 3 |
| :--- | :--- | :--- | :--- |
| Anger | [▶](https://drive.google.com/file/d/1sNvEhdtZ5gqxrARpj1m-ZpK_OszsjCuE/view) | [▶](https://drive.google.com/file/d/1PlfjECwcOBTIO71V52Ui58DMflvXWU-k/view) | [▶](https://drive.google.com/file/d/1sPJzajHQE7ZAm-BYPrX8b-bUhqGJQ7Yh/view) |
| Annoyed | [▶](https://drive.google.com/file/d/1sYUZoooNei9H9dKHQtsC8lWX_rYnPOYU/view) | [▶](https://drive.google.com/file/d/1i0D_OEErnP-6OQWQoa0XB33GP5oUTrGW/view) | [▶](https://drive.google.com/file/d/11-pyaD05MG7cVKijwzPiDpReXigO5jhq/view) |
| Awe | [▶](https://drive.google.com/file/d/1Xt5wD07oPPs5i2ioW67FFCS9t-0ftUvB/view) | [▶](https://drive.google.com/file/d/1C6sNneKZJunqyWl6c5W60Rp3H7Cm-xao/view) | [▶](https://drive.google.com/file/d/1EmDrj3CXpUVD41_bZeeh4QPDRQkrZyOv/view) |
| Curious | [▶](https://drive.google.com/file/d/1eJ-DmIzJb8AN5B3YRXfnfI5nGWdV69tj/view) | [▶](https://drive.google.com/file/d/178LAUisk6iKbUr4oSnQumdxGJpAOZZJ2/view) | [▶](https://drive.google.com/file/d/1MztgVQleyx8E0Fox0x_cQtb4rv3ypzRD/view) |
| Excited | [▶](https://drive.google.com/file/d/10ymKSkD1tkAgJzDZZliVJc-bFb2GAXOK/view) | [▶](https://drive.google.com/file/d/1mZuTL_56TR6cqjQhvz1d1TQZnxdFJAmF/view) | [▶](https://drive.google.com/file/d/1Jpgu91TQsHLHgph0AB66mgERBfJBOO7d/view) |
| Fearful | [▶](https://drive.google.com/file/d/1-21X_la2wvjTuYGklmiapfPTfs79IZmO/view) | [▶](https://drive.google.com/file/d/1etpZgM9ADaWKjvvNHfOmVPZWHrGSRVzb/view) | [▶](https://drive.google.com/file/d/11-Jowpp2ZVMimQDctxulR3_eXHcp3H4o/view) |
| Flirty | [▶](https://drive.google.com/file/d/1nGGozA7VUBacgRuxe_hNglpec_Ddjp6l/view) | [▶](https://drive.google.com/file/d/1oZGn4B9d4lhuvPPOnImFnNWGWJ1ys46r/view) | [▶](https://drive.google.com/file/d/1HBJPH4z58RsKN1fg3SWNU9WEjBuz8jgb/view) |
| Joyful | [▶](https://drive.google.com/file/d/1R5jaoFmp95yUB8cl0dZseziXLfXzLX-A/view) | [▶](https://drive.google.com/file/d/1YEaoDiAY_TkWfTc1oSGpxiln0BDHRP2L/view) | [▶](https://drive.google.com/file/d/1_FCMpfk90iXT4pHs3bzAb_V53BwmrIqV/view) |
| Loud | [▶](https://drive.google.com/file/d/1E3NCyxLUK7PlFPdXqF0hS3x5T4kMHyOP/view) | [▶](https://drive.google.com/file/d/1Md5GFQbGvvlbEsNdf-Iy0dmbJjSTfr7n/view) | [▶](https://drive.google.com/file/d/1qgDM6cyH8V6Wjrvx9bOUqQElEk52fBwi/view) |
| Menacing | [▶](https://drive.google.com/file/d/1PSQlztcf6Lnzs3g2IhefnfmEzIp0U1rW/view) | [▶](https://drive.google.com/file/d/1f9xeDaRk_aVRYP-7oirHzfh6hDn07TXq/view) | [▶](https://drive.google.com/file/d/1IYBvj7PW2J5aSD2YsiGW4WnEez-NKcXH/view) |
| Mischievous | [▶](https://drive.google.com/file/d/14MH9BRtq0pRD5hXEtR7wv_bNLFy4UNai/view) | [▶](https://drive.google.com/file/d/1tC5UlRs1NyFSzAWCPgcFIyThvDDzEq3y/view) | [▶](https://drive.google.com/file/d/1u4aGskPzBi4Od4ywv96j25oupWHuSrc-/view) |
| Nervous | [▶](https://drive.google.com/file/d/1jAhjRVBFCuO_aemNuNBq87d4vo3_xKYE/view) | [▶](https://drive.google.com/file/d/11_9UtTws5Z4N_YI_leqZOTGDtWI44x8X/view) | [▶](https://drive.google.com/file/d/1TovoJU7mg9mM0cl9S_UcVy1OqCStaNFb/view) |
| Sad | [▶](https://drive.google.com/file/d/1Rb9qKTP8pPOc9RwPOrRxPDaY6goVdhOe/view) | [▶](https://drive.google.com/file/d/19xYgeol9LYWJXHpreaYI3Q8xfwoMiCFt/view) | [▶](https://drive.google.com/file/d/14SmhlmxgF2LFayRF243WZrcBdTRWROG8/view) |
| Sarcastic | [▶](https://drive.google.com/file/d/1ew4gGYOgQlsQTgCLpxa9uk5XKgDVLQui/view) | [▶](https://drive.google.com/file/d/1IRXLouh9RE7bpJX31SWgqyZmcP9r_L3B/view) | [▶](https://drive.google.com/file/d/1q6hDwouBlcmpIsOvUuu_EmM4_Eoc-WLu/view) |
| Smug | [▶](https://drive.google.com/file/d/1IFwR7sJ-pN6Q30y7jLiMRknhecHwwRMR/view) | [▶](https://drive.google.com/file/d/1h51SKBa0VTNtpU6mI6nNP2dbkm8snEmf/view) | [▶](https://drive.google.com/file/d/1dRqiGsfiisTw1b_8GitD2OwEk0UvxO0l/view) |
| Surprised | [▶](https://drive.google.com/file/d/1EAD-ai91NLejNbtX-QHoGz_LEYD5V_vy/view) | [▶](https://drive.google.com/file/d/1jMVi613VRPvXYUuFEsQPhEJp3d5ozMWx/view) | [▶](https://drive.google.com/file/d/1faD7vETERlAkUCTllWX6AJTOv49CFp5G/view) |
| Tender | [▶](https://drive.google.com/file/d/1ctW_EppmD0HaSbJ16DkmYuHmE0zuh8em/view) | [▶](https://drive.google.com/file/d/1_N26T9UtwcyeTe114mcGAD_p5cldzko9/view) | [▶](https://drive.google.com/file/d/1nYl9vfF97eMUOchwOPWcG6AFC3LCK3vc/view) |
| Thoughtful | [▶](https://drive.google.com/file/d/1TeyMeHJp2pwJsNYV9hp3gxV_BZp0KJne/view) | [▶](https://drive.google.com/file/d/1b9xd9k9nkNVpbhYT8YSc7Zxl0pN1Jg6u/view) | [▶](https://drive.google.com/file/d/1Ox97FHdBuBx49DulKpnn1EZjSzfkcC5y/view) |
| Whisper | [▶](https://drive.google.com/file/d/1zjNtOA0IZcY8sD3ul0i8fU50J-Ukuytk/view) | [▶](https://drive.google.com/file/d/1WY7IIrtwF66I9w4LfggRSwlWSY26aqF2/view) | [▶](https://drive.google.com/file/d/1dQKFID1HpxHcQKk1qOvy59EgFbFfwWZ4/view) |

### 7.3 Event tags & transcription rules

**20 usable event tags** (point-in-time, inserted at the exact instant the sound occurs):

```
<|laugh|>  <|chuckle|>  <|giggle|>  <|sigh|>  <|sniff|>
<|cough|>  <|throat_clear|>  <|lip_smack|>  <|gulp|>  <|gasp|>
<|yawn|>   <|snort|>  <|cry|>  <|woo|>  <|hum_tune|>
<|tsk|>    <|um|>  <|uh|>  <|inhale|>  <|exhale|>
```

**Breathing rule (critical):** never emit `<|breath|>`. Use `<|inhale|>` / `<|exhale|>` only for long, clearly audible breaths; ignore normal background breathing.

**Formatting rules the AI + linter enforce:**

| Rule | Do | Example |
| :--- | :--- | :--- |
| Numbers | Digits, not words | `10 dollar`, not "ten dollar" |
| Ordinals | Number + suffix | `1st`, `2nd`, `22nd`, `34th` |
| Acronyms | UPPERCASE | `ATM`, `PAN`, `UFC`, `USA` |
| Proper nouns | Title/Sentence case | `Verizon`, `Los Angeles`, `Montreal Protocol` |
| Contractions | Repair broken ASR | `doesn t → doesn't`, `i m → I'm`, `they re → they're` |
| Letter-by-letter | Keep spaced | `h e a t` |
| Hum tone | Tag it | `hmm` → `<|hum_tune|>` |
| Stutters/repeats | Keep verbatim | `I think I think`, `d de decide` |
| Speakers | Primary only | ignore overlapping/background |
| Grammar | Keep speaker's own | don't "fix" real grammar |

### 7.4 Statuses & local storage keys

**Review statuses** (drive the dashboard KPIs): **Accepted** (no changes), **Fixed** (edited then approved), **Rejected** (major violation), **Total Submitted** (all worked clips).

**Suggested persisted keys** (localStorage / IndexedDB):

```
ttsc.settings        provider keys, hybrid mode, theme, density
ttsc.dictionary      custom proper nouns / never-change list  (F8)
ttsc.kb              parsed knowledge-base chunks             (F1)
ttsc.log             per-clip review events for analytics     (F9)
ttsc.cache.<clipId>  last AI result per clip (revert/instant) (F7)
ttsc.flags           flagged clips + notes                    (F14)
```

### 7.5 The standardized AI JSON contract

Every provider adapter (Ear, Brain, hybrid, offline) normalizes to this one shape, so the React UI only ever renders one object:

```json
{
  "corrected_transcript_clean": "For a 10 dollar pass, Verizon will pick this up here.",
  "tagged_transcript": "<|style_open|>curious<|style_body|>For a 10 dollar pass, <|inhale|>Verizon will pick this up here.<|style_close|>",
  "emotion": "curious",
  "runner_up": "thoughtful",
  "confidence": 0.72,
  "events": [{ "tag": "inhale", "at_ms": 40 }],
  "spans": [{ "emotion": "curious", "start_ms": 0, "end_ms": 3000 }],
  "review_notes": "Rising, unhurried, questioning tone → curious. Fixed 'ten'→'10'; capitalized 'Verizon'.",
  "engine": "hybrid",
  "audio_listened": true
}
```

- `audio_listened: false` when NVIDIA-only text mode ran — the UI shows a "verify emotion" hint.
- `engine` is one of `hybrid | gemini | nvidia | offline` and is echoed in the top-bar status pill.

### 7.6 Suggested React component tree

```
<App>
 ├─ <TopBar engineStatus themeToggle />
 ├─ <Sidebar activeView />
 └─ <Main>
     ├─ <DashboardView>      (F9)
     │   ├─ <DateFilter/> <KpiCard×4/> <CompletionsChart/> <EmotionDonut/> <RecentClipsTable/>
     ├─ <ReviewView>         (core)
     │   ├─ <SourcePane>  <Waveform/>(F4) <SpanTimeline/>(F5) <OriginalTranscript/> <ClipMeta/>
     │   └─ <ReviewPane>  <Toolbar AutoReview/> <RichEditor/>(F2) <DiffToggle/>(F3)
     │                    <InsightCard/>(F6) <EmotionChips/> <EventChips/> <ActionBar Accept/Reject/Revert/>(F7)
     ├─ <GuideView emotions samples />   (7.1/7.2, F10)
     └─ <SettingsView providers hybridSwitch kb dictionary />  (F1/F8/F12)
 └─ <CommandPalette/>(F15)  <Toaster/>  <Tour/>(F15)
```

### 7.7 Libraries to reach for

| Need | Library |
| :--- | :--- |
| Waveform / audio | `wavesurfer.js` |
| Word-level diff | `diff` (jsdiff) |
| Charts | `recharts` |
| Command palette + fuzzy | `cmdk` + `fuse.js` |
| PDF / DOCX / CSV parsing (KB) | `pdfjs-dist`, `mammoth`, `papaparse` |
| Onboarding tour | `react-joyride` |
| State + persistence | `zustand` (or Redux Toolkit) + localStorage/IndexedDB |
| Rich editor (highlighting) | CodeMirror 6 or a contentEditable wrapper |

### 7.8 Technical requirements (consolidated)
- **Stack:** React 18 + TypeScript, Vite build. Functional components + hooks; one shared design-token stylesheet (CSS variables) driving light/dark/system.
- **State:** a single store (`zustand` or Redux Toolkit) with slices for `settings`, `review` (current clip + edit stack), `dashboard` (log + filters), `kb`, `dictionary`, `flags`. Persist via `localStorage`/IndexedDB using the §7.4 keys.
- **AI layer:** one `runHybrid(clip, settings)` entry, a provider registry (audio + text adapters), streaming support, retry/backoff on 429/5xx, and normalization to the §7.5 JSON contract. No secrets leave the device (§4.5).
- **Audio:** fetch the clip blob, decode for `wavesurfer.js`, expose current playhead time so event tags stamp accurately.
- **Editor:** controlled rich text with live lint decorators (F2) and a word-level diff view (F3) from `jsdiff`.
- **Packaging targets:** web SPA, installable PWA (own window), optional Electron/Tauri desktop wrapper — same build (§3.4).
- **Quality floor:** responsive to ~360px, full keyboard nav, visible focus, `prefers-reduced-motion` and `prefers-color-scheme` respected, WCAG-AA contrast, no layout shift on load.
- **Performance:** prefetch audio on clip load, stream Brain output, cache per-clip results; target interaction-to-paint under ~100ms for chip/emotion changes.
- **Offline:** the heuristic linter must run with zero keys so the tool is never dead.

### 7.9 Source files & linked resources
- **Training Guide** — `reference/pdff.pdf` (4-stage workflow, status definitions, emotion-span mechanics, per-emotion appendix). Ground truth for §2 and §7.1.
- **Taxonomy sheet** — `reference/pdf.pdf` (emotion definitions, listen-for cues, look-alikes, and the 57 Drive sample clips). Ground truth for §7.1–§7.2.
- **Legacy README** — `reference/readme.md` (original feature list; superseded by §5).
- **Portal** — `https://tts-review.sabi.com/` (the live review platform this tool assists).
- **Provider consoles** — Gemini keys: `https://aistudio.google.com/app/apikey`; NVIDIA NIM: `https://build.nvidia.com/`.
- **Emotion sample clips** — the Google Drive links enumerated in §7.2 (three per emotion).

---


## 8. Suggested build order

Build in slices so there's always a working app.

1. **Shell & design system** — sidebar + top bar + three empty views, tokens, theme toggle (§3.2). *Get the "product" feel first.*
2. **Review core** — SourcePane + ReviewPane, wire the existing engine call, native-safe portal write. Waveform (F4) + rich editor (F2).
3. **Hybrid engine** (§4) — provider registry, Ear/Brain roles, auto-detect keys, fallback chain, streaming.
4. **Emotion + events** — chips, span open/close, span timeline (F5), diff (F3), insight card (F6).
5. **Dashboard** (F9) — logging, KPI cards, charts, recent-clips table, date filter.
6. **Knowledge & settings** — KB upload/parse (F1), dictionary (F8), provider settings, export/import (F13).
7. **Guide + trainer** — 19-emotion reference + samples (§7.1/7.2), quiz (F10).
8. **Polish** — history/undo (F7), flag-for-QA (F14), command palette + tour (F15), a11y pass, stealth, compact density.

---

## 9. How this maps to your goals

- **"Not more than an extension → a clear, large, professional window."** §3 replaces the cramped popup with a docked sidebar + spacious two-pane workspace and a real Dashboard, on a proper grid with a calm design system.
- **"Dashboard like the window."** The Dashboard (§3 View A / F9) shares the exact same shell, tokens, and components as the review window, so they feel like one product.
- **"Use Gemini and NVIDIA, switch between them; one for speech-to-text, one for better responses; one key is fine too."** §4 defines the Ear (Gemini audio) + Brain (NVIDIA text) hybrid with auto mode-detection and graceful single-key / offline fallback.
- **"Responsive and looks too good."** §3.3 covers desktop/tablet/mobile stacking, themes, motion, and accessibility.
- **"Grounded in the training files."** §2 and §7 are extracted directly from the Training Guide + Taxonomy sheet, and F1 lets the AI ingest them at runtime.

**Where each requirement is specified** (so this one file is enough to build from):

| Requirement | Section |
| :--- | :--- |
| UI / dashboard structure | §3.1, F9 |
| Window behavior (standalone, not popup) | §3.4 |
| Existing functionality | §5 |
| New features | §6 (F1–F15) |
| User workflow | §2, §3.1 (View B) |
| Gemini / NVIDIA model usage | §4.1 |
| Speech-to-text flow | §4.1 (Ear) |
| Response-generation flow | §4.1 (Brain) |
| Model switching / fallback | §4.2, §4.3 |
| API-key handling | §4.5 |
| Responsiveness | §3.3 |
| UX requirements | §3.2, §3.3 |
| Technical requirements | §7.6, §7.7, §7.8 |
| Links / resources | §7.2, §7.9 |

*This `ADDING_NEW_FEATURES.md` is the single, self-contained deliverable — no other files are needed to build the app. End of guide.*












