/**
 * Background Service Worker (MV3)
 * Minimal worker for manifest compliance. All logic lives in popup.js and content.js.
 */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    console.log('[Website Study Analyzer] Extension installed. All processing stays local.');
  }
});
