// Logic for Global Active Tab Monitor
let session = {
  url: null,
  domain: null,
  startTime: 0,
  extStartTotal: 0,
  active: false,
};
let isPollActive = true;

// Helper to get today's date key
function getDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Fetch stored data + live buffer from background
async function measureExtensionData(targetUrl) {
  if (!targetUrl) return 0;

  return new Promise((resolve) => {
    // 1. Get Stored Data
    const dateKey = getDateKey();
    chrome.storage.local.get([dateKey], (storageResult) => {
      const dailyData = storageResult[dateKey] || {};
      let total = 0;

      // Check storage for this URL
      if (dailyData[targetUrl]) {
        total += dailyData[targetUrl].seconds;
      }

      // 2. Get Memory Buffer (and check active status)
      chrome.runtime.sendMessage({ action: "get_live_data" }, (response) => {
        if (
          response &&
          response.unsavedData &&
          response.unsavedData[targetUrl]
        ) {
          total += response.unsavedData[targetUrl].seconds;
        }
        resolve({
          totalSeconds: total,
          activeUrl: response.currentUrl,
          isFocused: response.isWindowFocused,
        });
      });
    });
  });
}

async function tick() {
  if (!isPollActive) return;

  // 1. Get Global State
  // We send a dummy message to get the global state first
  chrome.runtime.sendMessage({ action: "get_live_data" }, async (response) => {
    if (!response) {
      log("Error: No response from background.");
      return;
    }

    const currentUrl = response.currentUrl;
    const currentDomain = getHostname(currentUrl);
    const isFocused = response.isWindowFocused;

    // 2. State Change Detection
    // If URL changed or just started
    if (currentUrl && currentUrl !== session.url) {
      // Start New Session
      log(`Switched to: ${currentDomain}`);

      // Get initial total for this new URL to zero-base our counter
      const measure = await measureExtensionData(currentUrl);

      session = {
        url: currentUrl,
        domain: currentDomain,
        startTime: Date.now(),
        extStartTotal: measure.totalSeconds,
        active: true,
      };

      updateHeader(currentDomain, currentUrl, true);
    }

    // 3. Update Metrics (if we have a valid session)
    if (session.url) {
      const measure = await measureExtensionData(session.url);

      // Calculate Session Deltas
      const extSessionSeconds = measure.totalSeconds - session.extStartTotal;
      const realSessionSeconds = Math.floor(
        (Date.now() - session.startTime) / 1000
      );

      // Drift = (Extension's Count) - (Real Time Passed)
      // Ideally should be 0 or small negative (processing delay)
      // Large negative means extension stopped counting.
      const drift = extSessionSeconds - realSessionSeconds;

      // UI Updates
      document.getElementById(
        "extSessionTime"
      ).innerText = `${extSessionSeconds}s`;

      const driftEl = document.getElementById("driftTime");
      driftEl.innerText = `${drift > 0 ? "+" : ""}${drift}s`;
      driftEl.className =
        "stat-value " + (Math.abs(drift) > 2 ? "drift-bad" : "drift-good");

      // Status Badge
      const badge = document.getElementById("statusBadge");
      if (!isFocused) {
        badge.className = "status-badge status-paused";
        badge.innerText = "PAUSED (Focus Lost)";
      } else if (response.currentUrl !== session.url) {
        // This happens briefly during transition
        badge.className = "status-badge status-paused";
        badge.innerText = "SWITCHING...";
      } else {
        badge.className = "status-badge status-active";
        badge.innerText = "TRACKING";
      }
    } else {
      document.getElementById("currentDomain").innerText =
        "No Active Tab / Ignore Protocol";
      document.getElementById("currentUrl").innerText =
        "Extension tracks http/https only";
    }
  });
}

function updateHeader(domain, url, active) {
  document.getElementById("currentDomain").innerText = domain || "Unknown";
  document.getElementById("currentUrl").innerText = url || "";
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

function log(msg) {
  const logDiv = document.getElementById("log");
  const time = new Date().toLocaleTimeString();
  logDiv.innerText = `[${time}] ${msg}\n` + logDiv.innerText;
}

// Start Polling
setInterval(tick, 1000);
tick(); // Immediate start

log("Monitor started. Focus another window to test.");
