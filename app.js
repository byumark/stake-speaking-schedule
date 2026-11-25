// -------------------------------------------------------------
// Constants
// -------------------------------------------------------------
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ORG_DEFINITIONS = {
  'ORG_RS': { name: 'Relief Society', roles: ['RS Pres', 'RS 1st', 'RS 2nd', 'RS Sec'] },
  'ORG_YW': { name: 'Young Women', roles: ['YW Pres', 'YW 1st', 'YW 2nd', 'YW Sec'] },
  'ORG_PRIMARY': { name: 'Primary', roles: ['Primary Pres', 'Primary 1st', 'Primary 2nd', 'Primary Sec'] },
  'ORG_YM': { name: 'Young Men', roles: ['YM 1st', 'YM 2nd', 'YM Sec'] },
  'ORG_SS': { name: 'Sunday School', roles: ['SS 1st', 'SS 2nd'] },
  'ORG_CLERKS': { name: 'Stake Clerks & Sec', roles: ['Stake Exec Sec', 'Stake Clerk', 'Stake Asst Clerk'] }
};

// -------------------------------------------------------------
// Pure Dynamic Stores (Zero Hardcoded Fallback Data)
// -------------------------------------------------------------
let HIGH_COUNCIL = [];
let WARDS = [];
let COMPANION_ROLES = {};
let THEMES = {};
let HC_SCHEDULE_GRID = {};
let COMP_SCHEDULE_GRID = {};
let OVERRIDES = [];
let isDataLoaded = false;

// -------------------------------------------------------------
// App State, Persistence & URL Sync
// -------------------------------------------------------------
const STORAGE_KEY = 'stakeScheduleState_v1';
const DATA_CACHE_KEY = 'stakeScheduleDataCache_v1';
const VALID_TABS = ['highCouncil', 'companion', 'ward', 'month'];

let currentTab = 'highCouncil';
let currentSelection = '';
let savedSelections = { highCouncil: '', companion: '', ward: '', month: '' };
let showPastMonths = false;
let showOffMonths = false;
let isSyncing = false;
let lastSyncError = false;
let toastTimeoutId = null;

function hasAnyScheduleData() {
  return HIGH_COUNCIL.length > 0 || WARDS.length > 0 || Object.keys(COMPANION_ROLES).length > 0;
}

function loadCachedSheetData() {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached !== 'object') return false;
    if (Array.isArray(cached.HIGH_COUNCIL)) HIGH_COUNCIL = cached.HIGH_COUNCIL;
    if (Array.isArray(cached.WARDS)) WARDS = cached.WARDS;
    if (cached.COMPANION_ROLES && typeof cached.COMPANION_ROLES === 'object') COMPANION_ROLES = cached.COMPANION_ROLES;
    if (cached.THEMES && typeof cached.THEMES === 'object') THEMES = cached.THEMES;
    if (cached.HC_SCHEDULE_GRID && typeof cached.HC_SCHEDULE_GRID === 'object') HC_SCHEDULE_GRID = cached.HC_SCHEDULE_GRID;
    if (cached.COMP_SCHEDULE_GRID && typeof cached.COMP_SCHEDULE_GRID === 'object') COMP_SCHEDULE_GRID = cached.COMP_SCHEDULE_GRID;
    if (Array.isArray(cached.OVERRIDES)) OVERRIDES = cached.OVERRIDES;
    return hasAnyScheduleData();
  } catch (e) {
    return false;
  }
}

function saveCachedSheetData() {
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      HIGH_COUNCIL,
      WARDS,
      COMPANION_ROLES,
      THEMES,
      HC_SCHEDULE_GRID,
      COMP_SCHEDULE_GRID,
      OVERRIDES
    }));
  } catch (e) {
    // Ignore storage quota/private mode errors
  }
}

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

function getWardInfo(wardName) {
  const found = WARDS.find(w => w.name.trim().toLowerCase() === (wardName || '').trim().toLowerCase());
  return found || { name: wardName || 'Unknown Ward', building: '', address: '', time: '10:00 AM' };
}

function getCurrentMonthName() {
  return MONTHS[new Date().getMonth()] || MONTHS[0];
}

function isMonthPast(monthName) {
  const idx = MONTHS.indexOf(monthName);
  if (idx === -1) return false;
  return idx < new Date().getMonth();
}

function isCurrentMonth(monthName) {
  const idx = MONTHS.indexOf(monthName);
  return idx !== -1 && idx === new Date().getMonth();
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && VALID_TABS.includes(parsed.tab)) {
        currentTab = parsed.tab;
      }
      if (parsed && parsed.selections && typeof parsed.selections === 'object') {
        VALID_TABS.forEach(t => {
          if (typeof parsed.selections[t] === 'string') {
            savedSelections[t] = parsed.selections[t];
          }
        });
      }
      if (typeof parsed.showPastMonths === 'boolean') showPastMonths = parsed.showPastMonths;
      if (typeof parsed.showOffMonths === 'boolean') showOffMonths = parsed.showOffMonths;
    }
  } catch (e) {
    // Ignore storage errors in private browsing or restricted environments
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    const urlSelect = params.get('select');
    if (urlTab && VALID_TABS.includes(urlTab)) {
      currentTab = urlTab;
    }
    if (urlSelect) {
      savedSelections[currentTab] = urlSelect;
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  currentSelection = savedSelections[currentTab] || '';
}

function syncUrlParams() {
  if (!isDataLoaded || !currentSelection) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', currentTab);
    url.searchParams.set('select', currentSelection);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (e) {
    // Ignore history API errors (e.g., file:// origin)
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tab: currentTab,
      selections: savedSelections,
      showPastMonths,
      showOffMonths
    }));
  } catch (e) {
    // Ignore storage quota/private mode errors
  }
  syncUrlParams();
}

// -------------------------------------------------------------
// Schedule Resolution with Overrides Support
// -------------------------------------------------------------
function getEffectiveAssignment(wardName, month) {
  const origHC = (HC_SCHEDULE_GRID[wardName] && HC_SCHEDULE_GRID[wardName][month]) || '';
  const origCompRole = (COMP_SCHEDULE_GRID[wardName] && COMP_SCHEDULE_GRID[wardName][month]) || '';
  const origCompName = origCompRole ? (COMPANION_ROLES[origCompRole] || origCompRole) : '';

  let hc = origHC;
  let hcOverridden = false;
  let hcNote = '';

  let compRole = origCompRole;
  let compName = origCompName;
  let compOverridden = false;
  let compNote = '';

  let generalNotes = [];

  OVERRIDES.forEach(ov => {
    if (ov.month.toLowerCase() === month.toLowerCase() && ov.ward.toLowerCase() === wardName.toLowerCase()) {
      const type = ov.roleType.toLowerCase();
      if (type.includes('high council') || type === 'hc') {
        if (ov.replacement) {
          hc = ov.replacement;
          hcOverridden = (hc.toLowerCase() !== origHC.toLowerCase());
        }
        if (ov.note) hcNote = ov.note;
      } else if (type.includes('companion') || type === 'comp') {
        if (ov.replacement) {
          compRole = ov.replacement;
          compName = COMPANION_ROLES[ov.replacement] || ov.replacement;
          compOverridden = (compRole.toLowerCase() !== origCompRole.toLowerCase());
        }
        if (ov.note) compNote = ov.note;
      } else {
        const msg = [ov.replacement, ov.note].filter(Boolean).join(' — ');
        if (msg) generalNotes.push(msg);
      }
    }
  });

  return {
    origHC,
    hc,
    hcOverridden,
    hcNote,
    origCompRole,
    origCompName,
    compRole,
    compName,
    compOverridden,
    compNote,
    generalNotes
  };
}

