// Pure, dependency-free logic for the TTS Review Copilot dashboard.
// Imported by dashboard/app.js + dashboard/engine.js in the browser and by
// tests/dashboard-tests.mjs in Node — so this file must never touch DOM or
// chrome.* APIs.

import { EMOTIONS, EMOTION_ALIASES, normalizeEmotion, EVENT_TAGS } from "./guide-data.mjs";
export { EMOTIONS, EMOTION_ALIASES, normalizeEmotion, EVENT_TAGS };

// ---------------------------------------------------------------------------
// Offline heuristic engine (port of background.js runOfflineHeuristic)
// ---------------------------------------------------------------------------

const CONTRACTIONS = [
  [/doesn\s*t\b/gi, "doesn't"], [/it\s*s\b/gi, "it's"], [/i\s*m\b/gi, "I'm"],
  [/that\s*s\b/gi, "that's"], [/haven\s*t\b/gi, "haven't"], [/they\s*re\b/gi, "they're"],
  [/won\s*t\b/gi, "won't"], [/don\s*t\b/gi, "don't"], [/wasn\s*t\b/gi, "wasn't"],
  [/hasn\s*t\b/gi, "hasn't"], [/can\s*t\b/gi, "can't"], [/didn\s*t\b/gi, "didn't"],
  [/couldn\s*t\b/gi, "couldn't"], [/wouldn\s*t\b/gi, "wouldn't"], [/isn\s*t\b/gi, "isn't"],
  [/aren\s*t\b/gi, "aren't"], [/we\s*re\b/gi, "we're"], [/you\s*re\b/gi, "you're"],
  [/what\s*s\b/gi, "what's"], [/there\s*s\b/gi, "there's"], [/who\s*s\b/gi, "who's"],
  [/let\s*s\b/gi, "let's"]
];

const NUMBER_WORDS = [
  [/\bzero\b/gi, "0"], [/\b(?<!no\s)(?<!some\s)(?<!any\s)(?<!every\s)one\b/gi, "1"],
  [/\btwo\b/gi, "2"], [/\bthree\b/gi, "3"], [/\bfour\b/gi, "4"], [/\bfive\b/gi, "5"],
  [/\bsix\b/gi, "6"], [/\bseven\b/gi, "7"], [/\beight\b/gi, "8"], [/\bnine\b/gi, "9"],
  [/\bten\b/gi, "10"], [/\beleven\b/gi, "11"], [/\btwelve\b/gi, "12"],
  [/\bthirteen\b/gi, "13"], [/\bfourteen\b/gi, "14"], [/\bfifteen\b/gi, "15"],
  [/\bsixteen\b/gi, "16"], [/\bseventeen\b/gi, "17"], [/\beighteen\b/gi, "18"],
  [/\bnineteen\b/gi, "19"], [/\btwenty\b/gi, "20"], [/\bthirty\b/gi, "30"],
  [/\bforty\b/gi, "40"], [/\bfifty\b/gi, "50"], [/\bsixty\b/gi, "60"],
  [/\bseventy\b/gi, "70"], [/\beighty\b/gi, "80"], [/\bninety\b/gi, "90"],
  [/\bhundred\b/gi, "100"]
];

const ORDINALS = [
  [/\bfirst\b/gi, "1st"], [/\bsecond\b/gi, "2nd"], [/\bthird\b/gi, "3rd"],
  [/\bfourth\b/gi, "4th"], [/\bfifth\b/gi, "5th"], [/\bsixth\b/gi, "6th"],
  [/\bseventh\b/gi, "7th"], [/\beighth\b/gi, "8th"], [/\bninth\b/gi, "9th"],
  [/\btenth\b/gi, "10th"], [/\btwentieth\b/gi, "20th"], [/\bthirtieth\b/gi, "30th"],
  [/\bhundredth\b/gi, "100th"]
];

const ACRONYMS = ["atm", "cibil", "pan", "ufc", "usa", "uk", "fbi", "cia", "kyc", "gst", "ai", "tts", "asr"];

