// Offline test harness for the TTS Review extension's background logic.
// Loads background/background.js into a sandbox with a Chrome stub and runs
// assertions against the Training Guide rules. Run: node tests/run-tests.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(root, "background", "background.js"), "utf8");

const noopListener = { addListener() {} };
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => "" }),
  chrome: {
    runtime: { onMessage: noopListener },
    commands: { onCommand: noopListener },
    storage: { sync: { get: async () => ({}), set: async () => {} } },
    tabs: { query: (_q, cb) => cb([]), sendMessage() {} }
  }
};
vm.createContext(sandbox);
vm.runInContext(
  src + "\n;globalThis.__bg = { runOfflineHeuristic, parseAIOutput, parseUnstructuredOutput, resolveGeminiModel, describeGeminiError, normalizeEmotion, DEFAULT_NVIDIA_MODEL };",
  sandbox,
  { filename: "background.js" }
);
const bg = sandbox.__bg;

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${extra ? " — " + extra : ""}`); }
}

console.log("Model remapping:");
check("null model → default", bg.resolveGeminiModel(null) === "gemini-3.8-flash");
check("retired 2.5 → default", bg.resolveGeminiModel("gemini-2.5-flash") === "gemini-3.8-flash");
check("retired 1.5 → default", bg.resolveGeminiModel("gemini-1.5-pro") === "gemini-3.8-flash");
check("current model kept", bg.resolveGeminiModel("gemini-flash-lite-latest") === "gemini-flash-lite-latest");

console.log("Emotion normalization (Training Guide labels):");
check("angry → anger", bg.normalizeEmotion("Angry") === "anger");
check("mischievously → mischievous", bg.normalizeEmotion("MISCHIEVOUSLY") === "mischievous");
check("whispers → whisper", bg.normalizeEmotion("whispers") === "whisper");
check("canonical passthrough", bg.normalizeEmotion("Thoughtful") === "thoughtful");
check("unknown → empty", bg.normalizeEmotion("flabbergasted") === "");

console.log("Offline heuristic (guide rules):");
const h1 = bg.runOfflineHeuristic("for a ten dollar pass verizon will pick this up here");
check("number word → digits", h1.corrected_transcript_clean.includes("10 dollar"), h1.corrected_transcript_clean);
check("proper noun capitalized", h1.corrected_transcript_clean.includes("Verizon"));
check("sentence start capitalized", /^[A-Z]/.test(h1.corrected_transcript_clean));
check("trailing punctuation added", /[.!?]$/.test(h1.corrected_transcript_clean));
check("no number words remain", !/\bten\b/i.test(h1.corrected_transcript_clean), h1.corrected_transcript_clean);

const h2 = bg.runOfflineHeuristic("no one believed it and someone else called");
check("'no one' is preserved (lookbehind guard)", /no one/i.test(h2.corrected_transcript_clean) && !/no 1/i.test(h2.corrected_transcript_clean), h2.corrected_transcript_clean);
check("'someone' is preserved", h2.corrected_transcript_clean.includes("someone"));

const h3 = bg.runOfflineHeuristic("i don t think it s here");
check("broken contractions repaired", h3.corrected_transcript_clean.includes("don't") && h3.corrected_transcript_clean.includes("it's"), h3.corrected_transcript_clean);
check("isolated i capitalized", h3.corrected_transcript_clean.includes("I don't"));

const h4 = bg.runOfflineHeuristic("okay <|um|>");
check("no period appended after an event tag", h4.corrected_transcript_clean.endsWith("<|um|>"), h4.corrected_transcript_clean);

const h5 = bg.runOfflineHeuristic("hello <|breath|> world");
check("forbidden <|breath|> removed", !h5.corrected_transcript_clean.includes("<|breath|>"));

const h6 = bg.runOfflineHeuristic("they opened the first ATM in the usa");
check("ordinal word → digit form", h6.corrected_transcript_clean.includes("1st"));
check("acronym uppercased", h6.corrected_transcript_clean.includes("ATM") && h6.corrected_transcript_clean.includes("USA"));

console.log("AI output parsing:");
const json1 = JSON.stringify({
  corrected_transcript_clean: "For a 10 dollar pass, Verizon will pick this up here.",
  emotion: "angry",
  emotion_confidence: "high",
  runner_up_emotion: "annoyed",
  tagged_transcript: "<|style_open|>angry<|style_body|>For a 10 dollar pass, Verizon will pick this up here.<|style_close|>",
  review_notes: { text_fixes: "digits", event_tags_inserted: [], emotion_and_vocal_cues: "tense voice" }
});
const p1 = bg.parseAIOutput(json1, "original", "Test");
check("JSON parsed", p1.corrected_transcript_clean.startsWith("For a 10"));
check("legacy label mapped to canonical", p1.emotion === "anger", p1.emotion);
check("confidence passthrough", p1.emotion_confidence === "high");
check("runner-up mapped", p1.runner_up_emotion === "annoyed");

const fenced = "Here is your result:\n```json\n{\"emotion\":\"whispers\",\"corrected_transcript_clean\":\"ok\"}\n```\nDone!";
const p2 = bg.parseAIOutput(fenced, "orig", "Test");
check("markdown-fenced JSON parsed", p2.emotion === "whisper" && p2.corrected_transcript_clean === "ok", JSON.stringify(p2));
check("tagged transcript rebuilt with canonical label", p2.tagged_transcript.startsWith("<|style_open|>whisper<|style_body|>"));

const prose = 'Sure! {"emotion":"curious","corrected_transcript_clean":"h e a t"} hope that helps';
const p3 = bg.parseAIOutput(prose, "orig", "Test");
check("prose-wrapped JSON extracted", p3.emotion === "curious");

const span = "<|style_open|>mischievously<|style_body|>well well<|style_close|>";
const p4 = bg.parseUnstructuredOutput(span, "orig", "Test");
check("unstructured span parsed + mapped", p4.emotion === "mischievous" && p4.corrected_transcript_clean === "well well");

console.log("Gemini error messaging:");
const e1 = bg.describeGeminiError(429, JSON.stringify({ error: { message: "limit: 50" } }));
check("429 → free-tier guidance", e1.includes("Free-tier quota"));
const e2 = bg.describeGeminiError(503, "{}");
check("503 → overload guidance", e2.includes("overloaded"));

console.log("NVIDIA config sanity:");
check("default NVIDIA model is from live catalog", bg.DEFAULT_NVIDIA_MODEL === "nvidia/nemotron-3-super-120b-a12b", bg.DEFAULT_NVIDIA_MODEL);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