function renderOverrideBanner(notes = []) {
  const cleanNotes = notes.filter(Boolean);
  if (cleanNotes.length === 0) return '';
  return `
    <div class="mt-2.5 flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs text-amber-900">
      <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
      <div class="space-y-0.5">
        ${cleanNotes.map(n => `<div class="font-medium">${escapeHTML(n)}</div>`).join('')}
      </div>
    </div>`;
}

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
  const offToggle = document.getElementById('offToggleContainer');
  const pastToggle = document.getElementById('pastToggleContainer');

  if (tabKey === 'highCouncil') {
    if (label) label.textContent = 'Select High Councilor';
    if (offToggle) offToggle.classList.remove('hidden');
    if (pastToggle) pastToggle.classList.remove('hidden');
  } else if (tabKey === 'companion') {
    if (label) label.textContent = 'Select Companion Role / Leader';
    if (offToggle) offToggle.classList.remove('hidden');
    if (pastToggle) pastToggle.classList.remove('hidden');
  } else if (tabKey === 'ward') {
    if (label) label.textContent = 'Select Ward / Branch';
    if (offToggle) offToggle.classList.add('hidden');
    if (pastToggle) pastToggle.classList.remove('hidden');
  } else if (tabKey === 'month') {
    if (label) label.textContent = 'Select Month';
    if (offToggle) offToggle.classList.add('hidden');
    if (pastToggle) pastToggle.classList.add('hidden');
  }
}

function switchTab(tabKey, { fromUser = true } = {}) {
  if (!VALID_TABS.includes(tabKey)) return;
  currentTab = tabKey;
  applyTabChrome(tabKey);
  populateDropdown();
  renderCards();
  if (isDataLoaded) saveState();

  if (fromUser && window.innerWidth < 640 && window.scrollY > 80) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function populateDropdown() {
  const select = document.getElementById('itemSelect');
  if (!select) return;

  const preferredVal = savedSelections[currentTab] || '';
  select.innerHTML = '';

  if (currentTab === 'highCouncil') {
    // Strictly ALPHABETICAL by member name, NO numbers in front
    const sortedHC = [...HIGH_COUNCIL].sort((a, b) => a.name.localeCompare(b.name));
    sortedHC.forEach(hc => {
      const opt = document.createElement('option');
      opt.value = hc.name;
      opt.textContent = hc.name;
      select.appendChild(opt);
    });
  } else if (currentTab === 'companion') {
    // 1. Whole Organization optgroup
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

    // 2. Individual roles - sanitized own-property extraction
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

    const validRoles = Object.keys(COMPANION_ROLES);

    orderedRoles.forEach(role => {
      if (validRoles.includes(role)) {
        const name = COMPANION_ROLES[role];
        const opt = document.createElement('option');
        opt.value = role;
        opt.textContent = name ? `${role} (${name})` : role;
        indGroup.appendChild(opt);
      }
    });

    validRoles.forEach(role => {
      if (!orderedRoles.includes(role)) {
        const name = COMPANION_ROLES[role];
        const opt = document.createElement('option');
        opt.value = role;
        opt.textContent = name ? `${role} (${name})` : role;
        indGroup.appendChild(opt);
      }
    });

    select.appendChild(indGroup);

  } else if (currentTab === 'ward') {
    WARDS.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.name;
      opt.textContent = `${w.name} (${w.building})`;
      select.appendChild(opt);
    });
  } else if (currentTab === 'month') {
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
    currentSelection = matchedPreferred;
  } else if (currentTab === 'month' && validValues.includes(getCurrentMonthName())) {
    const curMonth = getCurrentMonthName();
    select.value = curMonth;
    currentSelection = curMonth;
  } else if (select.options.length > 0) {
    select.value = select.options[0].value;
    currentSelection = select.options[0].value;
  }

  if (currentSelection) {
    savedSelections[currentTab] = currentSelection;
  }
}

function onSelectionChange(val) {
  currentSelection = val;
  savedSelections[currentTab] = val;
  renderCards();
  saveState();
}

function toggleShowPastMonths(checked) {
  showPastMonths = checked;
  renderCards();
  saveState();
}

function toggleShowOffMonths(checked) {
  showOffMonths = checked;
  renderCards();
  saveState();
}

// -------------------------------------------------------------
// Talk Links & Theme Renderers
// -------------------------------------------------------------
function renderTalkLinks(talks, isDark = false) {
  if (!talks || talks.length === 0) {
    return `<p class="text-xs ${isDark ? 'text-sky-200/70' : 'text-slate-400'} italic">Conference talks to be announced.</p>`;
  }

  const titleColor = isDark ? 'text-sky-300 hover:text-white' : 'text-blue-600 hover:text-blue-800';
  const speakerColor = isDark ? 'text-slate-200' : 'text-slate-500';
  const iconColor = isDark ? 'text-sky-300' : 'text-blue-500';

  let html = '<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">';
  talks.forEach(talk => {
    if (talk.url) {
      html += `
        <a href="${talk.url}" target="_blank" rel="noopener noreferrer" 
           class="inline-flex items-baseline gap-1.5 group min-w-0 transition-colors">
          <svg class="w-3.5 h-3.5 ${iconColor} shrink-0 translate-y-0.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          <span class="truncate">
            <span class="font-semibold underline decoration-transparent group-hover:decoration-current ${titleColor}">${escapeHTML(talk.title)}</span>
            ${talk.speaker ? `<span class="${speakerColor}"> — ${escapeHTML(talk.speaker)}</span>` : ''}
          </span>
        </a>`;
    } else {
      html += `
        <div class="inline-flex items-baseline gap-1.5 min-w-0">
          <span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 translate-y-[-1px]"></span>
          <span class="truncate">
            <span class="font-medium text-slate-700">${escapeHTML(talk.title)}</span>
            ${talk.speaker ? `<span class="text-slate-500"> — ${escapeHTML(talk.speaker)}</span>` : ''}
          </span>
        </div>`;
    }
  });
  html += '</div>';
  return html;
}

function navigateToEntity(tabKey, targetValue) {
  if (!VALID_TABS.includes(tabKey) || !targetValue) return;
  savedSelections[tabKey] = targetValue;
  switchTab(tabKey, { fromUser: true });
}

function renderEntityLink(label, tabKey, targetValue, extraClasses = '') {
  if (!label) return '';
  if (!targetValue) return `<span class="${extraClasses}">${escapeHTML(label)}</span>`;
  return `<button type="button" data-nav-tab="${escapeHTML(tabKey)}" data-nav-value="${escapeHTML(targetValue)}" class="text-left hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2 transition-colors cursor-pointer ${extraClasses}">${escapeHTML(label)}</button>`;
}

function canNavigateToHighCouncil(name) {
  if (!name) return false;
  return HIGH_COUNCIL.some(hc => hc.name.toLowerCase() === name.toLowerCase());
}

function canNavigateToCompanionRole(role) {
  if (!role) return false;
  return Object.keys(COMPANION_ROLES).some(r => r.toLowerCase() === role.toLowerCase());
}

function canNavigateToWard(wardName) {
  if (!wardName) return false;
  return WARDS.some(w => w.name.toLowerCase() === wardName.toLowerCase());
}

function renderSummaryStrip(container, primaryText, secondaryText = '') {
  const strip = document.createElement('div');
  strip.className = 'flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500';
  strip.innerHTML = `
    <span class="font-semibold text-slate-600">${escapeHTML(primaryText)}</span>
    ${secondaryText ? `<span class="text-slate-400 font-medium">${escapeHTML(secondaryText)}</span>` : ''}
  `;
  container.appendChild(strip);
}

const MAP_PIN_SVG = '<svg class="w-3.5 h-3.5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';

function renderMapLink(address, labelText = '') {
  if (!address) return '';
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  return `<a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" title="Open in Google Maps" class="hover:text-indigo-600 underline decoration-slate-300 hover:decoration-indigo-500 underline-offset-2 transition-colors">${escapeHTML(labelText || address)}</a>`;
}