const PROPER_NOUNS = [
  "montreal protocol", "los angeles", "kyiv independent", "new york", "united states",
  "verizon", "google", "youtube", "facebook", "instagram", "tiktok", "netflix",
  "amazon", "microsoft", "apple", "meta", "twitter"
];

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export function heuristicClean(originalText, dictionary = null) {
  const notes = [];
  let text = (originalText || "").trim();
  if (!text) return { clean: "", notes: ["Empty input"] };

  const extraNouns = (dictionary && dictionary.properNouns) || [];
  const neverChange = (dictionary && dictionary.neverChange) || [];
  const isProtected = (word) => neverChange.some((w) => w.toLowerCase() === word.toLowerCase());

  for (const [re, full] of CONTRACTIONS) {
    if (re.test(text) && !neverChange.length) { text = text.replace(re, full); notes.push(`Repaired contraction: ${full}`); }
  }
  if (/\bi\b/.test(text)) { text = text.replace(/\bi\b/g, "I"); notes.push("Capitalized 'I'"); }

  for (const [re, digit] of NUMBER_WORDS) {
    const m = re.exec(text);
    if (m && !isProtected(m[0])) { text = text.replace(re, digit); notes.push(`Number → digits: ${digit}`); }
  }
  for (const [re, ord] of ORDINALS) {
    if (re.test(text)) { text = text.replace(re, ord); notes.push(`Ordinal → ${ord}`); }
  }
  for (const a of ACRONYMS.concat(extraNouns.filter((n) => n === n.toUpperCase() && n.length > 1))) {
    const re = new RegExp(`\\b${a}\\b`, "gi");
    if (re.test(text) && !isProtected(a)) { text = text.replace(re, a.toUpperCase()); notes.push(`Acronym: ${a.toUpperCase()}`); }
  }
  for (const p of PROPER_NOUNS.concat(extraNouns.filter((n) => n !== n.toUpperCase()))) {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (re.test(text) && !isProtected(p)) { text = text.replace(re, titleCase(p)); notes.push(`Proper noun: ${titleCase(p)}`); }
  }
  if (/<\|breath\|>/gi.test(text)) { text = text.replace(/<\|breath\|>\s*/gi, ""); notes.push("Removed forbidden <|breath|>"); }
  if (/^[a-z]/.test(text)) { text = text.charAt(0).toUpperCase() + text.slice(1); notes.push("Capitalized sentence start"); }
  if (text && !/[.!?]$/.test(text) && !/\|>\s*$/.test(text)) { text += "."; notes.push("Added ending punctuation"); }

  return { clean: text, notes };
}

// ---------------------------------------------------------------------------
// Live linter (Training Guide rules) + safe one-click fixes
// ---------------------------------------------------------------------------

const SPAN_RE = /<\|style_open\|>[a-z_]+<\|style_body\|>[\s\S]*<\|style_close\|>/;

export function lintText(text) {
  const issues = [];
  if (!SPAN_RE.test(text || "")) issues.push({ id: "span", label: "Style span missing (<|style_open|>…<|style_close|>)", fix: "span" });
  if (/<\|breath\|>/i.test(text || "")) issues.push({ id: "breath", label: "Forbidden <|breath|> tag present", fix: "breath" });
  const num = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|first|second|third)\b/i.exec(text || "");
  if (num) issues.push({ id: "digits", label: `Number as word: "${num[0]}" — must be digits`, fix: "digits" });
  for (const a of ACRONYMS) {
    const anyCase = new RegExp(`\\b${a}\\b`, "i").test(text || "");
    const upper = new RegExp(`\\b${a.toUpperCase()}\\b`).test(text || "");
    if (anyCase && !upper) { issues.push({ id: "acronyms", label: `Acronym not UPPERCASE: ${a.toUpperCase()}`, fix: "acronyms" }); break; }
  }
  for (const [a, b] of CONTRACTIONS) {
    if (new RegExp(`\\b${a.source.replace(/\\b$/, "")}\\s+${b}\\b`, "i").test(text || "")) {
      issues.push({ id: "contractions", label: "Broken ASR contraction (e.g. 'doesn t')", fix: "contractions" });
      break;
    }
  }
  if (/\bi\b/.test(text || "")) issues.push({ id: "i", label: "Lowercase 'i' found", fix: "i" });
  return issues;
}

export function applyFix(text, fixId, emotion = "thoughtful") {
  let t = text || "";
  if (fixId === "contractions") for (const [re, full] of CONTRACTIONS) t = t.replace(re, full);
  if (fixId === "i") t = t.replace(/\bi\b/g, "I");
  if (fixId === "acronyms") for (const a of ACRONYMS) t = t.replace(new RegExp(`\\b${a}\\b`, "gi"), a.toUpperCase());
  if (fixId === "digits") { for (const [re, d] of NUMBER_WORDS) t = t.replace(re, d); for (const [re, o] of ORDINALS) t = t.replace(re, o); }
  if (fixId === "breath") t = t.replace(/<\|breath\|>\s*/gi, "");
  if (fixId === "span") {
    const m = t.match(/<\|style_open\|>[a-z_]+<\|style_body\|>([\s\S]*?)<\|style_close\|>/i);
    if (m) t = `<|style_open|>${emotion}<|style_body|>${m[1]}<|style_close|>`;
    else {
      const bare = t.replace(/<\|style_open\|>[a-z_]*/gi, "").replace(/<\|style_body\|>/gi, "").replace(/<\|style_close\|>/gi, "").trim();
      t = `<|style_open|>${emotion}<|style_body|>${bare}<|style_close|>`;
    }
  }
  return t;
}

export function wrapSpan(text, emotion = "thoughtful") {
  return `<|style_open|>${normalizeEmotion(emotion) || "thoughtful"}<|style_body|>${(text || "").trim()}<|style_close|>`;
}

// ---------------------------------------------------------------------------
// Word-level diff (F3) — simple LCS over word tokens
// ---------------------------------------------------------------------------

