<p align="center"><img src="icons/icon128.png"></p>

<h1 align="center">LocalLog - Private & Simple Web Tracker</h1>

<p align="center">English | <a href="README.zh-TW.md">繁體中文</a></p>

A lightweight, privacy-focused Chrome extension that helps you track your browsing habits, set daily limits, and boost productivity. All data is stored locally on your device and never sent to external servers.


## ✨ Key Features


### 📊 Analytics Dashboard


- **Real-time Tracking:** Tracks time only when the window is focused and active, ensuring precision.
- **Visual Charts:** View activity trends by Day, Week, or Month via an interactive dashboard.
- **Category Statistics:** Automatically categorizes popular sites (Work, Social, Video, etc.) and supports custom categorization.
- **Top Sites:** At a glance, see exactly where your time goes.


### 🛡️ Productivity Tools


- **Daily Limits:** Set daily usage caps (in minutes) for specific domains or entire categories. Receive notifications when limits are exceeded.
- **Focus Mode:** Enable "Focus Mode" to receive warnings when visiting non-work-related websites.
- **Blacklist System:** Supports wildcards (e.g., `*.example.com`) to completely exclude specific domains or subdomains from tracking.


### 💾 Data Management


- **Privacy First:** 100% Local Storage. No backend servers, no data uploads.
- **Import & Export:**
  - Export browsing history to **CSV** format for external analysis.
  - **New:** Import CSV data to restore history or merge data from multiple devices.
  - Backup and restore your settings and rules via **JSON**.
- **Data Control:** One-click to clear all browsing history while preserving your personalized settings and rules.


### 🎨 Customization


- **Dark/Light Mode:** Switch interface themes at any time to suit your browsing environment.
- **Custom Categories:** Assign any website to a category that fits your workflow.


## 🚀 Installation


1. Download the source code for this project.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Toggle **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the folder containing this extension (the folder with `manifest.json`).


## 📖 Usage Guide


1. **Pin Extension:** Click the puzzle icon in Chrome and pin **LocalLog** for quick access.
2. **Popup:** Click the icon to view today's summary and toggle Focus Mode.
3. **Dashboard:** Click "Dashboard & Settings" in the popup to enter the full analytics interface.
4. **Set Rules:** Go to the "Limits & Categories" tab to add domains, set time limits, or adjust website categories.


## 🛠️ Technical Details


- **Manifest V3:** Built with the latest Chrome Extension standards for better security and performance.
- **High Performance:** Uses an in-memory buffer to reduce disk write frequency (saves every 5 seconds or on tab switch), minimizing resource consumption.
- **No External Dependencies:** Built with pure JavaScript, HTML, and CSS. Lightweight and fast.


## 🔒 Privacy Policy


We take your privacy seriously:


- **No Tracking Scripts:** We do not use Google Analytics or any third-party tracking services.
- **Local Storage:** Your browsing history stays permanently on your computer.
- **Permissions:** We only request the minimum permissions necessary for functionality (tabs, storage, notifications).


*If you enjoy **LocalLog**, feel free to provide feedback or report issues!*
