document.addEventListener('DOMContentLoaded', async () => {
  // --- Inject Dynamic Styles ---
  const style = document.createElement('style');
  style.textContent = `
    .analytics-list { display: flex; flex-direction: column; gap: 8px; width: 100%; max-height: 400px; overflow-y: auto; padding-right: 5px; }
    .analytics-list::-webkit-scrollbar { width: 4px; }
    .analytics-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    
    .analytics-item { 
      display: flex; align-items: center; padding: 12px 16px; 
      background: var(--bg-surface); border: 1px solid var(--border); 
      border-radius: 8px; transition: transform 0.1s;
    }
    .analytics-item:hover { background: var(--bg-hover); }
    
    .analytics-label-group { display: flex; flex-direction: column; width: 160px; flex-shrink: 0; margin-right: 16px; }
    .analytics-label-main { 
      font-weight: 600; font-size: 14px; color: var(--text-primary); 
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
      text-decoration: none; cursor: pointer;
    }
    .analytics-label-main:hover { color: var(--accent); text-decoration: underline; }
    
    .analytics-label-sub { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
    
    .analytics-bar-track { 
      flex: 1; height: 12px; background: var(--bg-input); 
      border-radius: 6px; margin-right: 20px; overflow: hidden; 
      position: relative;
    }
    .analytics-bar-fill { 
      height: 100%; background: var(--accent); border-radius: 6px; 
      min-width: 4px; transition: width 0.5s cubic-bezier(0.25, 0.8, 0.25, 1); 
    }
    
    .analytics-value { 
      width: 80px; text-align: right; font-weight: 700; 
      font-size: 14px; color: var(--text-primary); font-feature-settings: "tnum"; 
    }

    /* Custom ComboBox for Category Input */
    .custom-combobox { position: relative; width: 100%; }
    .combobox-wrapper { 
      display: flex; align-items: center; 
      background: var(--bg-input); border: 1px solid var(--border); 
      border-radius: 8px; transition: border-color 0.2s;
      box-sizing: border-box;
    }
    .combobox-wrapper:focus-within { border-color: var(--accent); }
    .combobox-input { 
      border: none; background: transparent; color: var(--text-primary); 
      padding: 12px; flex: 1; outline: none; font-size: 14px; font-family: inherit;
      min-width: 0;
    }
    .combobox-trigger { 
      padding: 0 12px; cursor: pointer; color: var(--text-secondary); 
      display: flex; align-items: center; justify-content: center; height: 100%;
    }
    .combobox-trigger:hover { color: var(--text-primary); }
    .combobox-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; 
      background: var(--bg-surface); border: 1px solid var(--border); 
      border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); 
      z-index: 100; max-height: 200px; overflow-y: auto;
      opacity: 0; visibility: hidden; transform: translateY(-10px);
      transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .combobox-dropdown.show { opacity: 1; visibility: visible; transform: translateY(0); }
    
    /* Dark mode shadow fix */
    body.dark-theme .combobox-dropdown { box-shadow: 0 4px 16px rgba(0,0,0,0.4); }

    .combobox-option { 
      padding: 10px 12px; cursor: pointer; font-size: 14px; color: var(--text-primary); 
    }
    .combobox-option:hover { background: var(--bg-hover); }
    .combobox-option.hidden { display: none; }

    /* Edit Form Styles inside Modal */
    .edit-form-group { margin-bottom: 12px; }
    .edit-form-group label { font-size: 12px; color: var(--text-secondary); display: block; margin-bottom: 4px; }
    .edit-form-input { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-input); color: var(--text-primary); box-sizing: border-box; }
    .edit-form-input:focus { border-color: var(--accent); outline: none; }
  `;
  document.head.appendChild(style);

  // --- I18n ---
  document.querySelectorAll('.i18n').forEach(el => {
    const key = el.getAttribute('data-msg');
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.textContent = msg;
  });

  // --- Theme Init ---
  const data = await chrome.storage.local.get('theme');
  const currentTheme = data.theme || 'light'; 
  applyTheme(currentTheme);
  
  // Init Custom Select for Theme (Settings Tab)
  initCustomSelect(currentTheme);

  // --- Tabs Navigation ---
  const tabs = document.querySelectorAll('.nav-btn');
  const contents = document.querySelectorAll('.tab-content');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      if (targetId) {
        const target = document.getElementById(targetId);
        if (target) target.classList.add('active');
      }
    });
  });

  // --- Time Range Switching ---
  const timeBtns = document.querySelectorAll('.time-btn');
  timeBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      timeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const range = btn.getAttribute('data-range');
      const settings = await loadSettings(); 
      await renderAnalytics(settings, range);
    });
  });

  // --- Load Settings & Initial Render ---
  let settings = await loadSettings();
  
  // Initialize Custom Category UI (replaces native datalist input)
  initCategoryCombobox(settings);
  
  // Initial Sync
  try { await chrome.runtime.sendMessage({ action: 'force_save' }); } catch(e) {}
  
  await renderAnalytics(settings, 'week'); 
  renderRules(settings);
  const inputBlacklist = document.getElementById('inputBlacklist');
  if (inputBlacklist) {
    inputBlacklist.value = settings.blacklist.join(', ');
  }

  // --- Auto-Refresh on Focus (Visibility Change) ---
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      try {
        await chrome.runtime.sendMessage({ action: 'force_save' });
      } catch (e) {}
      
      settings = await loadSettings();
      
      const activeTimeBtn = document.querySelector('.time-btn.active');
      const currentRange = activeTimeBtn ? activeTimeBtn.getAttribute('data-range') : 'week';
      
      await renderAnalytics(settings, currentRange);
      renderRules(settings);
      updateCategoryCombobox(settings);
    }
  });

  // --- Limits & Categories Logic (Add/Update Rule) ---
  const btnSaveRule = document.getElementById('btnSaveRule');
  if (btnSaveRule) {
    btnSaveRule.addEventListener('click', async () => {
      const domainInput = document.getElementById('inputDomain');
      const domain = domainInput ? domainInput.value.trim() : '';
      
      // Use value from our custom input
      const categoryInput = document.getElementById('inputCategory');
      const category = categoryInput ? categoryInput.value.trim() : '';
      
      const limitInput = document.getElementById('inputLimit');
      const limit = limitInput ? parseInt(limitInput.value) : 0;

      if (!domain) {
        showToast('Domain is required', 'error');
        return;
      }

      if (!settings.categories) settings.categories = {};
      if (!settings.limits) settings.limits = {};

      if (category) settings.categories[domain] = category;
      if (!isNaN(limit)) settings.limits[domain] = limit;

      await saveSettings(settings);
      
      // Update the dropdown list with new category if added
      updateCategoryCombobox(settings); 
      
      renderRules(settings);
      
      if (domainInput) domainInput.value = '';
      if (categoryInput) categoryInput.value = '';
      if (limitInput) limitInput.value = '0';
      showToast('Rule saved successfully', 'success');
    });
  }

  // --- Settings Logic (Save) ---
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      const inputBlacklist = document.getElementById('inputBlacklist');
      const raw = inputBlacklist ? inputBlacklist.value : '';
      settings.blacklist = raw.split(',').map(s => s.trim()).filter(s => s);
      await saveSettings(settings);

      // Save Theme (value is in hidden input from custom select)
      const hiddenThemeInput = document.getElementById('hiddenThemeInput');
      if (hiddenThemeInput) {
        const newTheme = hiddenThemeInput.value;
        await chrome.storage.local.set({ theme: newTheme });
      }

      showToast(chrome.i18n.getMessage('saveSuccess'), 'success');
    });
  }

  // --- Data Export/Import Logic ---
  const btnExportCSV = document.getElementById('btnExportCSV');
  if (btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);
  
  const btnExportSettings = document.getElementById('btnExportSettings');
  if (btnExportSettings) btnExportSettings.addEventListener('click', exportSettings);
  
  const btnImportSettings = document.getElementById('btnImportSettings');
  const inputImportSettings = document.getElementById('inputImportSettings');
  if (btnImportSettings && inputImportSettings) {
    btnImportSettings.addEventListener('click', () => {
      inputImportSettings.click();
    });
    inputImportSettings.addEventListener('change', importSettings);
  }

  // --- NEW: Import CSV Logic ---
  const btnImportCSV = document.getElementById('btnImportCSV');
  const inputImportCSV = document.getElementById('inputImportCSV');
  if (btnImportCSV && inputImportCSV) {
    btnImportCSV.addEventListener('click', () => {
      inputImportCSV.click();
    });
    inputImportCSV.addEventListener('change', importCSV);
  }

  // --- Clear Data Logic ---
  const btnClearData = document.getElementById('btnClearData');
  if (btnClearData) {
    btnClearData.addEventListener('click', async () => {
        const confirmed = await openConfirm(
            chrome.i18n.getMessage('confirmClearDataTitle') || 'Delete All Data?',
            chrome.i18n.getMessage('confirmClearDataMsg') || 'This will permanently delete all your tracking history. Settings will be kept.'
        );

        if (confirmed) {
            // Get all storage data
            const allData = await chrome.storage.local.get(null);
            const keysToRemove = [];
            // Preserve these specific configuration keys
            const preservedKeys = ['settings', 'theme', 'focusMode'];

            for (const key in allData) {
                if (!preservedKeys.includes(key)) {
                    keysToRemove.push(key);
                }
            }

            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                showToast(chrome.i18n.getMessage('dataCleared') || 'All history cleared.', 'success');
                
                // Refresh analytics to show empty state immediately
                settings = await loadSettings();
                const activeTimeBtn = document.querySelector('.time-btn.active');
                const currentRange = activeTimeBtn ? activeTimeBtn.getAttribute('data-range') : 'week';
                await renderAnalytics(settings, currentRange);
            } else {
                showToast(chrome.i18n.getMessage('noData') || 'No data to clear', 'info');
            }
        }
    });
  }
});

