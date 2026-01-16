/**
 * Web Activity Time Tracker - High Performance Background Service
 * With Smart Defaults, Buffering, Group Limits & Live Data Serving
 * FIXED: Date generation now uses Local Time instead of UTC.
 * FIXED: Blacklist now supports wildcards (e.g., *.example.com)
 */

let currentTabId = null;
let currentUrl = null;
let currentTitle = null;
let isWindowFocused = true;
let trackingInterval = null;

// --- Memory Buffer ---
let unsavedData = {};
let lastSaveTime = Date.now();
const SAVE_INTERVAL = 5000; // Persist to disk every 5s

// --- Smart Defaults ---
const DEFAULT_CATEGORIES = {
  "gemini.google.com": "AI",
  "chatgpt.com": "AI",
  "claude.ai": "AI",
  "grok.com": "AI",
  "perplexity.ai": "AI",
  "facebook.com": "Social",
  "instagram.com": "Social",
  "threads.com": "Social",
  "twitter.com": "Social",
  "x.com": "Social",
  "reddit.com": "Social",
  "linkedin.com": "Social",
  "dcard.tw": "Social",
  "ptt.cc": "Social",
  "youtube.com": "Video",
  "netflix.com": "Video",
  "twitch.tv": "Video",
  "disneyplus.com": "Video",
  "tiktok.com": "Video",
  "github.com": "Work",
  "stackoverflow.com": "Work",
  "notion.so": "Work",
  "figma.com": "Work",
  "docs.google.com": "Work",
  "slack.com": "Work",
  "amazon.com": "Shopping",
  "shopee.tw": "Shopping",
  "momo.com.tw": "Shopping",
  "yahoo.com": "News",
  "ettoday.com": "News",
  "www.tvbs.com.tw": "News",
};

// Settings Cache
let settings = {
  blacklist: [],
  limits: {},
  categories: {},
  categoryLimits: {},
  forWorkCategories: [],
};
let focusMode = false;
let notifiedDomains = {};
let focusNotifiedDomains = {};

// Init
loadSettings();
setupBadge();
init();

// --- Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "force_save") {
    // Force flush buffer to disk
    saveData().then(() => {
      sendResponse({ status: "saved" });
    });
    return true; // Async response
  } else if (request.action === "get_live_data") {
    // Return current memory buffer + Tracking State for POC
    sendResponse({
      unsavedData: unsavedData,
      currentUrl: currentUrl,
      isWindowFocused: isWindowFocused,
    });
    return false;
  }
});

if (!trackingInterval) {
  trackingInterval = setInterval(tick, 1000);
}

function tick() {
  if (!isWindowFocused || !currentUrl || !currentTabId) return;
  if (!isValidProtocol(currentUrl)) return;

  const hostname = getHostname(currentUrl);

  // FIXED: Check blacklist with wildcard support
  if (isBlacklisted(hostname)) return;

  // --- 1. Track Time (In Memory) ---
  if (!unsavedData[currentUrl]) {
    unsavedData[currentUrl] = {
      seconds: 0,
      title: currentTitle,
      lastVisit: Date.now(),
    };
  }
  unsavedData[currentUrl].seconds++;
  if (currentTitle) unsavedData[currentUrl].title = currentTitle;

  // --- 2. Check Focus Mode Violation ---
  checkFocusViolation(hostname);

  updateBadge();

  // --- 3. Periodic Save ---
  const now = Date.now();
  if (now - lastSaveTime >= SAVE_INTERVAL) {
    saveData();
  }
}

// NEW: Helper to check if hostname matches any blacklist rule (supports wildcards)
function isBlacklisted(hostname) {
  if (!settings.blacklist || settings.blacklist.length === 0) return false;

  return settings.blacklist.some((rule) => {
    // 1. Exact match
    if (rule === hostname) return true;

    // 2. Wildcard match (if rule contains *)
    if (rule.includes("*")) {
      // Escape special regex characters (except *)
      // e.g., "*.google.com" -> "\*.google\.com"
      const escapedRule = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

      // Replace * with .* (wildcard regex)
      // e.g., "\*.google\.com" -> ".*\.google\.com"
      const regexStr = "^" + escapedRule.replace(/\*/g, ".*") + "$";

      try {
        const regex = new RegExp(regexStr, "i"); // Case insensitive
        return regex.test(hostname);
      } catch (e) {
        // Fallback if regex fails for some reason
        return false;
      }
    }

    return false;
  });
}

function checkFocusViolation(hostname) {
  if (!focusMode) return;
  if (focusNotifiedDomains[hostname]) return;

  // Also check if the hostname is blacklisted (shouldn't warn if ignored)
  if (isBlacklisted(hostname)) return;

  const category = settings.categories[hostname] || "Uncategorized";
  const isForWork =
    settings.forWorkCategories && settings.forWorkCategories.includes(category);

  if (!isForWork) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: chrome.i18n.getMessage("focusWarningTitle") || "Focus Mode Alert",
      message: `${
        chrome.i18n.getMessage("focusWarningMsg") || "Focus Mode ON. Avoid:"
      } ${hostname}`,
      priority: 2,
    });
    focusNotifiedDomains[hostname] = true;
  }
}

function isValidProtocol(url) {
  if (!url) return false;
  // POC: Allow tracking for the console page
  if (url.includes("console.html")) return true;
  return url.startsWith("http://") || url.startsWith("https://");
}

