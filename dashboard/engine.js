// Hybrid AI engine (§4): Gemini = "Ear" (audio → transcript + vocal cues),
// NVIDIA = "Brain" (text → rule-compliant output). Auto mode detection with
// graceful fallback chain: hybrid → gemini → nvidia → offline heuristic.
// Runs inside the dashboard extension page, so provider hosts are covered by
// the manifest's host_permissions (no CORS issues, keys stay on-device).

import { normalizeEmotion, heuristicClean, extractJson, normalizeResult, wrapSpan } from "./lib-core.mjs";
import { EMOTIONS, TAXONOMY, EVENT_TAGS } from "./guide-data.mjs";

const GEMINI_DEFAULT = "gemini-3.8-flash";
const NVIDIA_DEFAULT = "nvidia/nemotron-3-super-120b-a12b";
const RETIRED_GEMINI = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];

const resolveGeminiModel = (m) => (!m || RETIRED_GEMINI.includes(m)) ? GEMINI_DEFAULT : m;

const emotionList = EMOTIONS.join(", ");
const taxonomyBlock = TAXONOMY.map((t) => `${t.label}: ${t.def} Listen for: ${t.listenFor} Don't confuse with: ${t.notConfuse}`).join("\n");
const eventBlock = EVENT_TAGS.join(" ");

const RULES = `# TTS Review rules (official Training Guide)
1. Primary speaker only; ignore overlapping/background speakers.
2. Numbers in digits (10, not "ten"); ordinals as 1st/2nd/34th.
3. Acronyms UPPERCASE (ATM, CIBIL, PAN, UFC); proper nouns Title Case (Verizon, Los Angeles).
4. Repair broken ASR contractions (doesn t -> doesn't, i m -> I'm, they re -> they're).
5. Keep stutters, repeats, misspeaks, and speaker grammar verbatim (audio true to itself).
6. Letter-by-letter sounds stay spaced (h e a t); "hmm" becomes <|hum_tune|>.
7. Event tags at the exact instant: ${eventBlock}
8. Breathing rule: NEVER emit <|breath|>; <|inhale|>/<|exhale|> only for long, clearly audible breaths.
9. Emotion is a SPAN: open where it begins, close where it ends — exactly one span per clip:
   <|style_open|>emotion<|style_body|>…transcript…<|style_close|>
10. Emotion label must be one of: ${emotionList}.`;

const EXTRA = (dictionary, kbChunks) => {
  let s = "";
  if (dictionary && (dictionary.properNouns?.length || dictionary.neverChange?.length)) {
    s += `\n\n# Custom dictionary (must respect)\n`;
    if (dictionary.properNouns?.length) s += `Proper nouns/brands (exact casing): ${dictionary.properNouns.join(", ")}\n`;
    if (dictionary.neverChange?.length) s += `NEVER change these words: ${dictionary.neverChange.join(", ")}\n`;
  }
  if (kbChunks && kbChunks.length) {
    s += `\n\n# Knowledge base (uploaded guideline extracts)\n` + kbChunks.slice(0, 12).map((c, i) => `[KB${i + 1}] ${c}`).join("\n").slice(0, 6000);
  }
  return s;
};

// --- Low-level provider calls ------------------------------------------------

async function withRetry(fn, { retries = 3, baseDelay = 1200 } = {}) {
  let err;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try { return await fn(); }
    catch (e) {
      err = e;
      const retriable = e.retriable || e.status === 503;
      if (!retriable || attempt === retries) throw e;
      await new Promise((r) => setTimeout(r, baseDelay * (attempt + 1)));
    }
  }
  throw err;
}