function renderLocationLine(wardInfo, { includeBuilding = false } = {}) {
  if (!wardInfo) return '';
  if (!includeBuilding && !wardInfo.address) return '';
  if (includeBuilding && !wardInfo.building && !wardInfo.address) return '';

  const parts = [];
  if (includeBuilding && wardInfo.building) {
    parts.push(`<span class="font-medium text-slate-600">${escapeHTML(wardInfo.building)}</span>`);
  }
  if (wardInfo.address) {
    parts.push(renderMapLink(wardInfo.address));
  }

  return `
    <div class="flex items-center gap-1.5 text-xs text-slate-500">
      ${MAP_PIN_SVG}
      <span class="min-w-0">${parts.join(' <span class="text-slate-300">•</span> ')}</span>
    </div>`;
}

function getMonthCardClass(isPast, isCurrent, isRelieved = false) {
  if (isPast) return 'rounded-2xl p-5 shadow-sm border transition-all opacity-65 bg-slate-50/70 border-dashed border-slate-300';
  if (isCurrent) return 'bg-white rounded-2xl p-5 shadow-sm border border-indigo-300 ring-1 ring-indigo-100 transition-all';
  if (isRelieved) return 'rounded-2xl p-5 shadow-sm border transition-all bg-slate-50/60 border-slate-200/80';
  return 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200/90 transition-all';
}

function renderCurrentBadge(isCurrent) {
  if (!isCurrent) return '';
  return '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-indigo-600 text-white shadow-sm">THIS MONTH</span>';
}

function renderThemeDrawer(month, { defaultOpen = false } = {}) {
  const themeData = THEMES[month] || { theme: '', talks: [] };
  const talks = themeData.talks || [];

  const talksSection = talks.length > 0
    ? `
      <details class="talks-drawer pt-0.5" ${defaultOpen ? 'open' : ''}>
        <summary class="cursor-pointer inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 select-none transition-colors">
          <svg class="talks-chevron w-3.5 h-3.5 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
          <span>Conference Talks (${talks.length})</span>
        </summary>
        <div class="pt-2.5">
          ${renderTalkLinks(talks, false)}
        </div>
      </details>`
    : `<p class="text-xs text-slate-400 italic">Conference talks to be announced.</p>`;

  return `
    <div class="pt-3.5 border-t border-slate-100 space-y-2">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
        <span class="font-bold uppercase tracking-wider text-slate-400 text-[10px]">STAKE THEME:</span>
        <span class="font-bold text-slate-900">${escapeHTML(themeData.theme || 'To be announced')}</span>
      </div>
      ${talksSection}
    </div>
  `;
}

// -------------------------------------------------------------
// Main View Dispatcher & Loading Skeleton
// -------------------------------------------------------------
function renderCards() {
  const container = document.getElementById('scheduleFeed');
  if (!container) return;

  if (!isDataLoaded) {
    container.innerHTML = `
      <div class="space-y-4">
        ${[1, 2, 3].map(() => `
          <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 animate-pulse space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="h-5 w-24 bg-slate-200 rounded-lg"></div>
                <div class="h-5 w-16 bg-purple-100 rounded-full"></div>
              </div>
              <div class="h-4 w-28 bg-slate-200 rounded-lg"></div>
            </div>
            <div class="h-4 w-48 bg-slate-100 rounded-lg"></div>
            <div class="pt-3 border-t border-slate-100 space-y-2">
              <div class="h-3.5 w-64 bg-slate-100 rounded-lg"></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div class="h-3.5 w-full bg-slate-100 rounded-lg"></div>
                <div class="h-3.5 w-full bg-slate-100 rounded-lg"></div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>`;
    return;
  }

  container.innerHTML = '';

  if (lastSyncError && !hasAnyScheduleData()) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-10 text-center border border-rose-200 text-slate-600 space-y-3 shadow-sm">
        <svg class="w-10 h-10 mx-auto text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="text-sm font-bold text-slate-800">Unable to load schedule from Google Sheets</p>
        <p class="text-xs text-slate-500 max-w-sm mx-auto">Check your internet connection and try again.</p>
        <button type="button" onclick="syncGoogleSheetData({ manual: true })" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-sm active:scale-95">
          Try Again
        </button>
      </div>`;
    return;
  }

  if (currentTab === 'highCouncil') {
    renderHighCouncilView(container);
  } else if (currentTab === 'companion') {
    if (currentSelection && currentSelection.startsWith('ORG_')) {
      renderCompanionOrgView(container);
    } else {
      renderCompanionIndividualView(container);
    }
  } else if (currentTab === 'ward') {
    renderWardView(container);
  } else if (currentTab === 'month') {
    renderMonthView(container);
  }
}

// High Council View (Includes Theme & Talks + Override Strike-Throughs)
function renderHighCouncilView(container) {
  const speakerName = currentSelection;
  let renderedCount = 0;
  let activeCount = 0;
  let nextAssignment = null;
  const fragment = document.createDocumentFragment();

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    const isCurrent = isCurrentMonth(month);
    if (isPast && !showPastMonths) return;

    // Find any ward where this HC is either the active speaker OR was the original speaker
    let matchedWard = null;
    let effective = null;
    let isRelieved = false;

    Object.keys(HC_SCHEDULE_GRID).forEach(wName => {
      const eff = getEffectiveAssignment(wName, month);
      if (eff.hc.toLowerCase() === speakerName.toLowerCase()) {
        matchedWard = wName;
        effective = eff;
        isRelieved = false;
      } else if (!matchedWard && eff.origHC.toLowerCase() === speakerName.toLowerCase()) {
        matchedWard = wName;
        effective = eff;
        isRelieved = true;
      }
    });

    const isOff = !matchedWard;
    if (isOff && !showOffMonths) return;
    renderedCount++;

    const wardInfo = matchedWard ? getWardInfo(matchedWard) : null;
    if (!isOff && !isRelieved) {
      activeCount++;
      if (!isPast && !nextAssignment) {
        nextAssignment = { month, wardName: wardInfo.name, time: wardInfo.time || '10:00 AM' };
      }
    }

    const card = document.createElement('div');
    card.className = getMonthCardClass(isPast, isCurrent, isRelieved);

    if (isOff) {
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center flex-wrap gap-2.5">
            <span class="text-base font-bold text-slate-900">${month}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">Off Month</span>
            ${renderCurrentBadge(isCurrent)}
          </div>
          ${isPast ? '<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">PAST</span>' : ''}
        </div>`;
    } else {
      const compNavRole = canNavigateToCompanionRole(effective.compRole) ? effective.compRole : '';
      const companionDisplay = effective.compOverridden
        ? `
          <div class="flex flex-col md:items-end">
            <span class="text-xs text-slate-400 line-through">${escapeHTML(effective.origCompName || effective.origCompRole || 'None')}</span>
            ${renderEntityLink(effective.compName || effective.compRole, 'companion', compNavRole, 'font-bold text-slate-900 text-sm')}
            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5">Companion Sub</span>
          </div>`
        : (effective.compRole ? `
          <div class="md:flex md:flex-col md:items-end">
            ${renderEntityLink(effective.compName || effective.compRole, 'companion', compNavRole, 'font-bold text-slate-900 text-sm')}
            <div class="text-xs text-slate-500 font-medium">${escapeHTML(effective.compRole)}</div>
          </div>
        ` : `
          <div class="text-xs text-slate-400 italic">No companion (Speaks individually)</div>
        `);

      const statusBadge = isRelieved
        ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Covered by ${escapeHTML(effective.hc)}</span>`
        : (effective.hcOverridden
          ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Sub / Swapped (Orig: <span class="line-through">${escapeHTML(effective.origHC || 'Unassigned')}</span>)</span>`
          : '');

      const notesList = [
        effective.hcNote ? `High Council Change: ${effective.hcNote}` : '',
        effective.compNote ? `Companion Change: ${effective.compNote}` : '',
        ...effective.generalNotes
      ];

      card.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3">
          <div class="space-y-1">
            <div class="flex items-center flex-wrap gap-2">
              <span class="text-base font-extrabold text-slate-900">${month}</span>
              ${renderCurrentBadge(isCurrent)}
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70 shadow-sm">
                ${wardInfo.time || '10:00 AM'}
              </span>
              ${statusBadge}
              ${isPast ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-500 border border-slate-200">PAST</span>' : ''}
            </div>
            <div class="flex items-center flex-wrap gap-x-2 text-sm">
              ${renderEntityLink(wardInfo.name, 'ward', canNavigateToWard(wardInfo.name) ? wardInfo.name : '', 'font-bold text-slate-900')}
              ${wardInfo.building ? `<span class="text-slate-400 text-xs font-medium">(${escapeHTML(wardInfo.building)})</span>` : ''}
            </div>
            ${renderLocationLine(wardInfo)}
            ${renderOverrideBanner(notesList)}
          </div>

          <div class="md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">SPEAKING WITH</div>
            ${companionDisplay}
          </div>
        </div>

        <!-- Stake Theme & Collapsible Talks Drawer -->
        ${renderThemeDrawer(month, { defaultOpen: isCurrent })}
      `;
    }

    fragment.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'No assignments found matching the current filters. Try enabling "Past Months" or "Off Months".');
    return;
  }

  const countLabel = `${activeCount} ${showPastMonths ? 'total' : 'upcoming'} assignment${activeCount === 1 ? '' : 's'}`;
  const nextLabel = nextAssignment ? `Next: ${nextAssignment.month} — ${nextAssignment.wardName} (${nextAssignment.time})` : '';
  renderSummaryStrip(container, countLabel, nextLabel);
  container.appendChild(fragment);
}

