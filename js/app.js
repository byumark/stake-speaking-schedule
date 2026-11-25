import {
  MONTHS,
  VALID_TABS,
  state,
  getCurrentMonthName,
  isCurrentMonth,
  loadCachedSheetData,
  loadSavedState,
  saveState
} from './state.js';
import { syncGoogleSheetData } from './sheets.js';
import { renderCards } from './render.js';
import { copyScheduleToClipboard, shareCurrentView } from './export.js';

let toastTimeoutId = null;

// -------------------------------------------------------------
// Status Badge, Toast & Modal UI
// -------------------------------------------------------------
function setStatusBadge(variant, text) {
  const badge = document.getElementById('statusBadge');
  const badgeText = document.getElementById('statusText');
  const badgeDot = document.getElementById('statusDot');
  if (!badge || !badgeText || !badgeDot) return;

  const base = 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition-all cursor-pointer active:scale-95';
  if (variant === 'loading') {
    badge.className = `${base} bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border-indigo-200/80`;
    badgeDot.className = 'w-2 h-2 rounded-full bg-indigo-500 animate-pulse';
  } else if (variant === 'live') {
    badge.className = `${base} bg-emerald-50 hover:bg-emerald-100/80 text-emerald-700 border-emerald-200/80`;
    badgeDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
  } else if (variant === 'warn') {
    badge.className = `${base} bg-amber-50 hover:bg-amber-100/80 text-amber-800 border-amber-200/80`;
    badgeDot.className = 'w-2 h-2 rounded-full bg-amber-500';
  } else {
    badge.className = `${base} bg-rose-50 hover:bg-rose-100/80 text-rose-700 border-rose-200/80`;
    badgeDot.className = 'w-2 h-2 rounded-full bg-rose-500';
  }
  badgeText.textContent = text;
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toastText');
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.remove('-translate-y-24', 'sm:translate-y-24', 'opacity-0');
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    toast.classList.add('-translate-y-24', 'sm:translate-y-24', 'opacity-0');
    toastTimeoutId = null;
  }, 2500);
}

function openGuidelinesModal() {
  const mingoTimeEl = document.getElementById('mingoTimeText');
  if (mingoTimeEl && state.wards.length > 0) {
    const mingo = state.wards.find(w => w.name.toLowerCase().includes('mingo'));
    if (mingo && mingo.time) {
      mingoTimeEl.textContent = mingo.time;
    }
  }
  const modal = document.getElementById('guidelinesModal');
  if (modal) modal.classList.remove('hidden');
}

function closeGuidelinesModal() {
  const modal = document.getElementById('guidelinesModal');
  if (modal) modal.classList.add('hidden');
}

// -------------------------------------------------------------
// Tabs, Dropdowns & Navigation
// -------------------------------------------------------------
function applyTabChrome(tabKey) {
  VALID_TABS.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (!btn) return;
    if (t === tabKey) {
      btn.className = 'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm font-semibold transition-all duration-150 bg-indigo-50 text-indigo-700 sm:bg-white sm:text-slate-900 sm:shadow-sm';
    } else {
      btn.className = 'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm font-medium transition-all duration-150 text-slate-500 hover:text-slate-900 sm:text-slate-600';
    }
  });

  const label = document.getElementById('dropdownLabel');
  const togglesGroup = document.getElementById('togglesGroup');
  const offToggle = document.getElementById('offToggleContainer');
  const pastToggle = document.getElementById('pastToggleContainer');

  if (tabKey === 'highCouncil') {
    if (label) label.textContent = 'Select High Councilor';
    if (togglesGroup) togglesGroup.classList.remove('hidden');
    if (offToggle) offToggle.classList.remove('hidden');
    if (pastToggle) pastToggle.classList.remove('hidden');
  } else if (tabKey === 'companion') {
    if (label) label.textContent = 'Select Companion Role / Leader';
    if (togglesGroup) togglesGroup.classList.remove('hidden');
    if (offToggle) offToggle.classList.remove('hidden');
    if (pastToggle) pastToggle.classList.remove('hidden');
  } else if (tabKey === 'ward') {
    if (label) label.textContent = 'Select Ward / Branch';
    if (togglesGroup) togglesGroup.classList.remove('hidden');
    if (offToggle) offToggle.classList.add('hidden');
    if (pastToggle) pastToggle.classList.remove('hidden');
  } else if (tabKey === 'month') {
    if (label) label.textContent = 'Select Month';
    if (togglesGroup) togglesGroup.classList.add('hidden');
    if (offToggle) offToggle.classList.add('hidden');
    if (pastToggle) pastToggle.classList.add('hidden');
  }
}

