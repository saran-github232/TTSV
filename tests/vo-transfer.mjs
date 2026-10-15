import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
let listener, received;
vm.runInNewContext(readFileSync(new URL('../vo/worker.js', import.meta.url), 'utf8'), {
  importScripts() {}, Map, Date, AbortController,
  chrome: { runtime: { onMessage: { addListener(fn) { listener = fn; } } } },
  VOAnalysis: { async analyze(payload) { received = payload; return { score:4 }; } }
});
const sender = {tab:{id:1},frameId:0};
const send = (request, from = sender) => new Promise(resolve => listener(request, from, resolve));
assert.equal((await send({action:'VO_BEGIN',id:'a',mimeType:'audio/wav'})).success,true);
await send({action:'VO_CHUNK',id:'a',data:'AQID'});
assert.equal((await send({action:'VO_CHUNK',id:'a',data:'AQID'}, {tab:{id:2},frameId:0})).success,false);
await send({action:'VO_CHUNK',id:'a',data:'BAU='});
assert.equal((await send({action:'VO_FINISH',id:'a'})).data.score,4);
assert.equal(received.audioBase64,'AQIDBAU=');
assert.equal(received.mimeType,'audio/wav');
assert.equal((await send({action:'VO_FINISH',id:'a'})).success,false);
await send({action:'VO_BEGIN',id:'b',mimeType:'audio/wav'});
await send({action:'VO_CANCEL',id:'b'});
assert.equal((await send({action:'VO_FINISH',id:'b'})).success,false);
console.log('VO chunk transport: ordering, tab isolation, cleanup and cancellation passed.');