const tokenize = (s) => (s || "").match(/\S+\s*/g) || [];

export function diffWords(a, b) {
  const A = tokenize(a), B = tokenize(b);
  const n = A.length, m = B.length;
  // Guard against pathological inputs on huge transcripts.
  if (n * m > 4_000_000) {
    return [{ t: A.length ? "-" : "=", s: a || "" }, { t: B.length ? "+" : "=", s: b || "" }];
  }
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  const eq = (x, y) => x.trim() === y.trim(); // whitespace-insensitive word equality
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(A[i], B[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  const push = (t, s) => { const last = out[out.length - 1]; if (last && last.t === t) last.s += s; else out.push({ t, s }); };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (eq(A[i], B[j])) { push("=", A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push("-", A[i]); i++; }
    else { push("+", B[j]); j++; }
  }
  while (i < n) push("-", A[i++]);
  while (j < m) push("+", B[j++]);
  return out;
}

export function diffHasChanges(a, b) {
  return diffWords(a, b).some((d) => d.t !== "=");
}

// ---------------------------------------------------------------------------
// Hybrid mode detection (§4.2)
// ---------------------------------------------------------------------------

export function detectMode(keys, pinned) {
  if (pinned && pinned !== "auto") return pinned;
  const hasGemini = !!(keys.geminiApiKey || "").trim();
  const hasNvidia = !!(keys.nvidiaApiKey || "").trim();
  if (hasGemini && hasNvidia) return "hybrid";
  if (hasGemini) return "gemini";
  if (hasNvidia) return "nvidia";
  return "offline";
}

// ---------------------------------------------------------------------------
// Result normalization — one internal shape from any provider/contract
// ---------------------------------------------------------------------------

const CONFMap = { high: 0.85, medium: 0.6, low: 0.35 };

export function normalizeResult(raw, engine, audioListened) {
  if (!raw || typeof raw !== "object") raw = {};
  const clean = raw.corrected_transcript_clean || raw.raw_transcript || "";
  const emotion = normalizeEmotion(raw.emotion) || "thoughtful";
  const runnerRaw = raw.runner_up || raw.runner_up_emotion || raw.audio_cues && raw.audio_cues.runner_up;
  const confRaw = raw.confidence != null ? raw.confidence
    : raw.audio_cues && raw.audio_cues.confidence != null ? raw.audio_cues.confidence
    : CONFMap[(raw.emotion_confidence || "").toLowerCase()] ?? null;
  const notesRaw = raw.review_notes;
  const notes = typeof notesRaw === "string" ? notesRaw
    : notesRaw && typeof notesRaw === "object"
      ? [notesRaw.text_fixes, notesRaw.emotion_and_vocal_cues].filter(Boolean).join(" · ")
      : "";
  return {
    clean,
    tagged: raw.tagged_transcript || wrapSpan(clean, emotion),
    emotion,
    runnerUp: normalizeEmotion(runnerRaw) || null,
    confidence: typeof confRaw === "number" ? Math.max(0, Math.min(1, confRaw)) : null,
    cues: (raw.audio_cues && raw.audio_cues.tone) || (typeof notesRaw === "object" && notesRaw.emotion_and_vocal_cues) || "",
    events: Array.isArray(raw.events) ? raw.events : (raw.audio_cues && Array.isArray(raw.audio_cues.events)) ? raw.audio_cues.events : [],
    spans: Array.isArray(raw.spans) ? raw.spans : [],
    reviewNotes: notes || `Emotion: ${emotion}`,
    engine,
    audioListened: !!audioListened
  };
}

// ---------------------------------------------------------------------------
// JSON extraction (tolerates markdown fences and prose around the JSON)
// ---------------------------------------------------------------------------

export function extractJson(text) {
  let t = (text || "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  return t;
}

// ---------------------------------------------------------------------------
// Dashboard aggregation (F9)
// ---------------------------------------------------------------------------

export function aggregateLog(log, range) {
  const now = Date.now();
  const from = range && range.from ? new Date(range.from + "T00:00:00").getTime() : 0;
  const to = range && range.to ? new Date(range.to + "T23:59:59").getTime() : Infinity;
  const inRange = (ts) => ts >= from && ts <= to;
  const events = (log || []).filter((e) => inRange(e.ts));
  const kpis = { accepted: 0, fixed: 0, rejected: 0, total: events.length };
  const byEmotion = {};
  const byDay = {};
  for (const e of events) {
    if (e.status in kpis) kpis[e.status]++;
    if (e.emotion) byEmotion[e.emotion] = (byEmotion[e.emotion] || 0) + 1;
    const day = new Date(e.ts).toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  const days = Object.keys(byDay).sort().map((day) => ({ day, count: byDay[day] }));
  return {
    kpis,
    byDay: days,
    byEmotion: Object.entries(byEmotion).map(([emotion, count]) => ({ emotion, count })).sort((a, b) => b.count - a.count),
    recent: events.slice().sort((a, b) => b.ts - a.ts).slice(0, 50)
  };
}