function populateDropdown() {
  const select = document.getElementById('itemSelect');
  if (!select) return;

  const preferredVal = state.savedSelections[state.currentTab] || '';
  select.innerHTML = '';

  if (state.currentTab === 'highCouncil') {
    const sortedHC = [...state.highCouncil].sort((a, b) => a.name.localeCompare(b.name));
    sortedHC.forEach(hc => {
      const opt = document.createElement('option');
      opt.value = hc.name;
      opt.textContent = hc.name;
      select.appendChild(opt);
    });
  } else if (state.currentTab === 'companion') {
    const orgGroup = document.createElement('optgroup');
    orgGroup.label = '★ View Whole Organization (For Switching)';

    const orgs = [
      { key: 'ORG_RS', label: 'All Relief Society' },
      { key: 'ORG_YW', label: 'All Young Women' },
      { key: 'ORG_PRIMARY', label: 'All Primary' },
      { key: 'ORG_YM', label: 'All Young Men' },
      { key: 'ORG_SS', label: 'All Sunday School' },
      { key: 'ORG_CLERKS', label: 'All Stake Clerks & Sec' }
    ];

    orgs.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.key;
      opt.textContent = o.label;
      orgGroup.appendChild(opt);
    });
    select.appendChild(orgGroup);

    const indGroup = document.createElement('optgroup');
    indGroup.label = 'Individual Speakers';

    const orderedRoles = [
      'RS Pres', 'RS 1st', 'RS 2nd', 'RS Sec',
      'YW Pres', 'YW 1st', 'YW 2nd', 'YW Sec',
      'Primary Pres', 'Primary 1st', 'Primary 2nd', 'Primary Sec',
      'YM 1st', 'YM 2nd', 'YM Sec',
      'SS 1st', 'SS 2nd',
      'Stake Exec Sec', 'Stake Clerk', 'Stake Asst Clerk'
    ];

    const validRoles = Object.keys(state.companionRoles);

    orderedRoles.forEach(role => {
      if (validRoles.includes(role)) {
        const name = state.companionRoles[role];
        const opt = document.createElement('option');
        opt.value = role;
        opt.textContent = name ? `${role} (${name})` : role;
        indGroup.appendChild(opt);
      }
    });

    validRoles.forEach(role => {
      if (!orderedRoles.includes(role)) {
        const name = state.companionRoles[role];
        const opt = document.createElement('option');
        opt.value = role;
        opt.textContent = name ? `${role} (${name})` : role;
        indGroup.appendChild(opt);
      }
    });

    select.appendChild(indGroup);
  } else if (state.currentTab === 'ward') {
    state.wards.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.name;
      opt.textContent = `${w.name} (${w.building})`;
      select.appendChild(opt);
    });
  } else if (state.currentTab === 'month') {
    MONTHS.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = isCurrentMonth(m) ? `${m} (This Month)` : m;
      select.appendChild(opt);
    });
  }

  const validValues = Array.from(select.options).map(o => o.value);
  const matchedPreferred = preferredVal
    ? validValues.find(v => v.toLowerCase() === preferredVal.toLowerCase())
    : '';

  if (matchedPreferred) {
    select.value = matchedPreferred;
    state.currentSelection = matchedPreferred;
  } else if (state.currentTab === 'month' && validValues.includes(getCurrentMonthName())) {
    const curMonth = getCurrentMonthName();
    select.value = curMonth;
    state.currentSelection = curMonth;
  } else if (select.options.length > 0) {
    select.value = select.options[0].value;
    state.currentSelection = select.options[0].value;
  }

  if (state.currentSelection) {
    state.savedSelections[state.currentTab] = state.currentSelection;
  }
}