// --- Helper Functions ---

function applyTheme(theme) {
  if (document.body) {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }
}

// Logic for Theme Select
function initCustomSelect(initialValue) {
  const themeSelect = document.getElementById('themeSelect');
  if (!themeSelect) return;
  
  const hiddenInput = document.getElementById('hiddenThemeInput');
  const label = document.getElementById('currentThemeLabel');
  const options = themeSelect.querySelectorAll('.option');

  function setVal(val) {
    if (hiddenInput) hiddenInput.value = val;
    applyTheme(val);
    let text = "";
    options.forEach(opt => {
      if(opt.getAttribute('data-value') === val) {
        opt.classList.add('selected');
        const span = opt.querySelector('span');
        if (span) text = span.textContent;
      } else {
        opt.classList.remove('selected');
      }
    });
    if (label) label.textContent = text;
  }

  setVal(initialValue);

  const trigger = themeSelect.querySelector('.select-trigger');
  if (trigger) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      themeSelect.classList.toggle('open');
    });
  }

  options.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      setVal(opt.getAttribute('data-value'));
      themeSelect.classList.remove('open');
    });
  });

  document.addEventListener('click', () => {
    if (themeSelect) themeSelect.classList.remove('open');
  });
}

async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  let s = data.settings || { blacklist: [], limits: {}, categories: {} };
  
  // Ensure categories object exists to prevent crashes
  if (!s.categories) s.categories = {};
  if (!s.categoryLimits) s.categoryLimits = {};
  if (!s.forWorkCategories) s.forWorkCategories = [];
  return s;
}