// Companion Individual View (Includes Theme & Collapsible Talks + Override Strike-Throughs)
function renderCompanionIndividualView(container) {
  const roleKey = currentSelection;
  const personName = COMPANION_ROLES[roleKey] || '';
  let renderedCount = 0;
  let activeCount = 0;
  let nextAssignment = null;
  const fragment = document.createDocumentFragment();

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    const isCurrent = isCurrentMonth(month);
    if (isPast && !showPastMonths) return;

    let matchedWard = null;
    let effective = null;
    let isRelieved = false;

    Object.keys(COMP_SCHEDULE_GRID).forEach(wName => {
      const eff = getEffectiveAssignment(wName, month);
      const matchesActive = eff.compRole.toLowerCase() === roleKey.toLowerCase() ||
                            (personName && eff.compRole.toLowerCase().includes(personName.toLowerCase()));
      const matchesOrig = eff.origCompRole.toLowerCase() === roleKey.toLowerCase();

      if (matchesActive) {
        matchedWard = wName;
        effective = eff;
        isRelieved = false;
      } else if (!matchedWard && matchesOrig) {
        matchedWard = wName;
        effective = eff;
        isRelieved = true;
      }
    });

    const isOff = !matchedWard;
    if (isOff && !showOffMonths) return;
    renderedCount++;

    const wardInfo = matchedWard ? getWardInfo(matchedWard) : null;
    if (!isOff && !isRelieved) {
      activeCount++;
      if (!isPast && !nextAssignment) {
        nextAssignment = { month, wardName: wardInfo.name, time: wardInfo.time || '10:00 AM' };
      }
    }

    const card = document.createElement('div');
    card.className = getMonthCardClass(isPast, isCurrent, isRelieved);

    if (isOff) {
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center flex-wrap gap-2.5">
            <span class="text-base font-bold text-slate-900">${month}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">Off Month</span>
            ${renderCurrentBadge(isCurrent)}
          </div>
          ${isPast ? '<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">PAST</span>' : ''}
        </div>`;
    } else {
      const hcNav = canNavigateToHighCouncil(effective.hc) ? effective.hc : '';
      const hcDisplay = effective.hcOverridden
        ? `
          <div class="flex flex-col md:items-end">
            <span class="text-xs text-slate-400 line-through">${escapeHTML(effective.origHC || 'Unassigned')}</span>
            ${renderEntityLink(effective.hc, 'highCouncil', hcNav, 'font-bold text-slate-900 text-sm')}
            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5">HC Sub</span>
          </div>`
        : (effective.hc ? `
          <div class="md:flex md:flex-col md:items-end">
            ${renderEntityLink(effective.hc, 'highCouncil', hcNav, 'font-bold text-slate-900 text-sm')}
            <div class="text-xs text-slate-500 font-medium">High Council</div>
          </div>
        ` : `
          <div class="text-xs text-slate-400 italic">Unassigned High Councilor</div>
        `);

      const statusBadge = isRelieved
        ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Covered by ${escapeHTML(effective.compName)}</span>`
        : (effective.compOverridden
          ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Sub / Swapped (Orig: <span class="line-through">${escapeHTML(effective.origCompName || effective.origCompRole)}</span>)</span>`
          : '');

      const notesList = [
        effective.compNote ? `Companion Change: ${effective.compNote}` : '',
        effective.hcNote ? `High Council Change: ${effective.hcNote}` : '',
        ...effective.generalNotes
      ];

      card.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3">
          <div class="space-y-1">
            <div class="flex items-center flex-wrap gap-2">
              <span class="text-base font-extrabold text-slate-900">${month}</span>
              ${renderCurrentBadge(isCurrent)}
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70 shadow-sm">
                ${wardInfo.time || '10:00 AM'}
              </span>
              ${statusBadge}
              ${isPast ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-500 border border-slate-200">PAST</span>' : ''}
            </div>
            <div class="flex items-center flex-wrap gap-x-2 text-sm">
              ${renderEntityLink(wardInfo.name, 'ward', canNavigateToWard(wardInfo.name) ? wardInfo.name : '', 'font-bold text-slate-900')}
              ${wardInfo.building ? `<span class="text-slate-400 text-xs font-medium">(${escapeHTML(wardInfo.building)})</span>` : ''}
            </div>
            ${renderLocationLine(wardInfo)}
            ${renderOverrideBanner(notesList)}
          </div>

          <div class="md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">SPEAKING WITH</div>
            ${hcDisplay}
          </div>
        </div>

        <!-- Stake Theme & Collapsible Talks Drawer -->
        ${renderThemeDrawer(month, { defaultOpen: isCurrent })}
      `;
    }

    fragment.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'No assignments found matching the current filters. Try enabling "Past Months" or "Off Months".');
    return;
  }

  const countLabel = `${activeCount} ${showPastMonths ? 'total' : 'upcoming'} assignment${activeCount === 1 ? '' : 's'}`;
  const nextLabel = nextAssignment ? `Next: ${nextAssignment.month} — ${nextAssignment.wardName} (${nextAssignment.time})` : '';
  renderSummaryStrip(container, countLabel, nextLabel);
  container.appendChild(fragment);
}

