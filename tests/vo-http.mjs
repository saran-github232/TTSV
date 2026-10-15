import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
let statuses=[], calls=[], waits=[];
const ctx=vm.createContext({AbortSignal, setTimeout: (fn,ms)=>{waits.push(ms);fn();},fetch:async(url,options)=>{
  calls.push({url,options}); const status=statuses.shift();
  if (status==='network') throw new TypeError('fetch failed');
  return {status,ok:status>=200&&status<300,headers:{get:k=>k==='nvcf-reqid'?'12345678-1234-1234-1234-123456789abc':null}};
}});
vm.runInContext(readFileSync(new URL('../vo/http.js',import.meta.url),'utf8'),ctx);
const run=async sequence=>{statuses=[...sequence];calls=[];waits=[];return ctx.VOHttp.request('https://integrate.api.nvidia.com/v1/chat/completions',{method:'POST',body:'audio',headers:{Authorization:'Bearer test'}},'NVIDIA');};
assert.equal((await run([503,502,200])).status,200);assert.equal(calls.length,3);assert.deepEqual(waits,[1500,3000]);
await assert.rejects(run([503,503,503]),/overloaded/);assert.equal(calls.length,3);
for(const status of [400,401,403,404,413,422,429]) {await assert.rejects(run([status]),new RegExp(String(status)));assert.equal(calls.length,1);}
await run([202,202,200]);assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.body,undefined);assert.ok(calls[1].url.includes('/v1/status/'));assert.equal(calls[1].options.headers.Authorization,'Bearer test');
await assert.rejects(run(['network']),/network/);
console.log('VO HTTP: retry recovery, bounded failures, nonretryable errors, NVIDIA pending polling and network errors passed.');