async function geminiCall(apiKey, model, parts, generation = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolveGeminiModel(model)}:generateContent`;
  const resp = await withRetry(async () => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, responseMimeType: "application/json", ...generation } })
    });
    if (r.status === 503) { const e = new Error("Gemini overloaded (503)"); e.status = 503; e.retriable = true; throw e; }
    if (!r.ok) {
      const t = await r.text();
      const e = new Error(r.status === 429 ? `Gemini free-tier quota reached (429). Wait a moment, switch to a Lite model, or enable billing.` : `Gemini error (${r.status}): ${t.slice(0, 200)}`);
      e.status = r.status; throw e;
    }
    return r.json();
  });
  return (resp.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
}

async function nimCall(apiKey, model, messages, { maxTokens = 2048, stream = false, onToken = null } = {}) {
  const resp = await withRetry(async () => {
    const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`, "Accept": stream ? "text/event-stream" : "application/json" },
      body: JSON.stringify({ model: model || NVIDIA_DEFAULT, messages, temperature: 0.1, max_tokens: maxTokens, ...(stream ? { stream: true } : {}) })
    });
    if (r.status === 503) { const e = new Error("NVIDIA overloaded (503)"); e.status = 503; e.retriable = true; throw e; }
    if (r.status === 401) throw new Error("NVIDIA: invalid API key (401). Keys from build.nvidia.com start with 'nvapi-'.");
    if (!r.ok) {
      const t = await r.text();
      let msg = t; try { const j = JSON.parse(t); msg = j.detail || j.title || t; } catch (_) {}
      const e = new Error(`NVIDIA error (${r.status}): ${String(msg).slice(0, 200)}`); e.status = r.status; throw e;
    }
    return r;
  });
  if (!stream) return (await resp.json()).choices?.[0]?.message?.content || "";
  // Stream SSE chunks; assemble content while streaming to the UI.
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      const m = line.match(/^data:\s*(.+)$/);
      if (!m || m[1].trim() === "[DONE]") continue;
      try {
        const delta = JSON.parse(m[1]).choices?.[0]?.delta?.content || "";
        full += delta;
        if (onToken) onToken(delta);
      } catch (_) {}
    }
  }
  return full;
}

async function fetchAudioBase64(audioSrc) {
  if (!audioSrc) return null;
  const r = await fetch(audioSrc);
  if (!r.ok) throw new Error(`Could not fetch clip audio (${r.status})`);
  const blob = await r.blob();
  const mime = blob.type || "audio/mp3";
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return { base64: btoa(binary), mimeType: mime };
}

// --- Roles -------------------------------------------------------------------

// "Ear": Gemini listens to the audio and returns transcript + vocal cues.
export async function runEar(clip, settings) {
  const audio = await fetchAudioBase64(clip.audioSrc);
  const prompt = `You are an expert audio annotator. Listen to this speech clip and the system transcript, then return STRICT JSON only:
{
  "raw_transcript": "exact primary-speaker speech, verbatim (keep stutters/repeats/misspeaks, fix only garbled ASR words)",
  "audio_cues": {
    "emotion_guess": "one of: ${emotionList}",
    "runner_up": "second-best label or empty",
    "events": [{"tag": "one of ${eventBlock}", "at_ms": 0}],
    "tone": "short description of tone, pitch, pace, pauses",
    "confidence": 0.0
  }
}
Breathing rule: never <|breath|>; inhale/exhale only if long and clearly audible.
System transcript from the portal: "${clip.transcript || ""}"

Rules context:
${RULES}`;

  const parts = [];
  if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.base64 } });
  parts.push({ text: prompt });
  const out = await geminiCall(settings.geminiApiKey, settings.geminiModel, parts);
  return JSON.parse(extractJson(out));
}

// "Brain": NVIDIA turns Ear's handoff into the final rule-compliant contract.
export async function runBrain(handoff, settings, { onToken, stream = false, dictionary = null, kbChunks = null } = {}) {
  const system = `${RULES}

You are the formatting Brain. You receive a raw transcript plus vocal cues from a listening model.
Apply every rule and return STRICT JSON only:
{
  "corrected_transcript_clean": "final clean text with casing/digits/punctuation and inline event tags",
  "tagged_transcript": "<|style_open|>emotion<|style_body|>…<|style_close|>",
  "emotion": "label", "runner_up": "label or empty",
  "events": [{"tag": "…", "at_ms": 0}],
  "review_notes": "what you fixed and why this emotion"
}${EXTRA(dictionary, kbChunks)}`;
  const user = `Raw transcript: "${handoff.raw_transcript || ""}"
Audio cues: ${JSON.stringify(handoff.audio_cues || {})}

Produce the final JSON contract now.`;
  return nimCall(settings.nvidiaApiKey, settings.nvidiaModel, [
    { role: "system", content: system }, { role: "user", content: user }
  ], { stream, onToken });
}

