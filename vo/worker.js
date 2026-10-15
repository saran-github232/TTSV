// Additive entry point: existing background logic stays unchanged.
importScripts('../background/background.js', 'rubric.js', 'analysis.js');
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (request.action !== 'VO_ANALYZE') return;
  VOAnalysis.analyze(request.payload).then(
    data => respond({ success: true, data }),
    error => respond({ success: false, error: error.message })
  );
  return true;
});
