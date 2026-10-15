// Browser flow test with simulated Chrome messaging and provider replies.
// Run with NODE_PATH pointing to a directory containing playwright.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({headless:true, executablePath:process.env.VO_CHROMIUM || undefined});
try {
  const page = await browser.newPage();
  await page.route('https://neevo.definedcrowd.com/**', route => route.request().resourceType() === 'document'
    ? route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body></body></html>'})
    : route.fulfill({status:200,contentType:'application/octet-stream',body:readFileSync(new URL('../test-portal/sample.wav',import.meta.url))}));
  await page.goto('https://neevo.definedcrowd.com/en-us/crowd-tasks/task/?jobMemberId=5371238');
  await page.setContent('<audio id="clip" preload="none" src="https://neevo.definedcrowd.com/extensionless-clip"></audio><input type="radio" id="portal"><textarea id="feedback"></textarea>');
  await page.evaluate(() => {
    window.calls = []; window.listeners = []; window.voSettings = {};
    window.chrome = {storage:{sync:{get:async()=>window.voSettings,set:async value=>{Object.assign(window.voSettings,value);}}},runtime:{onMessage:{addListener:fn=>window.listeners.push(fn)},getURL:p=>'https://neevo.definedcrowd.com/'+p,sendMessage:async r=>{
      window.calls.push(r);
      if (r.action !== 'VO_FINISH') return {success:true};
      if (window.delay) await new Promise(resolve => window.release = resolve);
      return window.fail ? {success:false,error:'Test quota error'} : {success:true,data:{score:3.5,label:'Fair-Good',confidence:'medium',reason:'Clear words, slightly flat pacing.'}};
    }}};
  });
  for (const file of ['vo/rubric.js','vo/audio.js','vo/content.js']) await page.addScriptTag({content:readFileSync(new URL('../'+file,import.meta.url),'utf8')});
  assert.equal(await page.locator('details.panel').getAttribute('open'), '');
  const ping = await page.evaluate(() => { let result; window.listeners[0]({action:'VO_PANEL_PING'}, {}, r=>result=r); return result; });
  assert.equal(ping.alive,true);
  await page.evaluate(() => { document.getElementById('tts-vo-host').remove(); window.listeners[0]({action:'VO_SHOW_PANEL'}, {}, ()=>{}); });
  assert.equal(await page.locator('#tts-vo-host').isVisible(),true);
  assert.equal(await page.locator('#rating').count(),0);
  assert.equal(await page.locator('#file').count(),0);
  assert.equal(await page.locator('#auto').isChecked(),true);
  assert.equal(await page.locator('#provider').inputValue(),'nvidia');
  await page.locator('#provider').selectOption('gemini');
  assert.equal(await page.evaluate(()=>window.voSettings.voProvider),'gemini');
  await page.locator('#provider').selectOption('nvidia');
  assert.equal(await page.evaluate(()=>window.voSettings.voProvider),'nvidia');
  assert.equal(await page.locator('#anchors audio').count(),5);
  const large = await page.evaluate(async () => {
    const bytes = new Uint8Array(10 * 1024 * 1024);
    bytes.set(new TextEncoder().encode('RIFF')); bytes.set(new TextEncoder().encode('WAVE'), 8);
    const normalized = await VOAudio.normalize(new Blob([bytes], {type:'application/octet-stream'}));
    return {size:normalized.size,type:normalized.type};
  });
  assert.equal(large.size,10 * 1024 * 1024);
  assert.equal(large.type,'audio/wav');
  await page.evaluate(() => document.getElementById('clip').dispatchEvent(new Event('play')));
  await page.waitForFunction(()=>document.getElementById('tts-vo-host').shadowRoot.getElementById('result').textContent.includes('3.5 - Fair-Good'));
  assert.equal(await page.locator('#portal').isChecked(),false);
  assert.equal(await page.locator('#feedback').inputValue(),'');
  await page.evaluate(() => document.getElementById('clip').dispatchEvent(new Event('play')));
  assert.equal(await page.evaluate(()=>window.calls.filter(r=>r.action==='VO_FINISH').length),1);
  assert.equal(await page.evaluate(()=>window.calls.find(r=>r.action==='VO_BEGIN').mimeType),'audio/wav');
  // A new source on the same element must be rated automatically.
  await page.evaluate(() => { const audio=document.getElementById('clip'); audio.src='https://neevo.definedcrowd.com/next-clip'; });
  await page.waitForTimeout(100);
  await page.evaluate(() => document.getElementById('clip').dispatchEvent(new Event('playing')));
  await page.waitForFunction(()=>window.calls.filter(r=>r.action==='VO_FINISH').length===2);
  await page.waitForFunction(()=>!document.getElementById('tts-vo-host').shadowRoot.getElementById('analyze').disabled);
  // A clip played while another request is pending must run next, not get lost.
  await page.evaluate(()=>{window.delay=true; window.release=null;});
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>!!window.release);
  await page.evaluate(()=>{
    document.getElementById('clip').remove();
    const next=document.createElement('audio'); next.id='clip'; next.preload='none';
    next.src='https://neevo.definedcrowd.com/queued-clip'; document.body.append(next);
    next.dispatchEvent(new Event('play'));
    window.delay=false; window.release();
  });
  await page.waitForFunction(()=>window.calls.filter(r=>r.action==='VO_FINISH').length===4);
  await page.waitForFunction(()=>!document.getElementById('tts-vo-host').shadowRoot.getElementById('analyze').disabled);
  assert.ok((await page.locator('#source').textContent()).includes('queued-clip'));
  assert.ok((await page.locator('#result').textContent()).includes('3.5 - Fair-Good'));
  await page.evaluate(()=>window.fail=true);
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('tts-vo-host').shadowRoot.getElementById('result').textContent.includes('quota'));
  assert.equal(await page.locator('#copy').isDisabled(),true);
  await page.evaluate(()=>{window.fail=false;window.delay=true;});
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>!!window.release);
  await page.evaluate(()=>{document.getElementById('clip').remove();window.release();});
  await page.waitForFunction(()=>!document.getElementById('tts-vo-host').shadowRoot.getElementById('analyze').disabled);
  assert.equal(await page.locator('#result').textContent(),'Play the task audio to get an AI rating.');
  await page.evaluate(()=>{
    window.release=null; window.delay=true;
    const audio=document.createElement('audio'); audio.id='clip'; audio.preload='none';
    audio.src='https://neevo.definedcrowd.com/cancel-test'; document.body.append(audio);
    audio.dispatchEvent(new Event('play'));
  });
  await page.waitForFunction(()=>!!window.release);
  await page.locator('#cancel').click();
  await page.waitForFunction(()=>!document.getElementById('tts-vo-host').shadowRoot.getElementById('analyze').disabled);
  assert.ok((await page.locator('#result').textContent()).toLowerCase().includes('cancelled'));
  await page.evaluate(()=>window.release());
  await page.evaluate(()=>document.documentElement.setAttribute('data-tts-stealth','1'));
  assert.equal(await page.locator('#tts-vo-host').isVisible(),false);
  console.log('VO browser flow passed: automatic playback, extensionless octet-stream audio, next clip, result, errors, stale result, untouched portal and stealth.');
} finally { await browser.close(); }
