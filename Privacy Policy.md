# LocalLog - Private & Simple Web Tracker


**Last Updated:** December 20, 2025


**LocalLog - Private & Simple Web Tracker** ("we", "us", or "our") is a Chrome extension designed to help users track their web browsing habits, manage productivity, and analyze time usage.


We are committed to protecting your privacy. This Privacy Policy explains what data we collect, how we use it, and how we ensure it remains private.


**The core principle of LocalLog is simple: Your data belongs to you. We do not transmit, sell, or share your browsing history with anyone.**


## 1. Data Collection and Usage


LocalLog operates entirely on your local device. We collect and process the following types of data solely for the purpose of the extension's functionality:


### A. Browsing Activity Data


To provide time-tracking analytics and productivity reports, LocalLog temporarily monitors:


- **URLs (Web Addresses):** To identify which website you are currently visiting.
- **Page Titles:** To display readable names in your dashboard.
- **Time Spent:** To calculate the duration of your visits.


**How it is used:** This data is used exclusively to generate the charts, graphs, and daily summaries visible in the extension's dashboard. This data is processed locally within your browser.


### B. User Preferences and Settings


We store your configurations, including:


- Daily time limits and rules.
- Custom category assignments.
- Blacklisted domains.
- Interface themes (Dark/Light mode).


**How it is used:** This data is used to maintain your personalized experience and enforce the productivity rules you have set.


## 2. Data Storage and Security


### Local Storage Only


**All data collected by LocalLog is stored locally on your computer** using the Chrome Storage API (`chrome.storage.local`).


- **No External Servers:** We do not own, operate, or rent any servers to store your data. Your browsing history never leaves your device.
- **No Cloud Sync:** By default, data is not synced across devices unless you manually export and import it.


### Data Retention


The data persists on your device until you manually clear it. You can delete your entire history at any time using the "Clear All History" button in the extension settings.


## 3. Third-Party Sharing and Tracking


- **No Third-Party Analytics:** We do not use Google Analytics, Mixpanel, or any other third-party tracking scripts inside the extension.
- **No Data Selling:** We do not sell, trade, or transfer your data to outside parties.
- **No Advertising:** LocalLog does not display ads and does not use your data for advertising purposes.


## 4. Permissions Usage


In accordance with the Chrome Web Store policies, we declare the specific permissions requested in our manifest (`manifest.json`) and their usage:


- **`tabs`**:
  - **Why:** To detect the URL and Title of the website you are currently visiting.
  - **Usage:** This is the primary permission required for the time-tracking functionality. It allows the extension to recognize the domain (e.g., "youtube.com") in the background so it can log time to the correct category (e.g., "Video"). We use this strictly for categorization and time calculation.
- **`storage`**:
  - **Why:** To save your browsing stats, settings, and rules locally on your device.
  - **Usage:** This enables your productivity data (such as time spent on sites) and preferences (such as dark mode or blocklists) to persist after you close the browser.
- **`notifications`**:
  - **Why:** To communicate important alerts to the user.
  - **Usage:** We use system notifications solely to alert you when you have exceeded a daily time limit you set, or to provide a gentle warning when you visit a distracting site while "Focus Mode" is active.
- **`activeTab`**:
  - **Why:** To grant the extension temporary access to the current tab when you interact with it.
  - **Usage:** This ensures that when you click the extension icon to view the popup, the extension can immediately identify and display statistics relevant to the page you are currently viewing.


## 5. User Rights and Control


You have full control over your data:


1. **Access:** You can view all your tracked data via the "Dashboard".
2. **Export:** You can export your data to a CSV or JSON file for your own backup or analysis.
3. **Deletion:** You can delete all stored data instantly via the "Settings" tab in the extension dashboard.
4. **Exclusion:** You can add specific domains to the "Blacklist" to prevent them from ever being tracked.


## 6. Changes to This Privacy Policy


We may update our Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. Any changes will be posted on this page, and the "Last Updated" date will be revised.


## 7. Contact Us


If you have any questions about this Privacy Policy or our data practices, please contact us.