// Gemini doing both roles in a single call (gemini-only mode).
export async function runGeminiFull(clip, settings, { dictionary = null, kbChunks = null } = {}) {
  const system = `${RULES}

You are an expert audio validator. Listen to the clip, then return STRICT JSON only:
{
  "corrected_transcript_clean": "final clean text with casing/digits/punctuation and inline event tags",
  "tagged_transcript": "<|style_open|>emotion<|style_body|>…<|style_close|>",
  "emotion": "label", "runner_up": "label or empty", "confidence": 0.0,
  "events": [{"tag": "…", "at_ms": 0}],
  "spans": [{"emotion": "label", "start_ms": 0, "end_ms": 3000}],
  "audio_cues": {"tone": "short tone description"},
  "review_notes": "what you fixed and why this emotion"
}${EXTRA(dictionary, kbChunks)}`;
  const audio = await fetchAudioBase64(clip.audioSrc);
  const parts = [];
  if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.base64 } });
  parts.push({ text: `${system}\n\nSystem transcript from the portal: "${clip.transcript || ""}"\n\nPerform the full review now.` });
  const out = await geminiCall(settings.geminiApiKey, settings.geminiModel, parts);
  return JSON.parse(extractJson(out));
}

// NVIDIA text-only mode (no audio listened — Brain runs on the portal transcript).
export async function runNvidiaTextOnly(clip, settings, { stream = false, onToken = null, dictionary = null, kbChunks = null } = {}) {
  const system = `${RULES}

NOTE (Provider Capability): the audio clip is NOT available. Judge the emotion from wording only; prefer "thoughtful" and low confidence when ambiguous. Do not invent sounds you cannot hear.
Return STRICT JSON only:
{
  "corrected_transcript_clean": "…", "tagged_transcript": "…",
  "emotion": "label", "runner_up": "label or empty",
  "review_notes": "what you fixed; emotion inferred from wording only"
}${EXTRA(dictionary, kbChunks)}`;
  const out = await nimCall(settings.nvidiaApiKey, settings.nvidiaModel, [
    { role: "system", content: system },
    { role: "user", content: `Original System Transcript: "${clip.transcript || ""}". Produce the final JSON contract now.` }
  ], { stream, onToken });
  return JSON.parse(extractJson(out));
}

export function runOffline(clip, dictionary) {
  const { clean, notes } = heuristicClean(clip.transcript, dictionary);
  return {
    corrected_transcript_clean: clean,
    tagged_transcript: wrapSpan(clean, "thoughtful"),
    emotion: "thoughtful",
    review_notes: notes.join(", ") || "Heuristic cleanup only"
  };
}

// --- Orchestrator (§4.2/§4.3) --------------------------------------------------

