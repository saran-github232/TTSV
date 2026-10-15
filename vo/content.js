(() => {
  if (document.getElementById('tts-vo-host')) return;
  const host = document.createElement('div');
  host.id = 'tts-vo-host';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{position:fixed;left:16px;bottom:16px;z-index:2147483646;font:14px/1.5 system-ui;color:#eef2ff}
    *{box-sizing:border-box} details.panel{width:340px;max-width:calc(100vw - 32px);background:#142139;border:1px solid #496185;border-radius:14px;box-shadow:0 8px 28px #0005}
    summary{padding:12px;cursor:pointer;font-weight:650} .body{padding:0 14px 14px;max-height:65vh;overflow:auto}
    p{margin:8px 0} button,select{padding:8px;border:1px solid #7086a7;border-radius:6px;background:#243c60;color:white;margin:4px 0}button{cursor:pointer}button:disabled{opacity:.5}
    label{display:block;margin:10px 0}input[type=file]{max-width:100%}audio{width:100%;height:34px} .muted{color:#c2cde0;font-size:12px} #result{white-space:pre-wrap}ol{padding-left:22px}
    </style><details class="panel"><summary>VO · Speech naturalness</summary><div class="body">
    <p>Listen with headphones. Judge pronunciation, pacing, intonation and audible artifacts.</p>
    <p class="muted">VO sends the full clip and five reference audios to Gemini using your saved key. AI suggestions need your review.</p>
    <label><input id="auto" type="checkbox"> Analyze automatically when I play a clip</label>
    <button id="analyze">Analyze current clip</button>
    <label>Or choose an audio file (up to 8 MB)<input id="file" type="file" accept="audio/*"></label>
    <p id="source" class="muted">Play a page clip to select it.</p>
    <p id="result" role="status" aria-live="polite">No rating yet.</p>
    <label>Your final rating<select id="rating"><option value="">Choose after listening</option></select></label>
    <button id="copy" disabled>Copy suggestion</button>
    <details><summary>Scale and reference clips</summary><p class="muted">Half-point ratings sit between adjacent examples. These anchors are guidance, not exact matches.</p><div id="anchors"></div></details>
    </div></details>`;
  document.documentElement.append(host);
  const stealthStyle = document.createElement('style');
  stealthStyle.textContent = 'html[data-tts-stealth="1"] #tts-vo-host{display:none!important}';
  document.documentElement.append(stealthStyle);
  const isNeevo = location.hostname === 'neevo.definedcrowd.com';
  if (isNeevo) root.querySelector('details.panel').open = true;
  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (request.action === 'VO_SHOW_PANEL') {
      if (!host.isConnected) document.documentElement.append(host);
      document.documentElement.setAttribute('data-tts-stealth', '0');
      root.querySelector('details.panel').open = true;
      respond({ alive: true, stealth: false });
    } else if (request.action === 'VO_PANEL_PING') {
      respond({ alive: host.isConnected, stealth: document.documentElement.getAttribute('data-tts-stealth') === '1' });
    } else if (isNeevo && request.action === 'TOGGLE_STEALTH') {
      const hidden = document.documentElement.getAttribute('data-tts-stealth') === '1';
      document.documentElement.setAttribute('data-tts-stealth', hidden ? '0' : '1');
      respond({ received: true });
    } else if (isNeevo && request.action === 'TOGGLE_PLAYBACK') {
      const audio = document.querySelector('audio,video');
      if (audio) { if (audio.paused) audio.play().catch(() => {}); else audio.pause(); }
      respond({ received: true });
    } else if (isNeevo && request.action === 'TRIGGER_AUTO_REVIEW') {
      run();
      respond({ received: true });
    }
  });
  const el = id => root.getElementById(id);
  VORubric.labels.forEach((label, i) => el('rating').add(new Option(`${1 + i / 2} - ${label}`, 1 + i / 2)));
  for (const anchor of VORubric.anchors) {
    const p = document.createElement('p');
    p.textContent = `${anchor.score} - ${VORubric.label(anchor.score)}: ${anchor.reason}`;
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    audio.src = chrome.runtime.getURL(`vo/anchors/${anchor.file}`);
    el('anchors').append(p, audio);
  }
  let current = null, source = '', generation = 0, busy = false, suggestion = '', lastAuto = '', pendingAuto = false;
  function clear() {
    generation++; suggestion = ''; el('copy').disabled = true; el('rating').value = '';
    el('result').textContent = 'No rating yet.';
  }
  function select(audio) {
    const next = audio.currentSrc || audio.src;
    if (audio !== current || next !== source) { clear(); current = audio; source = next; lastAuto = ''; }
    el('source').textContent = next ? `Selected: ${next.split('/').pop().split('?')[0].slice(0, 90)}` : 'No readable audio source. Use file upload.';
  }
  async function run(file) {
    if (busy) return;
    if (!file) {
      const audio = current?.isConnected ? current : document.querySelector('audio,video');
      if (!audio) { el('result').textContent = 'No page audio found. Choose an audio file.'; return; }
      select(audio);
    }
    clear();
    const ticket = generation;
    busy = true; el('analyze').disabled = true; el('file').disabled = true;
    el('result').textContent = 'Listening with Gemini…';
    try {
      let blob = file;
      if (!blob) {
        if (!source || !/^(https?:|blob:|data:audio\/)/.test(source)) throw new Error('This player has no accessible audio file. Use file upload.');
        const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('Could not read this clip. Use file upload.');
        if (Number(response.headers.get('content-length')) > 8 * 1024 * 1024) throw new Error('Clip exceeds 8 MB.');
        blob = await response.blob();
      }
      if (!blob.size || blob.size > 8 * 1024 * 1024) throw new Error('Choose a non-empty clip up to 8 MB.');
      const mimeType = blob.type.split(';')[0] || (/\.wav(?:[?#]|$)/i.test(file?.name || source) ? 'audio/wav' : /\.mp3(?:[?#]|$)/i.test(file?.name || source) ? 'audio/mpeg' : '');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      const response = await chrome.runtime.sendMessage({ action: 'VO_ANALYZE', payload: { audioBase64: data, mimeType } });
      if (ticket !== generation) return;
      if (!response?.success) throw new Error(response?.error || 'Extension disconnected. Reload this page.');
      const result = VORubric.validate(response.data);
      suggestion = `${result.score} - ${result.label}\nConfidence: ${result.confidence}\n${result.reason}`;
      el('result').textContent = suggestion;
      el('copy').disabled = false;
    } catch (error) {
      if (ticket === generation) { el('result').textContent = `VO: ${error.message || 'Could not read audio. Use file upload.'}`; lastAuto = ''; }
    } finally {
      busy = false; el('analyze').disabled = false; el('file').disabled = false;
      if (pendingAuto) {
        pendingAuto = false;
        if (el('auto').checked && current?.isConnected && source) { lastAuto = source; run(); }
      }
    }
  }
  document.addEventListener('play', event => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    select(event.target);
    if (el('auto').checked && source !== lastAuto) {
      if (busy) pendingAuto = true;
      else { lastAuto = source; run(); }
    }
  }, true);
  document.addEventListener('emptied', event => { if (event.target === current) { clear(); source = ''; lastAuto = ''; } }, true);
  new MutationObserver(() => { if (current && !current.isConnected) { clear(); current = null; source = ''; lastAuto = ''; } }).observe(document, { childList: true, subtree: true });
  el('analyze').onclick = () => run();
  el('file').onchange = () => { const file = el('file').files[0]; if (file) { el('source').textContent = `File: ${file.name}`; run(file); } };
  el('copy').onclick = async () => {
    try { await navigator.clipboard.writeText(suggestion); } catch { el('result').textContent = `${suggestion}\nCopy unavailable. Select the text above to copy it.`; }
  };
})();