async function saveData() {
  if (Object.keys(unsavedData).length === 0) return;

  // Atomic swap: Copy and clear buffer immediately
  const dataToSave = unsavedData;
  unsavedData = {};

  // Use LOCAL Date Key to ensure correctness
  const dateKey = getDateKey();

  try {
    const data = await chrome.storage.local.get([dateKey]);
    let dailyData = data[dateKey] || {};

    for (const [url, info] of Object.entries(dataToSave)) {
      if (!dailyData[url])
        dailyData[url] = { seconds: 0, lastVisit: 0, title: info.title };
      dailyData[url].seconds += info.seconds;
      dailyData[url].title = info.title;
      dailyData[url].lastVisit = Date.now();

      // Check limits (pass hostname)
      checkLimits(getHostname(url), dailyData);
    }
    await chrome.storage.local.set({ [dateKey]: dailyData });
    lastSaveTime = Date.now();
  } catch (e) {
    console.error("Save failed:", e);
    // Restore data on failure
    for (const [url, info] of Object.entries(dataToSave)) {
      if (!unsavedData[url]) {
        unsavedData[url] = info;
      } else {
        unsavedData[url].seconds += info.seconds;
      }
    }
  }
}

async function forceSave() {
  await saveData();
}

async function checkLimits(hostname, dailyData) {
  // If blacklisted, ignore limits too
  if (isBlacklisted(hostname)) return;

  let limitMinutes = 0;
  if (settings.limits && settings.limits[hostname] > 0) {
    limitMinutes = settings.limits[hostname];
  } else if (settings.categoryLimits) {
    const cat = settings.categories[hostname];
    if (cat && settings.categoryLimits[cat] > 0) {
      limitMinutes = settings.categoryLimits[cat];
    }
  }

  if (limitMinutes <= 0) return;

  let totalSeconds = 0;
  Object.entries(dailyData).forEach(([url, info]) => {
    if (getHostname(url) === hostname) {
      totalSeconds += info.seconds;
    }
  });

  const usedMinutes = totalSeconds / 60;

  if (usedMinutes >= limitMinutes && !notifiedDomains[hostname]) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title:
        chrome.i18n.getMessage("limitExceededTitle") || "Time Limit Exceeded",
      message: `${
        chrome.i18n.getMessage("limitExceededMsg") || "Limit reached for:"
      } ${hostname}`,
      priority: 2,
    });
    notifiedDomains[hostname] = true;
  }
}

function updateBadge() {
  if (focusMode) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#FF375F" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

async function loadSettings() {
  const result = await chrome.storage.local.get(["settings", "focusMode"]);
  if (result.settings) {
    settings = result.settings;
  } else {
    settings = { blacklist: [], limits: {}, categories: {} };
  }

  if (!settings.categories || Object.keys(settings.categories).length === 0) {
    settings.categories = { ...DEFAULT_CATEGORIES };
    await chrome.storage.local.set({ settings });
  }
  if (!settings.categoryLimits) settings.categoryLimits = {};
  if (!settings.forWorkCategories) settings.forWorkCategories = [];

  if (result.focusMode !== undefined) focusMode = result.focusMode;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.settings) settings = changes.settings.newValue;
    if (changes.focusMode) {
      focusMode = changes.focusMode.newValue;
      updateBadge();
    }
  }
});

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

// --- FIXED: Use Local Date ---
function getDateKey() {
  // Returns YYYY-MM-DD in local time
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setupBadge() {
  chrome.action.setBadgeBackgroundColor({ color: "#0A84FF" });
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await forceSave();
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (isValidProtocol(tab.url)) {
      currentTabId = tab.id;
      if (currentUrl !== tab.url) focusNotifiedDomains = {};
      currentUrl = tab.url;
      currentTitle = tab.title;
    } else {
      currentUrl = null;
    }
  } catch (e) {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && tab.active) {
    if (changeInfo.url) {
      forceSave();
      if (isValidProtocol(changeInfo.url)) {
        focusNotifiedDomains = {};
        currentUrl = changeInfo.url;
      } else {
        currentUrl = null;
      }
    }
    if (changeInfo.title) currentTitle = changeInfo.title;
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  await forceSave();
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
  } else {
    isWindowFocused = true;
    const tabs = await chrome.tabs.query({ active: true, windowId: windowId });
    if (tabs.length > 0) {
      if (isValidProtocol(tabs[0].url)) {
        currentTabId = tabs[0].id;
        if (currentUrl !== tabs[0].url) focusNotifiedDomains = {};
        currentUrl = tabs[0].url;
        currentTitle = tabs[0].title;
      } else {
        currentUrl = null;
      }
    }
  }
});

chrome.runtime.onSuspend.addListener(() => {
  saveData();
});

async function init() {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      if (isValidProtocol(tab.url)) {
        currentTabId = tab.id;
        currentUrl = tab.url;
        currentTitle = tab.title;
      }
    }
  } catch (e) {
    // Ignore errors during init
  }
}

if (typeof module !== 'undefined') {
    module.exports = {
        tick,
        saveData,
        forceSave,
        getDateKey,
        loadSettings,
        settings,
        unsavedData,
        currentUrl,
        init,
        setCurrentUrl: (url) => { currentUrl = url; },
        setCurrentTabId: (id) => { currentTabId = id; },
        setIsWindowFocused: (val) => { isWindowFocused = val; },
        getUnsavedData: () => unsavedData,
        setUnsavedData: (data) => { unsavedData = data; },
        setSettings: (s) => { settings = s; },
        checkLimits,
        // Expose other internals as needed
    };
}
