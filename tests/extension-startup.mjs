// Loads the actual unpacked extension, including imports and Chrome APIs.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
for (const file of [manifest.background.service_worker, 'background/background.js', 'vo/rubric.js', 'vo/http.js', 'vo/analysis.js', 'vo/worker.js']) {
  assert.ok(existsSync(new URL('../' + file, import.meta.url)), `Missing extension file: ${file}`);
}
const context = await chromium.launchPersistentContext('', {
  headless: true, executablePath: process.env.VO_CHROMIUM || undefined,
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 15000 });
  assert.ok(worker.url().endsWith('/service-worker.js'));
  const result = await worker.evaluate(() => ({
    legacy: typeof handleAudioAnalysis, vo: typeof VOAnalysis.analyze, http: typeof VOHttp.request,
    anchors: VORubric.anchors.length
  }));
  assert.deepEqual(result, { legacy: 'function', vo: 'function', http: 'function', anchors: 5 });
  const page = await context.newPage();
  await page.goto(worker.url().replace('/service-worker.js', '/popup/popup.html'));
  const reply = await page.evaluate(() => chrome.runtime.sendMessage({action:'VO_BEGIN',id:'startup-check',mimeType:'audio/wav'}));
  assert.equal(reply.success,true);
  await page.evaluate(() => chrome.runtime.sendMessage({action:'VO_CANCEL',id:'startup-check'}));
  console.log('Real extension startup passed: legacy worker, VO dependencies, popup and message round trip.');
} finally { await context.close(); }