async function saveSettings(newSettings) {
  await chrome.storage.local.set({ settings: newSettings });
  return newSettings;
}

// --- NEW: Custom Category Combobox Logic ---
// Replaces the native <input list="..."> with a custom UI
function initCategoryCombobox(settings) {
  const originalInput = document.getElementById('inputCategory');
  if (!originalInput) return;

  // 1. Create Wrapper Structure
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-combobox';
  
  const innerWrapper = document.createElement('div');
  innerWrapper.className = 'combobox-wrapper';

  // 2. Clone Input (to keep ID and reference) but change class
  const newInput = originalInput.cloneNode(true);
  newInput.className = 'combobox-input';
  newInput.removeAttribute('list'); // Remove native datalist link
  
  // 3. Create Trigger (Arrow)
  const trigger = document.createElement('div');
  trigger.className = 'combobox-trigger';
  trigger.innerHTML = '<i class="fa-solid fa-chevron-down" style="font-size:12px"></i>';

  // 4. Create Dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'combobox-dropdown';
  dropdown.id = 'categoryDropdown';

  // Assemble
  innerWrapper.appendChild(newInput);
  innerWrapper.appendChild(trigger);
  wrapper.appendChild(innerWrapper);
  wrapper.appendChild(dropdown);

  // Replace original in DOM
  if (originalInput.parentNode) {
      originalInput.parentNode.replaceChild(wrapper, originalInput);
  }

  // 5. Populate Options
  updateCategoryCombobox(settings);

  // 6. Event Listeners
  const inputEl = document.getElementById('inputCategory'); // Re-select the new one
  if (!inputEl) return;
  
  // Toggle Dropdown
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });

  // Input Focus -> Show
  inputEl.addEventListener('focus', () => {
    dropdown.classList.add('show');
  });

  // Filter Logic
  inputEl.addEventListener('input', () => {
    const filter = inputEl.value.toLowerCase();
    const opts = dropdown.querySelectorAll('.combobox-option');
    let hasVisible = false;
    opts.forEach(opt => {
      const text = opt.textContent.toLowerCase();
      if (text.includes(filter)) {
        opt.classList.remove('hidden');
        hasVisible = true;
      } else {
        opt.classList.add('hidden');
      }
    });
    if (!hasVisible) dropdown.classList.remove('show');
    else dropdown.classList.add('show');
  });

  // Click Outside to Close
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

