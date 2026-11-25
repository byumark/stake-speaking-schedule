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
// App State
// -------------------------------------------------------------
let currentTab = 'highCouncil';
let currentSelection = '';
let showPastMonths = false;
let showOffMonths = false;

function getWardInfo(wardName) {
  const found = WARDS.find(w => w.name.trim().toLowerCase() === (wardName || '').trim().toLowerCase());
  return found || { name: wardName || 'Unknown Ward', building: '', address: '', time: '10:00 AM' };
}

function isMonthPast(monthName) {
  const idx = MONTHS.indexOf(monthName);
  if (idx === -1) return false;
  return idx < new Date().getMonth();
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

function switchTab(tabKey) {
  currentTab = tabKey;

  ['highCouncil', 'companion', 'ward', 'month'].forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    if (!btn) return;
    if (t === tabKey) {
      btn.className = 'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-sm font-semibold transition-all duration-150 bg-indigo-50 text-indigo-700 sm:bg-white sm:text-slate-900 sm:shadow-xs';
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

  populateDropdown();
  renderCards();
}

function populateDropdown() {
  const select = document.getElementById('itemSelect');
  if (!select) return;

  const prevVal = currentSelection;
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
      opt.textContent = m;
      select.appendChild(opt);
    });
  }

  const validValues = Array.from(select.options).map(o => o.value);
  if (prevVal && validValues.includes(prevVal)) {
    select.value = prevVal;
    currentSelection = prevVal;
  } else if (select.options.length > 0) {
    select.value = select.options[0].value;
    currentSelection = select.options[0].value;
  }
}

function onSelectionChange(val) {
  currentSelection = val;
  renderCards();
}

function toggleShowPastMonths(checked) {
  showPastMonths = checked;
  renderCards();
}

function toggleShowOffMonths(checked) {
  showOffMonths = checked;
  renderCards();
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

function renderThemeDrawer(month) {
  const themeData = THEMES[month] || { theme: '', talks: [] };
  return `
    <div class="pt-3.5 border-t border-slate-100 space-y-2.5">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
        <span class="font-bold uppercase tracking-wider text-slate-400 text-[10px]">STAKE THEME:</span>
        <span class="font-bold text-slate-900">${escapeHTML(themeData.theme || 'To be announced')}</span>
      </div>
      <div class="space-y-1.5">
        <div class="font-bold uppercase tracking-wider text-slate-400 text-[10px]">CONFERENCE TALKS:</div>
        ${renderTalkLinks(themeData.talks, false)}
      </div>
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
          <div class="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 animate-pulse space-y-4">
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

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
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

    const card = document.createElement('div');
    card.className = `bg-white rounded-2xl p-5 shadow-xs border transition-all ${
      isPast ? 'opacity-65 bg-slate-50/70 border-dashed border-slate-300' : (isRelieved ? 'bg-slate-50/60 border-slate-200/80' : 'border-slate-200/90')
    }`;

    if (isOff) {
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-base font-bold text-slate-900">${month}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">Off Month</span>
          </div>
          ${isPast ? '<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">PAST</span>' : ''}
        </div>`;
    } else {
      const companionDisplay = effective.compOverridden
        ? `
          <div class="flex flex-col md:items-end">
            <span class="text-xs text-slate-400 line-through">${escapeHTML(effective.origCompName || effective.origCompRole || 'None')}</span>
            <span class="font-bold text-slate-900 text-sm">${escapeHTML(effective.compName || effective.compRole)}</span>
            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5">Companion Sub</span>
          </div>`
        : (effective.compRole ? `
          <div class="font-bold text-slate-900 text-sm">${escapeHTML(effective.compName || effective.compRole)}</div>
          <div class="text-xs text-slate-500 font-medium">${escapeHTML(effective.compRole)}</div>
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
            <div class="flex items-center flex-wrap gap-2.5">
              <span class="text-base font-extrabold text-slate-900">${month}</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70 shadow-2xs">
                ${wardInfo.time || '10:00 AM'}
              </span>
              ${statusBadge}
              ${isPast ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-500 border border-slate-200">PAST</span>' : ''}
            </div>
            <div class="flex items-center flex-wrap gap-x-2 text-sm">
              <span class="font-bold text-slate-900">${escapeHTML(wardInfo.name)}</span>
              ${wardInfo.building ? `<span class="text-slate-400 text-xs font-medium">(${escapeHTML(wardInfo.building)})</span>` : ''}
            </div>
            ${wardInfo.address ? `
              <div class="flex items-center gap-1.5 text-xs text-slate-500">
                <svg class="w-3.5 h-3.5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>${escapeHTML(wardInfo.address)}</span>
              </div>` : ''}
            ${renderOverrideBanner(notesList)}
          </div>

          <div class="md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">SPEAKING WITH</div>
            ${companionDisplay}
          </div>
        </div>

        <!-- Stake Theme & Talks Drawer -->
        ${renderThemeDrawer(month)}
      `;
    }

    container.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'No assignments found matching the current filters. Try enabling "Show Past Months" or "Show Off Months".');
  }
}