export async function runReview(clip, settings, hooks = {}) {
  const { onStatus = () => {}, onToken = null, stream = false, dictionary = null, kbChunks = null } = hooks;
  const keys = { geminiApiKey: settings.geminiApiKey, nvidiaApiKey: settings.nvidiaApiKey };
  const pinned = settings.engineMode || "auto";
  const hasGemini = !!keys.geminiApiKey?.trim();
  const hasNvidia = !!keys.nvidiaApiKey?.trim();

  let mode = pinned !== "auto" ? pinned : (hasGemini && hasNvidia ? "hybrid" : hasGemini ? "gemini" : hasNvidia ? "nvidia" : "offline");
  // If a pinned mode's key is missing, degrade instead of failing.
  if (mode === "hybrid" && !(hasGemini && hasNvidia)) mode = hasGemini ? "gemini" : hasNvidia ? "nvidia" : "offline";
  if (mode === "gemini" && !hasGemini) mode = hasNvidia ? "nvidia" : "offline";
  if (mode === "nvidia" && !hasNvidia) mode = hasGemini ? "gemini" : "offline";

  onStatus(`Engine mode: ${mode}`);

  // HYBRID: Ear (Gemini) → Brain (NVIDIA), streaming the Brain when allowed.
  if (mode === "hybrid") {
    try {
      onStatus("Ear (Gemini): listening to the clip…");
      const handoff = await runEar(clip, settings);
      onStatus("Brain (NVIDIA): formatting to the Training Guide rules…");
      const raw = JSON.parse(extractJson(await runBrain(handoff, settings, { stream, onToken, dictionary, kbChunks })));
      const result = normalizeResult({ ...raw, audio_cues: handoff.audio_cues, raw_transcript: handoff.raw_transcript }, "hybrid", true);
      if (!result.clean) result.clean = handoff.raw_transcript || clip.transcript || "";
      if (!raw.tagged_transcript) result.tagged = wrapSpan(result.clean, result.emotion);
      return result;
    } catch (e) {
      onStatus(`Hybrid failed (${e.message}) — falling back to Gemini-only…`);
      if (!hasGemini) { /* fall through below */ } else {
        try {
          const raw = await runGeminiFull(clip, settings, { dictionary, kbChunks });
          return normalizeResult(raw, "gemini", true);
        } catch (e2) {
          onStatus(`Gemini fallback failed (${e2.message}) — trying NVIDIA text-only…`);
        }
      }
      if (hasNvidia) {
        try {
          const raw = await runNvidiaTextOnly(clip, settings, { dictionary, kbChunks });
          return normalizeResult(raw, "nvidia", false);
        } catch (_) { /* fall to offline */ }
      }
      return normalizeResult(runOffline(clip, dictionary), "offline", false);
    }
  }

  if (mode === "gemini") {
    const raw = await runGeminiFull(clip, settings, { dictionary, kbChunks });
    return normalizeResult(raw, "gemini", true);
  }
  if (mode === "nvidia") {
    const raw = await runNvidiaTextOnly(clip, settings, { stream, onToken, dictionary, kbChunks });
    return normalizeResult(raw, "nvidia", false);
  }
  return normalizeResult(runOffline(clip, dictionary), "offline", false);
}

// --- Connection tests ---------------------------------------------------------

export async function testProvider(provider, key, model, baseUrl) {
  if (provider === "gemini") {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${resolveGeminiModel(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with JSON: {"status":"OK"}' }] }], generationConfig: { responseMimeType: "application/json" } })
    });
    if (!r.ok) throw new Error(r.status === 429 ? "Free-tier quota reached (429)" : `Gemini ${r.status}: ${(await r.text()).slice(0, 120)}`);
    return true;
  }
  if (provider === "nvidia") {
    const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({ model: model || NVIDIA_DEFAULT, messages: [{ role: "user", content: 'Reply with JSON: {"status":"OK"}' }], max_tokens: 16, temperature: 0 })
    });
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 401) throw new Error("Invalid API key (401) — keys start with 'nvapi-'");
      let msg = t; try { msg = JSON.parse(t).detail || JSON.parse(t).title || t; } catch (_) {}
      throw new Error(`NVIDIA ${r.status}: ${String(msg).slice(0, 120)}`);
    }
    return true;
  }
  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { "Authorization": `Bearer ${key}` } });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    return true;
  }
  if (provider === "groq") {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { "Authorization": `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Groq ${r.status}`);
    return true;
  }
  if (provider === "openrouter") {
    const r = await fetch("https://openrouter.ai/api/v1/models", { headers: { "Authorization": `Bearer ${key}` } });
    if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
    return true;
  }
  if (provider === "custom") {
    const base = (baseUrl || "http://localhost:11434/v1").replace(/\/+$/, "");
    const r = await fetch(`${base}/models`, { headers: key ? { "Authorization": `Bearer ${key}` } : {} });
    if (!r.ok) throw new Error(`Custom endpoint ${r.status}`);
    return true;
  }
  throw new Error(`Unknown provider: ${provider}`);
}