function updateCategoryCombobox(settings) {
  const dropdown = document.getElementById('categoryDropdown');
  if (!dropdown) return;

  const categories = new Set();
  // FIXED: Load ONLY from current settings
  if (settings.categories) {
    Object.values(settings.categories).forEach(cat => {
      if (cat) categories.add(cat);
    });
  }
  
  dropdown.innerHTML = '';
  
  const sortedCategories = Array.from(categories).sort();

  sortedCategories.forEach(cat => {
    const opt = document.createElement('div');
    opt.className = 'combobox-option';
    opt.textContent = cat;
    
    opt.addEventListener('click', () => {
      const input = document.getElementById('inputCategory');
      if (input) input.value = cat;
      dropdown.classList.remove('show');
    });
    
    dropdown.appendChild(opt);
  });
}

// --- Custom Modal Logic ---
function getModalElements() {
  const overlay = document.getElementById('customModal');
  if (!overlay) return null; // Handle missing overlay
  
  const container = overlay.querySelector('.modal-container');
  const titleEl = document.getElementById('modalTitle');
  const descEl = document.getElementById('modalDesc');
  const inputEl = document.getElementById('modalInput');
  const btnSave = document.getElementById('btnModalSave');
  const btnCancel = document.getElementById('btnModalCancel');
  
  let customContent = document.getElementById('modalCustomContent');
  if (!customContent && container) {
    customContent = document.createElement('div');
    customContent.id = 'modalCustomContent';
    const actions = container.querySelector('.modal-actions');
    if (actions) container.insertBefore(customContent, actions);
    else container.appendChild(customContent);
  }

  return { overlay, titleEl, descEl, inputEl, btnSave, btnCancel, customContent };
}

function resetModalListeners(btnSave, btnCancel) {
  if (!btnSave || !btnCancel) return { newBtnSave: btnSave, newBtnCancel: btnCancel };
  const newBtnSave = btnSave.cloneNode(true);
  if (btnSave.parentNode) btnSave.parentNode.replaceChild(newBtnSave, btnSave);
  const newBtnCancel = btnCancel.cloneNode(true);
  if (btnCancel.parentNode) btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
  return { newBtnSave, newBtnCancel };
}

// Simple Prompt
function openModal(title, description, initialValue) {
  return new Promise((resolve) => {
    const elements = getModalElements();
    if (!elements) { resolve(null); return; } // Safety check
    const { overlay, titleEl, descEl, inputEl, btnSave, btnCancel, customContent } = elements;
    
    if (customContent) {
        customContent.innerHTML = '';
        customContent.style.display = 'none';
    }
    if (inputEl) {
        inputEl.style.display = 'block';
        inputEl.value = initialValue;
        inputEl.focus();
    }
    
    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;
    
    overlay.classList.remove('hidden');

    const { newBtnSave, newBtnCancel } = resetModalListeners(btnSave, btnCancel);

    if (newBtnSave) {
        newBtnSave.addEventListener('click', () => {
          overlay.classList.add('hidden');
          resolve(inputEl ? inputEl.value : null);
        });
    }

    if (newBtnCancel) {
        newBtnCancel.addEventListener('click', () => {
          overlay.classList.add('hidden');
          resolve(null);
        });
    }
    
    if (inputEl) {
        inputEl.onkeydown = (e) => {
          if (e.key === 'Enter' && newBtnSave) newBtnSave.click();
          if (e.key === 'Escape' && newBtnCancel) newBtnCancel.click();
        };
    }
  });
}

// UI Confirm Dialog
function openConfirm(title, description) {
  return new Promise((resolve) => {
    const elements = getModalElements();
    if (!elements) { resolve(false); return; }
    const { overlay, titleEl, descEl, inputEl, btnSave, btnCancel, customContent } = elements;

    if (customContent) {
        customContent.innerHTML = '';
        customContent.style.display = 'none';
    }
    if (inputEl) inputEl.style.display = 'none'; 

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = description;

    overlay.classList.remove('hidden');
    
    const { newBtnSave, newBtnCancel } = resetModalListeners(btnSave, btnCancel);
    
    if (newBtnSave) {
        newBtnSave.textContent = 'Confirm';
        newBtnSave.addEventListener('click', () => {
          overlay.classList.add('hidden');
          newBtnSave.textContent = chrome.i18n.getMessage('btnSave') || 'Save';
          resolve(true);
        });
    }

    if (newBtnCancel) {
        newBtnCancel.addEventListener('click', () => {
          overlay.classList.add('hidden');
          if (newBtnSave) newBtnSave.textContent = chrome.i18n.getMessage('btnSave') || 'Save';
          resolve(false);
        });
    }
  });
}

