// TTS Review Copilot — dashboard application (vanilla ES module, no build step).
// Views: Dashboard (F9) · Review (core) · Guide (§7.1/F10) · Settings (F1/F8/F12/F13).
// Runs as an extension page: host_permissions give the engine CORS-free provider calls.

import { EMOTIONS, normalizeEmotion, EVENT_TAGS, TAXONOMY, SAMPLES, SAMPLE_URL, STATUSES } from "./guide-data.mjs";
import { lintText, applyFix, wrapSpan, diffWords, diffHasChanges, detectMode, normalizeResult, heuristicClean, aggregateLog } from "./lib-core.mjs";
import { runReview, testProvider } from "./engine.js";

// ---------- tiny helpers ----------
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtTime = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(1).padStart(4, "0")}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function toast(msg, kind = "info", ms = 4200) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), ms);
}
function modal(html, { onOpen } = {}) {
  const root = $("modal-root");
  const ov = document.createElement("div");
  ov.className = "overlay";
  ov.innerHTML = `<div class="modal">${html}</div>`;
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
  root.appendChild(ov);
  if (onOpen) onOpen(ov);
  return ov;
}

// ---------- state ----------
const SAMPLE_CLIPS = [
  { id: "ZyG8FSeTFKA_speaker_0_1340", title: "Sample 1 — numbers (Verizon)", transcript: "for a ten dollar pass verizon will pick this up here" },
  { id: "UfcPodcast_speaker_1_0042", title: "Sample 2 — contractions (podcast)", transcript: "i m telling you it s crazy he doesn t even care about that" },
  { id: "KyivReport_speaker_0_0891", title: "Sample 3 — proper nouns (news)", transcript: "kyiv independent confirmed they re preparing the report today" }
];
const PROVIDERS = [
  { id: "gemini", name: "🔷 Gemini", keyId: "geminiApiKey", modelId: "geminiModel", models: ["gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest"], getKey: "https://aistudio.google.com/app/apikey" },
  { id: "nvidia", name: "🟩 NVIDIA NIM", keyId: "nvidiaApiKey", modelId: "nvidiaModel", models: ["nvidia/nemotron-3-super-120b-a12b", "nvidia/llama-3.1-nemotron-ultra-253b-v1", "nvidia/nemotron-3.5-lightning-30b-a3b", "deepseek-ai/deepseek-v4.1-flash", "mistralai/mistral-large-2-instruct"], getKey: "https://build.nvidia.com/" },
  { id: "openai", name: "🟢 OpenAI", keyId: "openaiApiKey", modelId: "openaiModel", models: ["gpt-4o-audio-preview", "gpt-4o", "gpt-4o-mini", "gpt-4.1-mini"], getKey: "https://platform.openai.com/api-keys" },
  { id: "groq", name: "⚡ Groq", keyId: "groqApiKey", modelId: "groqModel", models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "mixtral-8x7b-32768"], getKey: "https://console.groq.com/keys" },
  { id: "openrouter", name: "🌐 OpenRouter", keyId: "openrouterApiKey", modelId: "openrouterModel", models: ["google/gemini-2.5-flash", "openai/gpt-4o", "anthropic/claude-sonnet-4", "meta-llama/llama-3.3-70b-instruct"], getKey: "https://openrouter.ai/keys" },
  { id: "custom", name: "🔧 Custom / local", keyId: "customApiKey", modelId: "customModel", models: ["llama3"], getKey: "" }
];

const syncKeys = ["geminiApiKey", "geminiModel", "nvidiaApiKey", "nvidiaModel", "openaiApiKey", "openaiModel",
  "groqApiKey", "groqModel", "openrouterApiKey", "openrouterModel", "customBaseUrl", "customApiKey", "customModel",
  "offlineMode", "autoRunOnNext", "autoPlayAudio", "styleSpanPref"];

const state = {
  settings: {}, prefs: { engineMode: "auto", theme: "system", density: "roomy", kbInject: true, tourDone: false, secondOpinion: false, lastView: "dashboard" },
  dictionary: { properNouns: [], neverChange: [] },
  kb: [], log: [], flags: [],
  view: "dashboard", range: "today", customFrom: "", customTo: "",
  clip: null, result: null,
  hist: [], histIdx: -1,
  wave: { peaks: [], duration: 0, playing: false, loop: false, a: null, b: null, raf: 0 },
  lintTimer: 0
};
let audioEl = null, actx = null, audioBuffer = null;

// ---------- storage ----------
const getSync = (keys) => chrome.storage.sync.get(keys);
const setSync = (o) => chrome.storage.sync.set(o);
const getLocal = (keys) => chrome.storage.local.get(keys);
const setLocal = (o) => chrome.storage.local.set(o);

async function loadAll() {
  const [sync, local] = await Promise.all([getSync([...syncKeys, "ttsc.settings"]), getLocal(["ttsc.log", "ttsc.flags", "ttsc.dictionary", "ttsc.kb"])]);
  state.settings = sync;
  Object.assign(state.prefs, sync.ttsc.settings || {});
  state.log = local["ttsc.log"] || [];
  state.flags = local["ttsc.flags"] || [];
  state.dictionary = local["ttsc.dictionary"] || { properNouns: [], neverChange: [] };
  state.kb = local["ttsc.kb"] || [];
}
const savePrefs = () => setSync({ "ttsc.settings": state.prefs });

// ---------- theme / density / nav ----------
function applyTheme() {
  const t = state.prefs.theme;
  const eff = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
  document.documentElement.dataset.theme = eff;
  $("btn-theme").textContent = t === "system" ? "🌗" : t === "dark" ? "🌙" : "☀️";
}
function applyDensity() {
  document.documentElement.dataset.density = state.prefs.density;
  $("btn-density").textContent = `Density: ${state.prefs.density === "compact" ? "Compact" : "Roomy"}`;
}
function setView(v) {
  if (!["dashboard", "review", "guide", "settings"].includes(v)) v = "dashboard";
  state.view = v;
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  $$(".view").forEach((s) => { s.style.display = s.id === `view-${v}` ? "" : "none"; });
  $("tb-title").textContent = v[0].toUpperCase() + v.slice(1);
  state.prefs.lastView = v; savePrefs();
  if (v === "dashboard") renderDashboard();
}

// ---------- engine pill ----------
function updateEnginePill() {
  const mode = detectMode(state.settings, state.prefs.engineMode === "offline" ? "offline" : (state.prefs.engineMode || "auto"));
  const labels = { hybrid: "Hybrid: Gemini + NVIDIA", gemini: "Gemini only", nvidia: "NVIDIA only (text)", offline: "Offline heuristic" };
  $("engine-text").textContent = labels[mode];
  $("engine-dot").className = `dot ${mode}`;
}