// Companion Individual View (NO Theme & Talks + Override Strike-Throughs)
function renderCompanionIndividualView(container) {
  const roleKey = currentSelection;
  const personName = COMPANION_ROLES[roleKey] || '';
  let renderedCount = 0;

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
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

    const card = document.createElement('div');
    card.className = `bg-white rounded-2xl p-5 shadow-xs border transition-all ${
      isPast ? 'opacity-65 bg-slate-50/70 border-dashed border-slate-300' : (isRelieved ? 'bg-slate-50/60 border-slate-200/80' : 'border-slate-200/90')
    }`;

    if (isOff) {
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-base font-bold text-slate-900">${month}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">Off Month</span>
          </div>
          ${isPast ? '<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">PAST</span>' : ''}
        </div>`;
    } else {
      const hcDisplay = effective.hcOverridden
        ? `
          <div class="flex flex-col md:items-end">
            <span class="text-xs text-slate-400 line-through">${escapeHTML(effective.origHC || 'Unassigned')}</span>
            <span class="font-bold text-slate-900 text-sm">${escapeHTML(effective.hc)}</span>
            <span class="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded mt-0.5">HC Sub</span>
          </div>`
        : (effective.hc ? `
          <div class="font-bold text-slate-900 text-sm">${escapeHTML(effective.hc)}</div>
          <div class="text-xs text-slate-500 font-medium">High Council</div>
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
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center flex-wrap gap-2.5">
              <span class="text-base font-extrabold text-slate-900">${month}</span>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70 shadow-2xs">
                ${wardInfo.time || '10:00 AM'}
              </span>
              ${statusBadge}
              ${isPast ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-500 border border-slate-200">PAST</span>' : ''}
            </div>
            <div class="flex items-center flex-wrap gap-x-2 text-sm">
              <span class="font-bold text-slate-900">${escapeHTML(wardInfo.name)}</span>
              ${wardInfo.building ? `<span class="text-slate-400 text-xs font-medium">(${escapeHTML(wardInfo.building)})</span>` : ''}
            </div>
            ${wardInfo.address ? `
              <div class="flex items-center gap-1.5 text-xs text-slate-500">
                <svg class="w-3.5 h-3.5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>${escapeHTML(wardInfo.address)}</span>
              </div>` : ''}
            ${renderOverrideBanner(notesList)}
          </div>

          <div class="md:text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">SPEAKING WITH</div>
            ${hcDisplay}
          </div>
        </div>
      `;
    }

    container.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'No assignments found matching the current filters. Try enabling "Show Past Months" or "Show Off Months".');
  }
}

// Companion Organization View (Grid for Swapping - NO Theme/Talks)
function renderCompanionOrgView(container) {
  const orgMeta = ORG_DEFINITIONS[currentSelection];
  if (!orgMeta) return;

  let renderedCount = 0;

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
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

    const card = document.createElement('div');
    card.className = `bg-white rounded-2xl p-5 shadow-xs border transition-all ${
      isPast ? 'opacity-65 bg-slate-50/70 border-dashed border-slate-300' : 'border-slate-200/90'
    }`;

    let assignmentsHtml = '';
    if (assignments.length === 0) {
      assignmentsHtml = `
        <div class="py-2 text-xs text-slate-400 italic">No organization members scheduled this month.</div>`;
    } else {
      assignmentsHtml = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          ${assignments.map(a => `
            <div class="bg-slate-50/80 rounded-xl p-3 border ${a.isOverridden ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200/80'} space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">${escapeHTML(a.role)}</span>
                <span class="text-xs font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">${escapeHTML(a.wardInfo.time || '10:00 AM')}</span>
              </div>
              ${a.isOverridden ? `
                <div class="text-xs text-slate-400 line-through">${escapeHTML(a.origName)} (${escapeHTML(a.origRole)})</div>
                <div class="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                  <span>${escapeHTML(a.name)}</span>
                  <span class="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Swapped</span>
                </div>
              ` : `
                <div class="font-extrabold text-sm text-slate-900">${escapeHTML(a.name)}</div>
              `}
              <div class="text-xs text-slate-700 font-medium">
                📍 ${escapeHTML(a.wardInfo.name)} <span class="text-slate-400">(${escapeHTML(a.wardInfo.building)})</span>
              </div>
              ${a.note ? `<div class="text-[11px] text-amber-800 font-medium">Note: ${escapeHTML(a.note)}</div>` : ''}
              <div class="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                High Councilor: <strong class="text-slate-800">${escapeHTML(a.hcSpeaker) || 'Unassigned'}</strong>
              </div>
            </div>
          `).join('')}
        </div>`;
    }

    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-100 pb-2">
        <div class="flex items-center gap-2">
          <span class="text-base font-extrabold text-slate-900">${month}</span>
          ${assignments.length > 0 ? `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">${assignments.length} Speaking</span>` : ''}
        </div>
        ${isPast ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-500 border border-slate-200">PAST</span>' : ''}
      </div>
      ${assignmentsHtml}
    `;

    container.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'No organization assignments in this range. Try enabling "Show Past Months".');
  }
}

// Ward View
function renderWardView(container) {
  const wardName = currentSelection;
  const wardInfo = getWardInfo(wardName);
  let renderedCount = 0;

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    if (isPast && !showPastMonths) return;
    renderedCount++;

    const eff = getEffectiveAssignment(wardName, month);
    const notesList = [
      eff.hcNote ? `High Council Change: ${eff.hcNote}` : '',
      eff.compNote ? `Companion Change: ${eff.compNote}` : '',
      ...eff.generalNotes
    ];

    const card = document.createElement('div');
    card.className = `bg-white rounded-2xl p-5 shadow-xs border transition-all ${
      isPast ? 'opacity-65 bg-slate-50/70 border-dashed border-slate-300' : 'border-slate-200/90'
    }`;

    card.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2.5">
            <span class="text-base font-extrabold text-slate-900">${month}</span>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70">
              ${wardInfo.time || '10:00 AM'}
            </span>
            ${(eff.hcOverridden || eff.compOverridden || eff.generalNotes.length > 0) ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Updated</span>' : ''}
            ${isPast ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-slate-100 text-slate-500 border border-slate-200">PAST</span>' : ''}
          </div>
          <div class="text-xs text-slate-500">
            ${escapeHTML(wardInfo.building)} • ${escapeHTML(wardInfo.address)}
          </div>
          ${renderOverrideBanner(notesList)}
        </div>

        <div class="grid grid-cols-2 gap-3 text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">HIGH COUNCIL</span>
            ${eff.hcOverridden ? `<span class="text-xs text-slate-400 line-through block">${escapeHTML(eff.origHC || 'None')}</span>` : ''}
            <span class="font-bold text-slate-900 text-sm block">${escapeHTML(eff.hc) || 'None'}</span>
          </div>
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">COMPANION</span>
            ${eff.compOverridden ? `<span class="text-xs text-slate-400 line-through block">${escapeHTML(eff.origCompName || 'None')}</span>` : ''}
            <span class="font-bold text-slate-900 text-sm block">${escapeHTML(eff.compName) || 'None'}</span>
            ${eff.compRole && eff.compRole !== eff.compName ? `<span class="text-[11px] text-slate-500 font-medium">(${escapeHTML(eff.compRole)})</span>` : ''}
          </div>
        </div>
      </div>

      ${renderThemeDrawer(month)}
    `;

    container.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'All months for this ward are in the past. Enable "Show Past Months" to view them.');
  }
}

