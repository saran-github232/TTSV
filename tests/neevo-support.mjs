import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pattern = 'https://neevo.definedcrowd.com/*';
assert.ok(manifest.host_permissions.includes(pattern));
assert.ok(manifest.content_scripts.find(s => s.js.includes('vo/content.js')).matches.includes(pattern));
assert.ok(manifest.web_accessible_resources.find(s => s.resources.includes('vo/anchors/*')).matches.includes(pattern));
assert.ok(!manifest.content_scripts.find(s => s.js.includes('content/content.js')).matches.includes(pattern));
const popup = read('popup/popup.js');
const fn = popup.slice(popup.indexOf('  function isSupportedTab('), popup.indexOf('  function setPanelStatus('));
const supported = vm.runInNewContext(fn + '\nisSupportedTab', { URL });
for (const id of ['5371238', '1', '42', '9876543', '5555555']) {
  assert.equal(supported(`https://neevo.definedcrowd.com/en-us/crowd-tasks/task/?jobMemberId=${id}`), true);
}
assert.equal(supported('https://neevo.definedcrowd.com/other/path'), true);
assert.equal(supported('https://neevo.definedcrowd.com.evil.test/'), false);
assert.equal(supported('http://neevo.definedcrowd.com/'), false);
assert.equal(supported('https://tts-review.sabi.com/'), true);
assert.equal(supported('http://localhost:8000/'), true);
console.log('Neevo support passed: permissions, VO injection, references, five job IDs, popup routing, and existing sites.');
