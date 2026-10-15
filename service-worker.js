// Root entry point keeps every background dependency under the worker's scope.
// Resolve from the extension root, never from a nested worker directory.
importScripts(
  chrome.runtime.getURL('background/background.js'),
  chrome.runtime.getURL('vo/rubric.js'),
  chrome.runtime.getURL('vo/http.js'),
  chrome.runtime.getURL('vo/analysis.js'),
  chrome.runtime.getURL('vo/worker.js')
);
