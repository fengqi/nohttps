import { loadConfigFromStorage, syncDynamicRules, STORAGE_KEYS } from "./shared.js";

let syncQueue = Promise.resolve();

function enqueueSync(reason) {
  syncQueue = syncQueue
    .then(async () => {
      const config = await loadConfigFromStorage();
      await syncDynamicRules(config);
      console.log(`[NoHTTPS] Dynamic rules synced (${reason}).`);
    })
    .catch((error) => {
      console.error("[NoHTTPS] Failed to sync dynamic rules:", error);
    });
}

chrome.runtime.onInstalled.addListener(() => {
  enqueueSync("onInstalled");
});

chrome.runtime.onStartup.addListener(() => {
  enqueueSync("onStartup");
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  const shouldSync =
    STORAGE_KEYS.redirectDomains in changes ||
    STORAGE_KEYS.ignoreDomains in changes ||
    STORAGE_KEYS.updatedAt in changes;

  if (shouldSync) {
    enqueueSync("storage.onChanged");
  }
});

enqueueSync("serviceWorkerStart");