// ---------- Dashboard (F9) ----------
function rangeToFromTo() {
  const now = new Date();
  const day = (d) => d.toISOString().slice(0, 10);
  if (state.range === "today") return { from: day(now), to: day(now) };
  if (state.range === "7d") { const f = new Date(now - 6 * 864e5); return { from: day(f), to: day(now) }; }
  if (state.range === "30d") { const f = new Date(now - 29 * 864e5); return { from: day(f), to: day(now) }; }
  if (state.range === "custom") return { from: state.customFrom || null, to: state.customTo || null };
  return null;
}
function renderDashboard() {
  const agg = aggregateLog(state.log, rangeToFromTo());
  const { kpis } = agg;
  const pct = (n) => kpis.total ? `${Math.round((n / kpis.total) * 100)}% of total` : "—";
  $("kpi-accepted").textContent = kpis.accepted; $("kpi-accepted-sub").textContent = pct(kpis.accepted);
  $("kpi-fixed").textContent = kpis.fixed; $("kpi-fixed-sub").textContent = pct(kpis.fixed);
  $("kpi-rejected").textContent = kpis.rejected; $("kpi-rejected-sub").textContent = pct(kpis.rejected);
  $("kpi-total").textContent = kpis.total;

  drawBars($("chart-days"), agg.byDay);
  renderDonut(agg.byEmotion, kpis.total);

  const flagged = new Set(state.flags.map((f) => f.clipId));
  const rows = agg.recent.filter((e) => !$("chk-flags").checked || flagged.has(e.clipId));
  $("recent-body").innerHTML = rows.length ? rows.map((e) => {
    const st = e.status === "accepted" ? "ok" : e.status === "fixed" ? "warn" : "bad";
    return `<tr data-clip="${esc(e.clipId)}" style="cursor:pointer;">
      <td>${esc(e.clipId)}</td>
      <td><span class="pill" style="border-color:transparent"><b class="dot ${st}" style="display:inline-block;margin-right:6px"></b>${esc(e.status)}</span></td>
      <td>${esc(e.emotion || "—")}</td>
      <td>${e.confidence != null ? Math.round(e.confidence * 100) + "%" : "—"}</td>
      <td>${esc(e.engine || "—")}${e.audioListened ? "" : " · text"}</td>
      <td class="muted small">${new Date(e.ts).toLocaleString()}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="6" class="muted">No reviews logged in this range yet — run one in the Review view.</td></tr>`;
  $$("#recent-body tr[data-clip]").forEach((tr) => tr.addEventListener("click", () => openCachedClip(tr.dataset.clip)));
}

function drawBars(canvas, days) {
  const ctx = canvas.getContext("2d");
  const W = canvas.clientWidth || 500, H = canvas.height;
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.clearRect(0, 0, W, H);
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--accent").trim() || "#6d5ef0";
  const muted = css.getPropertyValue("--muted").trim() || "#888";
  const data = days.slice(-30);
  if (!data.length) { ctx.fillStyle = muted; ctx.font = "13px Inter, sans-serif"; ctx.fillText("No completions in this range yet.", 12, H / 2); return; }
  const max = Math.max(...data.map((d) => d.count), 1);
  const bw = Math.max(8, Math.min(40, (W - 20) / data.length - 8));
  const pad = 8;
  data.forEach((d, i) => {
    const x = pad + i * ((W - 2 * pad) / data.length);
    const h = (d.count / max) * (H - 34);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(x, H - 22 - h, bw, h, 4);
    ctx.fill();
    ctx.fillStyle = muted; ctx.font = "10.5px Inter, sans-serif"; ctx.textAlign = "center";
    ctx.fillText(d.count > 0 ? d.count : "", x + bw / 2, H - 26 - h);
    if (data.length <= 12 || i % Math.ceil(data.length / 8) === 0) ctx.fillText(d.day.slice(5), x + bw / 2, H - 8);
  });
}
const DONUT_COLORS = ["#6d5ef0", "#34d399", "#fbbf24", "#f87171", "#60a5fa", "#f472b6", "#a3e635", "#fb923c", "#94a3b8"];
function renderDonut(byEmotion, total) {
  const wrap = $("donut-wrap");
  if (!byEmotion.length) { wrap.innerHTML = `<div class="muted small" style="padding:20px 0">No emotions logged yet.</div>`; return; }
  const top = byEmotion.slice(0, 8);
  const other = byEmotion.slice(8).reduce((s, x) => s + x.count, 0);
  const segs = other ? top.concat([{ emotion: "other", count: other }]) : top;
  const R = 52, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = segs.map((s, i) => {
    const frac = s.count / total;
    const dash = `${frac * C} ${C - frac * C}`;
    const rot = `rotate(${(off / C) * 360} 70 70)`;
    off += frac * C;
    return `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${DONUT_COLORS[i % DONUT_COLORS.length]}" stroke-width="22" stroke-dasharray="${dash}" transform="${rot}"><title>${esc(s.emotion)}: ${s.count}</title></circle>`;
  }).join("");
  const legend = segs.map((s, i) => `<span class="row-gap" style="font-size:12.5px"><span style="width:10px;height:10px;border-radius:3px;background:${DONUT_COLORS[i % DONUT_COLORS.length]};display:inline-block"></span>${esc(s.emotion)} (${s.count})</span>`).join(" ");
  wrap.innerHTML = `<div class="row-wrap" style="gap:18px"><svg width="140" height="140" viewBox="0 0 140 140">${arcs}<text x="70" y="75" text-anchor="middle" fill="currentColor" font-size="22" font-weight="700">${total}</text></svg><div style="display:flex;flex-direction:column;gap:5px">${legend}</div></div>`;
}

// ---------- Review ----------
function setEditorText(text, { history = true } = {}) {
  if (history) pushHistory($("editor").value);
  $("editor").value = text;
  scheduleLint();
}
function pushHistory(text) {
  state.hist = state.hist.slice(0, state.histIdx + 1);
  state.hist.push(text);
  if (state.hist.length > 60) state.hist.shift();
  state.histIdx = state.hist.length - 1;
  updateHistButtons();
}
function updateHistButtons() {
  $("btn-undo").disabled = state.histIdx <= 0;
  $("btn-redo").disabled = state.histIdx >= state.hist.length - 1;
}

async function loadClip(clip) {
  stopWaveLoop();
  state.clip = { ...clip };
  state.result = null;
  state.hist = []; state.histIdx = -1;
  $("clip-title").textContent = `Clip: ${clip.id}`;
  $("orig-transcript").textContent = clip.transcript || "—";
  $("clip-meta").textContent = clip.meta || "";
  $("editor").value = "";
  $("stream-note").textContent = "";
  $("insight").style.display = "none";
  $("rv-status").textContent = "Clip loaded. Run ✨ AI Auto-Review, or edit manually — the live Rule Check watches as you type.";
  $("wave-empty").style.display = "";
  $("span-region").style.display = "none";
  renderLint([]);
  updateHistButtons();
  await initWaveform(clip.audioSrc);
}

async function loadFromPortal() {
  const { "ttsc.currentClip": cur } = await getLocal(["ttsc.currentClip"]);
  if (!cur) { toast("No clip received from the portal yet. Open the portal Review tab with the extension active.", "warn"); return; }
  await loadClip({ id: cur.clipId || "portal-clip", audioSrc: cur.audioSrc || "", transcript: cur.transcript || "", meta: `Speaker/source from portal · received ${new Date(cur.ts).toLocaleTimeString()}` });
  toast("Portal clip loaded into Review.", "ok");
}

async function loadSample(idx) {
  const s = SAMPLE_CLIPS[idx];
  if (!s) return;
  await loadClip({ id: s.id, audioSrc: "http://localhost:8080/sample.wav", transcript: s.transcript, meta: "Bundled simulator sample — serve test-portal/ on :8080 for audio." });
}

// --- waveform (F4) ---
async function initWaveform(audioSrc) {
  const canvas = $("wave");
  const ctx2d = canvas.getContext("2d");
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);
  state.wave = { peaks: [], duration: 0, playing: false, loop: false, a: null, b: null, raf: 0 };
  $("ab-info").textContent = "";
  if (audioEl) { audioEl.pause(); audioEl.src = ""; }
  audioBuffer = null;
  if (!audioSrc) { drawWavePlaceholder("No audio source for this clip."); return; }
  try {
    const resp = await fetch(audioSrc);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    actx = actx || new AudioContext();
    audioBuffer = await actx.decodeAudioData(buf);
    const ch = audioBuffer.getChannelData(0);
    const width = 900, bins = Math.min(width, 1200), size = Math.floor(ch.length / bins);
    const peaks = [];
    for (let i = 0; i < bins; i++) {
      let peak = 0;
      for (let j = 0; j < size; j += 16) { const v = Math.abs(ch[i * size + j] || 0); if (v > peak) peak = v; }
      peaks.push(peak);
    }
    state.wave.peaks = peaks;
    state.wave.duration = audioBuffer.duration;
    audioEl = audioEl || new Audio();
    audioEl.src = audioSrc;
    audioEl.playbackRate = parseFloat($("sel-speed").value) || 1;
    $("wave-empty").style.display = "none";
    $("time-dur").textContent = fmtTime(state.wave.duration);
    drawWave();
    startWaveLoop();
  } catch (e) {
    drawWavePlaceholder(`Waveform unavailable (${e.message}). Playback controls still work if the audio loads.`);
  }
}
function drawWavePlaceholder(msg) { $("wave-empty").style.display = ""; $("wave-empty").textContent = msg; }
function drawWave() {
  const canvas = $("wave");
  const W = canvas.clientWidth || 800, H = canvas.height;
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
  const ctx2d = canvas.getContext("2d");
  ctx2d.scale(devicePixelRatio, devicePixelRatio);
  ctx2d.clearRect(0, 0, W, H);
  const peaks = state.wave.peaks;
  if (!peaks.length) return;
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue("--accent").trim();
  const mid = H / 2;
  const n = peaks.length, barW = W / n;
  const pos = audioEl && state.wave.duration ? (audioEl.currentTime / state.wave.duration) : 0;
  for (let i = 0; i < n; i++) {
    const h = Math.max(2, peaks[i] * (H - 10));
    ctx2d.fillStyle = i / n <= pos ? accent : css.getPropertyValue("--muted").trim();
    ctx2d.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 0.5), h);
  }
  // A-B region shading
  if (state.wave.a != null && state.wave.b != null) {
    const x1 = (state.wave.a / state.wave.duration) * W, x2 = (state.wave.b / state.wave.duration) * W;
    ctx2d.fillStyle = "rgba(109,94,240,0.18)";
    ctx2d.fillRect(Math.min(x1, x2), 0, Math.abs(x2 - x1), H);
  }
  // playhead
  if (audioEl) {
    ctx2d.fillStyle = css.getPropertyValue("--text").trim();
    ctx2d.fillRect(pos * W, 0, 1.5, H);
  }
}
function startWaveLoop() {
  cancelAnimationFrame(state.wave.raf);
  const tick = () => {
    if (audioEl) {
      $("time-cur").textContent = fmtTime(audioEl.currentTime);
      if (state.wave.a != null && state.wave.b != null && audioEl.currentTime >= state.wave.b) audioEl.currentTime = state.wave.a;
      drawWave();
    }
    state.wave.raf = requestAnimationFrame(tick);
  };
  state.wave.raf = requestAnimationFrame(tick);
}
function stopWaveLoop() { cancelAnimationFrame(state.wave.raf); }