// Edit Rule Modal (Domain + Limit)
function openEditRuleModal(oldDomain, oldLimit) {
  return new Promise((resolve) => {
    const elements = getModalElements();
    if (!elements) { resolve(null); return; }
    const { overlay, titleEl, descEl, inputEl, btnSave, btnCancel, customContent } = elements;

    if (inputEl) inputEl.style.display = 'none'; 
    if (customContent) {
        customContent.style.display = 'block';
        customContent.innerHTML = `
          <div class="edit-form-group">
            <label>Domain</label>
            <input type="text" id="editDomain" class="edit-form-input" value="${oldDomain}">
          </div>
          <div class="edit-form-group">
            <label>Daily Limit (minutes)</label>
            <input type="number" id="editLimit" class="edit-form-input" value="${oldLimit}" min="0">
          </div>
        `;
    }
    
    if (titleEl) titleEl.textContent = 'Edit Rule';
    if (descEl) descEl.textContent = 'Update the domain and daily limit.';

    overlay.classList.remove('hidden');
    const editDomainInput = document.getElementById('editDomain');
    if (editDomainInput) editDomainInput.focus();

    const { newBtnSave, newBtnCancel } = resetModalListeners(btnSave, btnCancel);

    if (newBtnSave) {
        newBtnSave.addEventListener('click', () => {
          const editDomain = document.getElementById('editDomain');
          const editLimit = document.getElementById('editLimit');
          const newDomain = editDomain ? editDomain.value.trim() : '';
          const newLimitVal = editLimit ? parseInt(editLimit.value) : 0;
          
          if (!newDomain) {
            showToast('Domain is required', 'error');
            return;
          }

          overlay.classList.add('hidden');
          resolve({ domain: newDomain, limit: isNaN(newLimitVal) ? 0 : newLimitVal });
        });
    }

    if (newBtnCancel) {
        newBtnCancel.addEventListener('click', () => {
          overlay.classList.add('hidden');
          resolve(null);
        });
    }
  });
}