// Companion Organization View (Grid for Swapping + Theme & Collapsible Talks)
function renderCompanionOrgView(container) {
  const orgMeta = ORG_DEFINITIONS[currentSelection];
  if (!orgMeta) return;

  let renderedCount = 0;
  let totalSpeakers = 0;
  const fragment = document.createDocumentFragment();

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    const isCurrent = isCurrentMonth(month);
    if (isPast && !showPastMonths) return;

    const assignments = [];
    Object.keys(COMP_SCHEDULE_GRID).forEach(wName => {
      const eff = getEffectiveAssignment(wName, month);
      const isOrigInOrg = orgMeta.roles.includes(eff.origCompRole);
      const isNewInOrg = orgMeta.roles.includes(eff.compRole);

      if (isNewInOrg || isOrigInOrg) {
        const wardInfo = getWardInfo(wName);
        assignments.push({
          role: eff.compRole,
          name: eff.compName,
          origRole: eff.origCompRole,
          origName: eff.origCompName,
          isOverridden: eff.compOverridden,
          isRelievedFromOrg: isOrigInOrg && !isNewInOrg,
          note: eff.compNote,
          wardInfo: wardInfo,
          hcSpeaker: eff.hc
        });
      }
    });

    if (assignments.length === 0 && !showOffMonths) return;
    renderedCount++;
    totalSpeakers += assignments.length;

    const card = document.createElement('div');
    card.className = getMonthCardClass(isPast, isCurrent);

    let assignmentsHtml = '';
    if (assignments.length === 0) {
      assignmentsHtml = `
        <div class="py-2 text-xs text-slate-400 italic">No organization members scheduled this month.</div>`;
    } else {
      assignmentsHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2.5 pb-3">
          ${assignments.map(a => `
            <div class="bg-slate-50/80 rounded-xl p-3 border ${a.isOverridden ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200/80'} space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">${escapeHTML(a.role)}</span>
                <span class="text-xs font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">${escapeHTML(a.wardInfo.time || '10:00 AM')}</span>
              </div>
              ${a.isOverridden ? `
                <div class="text-xs text-slate-400 line-through">${escapeHTML(a.origName)} (${escapeHTML(a.origRole)})</div>
                <div class="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                  ${renderEntityLink(a.name, 'companion', canNavigateToCompanionRole(a.role) ? a.role : '', 'font-extrabold text-sm text-slate-900')}
                  <span class="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Swapped</span>
                </div>
              ` : `
                <div>${renderEntityLink(a.name, 'companion', canNavigateToCompanionRole(a.role) ? a.role : '', 'font-extrabold text-sm text-slate-900')}</div>
              `}
              <div class="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                ${MAP_PIN_SVG}
                <span class="min-w-0">
                  ${renderEntityLink(a.wardInfo.name, 'ward', canNavigateToWard(a.wardInfo.name) ? a.wardInfo.name : '', 'font-medium text-slate-700')}
                  ${a.wardInfo.building ? `<span class="text-slate-400 font-normal">(${escapeHTML(a.wardInfo.building)})</span>` : ''}
                </span>
              </div>
              ${a.wardInfo.address ? `<div class="text-[11px] text-slate-500 pl-5">${renderMapLink(a.wardInfo.address)}</div>` : ''}
              ${a.note ? `<div class="text-[11px] text-amber-800 font-medium">Note: ${escapeHTML(a.note)}</div>` : ''}
              <div class="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                High Councilor: ${a.hcSpeaker ? renderEntityLink(a.hcSpeaker, 'highCouncil', canNavigateToHighCouncil(a.hcSpeaker) ? a.hcSpeaker : '', 'font-bold text-slate-800') : '<strong class="text-slate-800">Unassigned</strong>'}
              </div>
            </div>
          `).join('')}
        </div>`;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <div class="flex items-center flex-wrap gap-2">
          <span class="text-base font-extrabold text-slate-900">${month}</span>
          ${renderCurrentBadge(isCurrent)}
          ${assignments.length > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">${assignments.length} Speaking</span>` : ''}
        </div>
        ${isPast ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-500 border border-slate-200">PAST</span>' : ''}
      </div>
      ${assignmentsHtml}
      ${assignments.length > 0 ? renderThemeDrawer(month, { defaultOpen: false }) : ''}
    `;

    fragment.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'No organization assignments in this range. Try enabling "Past Months".');
    return;
  }

  renderSummaryStrip(container, `${totalSpeakers} ${showPastMonths ? 'total' : 'upcoming'} speaking assignment${totalSpeakers === 1 ? '' : 's'} across ${orgMeta.name}`);
  container.appendChild(fragment);
}

// Ward View
function renderWardView(container) {
  const wardName = currentSelection;
  const wardInfo = getWardInfo(wardName);
  let renderedCount = 0;
  const fragment = document.createDocumentFragment();

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    const isCurrent = isCurrentMonth(month);
    if (isPast && !showPastMonths) return;
    renderedCount++;

    const eff = getEffectiveAssignment(wardName, month);
    const notesList = [
      eff.hcNote ? `High Council Change: ${eff.hcNote}` : '',
      eff.compNote ? `Companion Change: ${eff.compNote}` : '',
      ...eff.generalNotes
    ];

    const card = document.createElement('div');
    card.className = getMonthCardClass(isPast, isCurrent);

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div class="space-y-1">
          <div class="flex items-center flex-wrap gap-2">
            <span class="text-base font-extrabold text-slate-900">${month}</span>
            ${renderCurrentBadge(isCurrent)}
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70 shadow-sm">
              ${wardInfo.time || '10:00 AM'}
            </span>
            ${(eff.hcOverridden || eff.compOverridden || eff.generalNotes.length > 0) ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Updated</span>' : ''}
            ${isPast ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-500 border border-slate-200">PAST</span>' : ''}
          </div>
          ${renderLocationLine(wardInfo, { includeBuilding: true })}
          ${renderOverrideBanner(notesList)}
        </div>

        <div class="grid grid-cols-2 items-start gap-4 text-left sm:text-right border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">HIGH COUNCIL</span>
            ${eff.hcOverridden ? `<span class="text-xs text-slate-400 line-through block">${escapeHTML(eff.origHC || 'None')}</span>` : ''}
            ${eff.hc ? renderEntityLink(eff.hc, 'highCouncil', canNavigateToHighCouncil(eff.hc) ? eff.hc : '', 'font-bold text-slate-900 text-sm') : '<span class="font-bold text-slate-900 text-sm block">None</span>'}
          </div>
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center sm:justify-end gap-x-1">
              <span>COMPANION</span>
              ${eff.compRole && eff.compRole !== eff.compName ? `<span class="text-slate-300">·</span><span class="normal-case tracking-normal font-semibold text-slate-500">${escapeHTML(eff.compRole)}</span>` : ''}
            </div>
            ${eff.compOverridden ? `<span class="text-xs text-slate-400 line-through block">${escapeHTML(eff.origCompName || 'None')}</span>` : ''}
            ${eff.compName ? renderEntityLink(eff.compName, 'companion', canNavigateToCompanionRole(eff.compRole) ? eff.compRole : '', 'font-bold text-slate-900 text-sm') : '<span class="font-bold text-slate-900 text-sm block">None</span>'}
          </div>
        </div>
      </div>

      ${renderThemeDrawer(month, { defaultOpen: isCurrent })}
    `;

    fragment.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'All months for this ward are in the past. Enable "Past Months" to view them.');
    return;
  }

  renderSummaryStrip(container, `${renderedCount} ${showPastMonths ? 'total' : 'upcoming'} month${renderedCount === 1 ? '' : 's'} for ${wardInfo.name}`, wardInfo.time ? `Sacrament Meeting: ${wardInfo.time}` : '');
  container.appendChild(fragment);
}