// --- live lint (F2) ---
function scheduleLint() {
  clearTimeout(state.lintTimer);
  state.lintTimer = setTimeout(() => renderLint(lintText($("editor").value)), 250);
}
function renderLint(issues) {
  $("lint-bar").innerHTML = issues.map((i) =>
    `<span class="lint-item">⚠️ ${esc(i.label)}<button type="button" data-fix="${i.id}">Fix</button></span>`).join("");
  $$("#lint-bar button").forEach((b) => b.addEventListener("click", () => {
    const emo = state.result ? state.result.emotion : "thoughtful";
    setEditorText(applyFix($("editor").value, b.dataset.fix, emo));
    toast("Fix applied.", "ok", 1800);
  }));
}

// --- diff (F3) ---
function renderDiff(show) {
  $("diff-view").style.display = show ? "" : "none";
  $("editor").style.display = show ? "none" : "";
  if (!show) return;
  const parts = diffWords($("orig-transcript").textContent, $("editor").value);
  $("diff-view").innerHTML = parts.map((p) =>
    p.t === "=" ? esc(p.s) : p.t === "+" ? `<span class="ins">${esc(p.s)}</span>` : `<span class="del">${esc(p.s)}</span>`).join("");
}

// --- insight card (F6) ---
function renderInsight(result) {
  $("insight").style.display = "";
  $("ins-emotion").textContent = `★ ${result.emotion}${result.audioListened ? "" : " · text-only (no audio listened) — verify the emotion"}`;
  const conf = result.confidence != null ? result.confidence : null;
  const runnerConf = conf != null ? Math.max(0.05, conf - 0.25) : null;
  $("conf-bars").innerHTML = `
    <div class="conf-row"><span style="width:86px">${esc(result.emotion)}</span><div class="conf-bar"><div class="conf-fill" style="width:${Math.round((conf ?? 0.6) * 100)}%"></div></div><span class="mono small">${conf != null ? Math.round(conf * 100) + "%" : "—"}</span></div>
    ${result.runnerUp ? `<div class="conf-row muted"><span style="width:86px">${esc(result.runnerUp)}</span><div class="conf-bar"><div class="conf-fill" style="width:${Math.round((runnerConf ?? 0.35) * 100)}%;opacity:.55"></div></div><span class="mono small">${runnerConf != null ? Math.round(runnerConf * 100) + "%" : ""}</span></div>` : ""}`;
  $("cues-text").textContent = result.cues ? `🎧 ${result.cues}` : "";
  $("ins-notes").textContent = result.reviewNotes || "";
  const rb = $("btn-runner");
  if (result.runnerUp) { rb.style.display = ""; rb.textContent = `Try '${result.runnerUp}'`; rb.onclick = () => { setEditorText(wrapSpan(stripTags($("editor").value), result.runnerUp)); toast(`Emotion updated to '${result.runnerUp}'`, "ok", 1800); }; }
  else rb.style.display = "none";
}
const stripTags = (t) => (t || "")
  .replace(/<\|style_open\|>[a-z_]*/gi, "").replace(/<\|style_body\|>/gi, "").replace(/<\|style_close\|>/gi, "").trim();

