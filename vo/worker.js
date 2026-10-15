// VO message handlers. Dependencies are loaded by /service-worker.js.
const voTransfers = new Map();
const voRunning = new Map();
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  const key = `${sender.tab?.id}:${sender.frameId}:${request.id}`;
  if (['VO_BEGIN', 'VO_CHUNK', 'VO_CANCEL', 'VO_FINISH'].includes(request.action)) {
    for (const [k, v] of voTransfers) if (Date.now() - v.time > 300000) voTransfers.delete(k);
    if (request.action === 'VO_BEGIN') {
      voTransfers.set(key, { mimeType: request.mimeType, chunks: [], time: Date.now() });
      respond({ success: true });
    } else if (request.action === 'VO_CANCEL') {
      voTransfers.delete(key); voRunning.get(key)?.abort(); voRunning.delete(key); respond({ success: true });
    } else {
      const transfer = voTransfers.get(key);
      if (!transfer) { respond({ success: false, error: 'Audio transfer expired. Replay the clip to retry.' }); return; }
      transfer.time = Date.now();
      if (request.action === 'VO_CHUNK') {
        if (typeof request.data !== 'string' || request.data.length > 1048576) {
          voTransfers.delete(key); respond({ success: false, error: 'Audio transfer chunk is invalid.' }); return;
        }
        transfer.chunks.push(request.data); respond({ success: true });
      } else {
        voTransfers.delete(key);
        const controller = new AbortController();
        voRunning.set(key, controller);
        VOAnalysis.analyze({ mimeType: transfer.mimeType, audioBase64: transfer.chunks.join('') }, { signal: controller.signal }).then(
          data => respond({ success: true, data }), error => respond({ success: false, error: error.message })
        ).finally(() => voRunning.delete(key));
        return true;
      }
    }
    return;
  }
  if (request.action !== 'VO_ANALYZE') return;
  VOAnalysis.analyze(request.payload).then(
    data => respond({ success: true, data }),
    error => respond({ success: false, error: error.message })
  );
  return true;
});
