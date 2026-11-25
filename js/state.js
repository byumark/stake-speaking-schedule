// -------------------------------------------------------------
// Constants
// -------------------------------------------------------------
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const ORG_DEFINITIONS = {
  'ORG_RS': { name: 'Relief Society', roles: ['RS Pres', 'RS 1st', 'RS 2nd', 'RS Sec'] },
  'ORG_YW': { name: 'Young Women', roles: ['YW Pres', 'YW 1st', 'YW 2nd', 'YW Sec'] },
  'ORG_PRIMARY': { name: 'Primary', roles: ['Primary Pres', 'Primary 1st', 'Primary 2nd', 'Primary Sec'] },
  'ORG_YM': { name: 'Young Men', roles: ['YM 1st', 'YM 2nd', 'YM Sec'] },
  'ORG_SS': { name: 'Sunday School', roles: ['SS 1st', 'SS 2nd'] },
  'ORG_CLERKS': { name: 'Stake Clerks & Sec', roles: ['Stake Exec Sec', 'Stake Clerk', 'Stake Asst Clerk'] }
};

export const VALID_TABS = ['highCouncil', 'companion', 'ward', 'month'];

const STORAGE_KEY = 'stakeScheduleState_v1';
const DATA_CACHE_KEY = 'stakeScheduleDataCache_v1';

// -------------------------------------------------------------
// Shared Dynamic Store & UI State
// -------------------------------------------------------------
export const state = {
  highCouncil: [],
  wards: [],
  companionRoles: {},
  themes: {},
  hcScheduleGrid: {},
  compScheduleGrid: {},
  overrides: [],
  isDataLoaded: false,
  currentTab: 'highCouncil',
  currentSelection: '',
  savedSelections: { highCouncil: '', companion: '', ward: '', month: '' },
  showPastMonths: false,
  showOffMonths: false,
  isSyncing: false,
  lastSyncError: false
};

// -------------------------------------------------------------
// Offline Cache Persistence
// -------------------------------------------------------------
export function hasAnyScheduleData() {
  return (
    state.highCouncil.length > 0 ||
    state.wards.length > 0 ||
    Object.keys(state.companionRoles).length > 0
  );
}

export function loadCachedSheetData() {
  try {
    const raw = localStorage.getItem(DATA_CACHE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw);
    if (!cached || typeof cached !== 'object') return false;
    if (Array.isArray(cached.HIGH_COUNCIL)) state.highCouncil = cached.HIGH_COUNCIL;
    if (Array.isArray(cached.WARDS)) state.wards = cached.WARDS;
    if (cached.COMPANION_ROLES && typeof cached.COMPANION_ROLES === 'object') state.companionRoles = cached.COMPANION_ROLES;
    if (cached.THEMES && typeof cached.THEMES === 'object') state.themes = cached.THEMES;
    if (cached.HC_SCHEDULE_GRID && typeof cached.HC_SCHEDULE_GRID === 'object') state.hcScheduleGrid = cached.HC_SCHEDULE_GRID;
    if (cached.COMP_SCHEDULE_GRID && typeof cached.COMP_SCHEDULE_GRID === 'object') state.compScheduleGrid = cached.COMP_SCHEDULE_GRID;
    if (Array.isArray(cached.OVERRIDES)) state.overrides = cached.OVERRIDES;
    return hasAnyScheduleData();
  } catch (e) {
    return false;
  }
}

export function saveCachedSheetData() {
  try {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      HIGH_COUNCIL: state.highCouncil,
      WARDS: state.wards,
      COMPANION_ROLES: state.companionRoles,
      THEMES: state.themes,
      HC_SCHEDULE_GRID: state.hcScheduleGrid,
      COMP_SCHEDULE_GRID: state.compScheduleGrid,
      OVERRIDES: state.overrides
    }));
  } catch (e) {
    // Ignore storage quota/private mode errors
  }
}

// -------------------------------------------------------------
// Date, Ward & Escaping Helpers
// -------------------------------------------------------------
export function getWardInfo(wardName) {
  const found = state.wards.find(w => w.name.trim().toLowerCase() === (wardName || '').trim().toLowerCase());
  return found || { name: wardName || 'Unknown Ward', building: '', address: '', time: '10:00 AM' };
}

export function getCurrentMonthName() {
  return MONTHS[new Date().getMonth()] || MONTHS[0];
}

export function isMonthPast(monthName) {
  const idx = MONTHS.indexOf(monthName);
  if (idx === -1) return false;
  return idx < new Date().getMonth();
}

export function isCurrentMonth(monthName) {
  const idx = MONTHS.indexOf(monthName);
  return idx !== -1 && idx === new Date().getMonth();
}

export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// -------------------------------------------------------------
// View State Persistence & URL Sync
// -------------------------------------------------------------
export function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && VALID_TABS.includes(parsed.tab)) {
        state.currentTab = parsed.tab;
      }
      if (parsed && parsed.selections && typeof parsed.selections === 'object') {
        VALID_TABS.forEach(t => {
          if (typeof parsed.selections[t] === 'string') {
            state.savedSelections[t] = parsed.selections[t];
          }
        });
      }
      if (typeof parsed.showPastMonths === 'boolean') state.showPastMonths = parsed.showPastMonths;
      if (typeof parsed.showOffMonths === 'boolean') state.showOffMonths = parsed.showOffMonths;
    }
  } catch (e) {
    // Ignore storage errors in private browsing or restricted environments
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    const urlSelect = params.get('select');
    if (urlTab && VALID_TABS.includes(urlTab)) {
      state.currentTab = urlTab;
    }
    if (urlSelect) {
      state.savedSelections[state.currentTab] = urlSelect;
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  state.currentSelection = state.savedSelections[state.currentTab] || '';
}

export function syncUrlParams() {
  if (!state.isDataLoaded || !state.currentSelection) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', state.currentTab);
    url.searchParams.set('select', state.currentSelection);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (e) {
    // Ignore history API errors
  }
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tab: state.currentTab,
      selections: state.savedSelections,
      showPastMonths: state.showPastMonths,
      showOffMonths: state.showOffMonths
    }));
  } catch (e) {
    // Ignore storage quota/private mode errors
  }
  syncUrlParams();
}

// -------------------------------------------------------------
// Schedule Resolution with Overrides Support
// -------------------------------------------------------------
export function getEffectiveAssignment(wardName, month) {
  const origHC = (state.hcScheduleGrid[wardName] && state.hcScheduleGrid[wardName][month]) || '';
  const origCompRole = (state.compScheduleGrid[wardName] && state.compScheduleGrid[wardName][month]) || '';
  const origCompName = origCompRole ? (state.companionRoles[origCompRole] || origCompRole) : '';

  let hc = origHC;
  let hcOverridden = false;
  let hcNote = '';

  let compRole = origCompRole;
  let compName = origCompName;
  let compOverridden = false;
  let compNote = '';

  let generalNotes = [];

  state.overrides.forEach(ov => {
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
          compName = state.companionRoles[ov.replacement] || ov.replacement;
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