// Month View (Dark Hero Theme Banner + Units Grid)
function renderMonthView(container) {
  const selectedMonth = currentSelection;
  const themeData = THEMES[selectedMonth] || { theme: '', talks: [] };
  const isPast = isMonthPast(selectedMonth);

  const themeBanner = document.createElement('div');
  themeBanner.className = 'bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-2xl p-6 shadow-md border border-slate-800 space-y-4';
  themeBanner.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-2">
      <span class="text-xs font-extrabold tracking-wider uppercase text-sky-300">MONTHLY THEME & STUDY MATERIALS</span>
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

  const unitsGrid = document.createElement('div');
  unitsGrid.className = 'space-y-3 pt-2';

  WARDS.forEach(w => {
    const eff = getEffectiveAssignment(w.name, selectedMonth);
    const notesList = [
      eff.hcNote ? `HC: ${eff.hcNote}` : '',
      eff.compNote ? `Comp: ${eff.compNote}` : '',
      ...eff.generalNotes
    ];

    const item = document.createElement('div');
    item.className = 'bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4';
    item.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-extrabold text-base text-slate-900">${escapeHTML(w.name)}</span>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/70">
            ${w.time || '10:00 AM'}
          </span>
          ${(eff.hcOverridden || eff.compOverridden || eff.generalNotes.length > 0) ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Swapped / Updated</span>' : ''}
        </div>
        <div class="text-xs text-slate-500">
          📍 ${escapeHTML(w.building)} • ${escapeHTML(w.address)}
        </div>
        ${renderOverrideBanner(notesList)}
      </div>

      <div class="flex items-center gap-4 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
        <div class="min-w-[120px]">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">HIGH COUNCIL</span>
          ${eff.hcOverridden ? `<span class="text-xs text-slate-400 line-through block">${escapeHTML(eff.origHC || 'None')}</span>` : ''}
          <span class="font-bold text-slate-900 text-sm block">${escapeHTML(eff.hc) || 'Unassigned'}</span>
        </div>
        <div class="min-w-[120px]">
          <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">COMPANION</span>
          ${eff.compOverridden ? `<span class="text-xs text-slate-400 line-through block">${escapeHTML(eff.origCompName || 'None')}</span>` : ''}
          <span class="font-bold text-slate-900 text-sm block">${escapeHTML(eff.compName) || 'None'}</span>
          ${eff.compRole && eff.compRole !== eff.compName ? `<span class="text-[10px] text-slate-500 font-medium">(${escapeHTML(eff.compRole)})</span>` : ''}
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
        orgMeta.roles.forEach(role => {
          Object.keys(COMP_SCHEDULE_GRID).forEach(wName => {
            if (COMP_SCHEDULE_GRID[wName][m] === role) {
              const ward = getWardInfo(wName);
              const hc = HC_SCHEDULE_GRID[wName] ? HC_SCHEDULE_GRID[wName][m] : 'Unassigned';
              entries.push(`  • ${role} (${COMPANION_ROLES[role] || role}) -> ${ward.name} at ${ward.time} (with ${hc})`);
            }
          });
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

function copyToClipboardText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Copy failed', err);
  }
  document.body.removeChild(ta);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toastText');
  if (!toast || !text) return;
  text.textContent = msg;
  toast.classList.remove('-translate-y-24', 'sm:translate-y-24', 'opacity-0');
  setTimeout(() => {
    toast.classList.add('-translate-y-24', 'sm:translate-y-24', 'opacity-0');
  }, 2500);
}

function openGuidelinesModal() {
  document.getElementById('guidelinesModal').classList.remove('hidden');
}
function closeGuidelinesModal() {
  document.getElementById('guidelinesModal').classList.add('hidden');
}

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

async function syncGoogleSheetData() {
  const badge = document.getElementById('statusBadge');
  const badgeText = document.getElementById('statusText');
  const badgeDot = document.getElementById('statusDot');

  try {
    if (badgeText) badgeText.textContent = 'Syncing Google Sheets...';

    // 1. Fetch High Council Roster (gid=0)
    try {
      const raw = await fetchPublishedTab(TAB_GIDS.HC_ROSTER, ['High Council']);
      const rows = parseCSV(raw).slice(1);
      const list = [];
      rows.forEach((r, idx) => {
        const name = r[1] ? r[1].trim() : (r[0] ? r[0].trim() : '');
        if (name && name.length < 35 && !name.toLowerCase().includes('speaking')) {
          list.push({ id: idx + 1, name: name });
        }
      });
      if (list.length > 0) HIGH_COUNCIL = list;
    } catch (e) {
      console.warn('High Council roster fallback warning:', e);
    }

    // 2. Fetch Wards directory (gid=1) - Single source of truth for times
    try {
      const raw = await fetchPublishedTab(TAB_GIDS.WARDS, ['Wards']);
      const rows = parseCSV(raw).slice(1);
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
      if (list.length > 0) WARDS = list;
    } catch (e) {
      console.warn('Wards directory fallback warning:', e);
    }

    // 3. Fetch Companion Roles
    try {
      const raw = await fetchPublishedTab(TAB_GIDS.COMPANION_ROLES, ['Companion Speakers', 'Companion Roles']);
      const rows = parseCSV(raw).slice(1);
      const dict = {};
      rows.forEach(r => {
        const role = r[0] ? r[0].trim() : '';
        const name = r[1] ? r[1].trim() : '';
        if (role) dict[role] = name;
      });
      if (Object.keys(dict).length > 0) COMPANION_ROLES = dict;
    } catch (e) {
      console.warn('Companion Roles tab fetch warning:', e);
    }

    // 4. Fetch Themes & Talks (gid=2 & gid=3)
    try {
      const rawThemes = await fetchPublishedTab(TAB_GIDS.THEMES, ['Themes']);
      const themeRows = parseCSV(rawThemes).slice(1);
      themeRows.forEach(r => {
        const m = r[0] ? r[0].trim() : '';
        const t = r[1] ? r[1].trim() : '';
        if (m && MONTHS.includes(m)) {
          if (!THEMES[m]) THEMES[m] = { theme: '', talks: [] };
          THEMES[m].theme = t;
        }
      });
    } catch (e) {
      console.warn('Themes fetch warning:', e);
    }

    try {
      const rawTalks = await fetchPublishedTab(TAB_GIDS.TALKS, ['Talks']);
      const talkRows = parseCSV(rawTalks).slice(1);
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
    } catch (e) {
      console.warn('Talks fetch warning:', e);
    }

    // 5. Fetch High Council Schedule Grid (gid=208333913)
    try {
      const raw = await fetchPublishedTab(TAB_GIDS.HC_SCHEDULE, ['Schedule', 'High Council Schedule']);
      const rows = parseCSV(raw);
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
        if (Object.keys(newGrid).length > 0) HC_SCHEDULE_GRID = newGrid;
      }
    } catch (e) {
      console.warn('High Council schedule grid warning:', e);
    }

    // 6. Fetch Companion Schedule Grid (gid=437508687)
    try {
      const raw = await fetchPublishedTab(TAB_GIDS.COMP_SCHEDULE, ['Companion Schedule']);
      const rows = parseCSV(raw);
      if (rows.length > 1) {
        const header = rows[0].map(h => h.trim());
        const monthIndices = {};
        MONTHS.forEach(m => {
          const colIdx = header.findIndex(h => h.toLowerCase() === m.toLowerCase());
          if (colIdx !== -1) monthIndices[m] = colIdx;
        });

        // Dynamically locate Role and Name summary columns by header name
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

          // Capture Role -> Name mapping from summary columns on the right
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
        if (Object.keys(newGrid).length > 0) COMP_SCHEDULE_GRID = newGrid;
      }
    } catch (e) {
      console.warn('Companion schedule grid warning:', e);
    }

    // 7. Fetch Overrides Tab (Optional - matches by sheet name 'Overrides')
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${WEB_SOURCE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Overrides')}`;
      const res = await fetch(gvizUrl);
      if (res.ok) {
        const raw = await res.text();
        const rows = parseCSV(raw);
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
    } catch (e) {
      // Overrides tab is optional; skip silently if not yet created
    }

    isDataLoaded = true;
    populateDropdown();
    renderCards();

    if (badge) {
      badge.className = 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs transition-all';
    }
    if (badgeText) badgeText.textContent = 'Live Google Sheet Connected';
    if (badgeDot) badgeDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
  } catch (err) {
    console.error('Google Sheet sync error:', err);
    isDataLoaded = true;
    if (badge) {
      badge.className = 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs transition-all';
    }
    if (badgeText) badgeText.textContent = 'Connection Error';
    if (badgeDot) badgeDot.className = 'w-2 h-2 rounded-full bg-rose-500';
    renderCards();
  }
}

// -------------------------------------------------------------
// Application Initialization
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  renderCards(); // Shows loading skeleton while empty
  syncGoogleSheetData();
});