// --- span timeline (F5) ---
function renderSpanTimeline() {
  const tagged = state.result ? state.result.tagged : $("editor").value;
  const open = tagged ? tagged.search(/<\|style_open\|>/i) : -1;
  const close = tagged ? tagged.search(/<\|style_close\|>/i) : -1;
  const region = $("span-region");
  if (open < 0 || close < 0 || !state.wave.duration) { region.style.display = "none"; return; }
  const len = tagged.length;
  const s = (open / len) * 100, e = (close / len) * 100;
  region.style.display = "";
  region.style.left = Math.min(s, e) + "%";
  region.style.width = Math.max(1.5, Math.abs(e - s)) + "%";
}

// --- chips ---
function renderChips() {
  $("emotion-chips").innerHTML = EMOTIONS.map((e) => `<button type="button" class="chip emo" data-emo="${e}">${e}</button>`).join("");
  $("event-chips").innerHTML = EVENT_TAGS.map((t) => `<button type="button" class="chip evt" data-tag="${esc(t)}">${esc(t.replace(/<\||\|>/g, ""))}</button>`).join("");
  $$("#emotion-chips .chip").forEach((b) => b.addEventListener("click", () => {
    setEditorText(wrapSpan(stripTags($("editor").value), b.dataset.emo));
    if (state.result) state.result.emotion = b.dataset.emo;
    renderSpanTimeline();
    toast(`Emotion updated to '${b.dataset.emo}'`, "ok", 1800);
  }));
  $$("#event-chips .chip").forEach((b) => b.addEventListener("click", () => insertAtCursor($("editor"), b.dataset.tag)));
}
function insertAtCursor(ta, text) {
  const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
  pushHistory(ta.value);
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
  const p = s + text.length;
  ta.setSelectionRange(p, p); ta.focus();
  scheduleLint(); renderSpanTimeline();
}

// --- run the engine ---
async function runAutoReview() {
  if (!state.clip) { toast("Load a clip first (portal, sample, or load manually).", "warn"); return; }
  const btn = $("btn-run");
  btn.disabled = true;
  const cacheKey = `ttsc.cache.${state.clip.id}`;
  const { [cacheKey]: cached } = await getLocal([cacheKey]);
  if (cached && cached.result) {
    $("rv-status").textContent = "Loaded cached AI result for this clip (instant) — run again to re-analyze.";
    applyResult(cached.result, { fromCache: true });
    btn.disabled = false;
    return;
  }
  try {
    const result = await runReview(state.clip, { ...state.settings }, {
      onStatus: (s) => { $("rv-status").textContent = s; },
      onToken: (d) => { $("stream-note").textContent = "streaming…"; $("editor").value += d; },
      stream: state.prefs.engineMode === "hybrid",
      dictionary: state.dictionary,
      kbChunks: state.prefs.kbInject ? state.kb.map((k) => k.text) : null
    });
    setEditorText(result.tagged);
    applyResult(result);
    await setLocal({ [cacheKey]: { result, ts: Date.now() } });
    toast(`Review complete — engine: ${result.engine}${result.audioListened ? " (audio listened)" : " (text-only)"}`, "ok");
  } catch (e) {
    // Graceful fallback: never leave the reviewer empty-handed.
    const off = normalizeResult({ corrected_transcript_clean: heuristicClean(state.clip.transcript, state.dictionary).clean, emotion: "thoughtful" }, "offline", false);
    setEditorText(off.tagged);
    applyResult(off);
    $("rv-status").textContent = `AI failed (${e.message}) — offline heuristic applied instead.`;
    toast(`AI failed: ${e.message}`, "bad", 6000);
  } finally {
    btn.disabled = false;
    $("stream-note").textContent = "";
  }
}
function applyResult(result, { fromCache = false } = {}) {
  state.result = result;
  renderInsight(result);
  scheduleLint();
  renderSpanTimeline();
  if (!fromCache) $("rv-status").textContent = `✓ ${result.engine}${result.audioListened ? " (listened)" : " (text-only)"} · emotion: ${result.emotion}${result.confidence != null ? ` · confidence ${Math.round(result.confidence * 100)}%` : ""}`;
  if (state.prefs.secondOpinion) runSecondOpinion(result);
}

// --- second opinion (F11) ---
async function runSecondOpinion(result) {
  if (!state.settings.nvidiaApiKey || result.engine === "nvidia" || result.engine === "offline") return;
  try {
    const { runNvidiaTextOnly } = await import("./engine.js");
    const raw = await runNvidiaTextOnly({ transcript: state.clip.transcript }, state.settings);
    const alt = normalizeResult(raw, "nvidia", false);
    if (alt.emotion !== result.emotion) {
      $("ins-notes").textContent += ` ⚠️ Cross-check: NVIDIA text-only suggests '${alt.emotion}' (you chose '${result.emotion}').`;
      toast(`Models disagree: ${result.emotion} vs ${alt.emotion} — double-check the emotion.`, "warn", 6500);
    }
  } catch (_) { /* second opinion is best-effort */ }
}