// Month View (Dark Hero Theme Banner + Units Grid)
function renderMonthView(container) {
  const selectedMonth = currentSelection;
  const themeData = THEMES[selectedMonth] || { theme: '', talks: [] };
  const isPast = isMonthPast(selectedMonth);
  const isCurrent = isCurrentMonth(selectedMonth);

  const themeBanner = document.createElement('div');
  themeBanner.className = 'bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-4';
  themeBanner.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <span class="text-xs font-extrabold tracking-wider uppercase text-sky-300">MONTHLY THEME & STUDY MATERIALS</span>
      ${isCurrent ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider bg-indigo-500/40 text-indigo-100 border border-indigo-300/40">THIS MONTH</span>' : ''}
      ${isPast ? '<span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-white/10 text-sky-200 border border-white/20">PAST MONTH</span>' : ''}
    </div>
    <h2 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug drop-shadow-sm">
      ${escapeHTML(themeData.theme || 'Theme to be announced')}
    </h2>
    <div class="pt-3 border-t border-white/15">
      <div class="text-[11px] font-bold uppercase tracking-wider text-sky-300 mb-2">CONFERENCE TALKS:</div>
      ${renderTalkLinks(themeData.talks, true)}
    </div>
  `;
  container.appendChild(themeBanner);

  renderSummaryStrip(container, `${WARDS.length} unit${WARDS.length === 1 ? '' : 's'} scheduled for ${selectedMonth}`, 'Tap any ward or speaker to view their full schedule');

  const unitsGrid = document.createElement('div');
  unitsGrid.className = 'space-y-3';

  WARDS.forEach(w => {
    const eff = getEffectiveAssignment(w.name, selectedMonth);
    const notesList = [
      eff.hcNote ? `HC: ${eff.hcNote}` : '',
      eff.compNote ? `Comp: ${eff.compNote}` : '',
      ...eff.generalNotes
    ];

    const item = document.createElement('div');
    item.className = 'bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4';
    item.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
          ${renderEntityLink(w.name, 'ward', canNavigateToWard(w.name) ? w.name : '', 'font-extrabold text-base text-slate-900')}
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70 shadow-sm">
            ${w.time || '10:00 AM'}
          </span>
          ${(eff.hcOverridden || eff.compOverridden || eff.generalNotes.length > 0) ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Swapped / Updated</span>' : ''}
        </div>
        ${renderLocationLine(w, { includeBuilding: true })}
        ${renderOverrideBanner(notesList)}
      </div>

      <div class="grid grid-cols-2 items-start gap-4 sm:flex sm:items-start sm:gap-6 sm:text-right border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
        <div class="sm:min-w-[125px]">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">HIGH COUNCIL</span>
          ${eff.hcOverridden ? `<span class="text-xs text-slate-400 line-through block">${escapeHTML(eff.origHC || 'None')}</span>` : ''}
          ${eff.hc ? renderEntityLink(eff.hc, 'highCouncil', canNavigateToHighCouncil(eff.hc) ? eff.hc : '', 'font-bold text-slate-900 text-sm') : '<span class="font-bold text-slate-900 text-sm block">Unassigned</span>'}
        </div>
        <div class="sm:min-w-[140px]">
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center sm:justify-end gap-x-1">
            <span>COMPANION</span>
            ${eff.compRole && eff.compRole !== eff.compName ? `<span class="text-slate-300">·</span><span class="normal-case tracking-normal font-semibold text-slate-500">${escapeHTML(eff.compRole)}</span>` : ''}
          </div>
          ${eff.compOverridden ? `<span class="text-xs text-slate-400 line-through block">${escapeHTML(eff.origCompName || 'None')}</span>` : ''}
          ${eff.compName ? renderEntityLink(eff.compName, 'companion', canNavigateToCompanionRole(eff.compRole) ? eff.compRole : '', 'font-bold text-slate-900 text-sm') : '<span class="font-bold text-slate-900 text-sm block">None</span>'}
        </div>
      </div>
    `;
    unitsGrid.appendChild(item);
  });

  container.appendChild(unitsGrid);
}

function renderEmptyState(container, msg) {
  container.innerHTML = `
    <div class="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 space-y-2">
      <svg class="w-10 h-10 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      <p class="text-sm font-semibold text-slate-700">No speaking assignments to show</p>
      <p class="text-xs text-slate-400 max-w-sm mx-auto">${msg}</p>
    </div>`;
}

// -------------------------------------------------------------
// Clipboard Export
// -------------------------------------------------------------
function copyScheduleToClipboard() {
  let lines = [];
  const timestamp = new Date().toLocaleDateString();

  if (currentTab === 'highCouncil') {
    const hc = currentSelection;
    lines.push(`Speaking Schedule for ${hc} (Generated ${timestamp})`);
    lines.push('----------------------------------------');
    MONTHS.forEach(m => {
      const isPast = isMonthPast(m);
      if (isPast && !showPastMonths) return;

      let assignedWard = null;
      let effective = null;
      Object.keys(HC_SCHEDULE_GRID).forEach(wName => {
        const eff = getEffectiveAssignment(wName, m);
        if (eff.hc === hc) {
          assignedWard = wName;
          effective = eff;
        }
      });

      if (!assignedWard) {
        if (showOffMonths) lines.push(`${m}: Off Month ${isPast ? '[Past]' : ''}`);
        return;
      }

      const ward = getWardInfo(assignedWard);
      const theme = THEMES[m] ? THEMES[m].theme : '';

      lines.push(`${m}${isPast ? ' [Past]' : ''}: ${ward.name} (${ward.time || '10:00 AM'})${effective.hcOverridden ? ` [Sub for ${effective.origHC}]` : ''}`);
      lines.push(`  Building: ${ward.building} (${ward.address})`);
      lines.push(`  Speaking With: ${effective.compName || 'None'}${effective.compRole && effective.compRole !== effective.compName ? ` [${effective.compRole}]` : ''}`);
      if (theme) lines.push(`  Theme: "${theme}"`);
      lines.push('');
    });
  } else if (currentTab === 'companion') {
    if (currentSelection.startsWith('ORG_')) {
      const orgMeta = ORG_DEFINITIONS[currentSelection];
      lines.push(`${orgMeta.name} Presidency Schedule (Generated ${timestamp})`);
      lines.push('----------------------------------------');
      MONTHS.forEach(m => {
        const isPast = isMonthPast(m);
        if (isPast && !showPastMonths) return;
        const entries = [];
        Object.keys(COMP_SCHEDULE_GRID).forEach(wName => {
          const eff = getEffectiveAssignment(wName, m);
          if (orgMeta.roles.includes(eff.compRole) || orgMeta.roles.includes(eff.origCompRole)) {
            const ward = getWardInfo(wName);
            const swapTag = eff.compOverridden ? ` [Sub for ${eff.origCompName || eff.origCompRole}]` : '';
            entries.push(`  • ${eff.compRole} (${eff.compName || eff.compRole})${swapTag} -> ${ward.name} at ${ward.time || '10:00 AM'} (with ${eff.hc || 'Unassigned'})`);
          }
        });
        if (entries.length > 0) {
          lines.push(`${m}${isPast ? ' [Past]' : ''}:`);
          lines.push(...entries);
          lines.push('');
        }
      });
    } else {
      const role = currentSelection;
      const name = COMPANION_ROLES[role] || role;
      lines.push(`Speaking Schedule for ${role} - ${name} (Generated ${timestamp})`);
      lines.push('----------------------------------------');
      MONTHS.forEach(m => {
        const isPast = isMonthPast(m);
        if (isPast && !showPastMonths) return;

        let assignedWard = null;
        let effective = null;
        Object.keys(COMP_SCHEDULE_GRID).forEach(wName => {
          const eff = getEffectiveAssignment(wName, m);
          if (eff.compRole === role) {
            assignedWard = wName;
            effective = eff;
          }
        });

        if (!assignedWard) {
          if (showOffMonths) lines.push(`${m}: Off Month ${isPast ? '[Past]' : ''}`);
          return;
        }

        const ward = getWardInfo(assignedWard);

        lines.push(`${m}${isPast ? ' [Past]' : ''}: ${ward.name} (${ward.time || '10:00 AM'})${effective.compOverridden ? ` [Sub for ${effective.origCompName}]` : ''}`);
        lines.push(`  Building: ${ward.building} (${ward.address})`);
        lines.push(`  Speaking With: ${effective.hc || 'None'} (High Council)`);
        lines.push('');
      });
    }
  } else if (currentTab === 'ward') {
    const wardName = currentSelection;
    const ward = getWardInfo(wardName);
    lines.push(`Sacrament Meeting Speaking Schedule: ${ward.name} (Generated ${timestamp})`);
    lines.push(`Building: ${ward.building} (${ward.address}) - Time: ${ward.time}`);
    lines.push('----------------------------------------');
    MONTHS.forEach(m => {
      const isPast = isMonthPast(m);
      if (isPast && !showPastMonths) return;
      const eff = getEffectiveAssignment(wardName, m);
      const theme = THEMES[m] ? THEMES[m].theme : '';

      lines.push(`${m}${isPast ? ' [Past]' : ''}:`);
      lines.push(`  High Council: ${eff.hc || 'None'}${eff.hcOverridden ? ` (Replaced ${eff.origHC})` : ''}`);
      lines.push(`  Companion: ${eff.compName || 'None'}${eff.compRole && eff.compRole !== eff.compName ? ` (${eff.compRole})` : ''}${eff.compOverridden ? ` (Replaced ${eff.origCompName})` : ''}`);
      if (theme) lines.push(`  Theme: "${theme}"`);
      lines.push('');
    });
  } else if (currentTab === 'month') {
    const m = currentSelection;
    const isPast = isMonthPast(m);
    const theme = THEMES[m] ? THEMES[m].theme : '';
    lines.push(`Stake Speaking Itinerary: ${m} ${isPast ? '[Past Month]' : ''} (Generated ${timestamp})`);
    if (theme) lines.push(`Monthly Theme: "${theme}"`);
    lines.push('----------------------------------------');
    WARDS.forEach(w => {
      const eff = getEffectiveAssignment(w.name, m);
      lines.push(`${w.name} (${w.time}) [${w.building}]:`);
      lines.push(`  High Council: ${eff.hc || 'None'}${eff.hcOverridden ? ` (Sub for ${eff.origHC})` : ''} | Companion: ${eff.compName || 'None'}${eff.compOverridden ? ` (Sub for ${eff.origCompName})` : ''}`);
    });
  }

  const textToCopy = lines.join('\n');
  copyToClipboardText(textToCopy);
  showToast('Schedule text copied to clipboard!');
}

