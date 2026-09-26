// Tests for the dashboard's pure logic (dashboard/lib-core.mjs).
// Run: node tests/dashboard-tests.mjs
import {
  heuristicClean, lintText, applyFix, wrapSpan, diffWords, diffHasChanges,
  detectMode, normalizeResult, extractJson, aggregateLog
} from "../dashboard/lib-core.mjs";
import { EMOTIONS, SAMPLES } from "../dashboard/guide-data.mjs";

let passed = 0, failed = 0;
const check = (name, cond, extra = "") => {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
};

console.log("Offline heuristic engine:");
const h1 = heuristicClean("for a ten dollar pass verizon will pick this up here");
check("digits + proper noun + casing + punctuation", /^For a 10 dollar pass Verizon will pick this up here\.$/.test(h1.clean), h1.clean);
const h2 = heuristicClean("no one believed it and someone else called");
check("'no one' preserved (lookbehind guard)", /no one/i.test(h2.clean) && !/no 1/i.test(h2.clean), h2.clean);
const h3 = heuristicClean("i don t think it s here");
check("broken contractions repaired", h3.clean.includes("I don't") && h3.clean.includes("it's"), h3.clean);
const h4 = heuristicClean("okay <|um|>");
check("no period appended after an event tag", h4.clean.endsWith("<|um|>"), h4.clean);
const h5 = heuristicClean("hello <|breath|> world");
check("forbidden <|breath|> removed", !h5.clean.includes("<|breath|>"));

console.log("Custom dictionary (F8):");
const h6 = heuristicClean("zoho billed the client", { properNouns: ["Zoho"], neverChange: [] });
check("custom proper noun cased", h6.clean.includes("Zoho"), h6.clean);
const h7 = heuristicClean("send the pan card", { properNouns: [], neverChange: ["pan"] });
check("never-change word respected", /\bpan\b/.test(h7.clean), h7.clean);

console.log("Span utilities:");
check("wrapSpan canonicalizes legacy label", wrapSpan("hello", "angry") === "<|style_open|>anger<|style_body|>hello<|style_close|>", wrapSpan("hello", "angry"));

console.log("Live linter (F2):");
const l1 = lintText("for a ten dollar pass atm i think");
check("flags word number", l1.some((x) => x.id === "digits"));
check("flags missing span", l1.some((x) => x.id === "span"));
check("flags lowercase i", l1.some((x) => x.id === "i"));
check("flags lowercase acronym", l1.some((x) => x.id === "acronyms"));
const fixed = ["digits", "acronyms", "i", "span"].reduce((t, f) => applyFix(t, f, "curious"), "for a ten dollar pass atm i think");
check("applyFix chain cleans the text", /^<\|style_open\|>curious<\|style_body\|>For a 10 dollar pass, ATM I think\.$/.test(fixed) || (fixed.includes("10") && fixed.includes("ATM") && fixed.includes("I ")), fixed);

console.log("Word diff (F3):");
const d1 = diffWords("for a ten dollar pass", "for a 10 dollar pass");
check("detects deletion and insertion", d1.some((x) => x.t === "-" && /ten/.test(x.s)) && d1.some((x) => x.t === "+" && /10/.test(x.s)), JSON.stringify(d1));
check("no-change detection", !diffHasChanges("same text here.", "same   text here."));
check("change detection", diffHasChanges("a b", "a c"));

console.log("Hybrid mode detection (§4.2):");
check("both keys → hybrid", detectMode({ geminiApiKey: "a", nvidiaApiKey: "b" }, "auto") === "hybrid");
check("gemini only → gemini", detectMode({ geminiApiKey: "a", nvidiaApiKey: "" }, "auto") === "gemini");
check("nvidia only → nvidia", detectMode({ geminiApiKey: "", nvidiaApiKey: "b" }, "auto") === "nvidia");
check("no keys → offline", detectMode({}, "auto") === "offline");
check("pinned mode respected", detectMode({ geminiApiKey: "a" }, "nvidia") === "nvidia");

console.log("Result normalization (§7.5 contract):");
const n1 = normalizeResult({
  corrected_transcript_clean: "For a 10 dollar pass.", tagged_transcript: "<|style_open|>angry<|style_body|>x<|style_close|>",
  emotion: "angry", runner_up_emotion: "annoyed", emotion_confidence: "high",
  review_notes: { text_fixes: "digits", emotion_and_vocal_cues: "tense voice" }
}, "gemini", true);
check("legacy shape mapped + label canonicalized", n1.emotion === "anger" && n1.runnerUp === "annoyed" && n1.confidence === 0.85, JSON.stringify(n1));
check("notes object flattened", n1.reviewNotes.includes("digits") && n1.reviewNotes.includes("tense voice"), n1.reviewNotes);
const n2 = normalizeResult({
  raw_transcript: "raw words", emotion: "curious",
  audio_cues: { runner_up: "thoughtful", confidence: 0.72, tone: "rising pitch", events: [{ tag: "inhale", at_ms: 40 }] }
}, "hybrid", true);
check("§7.5 handoff shape mapped", n2.confidence === 0.72 && n2.runnerUp === "thoughtful" && n2.cues === "rising pitch" && n2.events.length === 1, JSON.stringify(n2));
check("confidence clamped", normalizeResult({ confidence: 5 }, "gemini", true).confidence === 1);

console.log("JSON extraction:");
const j1 = extractJson('Sure!\n```json\n{"a": 1}\n```\nDone');
check("fenced JSON extracted", JSON.parse(j1).a === 1);

console.log("Dashboard aggregation (F9):");
const now = Date.now();
const log = [
  { ts: now, clipId: "c1", status: "accepted", emotion: "anger", confidence: 0.9, engine: "hybrid", audioListened: true },
  { ts: now, clipId: "c2", status: "fixed", emotion: "anger", confidence: 0.7, engine: "gemini", audioListened: true },
  { ts: now - 40 * 864e5, clipId: "c3", status: "rejected", emotion: "sad", confidence: 0.5, engine: "offline", audioListened: false }
];
const aggAll = aggregateLog(log, null);
check("kpis counted", aggAll.kpis.accepted === 1 && aggAll.kpis.fixed === 1 && aggAll.kpis.rejected === 1 && aggAll.kpis.total === 3, JSON.stringify(aggAll.kpis));
check("emotion distribution sorted", aggAll.byEmotion[0].emotion === "anger" && aggAll.byEmotion[0].count === 2);
const aggRange = aggregateLog(log, { from: new Date(now).toISOString().slice(0, 10), to: new Date(now).toISOString().slice(0, 10) });
check("date range filters old events", aggRange.kpis.total === 2 && aggRange.recent.length === 2, JSON.stringify(aggRange.kpis));

console.log("Guide data sanity:");
check("19 emotions, 57 samples", EMOTIONS.length === 19 && Object.values(SAMPLES).flat().length === 57);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