// --- statuses & logging (§7.4) ---
async function logEvent(status) {
  if (!state.clip) { toast("No clip loaded.", "warn"); return; }
  const current = $("editor").value;
  const changed = diffHasChanges($("orig-transcript").textContent, stripTags(current));
  const finalStatus = status === "accepted" ? (changed ? "fixed" : "accepted") : "rejected";
  state.log.push({
    id: uid(), ts: Date.now(), clipId: state.clip.id, status: finalStatus,
    emotion: state.result ? state.result.emotion : normalizeEmotion(""),
    confidence: state.result ? state.result.confidence : null,
    engine: state.result ? state.result.engine : "offline",
    audioListened: state.result ? state.result.audioListened : false
  });
  if (state.log.length > 1000) state.log = state.log.slice(-1000);
  await setLocal({ "ttsc.log": state.log });
  $("action-note").textContent = `Logged as ${finalStatus.toUpperCase()} — ${STATUSES[finalStatus].split("—")[1]?.trim() || ""}`;
  toast(`Clip marked ${finalStatus}. ${STATUSES[finalStatus]}`, "ok");
}
async function flagClip() {
  if (!state.clip) { toast("No clip loaded.", "warn"); return; }
  modal(`<h3>🚩 Flag for QA</h3>
    <p class="muted small">Clip: ${esc(state.clip.id)}</p>
    <textarea id="flag-note" rows="3" placeholder="What should QA look at?"></textarea>
    <div class="row-wrap" style="margin-top:12px;justify-content:flex-end">
      <button class="ghost-btn" id="flag-cancel">Cancel</button>
      <button class="btn-primary" id="flag-save">Save flag</button>
    </div>`, { onOpen: (ov) => {
    ov.querySelector("#flag-cancel").onclick = () => ov.remove();
    ov.querySelector("#flag-save").onclick = async () => {
      state.flags.push({ clipId: state.clip.id, note: ov.querySelector("#flag-note").value.trim(), ts: Date.now() });
      await setLocal({ "ttsc.flags": state.flags });
      ov.remove(); toast("Clip flagged for QA.", "ok");
    };
  } });
}
async function openCachedClip(clipId) {
  const key = `ttsc.cache.${clipId}`;
  const { [key]: cached } = await getLocal([key]);
  if (!cached || !cached.result) { toast("No cached result for that clip — run it in Review.", "warn"); setView("review"); return; }
  const orig = state.log.find((e) => e.clipId === clipId) || {};
  await loadClip({ id: clipId, audioSrc: "", transcript: cached.result.clean, meta: "Restored from cache (no audio source stored)." });
  setEditorText(cached.result.tagged, { history: false });
  applyResult(cached.result, { fromCache: true });
  setView("review");
}

// ---------- Guide (§7.1 / §7.2 / F10) ----------
function renderGuide(filter = "") {
  const q = filter.toLowerCase().trim();
  const items = TAXONOMY.filter((t) => !q || [t.name, t.label, t.def, t.listenFor, t.notConfuse].join(" ").toLowerCase().includes(q));
  $("guide-cards").innerHTML = items.length ? items.map((t) => `
    <div class="card guide-card" data-emo="${t.label}">
      <div class="g-top"><span class="g-lab">★ ${t.label}</span><strong>${esc(t.name)}</strong></div>
      <div class="small">${esc(t.def)}</div>
      <div class="small" style="color:var(--info)">🎧 ${esc(t.listenFor)}</div>
      <div class="small" style="color:var(--warn)">⚠️ Don't confuse with: ${esc(t.notConfuse)}</div>
      <div class="small">🎯 ${SAMPLES[t.label].map((id, i) => `<a href="${SAMPLE_URL(id)}" target="_blank" rel="noopener">Sample ${i + 1}</a>`).join(" · ")}</div>
      <div class="g-card-actions">
        <button class="ghost-btn g-apply" data-emo="${t.label}">Apply This Style</button>
        <button class="ghost-btn g-quiz" data-emo="${t.label}">Practice</button>
      </div>
    </div>`).join("") : `<div class="card muted">No matching emotions.</div>`;
  $$(".g-apply").forEach((b) => b.addEventListener("click", () => {
    setEditorText(wrapSpan(stripTags($("editor").value), b.dataset.emo));
    toast(`Emotion updated to '${b.dataset.emo}' — check the Review view.`, "ok");
  }));
  $$(".g-quiz").forEach((b) => b.addEventListener("click", () => startTrainer(b.dataset.emo)));
}

// Trainer (F10) — guess-the-emotion flashcards.
function startTrainer(pinnedEmotion) {
  let score = { ok: 0, total: 0 };
  let answer = pinnedEmotion || TAXONOMY[Math.floor(Math.random() * TAXONOMY.length)].label;
  const ov = modal(`<h3>🎯 Emotion trainer</h3>
    <p class="muted small">Score: <b id="q-score">0/0</b> — read the definition and cues, then pick the emotion.</p>
    <div id="q-body"></div>`, {});
  const renderQ = () => {
    const t = TAXONOMY.find((x) => x.label === answer);
    ov.querySelector("#q-body").innerHTML = `
      <div class="card" style="margin-bottom:10px"><b>Definition:</b> ${esc(t.def)}<br><b style="color:var(--info)">Listen for:</b> ${esc(t.listenFor)}</div>
      <div class="chip-row">${EMOTIONS.map((e) => `<button type="button" class="chip" data-emo="${e}">${e}</button>`).join("")}</div>
      <div id="q-reveal" class="small" style="margin-top:10px"></div>`;
    $$("#q-body .chip").forEach((b) => b.addEventListener("click", () => {
      score.total++;
      const correct = b.dataset.emo === answer;
      if (correct) score.ok++;
      ov.querySelector("#q-score").textContent = `${score.ok}/${score.total}`;
      const s = SAMPLES[answer];
      ov.querySelector("#q-reveal").innerHTML = correct
        ? `<span style="color:var(--ok)">✓ Correct!</span> 🎯 <a href="${SAMPLE_URL(s[0])}" target="_blank" rel="noopener">Listen to a reference clip</a> <button class="ghost-btn" id="q-next">Next →</button>`
        : `<span style="color:var(--bad)">✗ It was '${answer}'.</span> 🎯 <a href="${SAMPLE_URL(s[0])}" target="_blank" rel="noopener">Listen to a reference clip</a> <button class="ghost-btn" id="q-next">Next →</button>`;
      ov.querySelector("#q-next").onclick = () => { answer = TAXONOMY[Math.floor(Math.random() * TAXONOMY.length)].label; renderQ(); };
    }));
  };
  renderQ();
}