async function copyToClipboardText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fall back to execCommand below
    }
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (err) {
    console.error('Copy failed', err);
  }
  document.body.removeChild(ta);
  return ok;
}

async function shareCurrentView() {
  syncUrlParams();
  const shareUrl = window.location.href;
  const select = document.getElementById('itemSelect');
  const selectedLabel = select && select.selectedOptions && select.selectedOptions[0]
    ? select.selectedOptions[0].textContent
    : currentSelection;
  const shareTitle = selectedLabel
    ? `Stake Speaking Schedule — ${selectedLabel}`
    : 'Stake Speaking Schedule';

  if (navigator.share) {
    try {
      await navigator.share({ title: shareTitle, url: shareUrl });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }

  await copyToClipboardText(shareUrl);
  showToast('Share link copied to clipboard!');
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
  document.getElementById('guidelinesModal').classList.remove('hidden');
}
function closeGuidelinesModal() {
  document.getElementById('guidelinesModal').classList.add('hidden');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('guidelinesModal');
    if (modal && !modal.classList.contains('hidden')) {
      closeGuidelinesModal();
    }
  }
});

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// -------------------------------------------------------------
// Published Google Sheet CSV Dynamic Synchronization
// -------------------------------------------------------------
const PUBLISHED_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQbVCgfwkh_-m3O1YW8uxwwmLcqaJT99RanTRLNIIWSMaD6S7NgaALYB5VXC-QIfRPRRJ0DdDGOMVu/pub?output=csv';
const WEB_SOURCE_SHEET_ID = '1qSdJqlsYkEYSQduHuq1apx4bG8ztS3l3yxXjRByT2MQ';

const TAB_GIDS = {
  HC_ROSTER: '0',
  WARDS: '1',
  COMPANION_ROLES: '781995817',
  THEMES: '2',
  TALKS: '3',
  HC_SCHEDULE: '208333913',
  COMP_SCHEDULE: '437508687'
};

function parseCSV(text) {
  if (!text) return [];
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    const row = [];
    let inQuotes = false;
    let token = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          token += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(token);
        token = '';
      } else {
        token += char;
      }
    }
    row.push(token);
    return row;
  });
}

async function fetchPublishedTab(gid, sheetNames = []) {
  // 1. Try published CSV URL with GID first
  try {
    const url = `${PUBLISHED_BASE_URL}&gid=${gid}`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.text();
    }
  } catch (e) {
    // Continue to sheet name fallback
  }

  // 2. Fallback: Query by tab name using Google Visualization endpoint on Web Source sheet
  for (const name of sheetNames) {
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${WEB_SOURCE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
      const res = await fetch(gvizUrl);
      if (res.ok) {
        return await res.text();
      }
    } catch (e) {
      // Try next alias
    }
  }

  throw new Error(`Unable to fetch tab (GID: ${gid})`);
}