function renderRules(settings) {
  const container = document.getElementById('rulesList');
  if (!container) return;
  
  // Capture expanded state
  const expandedCategories = new Set();
  container.querySelectorAll('.rule-group').forEach(group => {
    if (!group.classList.contains('collapsed')) {
      expandedCategories.add(group.getAttribute('data-category'));
    }
  });

  container.innerHTML = '';
  
  const domains = [...new Set([...Object.keys(settings.categories || {}), ...Object.keys(settings.limits || {})])];

  if (domains.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-list-check"></i>
        <p class="i18n">${chrome.i18n.getMessage('emptyRules')}</p>
      </div>
    `;
    return;
  }

  const groupedRules = {};
  domains.forEach(domain => {
    const cat = settings.categories[domain] || 'Uncategorized';
    if (!groupedRules[cat]) groupedRules[cat] = [];
    groupedRules[cat].push(domain);
  });

  const sortedCategories = Object.keys(groupedRules).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  sortedCategories.forEach(cat => {
    const groupEl = document.createElement('div');
    
    // Restore expanded state
    if (expandedCategories.has(cat)) {
        groupEl.className = 'rule-group';
    } else {
        groupEl.className = 'rule-group collapsed';
    }
    groupEl.setAttribute('data-category', cat);

    const groupLimit = settings.categoryLimits && settings.categoryLimits[cat] ? settings.categoryLimits[cat] : 0;
    const groupLimitText = groupLimit > 0 ? `${groupLimit}m` : 'No Limit';
    
    const isForWork = settings.forWorkCategories && settings.forWorkCategories.includes(cat);

    const header = document.createElement('div');
    header.className = 'rule-group-header';
    header.innerHTML = `
      <div class="group-title">
        <i class="fa-solid fa-chevron-down toggle-icon"></i>
        <span><i class="fa-solid fa-folder"></i> ${cat}</span>
        <span class="badge">${groupedRules[cat].length}</span>
      </div>
      <div class="group-actions">
        <div class="work-toggle-container" title="Mark as Work (No Focus Warnings)">
           <label class="switch-small">
             <input type="checkbox" class="work-switch" ${isForWork ? 'checked' : ''}>
             <span class="slider-small round"></span>
           </label>
           <span>${chrome.i18n.getMessage('labelForWork') || 'For Work'}</span>
        </div>
        <div class="rule-group-limit" title="Set group limit (lower priority)">
          <i class="fa-solid fa-layer-group"></i> ${groupLimitText}
        </div>
      </div>
    `;
    
    header.addEventListener('click', (e) => {
      if (e.target.closest('.group-actions')) return;
      groupEl.classList.toggle('collapsed');
    });

    const limitBtn = header.querySelector('.rule-group-limit');
    if (limitBtn) {
        limitBtn.addEventListener('click', async () => {
          const newVal = await openModal(
            `Limit for '${cat}'`, 
            'Set daily limit for entire group (in minutes). Enter 0 to disable.',
            groupLimit
          );
          
          if (newVal !== null) {
            const parsed = parseInt(newVal);
            if (!isNaN(parsed)) {
              if (!settings.categoryLimits) settings.categoryLimits = {};
              settings.categoryLimits[cat] = parsed;
              await saveSettings(settings);
              renderRules(settings);
              showToast(`Group limit set to ${parsed}m`, 'success');
            }
          }
        });
    }
    
    const workSwitch = header.querySelector('.work-switch');
    if (workSwitch) {
        workSwitch.addEventListener('change', async (e) => {
          const checked = e.target.checked;
          if (!settings.forWorkCategories) settings.forWorkCategories = [];
          
          if (checked) {
            if (!settings.forWorkCategories.includes(cat)) {
              settings.forWorkCategories.push(cat);
            }
          } else {
            settings.forWorkCategories = settings.forWorkCategories.filter(c => c !== cat);
          }
          await saveSettings(settings);
          showToast(`${cat} is now ${checked ? 'Work' : 'Non-Work'}`, 'success');
        });
    }

    groupEl.appendChild(header);

    const listEl = document.createElement('div');
    listEl.className = 'rule-group-list';

    // Drag Drop Group Handlers
    groupEl.addEventListener('dragover', (e) => { e.preventDefault(); groupEl.classList.add('drag-over'); });
    groupEl.addEventListener('dragleave', () => { groupEl.classList.remove('drag-over'); });
    groupEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      groupEl.classList.remove('drag-over');
      const domain = e.dataTransfer.getData('text/plain');
      const targetCategory = groupEl.getAttribute('data-category');
      
      if (domain && settings.categories[domain] !== targetCategory) {
        settings.categories[domain] = targetCategory;
        await saveSettings(settings);
        // Update combobox list if category list changes
        updateCategoryCombobox(settings); 
        renderRules(settings);
        showToast(`Moved ${domain} to ${targetCategory}`, 'success');
      }
    });

    groupedRules[cat].forEach(domain => {
      const limit = settings.limits[domain] || 0;
      
      const itemEl = document.createElement('div');
      itemEl.className = 'rule-item';
      itemEl.setAttribute('draggable', 'true'); 
      itemEl.setAttribute('data-domain', domain);
      
      itemEl.innerHTML = `
        <div class="rule-info">
          <strong>${domain}</strong>
          <div class="rule-details">
            ${limit > 0 ? `<span class="tag"><i class="fa-solid fa-clock"></i> ${limit}m (Priority)</span>` : '<span class="tag" style="opacity:0.5">Inherit</span>'}
          </div>
        </div>
        <div class="rule-actions">
          <i class="fa-solid fa-pen" title="Edit Rule" data-action="edit"></i>
          <i class="fa-solid fa-trash" title="Remove" data-action="remove"></i>
        </div>
      `;

      itemEl.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', domain);
        itemEl.classList.add('dragging');
      });
      itemEl.addEventListener('dragend', () => {
        itemEl.classList.remove('dragging');
      });

      // Actions
      const removeBtn = itemEl.querySelector('[data-action="remove"]');
      if (removeBtn) {
          removeBtn.addEventListener('click', async () => {
            const confirmed = await openConfirm(
              'Delete Rule', 
              `Are you sure you want to remove the rule for ${domain}?`
            );
            
            if(confirmed) {
              delete settings.categories[domain];
              delete settings.limits[domain];
              await saveSettings(settings);
              updateCategoryCombobox(settings); // Update dropdown
              renderRules(settings);
              showToast('Rule removed', 'success');
            }
          });
      }

      const editBtn = itemEl.querySelector('[data-action="edit"]');
      if (editBtn) {
          editBtn.addEventListener('click', async () => {
            const currentLimit = settings.limits[domain] || 0;
            
            const result = await openEditRuleModal(domain, currentLimit);
            
            if (result) {
              const { domain: newDomain, limit: newLimit } = result;
              
              if (newDomain !== domain) {
                settings.categories[newDomain] = settings.categories[domain];
                delete settings.categories[domain];
                if (settings.limits[domain]) delete settings.limits[domain];
              }
              
              settings.limits[newDomain] = newLimit;
              
              await saveSettings(settings);
              updateCategoryCombobox(settings);
              renderRules(settings);
              showToast(`Rule for ${newDomain} updated`, 'success');
            }
          });
      }

      listEl.appendChild(itemEl);
    });

    groupEl.appendChild(listEl);
    container.appendChild(groupEl);
  });
}

async function renderAnalytics(settings, range = 'week') {
  // FIXED: Define palette at top scope so it's accessible everywhere in function
  const palette = ['#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#BF5AF2', '#64D2FF', '#FFD60A', '#5E5CE6'];

  const descEl = document.querySelector('#analytics .section-desc');
  let descKey = 'descAnalyticsWeek'; 
  if (range === 'day') descKey = 'descAnalyticsDay';
  if (range === 'month') descKey = 'descAnalyticsMonth';
  if (descEl) descEl.textContent = chrome.i18n.getMessage(descKey);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const today = new Date(year, now.getMonth(), now.getDate());

  const listItems = []; 
  const categoryStats = {}; 
  const domainMap = {}; 
  let totalRangeSeconds = 0;
  
  let daysCount = 1;
  if (range === 'week') daysCount = 7;
  if (range === 'month') daysCount = 30;

  for(let i = 0; i < daysCount; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    
    // Construct local YYYY-MM-DD
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    const dateKey = `${y}-${m}-${da}`;
    
    const data = await chrome.storage.local.get(dateKey);
    const dayData = data[dateKey];

    if (dayData) {
      Object.entries(dayData).forEach(([url, info]) => {
        const secs = Number(info.seconds) || 0;
        let hostname;
        try { hostname = new URL(url).hostname; } catch(e) { hostname = url; }
        if (!domainMap[hostname]) domainMap[hostname] = 0;
        domainMap[hostname] += secs;
        totalRangeSeconds += secs;
        const cat = settings.categories[hostname] || 'Uncategorized';
        if(!categoryStats[cat]) categoryStats[cat] = 0;
        categoryStats[cat] += secs;
      });
    }
  }

  const sortedDomains = Object.entries(domainMap).sort((a, b) => b[1] - a[1]); 

  sortedDomains.forEach(([domain, seconds]) => {
    if (seconds > 0) {
      listItems.push({
        labelMain: domain,
        labelSub: settings.categories[domain] || 'Uncategorized',
        value: seconds,
        formattedValue: formatTime(seconds),
        url: 'http://' + domain
      });
    }
  });

  const chartContainer = document.getElementById('weeklyChart');
  if (chartContainer) {
      chartContainer.innerHTML = '';
      chartContainer.removeAttribute('style'); 
      chartContainer.className = 'analytics-list'; 
      
      if (listItems.length === 0) {
         chartContainer.innerHTML = `
          <div class="empty-state" style="width:100%">
            <i class="fa-solid fa-chart-simple"></i>
            <p>${chrome.i18n.getMessage('emptyAnalytics')}</p>
          </div>`;
      } else {
        let maxVal = Math.max(...listItems.map(d => d.value));
        if (maxVal === 0) maxVal = 1; 

        listItems.forEach((item, index) => {
          const widthPct = (item.value / maxVal) * 100;
          const color = palette[index % palette.length];
          
          const itemEl = document.createElement('div');
          itemEl.className = 'analytics-item';
          itemEl.innerHTML = `
            <div class="analytics-label-group">
              <a class="analytics-label-main" href="${item.url}" target="_blank" title="Open ${item.labelMain}">
                ${item.labelMain} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px; margin-left: 4px; opacity: 0.5;"></i>
              </a>
              <div class="analytics-label-sub">${item.labelSub}</div>
            </div>
            <div class="analytics-bar-track">
              <div class="analytics-bar-fill" style="width: ${widthPct}%; background: ${color};"></div>
            </div>
            <div class="analytics-value">${item.formattedValue}</div>
          `;
          chartContainer.appendChild(itemEl);
        });
      }
  }

  const catContainer = document.getElementById('categoryBreakdown');
  if (catContainer) {
      catContainer.innerHTML = '';
      if (totalRangeSeconds === 0) {
        catContainer.innerHTML = `<div class="empty-state"><p>No data to categorize.</p></div>`;
      } else {
        const sortedCats = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
        sortedCats.forEach(([catName, seconds], index) => {
          const pct = ((seconds / totalRangeSeconds) * 100).toFixed(1);
          const timeStr = formatTime(seconds);
          const color = palette[index % palette.length];
          const row = document.createElement('div');
          row.className = 'category-row';
          row.innerHTML = `
            <div class="cat-name">${catName}</div>
            <div class="cat-bar-container"><div class="cat-bar-fill" style="width: ${pct}%; background: ${color};"></div></div>
            <div class="cat-time">${timeStr}</div>
          `;
          catContainer.appendChild(row);
        });
      }
  }
}

// --- RESTORED MISSING UTILITY FUNCTIONS ---

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function exportSettings() {
  chrome.storage.local.get(['settings', 'theme'], (data) => {
    const exportData = {
      settings: data.settings,
      theme: data.theme,
      timestamp: new Date().toISOString(),
      version: "1.0"
    };
    
    // --- Generate Filename with Current Date ---
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `tracker_settings_${yyyy}${mm}${dd}.json`;

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none'; 
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
  });
}

function exportCSV() {
  chrome.storage.local.get(null, (allData) => {
    let csvContent = "Date,Domain,URL,Category,Seconds\n";
    const settings = allData.settings || { categories: {} };
    Object.keys(allData).forEach(key => {
      if (key === 'settings' || key === 'focusMode' || key === 'theme') return;
      const daily = allData[key];
      if (daily) {
        Object.entries(daily).forEach(([url, info]) => {
          let hostname;
          try { hostname = new URL(url).hostname; } catch(e) { hostname = url; }
          const cat = settings.categories[hostname] || 'Uncategorized';
          const cleanUrl = `"${url.replace(/"/g, '""')}"`; 
          csvContent += `${key},${hostname},${cleanUrl},${cat},${info.seconds}\n`;
        });
      }
    });
    
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const filename = `tracker_export_${yyyy}${mm}${dd}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
  });
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const text = e.target.result;
      const lines = text.split(/\r?\n/);
      
      if (lines.length < 2) {
         throw new Error("Empty CSV");
      }

      const updates = {}; // Key: Date, Value: { url: { seconds, title? } }
      let settingsUpdated = false;
      const settings = await loadSettings();

      const parseLine = (line) => {
          const result = [];
          let current = '';
          let inQuote = false;
          for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                  if (inQuote && line[i+1] === '"') {
                      current += '"';
                      i++;
                  } else {
                      inQuote = !inQuote;
                  }
              } else if (char === ',' && !inQuote) {
                  result.push(current);
                  current = '';
              } else {
                  current += char;
              }
          }
          result.push(current);
          return result;
      };

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = parseLine(line);
        if (cols.length < 5) continue;

        const dateKey = cols[0].trim();
        const domain = cols[1].trim();
        const url = cols[2].trim(); 
        const category = cols[3].trim();
        const seconds = parseInt(cols[4].trim());

        if (!dateKey.match(/^\d{4}-\d{2}-\d{2}$/) || isNaN(seconds)) continue;

        if (!updates[dateKey]) updates[dateKey] = {};
        
        if (!updates[dateKey][url]) {
            updates[dateKey][url] = { seconds: seconds, title: domain }; 
        } else {
            updates[dateKey][url].seconds = Math.max(updates[dateKey][url].seconds, seconds);
        }

        if (domain && category && category !== 'Uncategorized') {
           if (!settings.categories[domain] || settings.categories[domain] === 'Uncategorized') {
               settings.categories[domain] = category;
               settingsUpdated = true;
           }
        }
      }

      for (const [dateKey, newUrlData] of Object.entries(updates)) {
         const existingWrap = await chrome.storage.local.get(dateKey);
         let dailyData = existingWrap[dateKey] || {};

         for (const [url, info] of Object.entries(newUrlData)) {
             if (!dailyData[url]) {
                 dailyData[url] = { seconds: info.seconds, title: info.title, lastVisit: Date.now() };
             } else {
                 dailyData[url].seconds = Math.max(dailyData[url].seconds, info.seconds);
             }
         }
         await chrome.storage.local.set({ [dateKey]: dailyData });
      }

      if (settingsUpdated) {
          await saveSettings(settings);
          updateCategoryCombobox(settings);
          renderRules(settings);
      }
      
      showToast(chrome.i18n.getMessage('csvImportSuccess'), 'success');
      
      const activeTimeBtn = document.querySelector('.time-btn.active');
      const currentRange = activeTimeBtn ? activeTimeBtn.getAttribute('data-range') : 'week';
      await renderAnalytics(settings, currentRange);

    } catch (err) {
      console.error(err);
      showToast(chrome.i18n.getMessage('csvImportError'), 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.settings) throw new Error("Invalid file");

      await chrome.storage.local.set({ settings: data.settings });
      if (data.theme) {
        await chrome.storage.local.set({ theme: data.theme });
        applyTheme(data.theme);
        initCustomSelect(data.theme); 
      }

      showToast(chrome.i18n.getMessage('settingsImportSuccess'), 'success');
      
      const settings = await loadSettings();
      renderRules(settings);
      updateCategoryCombobox(settings); 
      const inputBlacklist = document.getElementById('inputBlacklist');
      if (inputBlacklist) {
          inputBlacklist.value = settings.blacklist.join(', ');
      }

    } catch (err) {
      showToast(chrome.i18n.getMessage('settingsImportError'), 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; display: flex; flex-direction: column; gap: 10px; z-index: 10000; pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  let bg = '#333';
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === 'success') { bg = '#34C759'; icon = '<i class="fa-solid fa-check-circle"></i>'; } 
  else if (type === 'error') { bg = '#FF3B30'; icon = '<i class="fa-solid fa-circle-exclamation"></i>'; }
  toast.innerHTML = `${icon} <span style="margin-left:8px">${message}</span>`;
  toast.style.cssText = `
    background: ${bg}; color: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-size: 14px; font-weight: 600; opacity: 0; transform: translateY(20px); transition: all 0.3s; pointer-events: auto; display: flex; align-items: center; min-width: 200px;
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(20px)'; setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300); }, 3000);
}