// ---------- Settings (F1/F8/F12/F13) ----------
function renderSettings() {
  $("provider-list").innerHTML = PROVIDERS.map((p) => `
    <div class="prov" data-prov="${p.id}">
      <label>${p.name}${p.getKey ? ` <a class="small" href="${p.getKey}" target="_blank" rel="noopener" style="color:var(--info)">key ↗</a>` : ""}</label>
      ${p.id === "custom"
        ? `<input type="text" id="set-customBaseUrl" placeholder="http://localhost:11434/v1" value="${esc(state.settings.customBaseUrl || "")}">`
        : `<input type="password" id="set-${p.keyId}" placeholder="API key" value="${esc(state.settings[p.keyId] || "")}" autocomplete="off">`}
      ${p.id === "custom"
        ? `<input type="text" id="set-${p.modelId}" placeholder="model (e.g. llama3)" value="${esc(state.settings[p.modelId] || "llama3")}">`
        : `<select id="set-${p.modelId}">${p.models.map((m) => `<option value="${m}" ${(state.settings[p.modelId] || "") === m ? "selected" : ""}>${m}</option>`).join("")}</select>`}
      <button type="button" class="ghost-btn btn-test" data-prov="${p.id}">🔌 Test</button>
      <span class="test-out" id="test-out-${p.id}"></span>
    </div>`).join("");
  $$("#provider-list .prov input, #provider-list .prov select").forEach((el) => el.addEventListener("change", async () => {
    const id = el.id.replace(/^set-/, "");
    state.settings[id] = el.value.trim();
    await setSync({ [id]: el.value.trim() });
    updateEnginePill();
  }));
  $$(".btn-test").forEach((b) => b.addEventListener("click", async () => {
    const p = b.dataset.prov;
    const cfg = PROVIDERS.find((x) => x.id === p);
    const out = $(`test-out-${p}`);
    out.textContent = "testing…"; out.style.color = "var(--muted)";
    try {
      await testProvider(p, state.settings[cfg.keyId] || "", state.settings[cfg.modelId] || "", state.settings.customBaseUrl);
      out.textContent = "✓ Connected"; out.style.color = "var(--ok)";
    } catch (e) { out.textContent = `✗ ${e.message}`.slice(0, 60); out.style.color = "var(--bad)"; }
  }));
  // engine mode chips
  $$("#mode-chips .chip").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === state.prefs.engineMode);
    b.onclick = async () => {
      state.prefs.engineMode = b.dataset.mode;
      $$("#mode-chips .chip").forEach((x) => x.classList.toggle("active", x === b));
      savePrefs(); updateEnginePill();
    };
  });
  // second opinion toggle
  let so = $("chk-second-opinion");
  if (!so) {
    so = document.createElement("label");
    so.className = "chk";
    so.style.marginTop = "10px";
    so.innerHTML = `<input type="checkbox" id="chk-second-opinion"> Second opinion (F11): cross-check the emotion with NVIDIA text-only and flag disagreement`;
    $("mode-chips").parentElement.appendChild(so);
  }
  so.querySelector("input").checked = !!state.prefs.secondOpinion;
  so.querySelector("input").onchange = async (e) => { state.prefs.secondOpinion = e.target.checked; savePrefs(); };
  // dictionary
  $("dict-nouns").value = state.dictionary.properNouns.join("\n");
  $("dict-never").value = state.dictionary.neverChange.join("\n");
  // KB list
  $("kb-list").innerHTML = state.kb.length
    ? state.kb.map((k, i) => `<div class="kb-item">📄 ${esc(k.name)} <span class="muted small">${k.text.length} chars</span><span class="spacer"></span><button class="ghost-btn" data-kb="${i}">Remove</button></div>`).join("")
    : `<div class="muted small">No documents uploaded yet.</div>`;
  $$("#kb-list button").forEach((b) => b.addEventListener("click", async () => {
    state.kb.splice(Number(b.dataset.kb), 1);
    await setLocal({ "ttsc.kb": state.kb });
    renderSettings();
  }));
}

