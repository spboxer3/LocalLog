document.addEventListener('DOMContentLoaded', async () => {
  // --- Init Theme ---
  const settingsData = await chrome.storage.local.get('theme');
  const currentTheme = settingsData.theme || 'light'; 
  if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
  }

  // --- I18n ---
  const i18nIds = ['appTitle', 'reportTitle', 'lblModeDomain', 'lblModeUrl', 'msgNoData'];
  i18nIds.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = chrome.i18n.getMessage(id === 'appTitle' ? 'extensionName' : id);
  });
  
  const dbBtn = document.querySelector('[data-msg="btnDashboard"]');
  if(dbBtn) dbBtn.textContent = chrome.i18n.getMessage('btnDashboard');
  
  const focusLabel = document.querySelector('[data-msg="labelFocusMode"]');
  if(focusLabel) focusLabel.textContent = chrome.i18n.getMessage('labelFocusMode');

  // --- State ---
  let currentMode = 'domain';
  let focusMode = false;
  let activeTabUrl = null;
  let activeTabHostname = null;
  let updateTimer = null; 
  
  // --- FIXED: Local Date Generation ---
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;

  // Date Input Setup
  const dateInput = document.getElementById('dateInput');
  dateInput.value = today;

  // --- Identify Active Tab ---
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith('http')) {
      activeTabUrl = tab.url;
      try { activeTabHostname = new URL(tab.url).hostname; } catch(e) {}
    }
  } catch(e) {}

  // --- Initial Load ---
  await loadState();
  await loadAndRender(); // Initial render

  // --- Start Real-time Loop (1s) ---
  updateTimer = setInterval(() => {
    if (dateInput.value === today) {
      loadAndRender();
    }
  }, 1000);

  // --- Listeners ---
  dateInput.addEventListener('change', (e) => loadAndRender());

  document.getElementById('btnModeDomain').addEventListener('click', () => setMode('domain'));
  document.getElementById('btnModeUrl').addEventListener('click', () => setMode('url'));
  
  document.getElementById('btnDashboard').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  const checkFocus = document.getElementById('checkFocusMode');
  checkFocus.addEventListener('change', async (e) => {
    focusMode = e.target.checked;
    updateFocusUI();
    await chrome.storage.local.set({ focusMode });
  });

  // --- Functions ---
  
  async function loadState() {
    const data = await chrome.storage.local.get('focusMode');
    focusMode = !!data.focusMode;
    document.getElementById('checkFocusMode').checked = focusMode;
    updateFocusUI();
  }

  function updateFocusUI() {
    const card = document.getElementById('focusCard');
    const statusText = document.getElementById('focusStatus');
    const onTxt = chrome.i18n.getMessage('focusModeOn') || "ON";
    const offTxt = chrome.i18n.getMessage('focusModeOff') || "OFF";

    if (focusMode) {
      card.classList.add('active');
      statusText.textContent = onTxt;
    } else {
      card.classList.remove('active');
      statusText.textContent = offTxt;
    }
  }

  function setMode(mode) {
    currentMode = mode;
    document.getElementById('btnModeDomain').classList.toggle('active', mode === 'domain');
    document.getElementById('btnModeUrl').classList.toggle('active', mode === 'url');
    loadAndRender();
  }

  // CORE FUNCTION: Fetches + Merges + Renders
  async function loadAndRender() {
    const dateKey = document.getElementById('dateInput').value;
    
    const storageData = await chrome.storage.local.get([dateKey]);
    let dailyData = storageData[dateKey] || {};

    // Only merge live buffer if viewing TODAY
    if (dateKey === today) {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'get_live_data' });
            const unsavedData = response?.unsavedData || {};
            
            dailyData = JSON.parse(JSON.stringify(dailyData));
            
            for (const [url, info] of Object.entries(unsavedData)) {
                if (!dailyData[url]) {
                    dailyData[url] = { seconds: 0, title: info.title };
                }
                dailyData[url].seconds += info.seconds;
                if (info.title) dailyData[url].title = info.title;
            }
        } catch (e) {
            // Ignore context invalidated
        }
    }

    renderUI(dailyData);
  }

  function renderUI(rawData) {
    const listEl = document.getElementById('statsList');
    const noDataEl = document.getElementById('noDataMessage');
    const centerTimeEl = document.getElementById('centerTime');
    const centerLabelEl = document.getElementById('centerLabel');
    const pieChartEl = document.getElementById('pieChart');

    const previousScrollTop = listEl.scrollTop;

    listEl.innerHTML = '';
    pieChartEl.innerHTML = ''; 
    centerLabelEl.textContent = 'TOTAL';
    
    if (!rawData || Object.keys(rawData).length === 0) {
      noDataEl.classList.remove('hidden');
      centerTimeEl.textContent = "00:00";
      return;
    }
    noDataEl.classList.add('hidden');

    const processedList = processData(rawData, currentMode);
    const totalSeconds = processedList.reduce((acc, curr) => acc + curr.seconds, 0);
    centerTimeEl.textContent = formatTime(totalSeconds);

    let chartData = [];
    if (processedList.length <= 5) {
      chartData = processedList;
    } else {
      const top5 = processedList.slice(0, 5);
      const others = processedList.slice(5);
      const othersSeconds = others.reduce((acc, curr) => acc + curr.seconds, 0);
      chartData = [...top5];
      if (othersSeconds > 0) {
        chartData.push({
          mainText: chrome.i18n.getMessage('others'),
          subText: `${processedList.length - 5} sites`,
          seconds: othersSeconds,
          isOther: true
        });
      }
    }

    processedList.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'stat-item';
      
      let isActive = false;
      const isToday = document.getElementById('dateInput').value === today;
      
      if (isToday) {
        if (currentMode === 'domain' && activeTabHostname && entry.mainText === activeTabHostname) {
          isActive = true;
        } else if (currentMode === 'url' && activeTabUrl && entry.rawUrl === activeTabUrl) {
          isActive = true;
        }
      }

      if (isActive) {
        li.classList.add('active-highlight');
      }

      li.innerHTML = `
        <div class="stat-info">
          <div class="stat-main" title="${escapeHtml(entry.mainText)}">${escapeHtml(entry.mainText)}</div>
          <div class="stat-sub" title="${escapeHtml(entry.subText)}">${escapeHtml(entry.subText)}</div>
        </div>
        <span class="stat-time">${formatTime(entry.seconds)}</span>
      `;
      listEl.appendChild(li);
    });

    if (previousScrollTop > 0) {
        listEl.scrollTop = previousScrollTop;
    }

    renderDoughnutChart(chartData, totalSeconds);
  }

  function processData(rawData, mode) {
    if (mode === 'url') {
      return Object.entries(rawData)
        .map(([url, info]) => ({
          mainText: info.title || url,
          subText: url,
          seconds: Number(info.seconds) || 0,
          rawUrl: url
        }))
        .sort((a, b) => b.seconds - a.seconds);
    } else {
      const domainMap = {};
      Object.entries(rawData).forEach(([url, info]) => {
        let hostname;
        try { hostname = new URL(url).hostname; } catch(e) { hostname = url; }
        if (!domainMap[hostname]) domainMap[hostname] = { seconds: 0, title: info.title };
        domainMap[hostname].seconds += (Number(info.seconds) || 0);
        if (info.title) domainMap[hostname].title = info.title;
      });
      return Object.entries(domainMap)
        .map(([domain, info]) => ({
          mainText: domain,
          subText: info.title || 'Domain',
          seconds: info.seconds,
          rawUrl: domain 
        }))
        .sort((a, b) => b.seconds - a.seconds);
    }
  }

  function renderDoughnutChart(chartData, totalSeconds) {
      const svg = document.getElementById('pieChart');
      const tooltip = document.getElementById('tooltip');
      const centerTimeEl = document.getElementById('centerTime');
      const centerLabelEl = document.getElementById('centerLabel');
      const ttPrimary = document.getElementById('tt-primary');
      const ttSecondary = document.getElementById('tt-secondary');
  
      let cumulativePercent = 0;
      const colors = ['#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#BF5AF2', '#636366'];
  
      chartData.forEach((entry, index) => {
        const percent = entry.seconds / totalSeconds;
        if (percent === 0) return;
  
        let color = colors[index % 5];
        if (entry.isOther) color = colors[5];
  
        const startPercent = cumulativePercent;
        const endPercent = cumulativePercent + percent;
        cumulativePercent += percent;
  
        const pathData = getDoughnutPath(startPercent, endPercent);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', color);
        
        path.addEventListener('mouseenter', () => {
          centerLabelEl.textContent = entry.isOther ? 'OTHERS' : 'ACTIVE';
          centerTimeEl.textContent = formatTime(entry.seconds);
          centerTimeEl.style.color = color;
          tooltip.classList.remove('hidden');
          ttPrimary.textContent = entry.mainText;
          ttSecondary.textContent = entry.subText;
        });
  
        path.addEventListener('mousemove', (e) => {
          tooltip.style.left = Math.min(e.clientX + 10, window.innerWidth - 250) + 'px'; 
          tooltip.style.top = Math.min(e.clientY + 10, window.innerHeight - 80) + 'px';
        });
  
        path.addEventListener('mouseleave', () => {
          centerLabelEl.textContent = 'TOTAL';
          centerTimeEl.textContent = formatTime(totalSeconds);
          centerTimeEl.style.color = '';
          tooltip.classList.add('hidden');
        });
  
        svg.appendChild(path);
      });
  }

  function getDoughnutPath(startPct, endPct) {
      const outerR = 50, innerR = 38;
      if (endPct - startPct > 0.999) return getDoughnutPath(0, 0.5) + " " + getDoughnutPath(0.5, 1);
      const [startX, startY] = getCoordinatesForPercent(startPct, outerR);
      const [endX, endY] = getCoordinatesForPercent(endPct, outerR);
      const [startInnerX, startInnerY] = getCoordinatesForPercent(startPct, innerR);
      const [endInnerX, endInnerY] = getCoordinatesForPercent(endPct, innerR);
      const largeArcFlag = (endPct - startPct) > 0.5 ? 1 : 0;
      return `M ${startX} ${startY} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endX} ${endY} L ${endInnerX} ${endInnerY} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${startInnerX} ${startInnerY} Z`;
  }
  
  function getCoordinatesForPercent(percent, radius) {
      const x = 50 + radius * Math.cos(2 * Math.PI * percent);
      const y = 50 + radius * Math.sin(2 * Math.PI * percent);
      return [x, y];
  }
  
  function formatTime(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m ${s}s`;
  }
  
  function escapeHtml(text) {
      if (!text) return '';
      return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});