function switchTab(tabKey, { fromUser = true } = {}) {
  if (!VALID_TABS.includes(tabKey)) return;
  state.currentTab = tabKey;
  applyTabChrome(tabKey);
  populateDropdown();
  renderCards();
  if (state.isDataLoaded) saveState();

  if (fromUser && window.innerWidth < 640 && window.scrollY > 80) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function navigateToEntity(tabKey, targetValue) {
  if (!VALID_TABS.includes(tabKey) || !targetValue) return;
  state.savedSelections[tabKey] = targetValue;
  switchTab(tabKey, { fromUser: true });
}

function refreshData({ manual = false } = {}) {
  return syncGoogleSheetData({
    manual,
    setStatusBadge,
    showToast,
    onDataReady: ({ errorOnly = false } = {}) => {
      if (!errorOnly) {
        applyTabChrome(state.currentTab);
        populateDropdown();
        saveState();
      }
      renderCards();
    }
  });
}

// -------------------------------------------------------------
// Application Initialization & Event Wiring
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  loadSavedState();

  const pastToggle = document.getElementById('showPastMonthsToggle');
  const offToggle = document.getElementById('showOffMonthsToggle');
  if (pastToggle) {
    pastToggle.checked = state.showPastMonths;
    pastToggle.addEventListener('change', (e) => {
      state.showPastMonths = e.target.checked;
      renderCards();
      saveState();
    });
  }
  if (offToggle) {
    offToggle.checked = state.showOffMonths;
    offToggle.addEventListener('change', (e) => {
      state.showOffMonths = e.target.checked;
      renderCards();
      saveState();
    });
  }

  const select = document.getElementById('itemSelect');
  if (select) {
    select.addEventListener('change', (e) => {
      state.currentSelection = e.target.value;
      state.savedSelections[state.currentTab] = e.target.value;
      renderCards();
      saveState();
    });
  }

  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const statusBadge = document.getElementById('statusBadge');
  if (statusBadge) statusBadge.addEventListener('click', () => refreshData({ manual: true }));

  const guidelinesBtn = document.getElementById('guidelinesBtn');
  if (guidelinesBtn) guidelinesBtn.addEventListener('click', openGuidelinesModal);

  const guidelinesModal = document.getElementById('guidelinesModal');
  if (guidelinesModal) {
    guidelinesModal.addEventListener('click', (e) => {
      if (e.target === guidelinesModal || e.target.closest('[data-close-modal]')) {
        closeGuidelinesModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && guidelinesModal && !guidelinesModal.classList.contains('hidden')) {
      closeGuidelinesModal();
    }
  });

  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) shareBtn.addEventListener('click', () => shareCurrentView(showToast));

  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) copyBtn.addEventListener('click', () => copyScheduleToClipboard(showToast));

  const feed = document.getElementById('scheduleFeed');
  if (feed) {
    feed.addEventListener('click', (e) => {
      const retryBtn = e.target.closest('[data-action="retry-sync"]');
      if (retryBtn) {
        refreshData({ manual: true });
        return;
      }
      const navTarget = e.target.closest('[data-nav-tab][data-nav-value]');
      if (navTarget) {
        navigateToEntity(navTarget.dataset.navTab, navTarget.dataset.navValue);
      }
    });
  }

  applyTabChrome(state.currentTab);

  // Hydrate immediately from local cache if available, then refresh in background
  if (loadCachedSheetData()) {
    state.isDataLoaded = true;
    populateDropdown();
    renderCards();
  } else {
    renderCards();
  }

  refreshData();
});