function wireSettings() {
  $("dict-nouns").addEventListener("change", async (e) => {
    state.dictionary.properNouns = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
    await setLocal({ "ttsc.dictionary": state.dictionary });
    toast("Dictionary saved — injected into prompts and the offline engine.", "ok");
  });
  $("dict-never").addEventListener("change", async (e) => {
    state.dictionary.neverChange = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
    await setLocal({ "ttsc.dictionary": state.dictionary });
    toast("Never-change list saved.", "ok");
  });
  $("kb-file").addEventListener("change", async (e) => {
    for (const f of e.target.files) {
      const text = await f.text();
      state.kb.push({ name: f.name, text: text.slice(0, 60000) });
    }
    e.target.value = "";
    await setLocal({ "ttsc.kb": state.kb });
    toast(`Knowledge base updated (${state.kb.length} document${state.kb.length === 1 ? "" : "s"}).`, "ok");
    renderSettings();
  });
  $("btn-export-profile").addEventListener("click", async () => {
    const includeKeys = $("chk-export-keys").checked;
    const profile = {
      version: 2, exportedAt: new Date().toISOString(),
      settings: includeKeys ? Object.fromEntries(syncKeys.map((k) => [k, state.settings[k]])) : {},
      prefs: state.prefs, dictionary: state.dictionary, kb: state.kb, includeKeys
    };
    downloadFile(`ttsc-profile-${Date.now()}.json`, JSON.stringify(profile, null, 2), "application/json");
    toast("Profile exported" + (includeKeys ? " (including keys — keep it private)." : "."), "ok");
  });
  $("btn-import-profile").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const p = JSON.parse(await f.text());
      if (typeof p !== "object" || !("version" in p)) throw new Error("Not a Copilot profile");
      if (p.settings) { Object.assign(state.settings, p.settings); await setSync(p.settings); }
      if (p.prefs) { Object.assign(state.prefs, p.prefs); savePrefs(); }
      if (p.dictionary) { state.dictionary = p.dictionary; await setLocal({ "ttsc.dictionary": state.dictionary }); }
      if (Array.isArray(p.kb)) { state.kb = p.kb; await setLocal({ "ttsc.kb": state.kb }); }
      applyTheme(); applyDensity(); renderSettings(); updateEnginePill();
      toast("Profile imported.", "ok");
    } catch (err) { toast(`Import failed: ${err.message}`, "bad"); }
    e.target.value = "";
  });
  $("btn-tour").addEventListener("click", startTour);
}
function downloadFile(name, content, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Command palette (F15) ----------
const COMMANDS = () => [
  { n: "Go to Dashboard", k: "view", run: () => setView("dashboard") },
  { n: "Go to Review", k: "view", run: () => setView("review") },
  { n: "Go to Guide", k: "view", run: () => setView("guide") },
  { n: "Go to Settings", k: "view", run: () => setView("settings") },
  { n: "Run AI Auto-Review", k: "Alt+A", run: () => { setView("review"); runAutoReview(); } },
  { n: "Play / Pause audio", k: "Alt+P", run: () => audioEl && (audioEl.paused ? audioEl.play() : audioEl.pause()) },
  { n: "Insert emotion span OPEN at cursor", k: "span", run: () => { setView("review"); insertAtCursor($("editor"), `<|style_open|>${state.result ? state.result.emotion : "thoughtful"}<|style_body|>`); } },
  { n: "Insert span CLOSE at cursor", k: "span", run: () => { setView("review"); insertAtCursor($("editor"), "<|style_close|>"); } },
  { n: "Toggle theme", k: "theme", run: () => cycleTheme() },
  { n: "Toggle compact density", k: "ui", run: () => { state.prefs.density = state.prefs.density === "compact" ? "roomy" : "compact"; savePrefs(); applyDensity(); } },
  { n: "Load clip from portal", k: "clip", run: () => { setView("review"); loadFromPortal(); } },
  { n: "Export dashboard CSV", k: "export", run: exportCsv },
  { n: "Start the guided tour", k: "help", run: startTour }
];
const fuzzy = (q, s) => { q = q.toLowerCase(); s = s.toLowerCase(); let i = 0; for (const c of s) if (c === q[i]) i++; return i === q.length; };
function openPalette() {
  $("palette").style.display = "";
  $("pal-input").value = "";
  renderPal("");
  $("pal-input").focus();
}
function closePalette() { $("palette").style.display = "none"; }
function renderPal(q) {
  const items = COMMANDS().filter((c) => fuzzy(q, c.n));
  $("pal-list").innerHTML = items.map((c, i) => `<div class="pal-item ${i === 0 ? "sel" : ""}" data-i="${i}">${esc(c.n)}<span class="k">${c.k}</span></div>`).join("") || `<div class="pal-item muted">No matching commands</div>`;
  $$(".pal-item[data-i]").forEach((el) => el.addEventListener("click", () => { closePalette(); items[Number(el.dataset.i)].run(); }));
  $("pal-list").dataset.count = String(items.length);
}
function cycleTheme() {
  const order = ["system", "dark", "light"];
  state.prefs.theme = order[(order.indexOf(state.prefs.theme) + 1) % 3];
  savePrefs(); applyTheme();
}

// ---------- Tour (F15) ----------
function startTour() {
  state.prefs.tourDone = true; savePrefs();
  const steps = [
    { sel: "#nav", view: "dashboard", text: "Navigate between Dashboard, Review, Guide and Settings from this sidebar." },
    { sel: "#engine-pill", view: "dashboard", text: "The live engine status: Hybrid (Gemini listens + NVIDIA formats), single-model, or offline heuristic — based on your keys (Settings)." },
    { sel: "#btn-run", view: "review", text: "Load a clip (from the portal or a sample), then run the AI review. Results fill the editor with live Rule Check." },
    { sel: "#lint-bar", view: "review", text: "As you edit, rule violations appear here with one-click fixes — Training Guide rules only." },
    { sel: "#action-bar", view: "review", text: "Finish by Accepting (auto-logged as Accepted or Fixed), Rejecting, or Flagging for QA. The Dashboard tracks it all." }
  ];
  let i = 0;
  const tip = document.createElement("div");
  tip.className = "tour-tip";
  const show = () => {
    $$(".tour-target").forEach((el) => el.classList.remove("tour-target"));
    if (i >= steps.length) { tip.remove(); toast("Tour complete — happy reviewing! 🎧", "ok"); return; }
    setView(steps[i].view);
    const el = $(steps[i].sel);
    if (!el) { i++; show(); return; }
    el.classList.add("tour-target");
    const r = el.getBoundingClientRect();
    tip.innerHTML = `<b>Step ${i + 1}/${steps.length}</b><br><span class="small">${esc(steps[i].text)}</span><div class="row-wrap" style="margin-top:8px;justify-content:flex-end"><button class="ghost-btn" id="tour-skip">Skip</button><button class="btn-primary" id="tour-next" style="padding:6px 14px">Next</button></div>`;
    document.body.appendChild(tip);
    tip.style.left = Math.max(10, Math.min(window.innerWidth - 310, r.left)) + "px";
    tip.style.top = Math.min(window.innerHeight - 170, r.bottom + 10) + "px";
    tip.querySelector("#tour-skip").onclick = () => { i = steps.length; show(); };
    tip.querySelector("#tour-next").onclick = () => { i++; show(); };
  };
  show();
}

// ---------- CSV export (F13) ----------
function exportCsv() {
  const rows = [["timestamp", "clipId", "status", "emotion", "confidence", "engine", "audioListened"],
    ...state.log.map((e) => [new Date(e.ts).toISOString(), e.clipId, e.status, e.emotion, e.confidence ?? "", e.engine, e.audioListened])];
  downloadFile(`ttsc-log-${Date.now()}.csv`, rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  toast("CSV exported.", "ok");
}

// ---------- portal clip forwarding ----------
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes["ttsc.currentClip"]) {
    const cur = changes["ttsc.currentClip"].newValue;
    if (cur && state.view === "review") {
      $("rv-portal-banner").style.display = "";
      $("rv-portal-banner").innerHTML = `📥 New clip detected on the portal: <b>${esc(cur.clipId || "clip")}</b> <button class="ghost-btn" id="btn-take-clip" style="margin-left:8px">Load it</button>`;
      $("btn-take-clip").onclick = () => { $("rv-portal-banner").style.display = "none"; loadFromPortal(); };
      toast(`New portal clip: ${cur.clipId || "clip"}`, "info");
    }
  }
  if (area === "sync" && changes["ttsc.settings"]) { Object.assign(state.prefs, changes["ttsc.settings"].newValue || {}); applyTheme(); applyDensity(); }
});

// ---------- keyboard ----------
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
  if (e.altKey && e.key.toLowerCase() === "a") { e.preventDefault(); setView("review"); runAutoReview(); }
  if (e.altKey && e.key.toLowerCase() === "p") { e.preventDefault(); if (audioEl) audioEl.paused ? audioEl.play().catch(() => {}) : audioEl.pause(); }
  if (e.key === "Escape") { closePalette(); $$("#modal-root .overlay").forEach((o) => o.remove()); }
});
$("pal-input").addEventListener("keydown", (e) => {
  const items = $$(".pal-item[data-i]");
  let idx = items.findIndex((el) => el.classList.contains("sel"));
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    idx = e.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
    items.forEach((el) => el.classList.remove("sel"));
    if (items[idx]) items[idx].classList.add("sel");
  } else if (e.key === "Enter") {
    const cmd = COMMANDS().filter((c) => fuzzy($("pal-input").value, c.n))[Math.max(0, idx)];
    if (cmd) { closePalette(); cmd.run(); }
  }
});

