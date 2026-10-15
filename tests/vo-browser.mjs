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
  await page.route('https://vo.test/**', route => route.request().resourceType() === 'document'
    ? route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body></body></html>'})
    : route.fulfill({status:200,contentType:'audio/wav',body:readFileSync(new URL('../test-portal/sample.wav',import.meta.url))}));
  await page.goto('https://vo.test/');
  await page.setContent('<audio id="clip" preload="none" src="https://vo.test/clip.wav"></audio><input type="radio" id="portal"><textarea id="feedback"></textarea>');
  await page.evaluate(() => {
    window.calls = [];
    window.chrome = {runtime:{getURL:p=>'https://vo.test/'+p,sendMessage:async r=>{
      window.calls.push(r);
      if (window.delay) await new Promise(resolve => window.release = resolve);
      return window.fail ? {success:false,error:'Test quota error'} : {success:true,data:{score:3.5,label:'Fair-Good',confidence:'medium',reason:'Clear words, slightly flat pacing.'}};
    }}};
  });
  for (const file of ['vo/rubric.js','vo/content.js']) await page.addScriptTag({content:readFileSync(new URL('../'+file,import.meta.url),'utf8')});
  await page.locator('summary').first().click();
  assert.equal(await page.locator('#rating option').count(),10);
  assert.equal(await page.locator('#anchors audio').count(),5);
  await page.evaluate(() => document.getElementById('clip').dispatchEvent(new Event('play')));
  assert.equal(await page.evaluate(()=>window.calls.length),0);
  await page.locator('#auto').check();
  await page.evaluate(() => document.getElementById('clip').dispatchEvent(new Event('play')));
  await page.waitForFunction(()=>document.getElementById('tts-vo-host').shadowRoot.getElementById('result').textContent.includes('3.5 - Fair-Good'));
  assert.equal(await page.locator('#rating').inputValue(),'');
  assert.equal(await page.locator('#portal').isChecked(),false);
  assert.equal(await page.locator('#feedback').inputValue(),'');
  await page.evaluate(() => document.getElementById('clip').dispatchEvent(new Event('play')));
  assert.equal(await page.evaluate(()=>window.calls.length),1);
  await page.locator('#file').setInputFiles(new URL('../vo/anchors/good.mp3',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
  await page.waitForFunction(()=>window.calls.length===2);
  await page.waitForFunction(()=>!document.getElementById('tts-vo-host').shadowRoot.getElementById('analyze').disabled);
  await page.evaluate(()=>window.fail=true);
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>document.getElementById('tts-vo-host').shadowRoot.getElementById('result').textContent.includes('quota'));
  assert.equal(await page.locator('#copy').isDisabled(),true);
  await page.evaluate(()=>{window.fail=false;window.delay=true;});
  await page.locator('#analyze').click();
  await page.waitForFunction(()=>!!window.release);
  await page.evaluate(()=>{document.getElementById('clip').remove();window.release();});
  await page.waitForFunction(()=>!document.getElementById('tts-vo-host').shadowRoot.getElementById('analyze').disabled);
  assert.equal(await page.locator('#result').textContent(),'No rating yet.');
  await page.evaluate(()=>document.documentElement.setAttribute('data-tts-stealth','1'));
  assert.equal(await page.locator('#tts-vo-host').isVisible(),false);
  console.log('VO browser flow passed: controls, playback opt-in, deduplication, upload, result, errors, stale result, untouched portal and stealth.');
} finally { await browser.close(); }