async function fetchOverridesTab() {
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${WEB_SOURCE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Overrides')}`;
  const res = await fetch(gvizUrl);
  if (!res.ok) throw new Error('Overrides tab unavailable');
  return await res.text();
}

async function syncGoogleSheetData({ manual = false } = {}) {
  if (isSyncing) return;
  isSyncing = true;

  const hadExistingData = hasAnyScheduleData();
  setStatusBadge('loading', hadExistingData ? 'Refreshing Schedule...' : 'Syncing Google Sheets...');

  try {
    const [
      hcRosterRes,
      wardsRes,
      compRolesRes,
      themesRes,
      talksRes,
      hcScheduleRes,
      compScheduleRes,
      overridesRes
    ] = await Promise.allSettled([
      fetchPublishedTab(TAB_GIDS.HC_ROSTER, ['High Council']),
      fetchPublishedTab(TAB_GIDS.WARDS, ['Wards']),
      fetchPublishedTab(TAB_GIDS.COMPANION_ROLES, ['Companion Speakers', 'Companion Roles']),
      fetchPublishedTab(TAB_GIDS.THEMES, ['Themes']),
      fetchPublishedTab(TAB_GIDS.TALKS, ['Talks']),
      fetchPublishedTab(TAB_GIDS.HC_SCHEDULE, ['Schedule', 'High Council Schedule']),
      fetchPublishedTab(TAB_GIDS.COMP_SCHEDULE, ['Companion Schedule']),
      fetchOverridesTab()
    ]);

    let coreSuccessCount = 0;
    const coreTotal = 7;

    // 1. Parse High Council Roster
    if (hcRosterRes.status === 'fulfilled') {
      const rows = parseCSV(hcRosterRes.value).slice(1);
      const list = [];
      rows.forEach((r, idx) => {
        const name = r[1] ? r[1].trim() : (r[0] ? r[0].trim() : '');
        if (name && name.length < 35 && !name.toLowerCase().includes('speaking')) {
          list.push({ id: idx + 1, name });
        }
      });
      if (list.length > 0) {
        HIGH_COUNCIL = list;
        coreSuccessCount++;
      }
    } else {
      console.warn('High Council roster warning:', hcRosterRes.reason);
    }

    // 2. Parse Wards directory (single source of truth for times)
    if (wardsRes.status === 'fulfilled') {
      const rows = parseCSV(wardsRes.value).slice(1);
      const list = [];
      rows.forEach((r, idx) => {
        const name = r[1] || r[0];
        if (name && name.trim()) {
          list.push({
            id: idx + 1,
            name: name.trim(),
            building: r[2] ? r[2].trim() : '',
            address: r[3] ? r[3].trim() : '',
            time: r[4] ? r[4].trim() : '10:00 AM'
          });
        }
      });
      if (list.length > 0) {
        WARDS = list;
        coreSuccessCount++;
      }
    } else {
      console.warn('Wards directory warning:', wardsRes.reason);
    }

    // 3. Parse Companion Roles
    if (compRolesRes.status === 'fulfilled') {
      const rows = parseCSV(compRolesRes.value).slice(1);
      const dict = {};
      rows.forEach(r => {
        const role = r[0] ? r[0].trim() : '';
        const name = r[1] ? r[1].trim() : '';
        if (role) dict[role] = name;
      });
      if (Object.keys(dict).length > 0) {
        COMPANION_ROLES = dict;
        coreSuccessCount++;
      }
    } else {
      console.warn('Companion Roles tab warning:', compRolesRes.reason);
    }

    // 4. Parse Themes & Talks
    if (themesRes.status === 'fulfilled') {
      const themeRows = parseCSV(themesRes.value).slice(1);
      themeRows.forEach(r => {
        const m = r[0] ? r[0].trim() : '';
        const t = r[1] ? r[1].trim() : '';
        if (m && MONTHS.includes(m)) {
          if (!THEMES[m]) THEMES[m] = { theme: '', talks: [] };
          THEMES[m].theme = t;
        }
      });
      coreSuccessCount++;
    } else {
      console.warn('Themes fetch warning:', themesRes.reason);
    }

    if (talksRes.status === 'fulfilled') {
      const talkRows = parseCSV(talksRes.value).slice(1);
      const monthTalks = {};
      talkRows.forEach(r => {
        const m = r[0] ? r[0].trim() : '';
        const speaker = r[1] ? r[1].trim() : '';
        const title = r[2] ? r[2].trim() : '';
        const url = r[3] ? r[3].trim() : '';
        if (m && title) {
          if (!monthTalks[m]) monthTalks[m] = [];
          monthTalks[m].push({ speaker, title, url });
        }
      });
      Object.keys(monthTalks).forEach(m => {
        if (!THEMES[m]) THEMES[m] = { theme: '', talks: [] };
        THEMES[m].talks = monthTalks[m];
      });
      coreSuccessCount++;
    } else {
      console.warn('Talks fetch warning:', talksRes.reason);
    }

    // 5. Parse High Council Schedule Grid
    if (hcScheduleRes.status === 'fulfilled') {
      const rows = parseCSV(hcScheduleRes.value);
      if (rows.length > 1) {
        const header = rows[0].map(h => h.trim());
        const monthIndices = {};
        MONTHS.forEach(m => {
          const colIdx = header.findIndex(h => h.toLowerCase() === m.toLowerCase());
          if (colIdx !== -1) monthIndices[m] = colIdx;
        });

        const newGrid = {};
        rows.slice(1).forEach(r => {
          const wardName = r[1] ? r[1].trim() : (r[0] ? r[0].trim() : '');
          if (!wardName) return;
          if (!newGrid[wardName]) newGrid[wardName] = {};
          MONTHS.forEach(m => {
            if (monthIndices[m] !== undefined && r[monthIndices[m]]) {
              newGrid[wardName][m] = r[monthIndices[m]].trim();
            }
          });
        });
        if (Object.keys(newGrid).length > 0) {
          HC_SCHEDULE_GRID = newGrid;
          coreSuccessCount++;
        }
      }
    } else {
      console.warn('High Council schedule grid warning:', hcScheduleRes.reason);
    }

    // 6. Parse Companion Schedule Grid (uses parsed WARDS above)
    if (compScheduleRes.status === 'fulfilled') {
      const rows = parseCSV(compScheduleRes.value);
      if (rows.length > 1) {
        const header = rows[0].map(h => h.trim());
        const monthIndices = {};
        MONTHS.forEach(m => {
          const colIdx = header.findIndex(h => h.toLowerCase() === m.toLowerCase());
          if (colIdx !== -1) monthIndices[m] = colIdx;
        });

        const roleColIdx = header.findIndex(h => h.toLowerCase() === 'role');
        const nameColIdx = header.findIndex(h => h.toLowerCase() === 'name');

        const newGrid = {};
        rows.slice(1).forEach(r => {
          const wardName = r[1] ? r[1].trim() : (r[0] ? r[0].trim() : '');
          if (wardName && WARDS.some(w => w.name.toLowerCase() === wardName.toLowerCase())) {
            if (!newGrid[wardName]) newGrid[wardName] = {};
            MONTHS.forEach(m => {
              if (monthIndices[m] !== undefined && r[monthIndices[m]]) {
                newGrid[wardName][m] = r[monthIndices[m]].trim();
              }
            });
          }

          const rIdx = roleColIdx !== -1 ? roleColIdx : 13;
          const nIdx = nameColIdx !== -1 ? nameColIdx : 15;
          if (r[rIdx] && r[nIdx]) {
            const rKey = r[rIdx].trim();
            const rName = r[nIdx].trim();
            if (rKey && rName && rKey.toUpperCase() !== 'TOTAL' && !COMPANION_ROLES[rKey]) {
              COMPANION_ROLES[rKey] = rName;
            }
          }
        });
        if (Object.keys(newGrid).length > 0) {
          COMP_SCHEDULE_GRID = newGrid;
          coreSuccessCount++;
        }
      }
    } else {
      console.warn('Companion schedule grid warning:', compScheduleRes.reason);
    }

    // 7. Parse Overrides Tab (Optional)
    if (overridesRes.status === 'fulfilled') {
      const rows = parseCSV(overridesRes.value);
      if (rows.length > 1) {
        const header = rows[0].map(h => h.trim().toLowerCase());
        const mIdx = header.findIndex(h => h.includes('month'));
        const wIdx = header.findIndex(h => h.includes('ward') || h.includes('unit'));
        const tIdx = header.findIndex(h => h.includes('role') || h.includes('type'));
        const rIdx = header.findIndex(h => h.includes('replacement') || h.includes('speaker') || h.includes('sub'));
        const nIdx = header.findIndex(h => h.includes('note') || h.includes('reason'));

        if (mIdx !== -1 && wIdx !== -1) {
          const parsedOverrides = [];
          rows.slice(1).forEach(r => {
            const m = (r[mIdx] || '').trim();
            const w = (r[wIdx] || '').trim();
            if (m && w) {
              parsedOverrides.push({
                month: m,
                ward: w,
                roleType: tIdx !== -1 ? (r[tIdx] || '').trim() : 'Companion',
                replacement: rIdx !== -1 ? (r[rIdx] || '').trim() : '',
                note: nIdx !== -1 ? (r[nIdx] || '').trim() : ''
              });
            }
          });
          OVERRIDES = parsedOverrides;
        }
      }
    }

    isDataLoaded = true;

    if (coreSuccessCount === 0) {
      lastSyncError = true;
      if (hasAnyScheduleData()) {
        setStatusBadge('warn', 'Offline · Showing Cached Schedule');
        if (manual) showToast('Offline — showing cached schedule');
      } else {
        setStatusBadge('error', 'Connection Error · Tap to Retry');
      }
    } else {
      lastSyncError = false;
      saveCachedSheetData();
      if (coreSuccessCount === coreTotal) {
        setStatusBadge('live', 'Live Google Sheet Connected');
      } else {
        setStatusBadge('warn', 'Partially Synced · Tap to Refresh');
      }
      if (manual) showToast('Schedule refreshed from Google Sheets');
    }

    applyTabChrome(currentTab);
    populateDropdown();
    renderCards();
    saveState();
  } catch (err) {
    console.error('Google Sheet sync error:', err);
    isDataLoaded = true;
    lastSyncError = true;
    if (hasAnyScheduleData()) {
      setStatusBadge('warn', 'Offline · Showing Cached Schedule');
    } else {
      setStatusBadge('error', 'Connection Error · Tap to Retry');
    }
    renderCards();
  } finally {
    isSyncing = false;
  }
}

// -------------------------------------------------------------
// Application Initialization
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  loadSavedState();
  const pastToggle = document.getElementById('showPastMonthsToggle');
  const offToggle = document.getElementById('showOffMonthsToggle');
  if (pastToggle) pastToggle.checked = showPastMonths;
  if (offToggle) offToggle.checked = showOffMonths;
  applyTabChrome(currentTab);

  // Delegated click handler for cross-tab entity navigation links
  const feed = document.getElementById('scheduleFeed');
  if (feed) {
    feed.addEventListener('click', (e) => {
      const target = e.target.closest('[data-nav-tab][data-nav-value]');
      if (!target) return;
      navigateToEntity(target.dataset.navTab, target.dataset.navValue);
    });
  }

  // Hydrate immediately from local cache if available, then refresh in background
  if (loadCachedSheetData()) {
    isDataLoaded = true;
    populateDropdown();
    renderCards();
  } else {
    renderCards(); // Shows loading skeleton on first visit
  }
  syncGoogleSheetData();
});