// ---------- wiring ----------
function wire() {
  $$(".nav-btn").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  $("btn-theme").addEventListener("click", cycleTheme);
  $("btn-density").addEventListener("click", () => { state.prefs.density = state.prefs.density === "compact" ? "roomy" : "compact"; savePrefs(); applyDensity(); });
  $("btn-palette").addEventListener("click", openPalette);
  $("palette").addEventListener("click", (e) => { if (e.target === $("palette")) closePalette(); });
  $("pal-input").addEventListener("input", () => renderPal($("pal-input").value));

  // dashboard
  $$("#range-chips .chip").forEach((c) => c.addEventListener("click", async () => {
    state.range = c.dataset.range;
    $$("#range-chips .chip").forEach((x) => x.classList.toggle("active", x === c));
    $("custom-range").style.display = state.range === "custom" ? "" : "none";
    if (state.range === "custom") {
      state.customFrom = $("dash-from").value; state.customTo = $("dash-to").value;
    }
    renderDashboard();
  }));
  $("dash-from").addEventListener("change", () => { state.customFrom = $("dash-from").value; renderDashboard(); });
  $("dash-to").addEventListener("change", () => { state.customTo = $("dash-to").value; renderDashboard(); });
  $("chk-flags").addEventListener("change", renderDashboard);
  $("btn-export-csv").addEventListener("click", exportCsv);
  $("btn-clear-log").addEventListener("click", async () => {
    state.log = []; await setLocal({ "ttsc.log": [] }); renderDashboard(); toast("Log cleared.", "ok");
  });

  // review
  $("btn-run").addEventListener("click", runAutoReview);
  $("btn-load-portal").addEventListener("click", loadFromPortal);
  $("sample-select").addEventListener("change", (e) => { if (e.target.value !== "") loadSample(Number(e.target.value)); });
  $("btn-play").addEventListener("click", () => audioEl && (audioEl.paused ? audioEl.play().catch(() => {}) : audioEl.pause()));
  $("sel-speed").addEventListener("change", (e) => { if (audioEl) audioEl.playbackRate = parseFloat(e.target.value) || 1; });
  $("btn-loop").addEventListener("click", () => {
    state.wave.loop = !state.wave.loop;
    if (audioEl) audioEl.loop = state.wave.loop;
    $("btn-loop").classList.toggle("active", state.wave.loop);
  });
  $("btn-ab-a").addEventListener("click", () => { if (audioEl) { state.wave.a = audioEl.currentTime; $("ab-info").textContent = `A=${fmtTime(state.wave.a)}${state.wave.b != null ? " → B=" + fmtTime(state.wave.b) : ""}`; } });
  $("btn-ab-b").addEventListener("click", () => { if (audioEl) { state.wave.b = audioEl.currentTime; $("ab-info").textContent = `${state.wave.a != null ? "A=" + fmtTime(state.wave.a) + " → " : ""}B=${fmtTime(state.wave.b)}`; } });
  $("wave").addEventListener("click", (e) => {
    if (!audioEl || !state.wave.duration) return;
    const r = $("wave").getBoundingClientRect();
    audioEl.currentTime = ((e.clientX - r.left) / r.width) * state.wave.duration;
  });
  $("btn-span-open").addEventListener("click", () => insertAtCursor($("editor"), `<|style_open|>${state.result ? state.result.emotion : "thoughtful"}<|style_body|>`));
  $("btn-span-close").addEventListener("click", () => insertAtCursor($("editor"), "<|style_close|>"));
  $("btn-undo").addEventListener("click", () => { if (state.histIdx > 0) { state.histIdx--; $("editor").value = state.hist[state.histIdx]; updateHistButtons(); scheduleLint(); } });
  $("btn-redo").addEventListener("click", () => { if (state.histIdx < state.hist.length - 1) { state.histIdx++; $("editor").value = state.hist[state.histIdx]; updateHistButtons(); scheduleLint(); } });
  $("btn-revert").addEventListener("click", () => { if (state.clip) { setEditorText(state.clip.transcript || ""); toast("Reverted to the original transcript.", "ok", 2200); } });
  $("editor").addEventListener("input", scheduleLint);
  $("editor").addEventListener("change", () => pushHistory($("editor").value));
  $("chk-diff").addEventListener("change", (e) => renderDiff(e.target.checked));
  $("btn-accept").addEventListener("click", () => logEvent("accepted"));
  $("btn-reject").addEventListener("click", () => logEvent("rejected"));
  $("btn-flag").addEventListener("click", flagClip);

  // guide
  $("guide-search").addEventListener("input", (e) => renderGuide(e.target.value));
  $("btn-trainer").addEventListener("click", () => startTrainer(null));

  wireSettings();

  // resizable split (persisted)
  const drag = $("drag-h");
  let dragging = false;
  drag.addEventListener("pointerdown", (e) => { dragging = true; drag.setPointerCapture(e.pointerId); });
  drag.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const root = $("split").getBoundingClientRect();
    const frac = Math.min(0.65, Math.max(0.3, (e.clientX - root.left) / root.width));
    $("split").style.gridTemplateColumns = `${(frac * 100).toFixed(1)}fr 8px ${(100 - frac * 100 - 1).toFixed(1)}fr`;
    drawWave();
  });
  drag.addEventListener("pointerup", () => { dragging = false; try { localStorage.setItem("ttsc.split", $("split").style.gridTemplateColumns); } catch (_) {} });
  try {
    const saved = localStorage.getItem("ttsc.split");
    if (saved) $("split").style.gridTemplateColumns = saved;
  } catch (_) {}

  window.addEventListener("resize", () => { if (state.wave.peaks.length) drawWave(); if (state.view === "dashboard") drawBars($("chart-days"), aggregateLog(state.log, rangeToFromTo()).byDay); });
}

// ---------- boot ----------
(async function boot() {
  await loadAll();
  applyTheme();
  applyDensity();
  renderChips();
  wire();
  renderGuide();
  renderSettings();
  updateEnginePill();
  setView(state.prefs.lastView || "dashboard");
  if (!state.prefs.tourDone) {
    modal(`<h3>🎙️ Welcome to TTS Review Copilot</h3>
      <p class="small">A professional workspace for TTS audio review — grounded in the official Training Guide.</p>
      <ul class="small muted" style="padding-left:18px;line-height:1.8">
        <li><b>Review</b> — load a clip (from the portal or the samples), run the Hybrid Gemini + NVIDIA engine, verify with the live Rule Check and diff.</li>
        <li><b>Dashboard</b> — your Accepted / Fixed / Rejected / Total KPIs with charts.</li>
        <li><b>Guide</b> — the 19 emotions with cues, sample clips, and a practice quiz.</li>
        <li><b>Settings</b> — keys (Gemini + NVIDIA recommended), engine mode, dictionary, knowledge base.</li>
      </ul>
      <div class="row-wrap" style="justify-content:flex-end;margin-top:8px">
        <button class="ghost-btn" id="wl-skip">Skip</button>
        <button class="btn-primary" id="wl-tour">Start the tour →</button>
      </div>`, { onOpen: (ov) => {
      ov.querySelector("#wl-skip").onclick = () => { state.prefs.tourDone = true; savePrefs(); ov.remove(); };
      ov.querySelector("#wl-tour").onclick = () => { ov.remove(); startTour(); };
    } });
  }
})();
