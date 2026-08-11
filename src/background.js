chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  chrome.tabs.sendMessage(tab.id, { type: "RESUMEMD_TOGGLE" }).catch(() => {
    chrome.scripting?.executeScript?.({
      target: { tabId: tab.id },
      files: ["src/content-script.js"]
    });
  });
});
