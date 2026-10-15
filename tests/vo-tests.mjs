import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
let settings = {}, request, status = 200, answer = { score: 3.5, confidence: 'medium', reason: 'Clear words with flat intonation.' };
const ctx = vm.createContext({ console, Uint8Array, AbortSignal, btoa, chrome: {
  storage: { sync: { get: async () => settings } }, runtime: { getURL: p => 'extension://' + p }
}, fetch: async (url, options) => {
  if (url.startsWith('extension:')) return { ok: true, arrayBuffer: async () => new Uint8Array([1,2,3]).buffer };
  request = JSON.parse(options.body);
  return { ok: status === 200, status, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }) };
} });
vm.runInContext(read('vo/rubric.js') + read('vo/analysis.js'), ctx);
const rubric = ctx.VORubric;
for (let score = 1; score <= 5; score += .5) assert.equal(rubric.validate({ score, confidence:'low', reason:'Evidence' }).score, score);
for (const score of [0, 6, 3.25, '3', null]) assert.throws(() => rubric.validate({score, confidence:'high',reason:'test'}));
const payload = { mimeType:'audio/mpeg', audioBase64:'AQID' };
await assert.rejects(ctx.VOAnalysis.analyze(payload), /key/);
settings = { offlineMode:true, geminiApiKey:'test' };
await assert.rejects(ctx.VOAnalysis.analyze(payload), /Offline/);
settings.offlineMode = false;
assert.equal((await ctx.VOAnalysis.analyze(payload)).score, 3.5);
assert.equal(request.contents[0].parts.filter(p => p.inlineData).length, 6);
assert.equal(request.contents[0].parts.at(-1).inlineData.data, 'AQID');
for (const s of [401,429,503]) { status=s; await assert.rejects(ctx.VOAnalysis.analyze(payload), new RegExp(String(s))); }
status=200; answer={score:null,reason:'No speech'};
await assert.rejects(ctx.VOAnalysis.analyze(payload), /No speech/);
answer={score:3.25,confidence:'high',reason:'test'};
await assert.rejects(ctx.VOAnalysis.analyze(payload), /invalid rating/);
await assert.rejects(ctx.VOAnalysis.analyze({...payload,mimeType:'text/plain'}), /supported/);
await assert.rejects(ctx.VOAnalysis.analyze({...payload,audioBase64:'A'.repeat(12*1024*1024)}), /supported/);
console.log('VO: scale, schema, audio payload, anchors, settings, provider errors and limits passed.');
