import {
  MONTHS,
  ORG_DEFINITIONS,
  state,
  getWardInfo,
  isMonthPast,
  isCurrentMonth,
  getEffectiveAssignment,
  hasAnyScheduleData,
  escapeHTML
} from './state.js';

const MAP_PIN_SVG = '<svg class="w-3.5 h-3.5 text-rose-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>';

// -------------------------------------------------------------
// Shared Card & Drawer Helpers
// -------------------------------------------------------------
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

function renderEntityLink(label, tabKey, targetValue, extraClasses = '') {
  if (!label) return '';
  if (!targetValue) return `<span class="${extraClasses}">${escapeHTML(label)}</span>`;
  return `<button type="button" data-nav-tab="${escapeHTML(tabKey)}" data-nav-value="${escapeHTML(targetValue)}" class="text-left hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2 transition-colors cursor-pointer ${extraClasses}">${escapeHTML(label)}</button>`;
}

function canNavigateToHighCouncil(name) {
  if (!name) return false;
  return state.highCouncil.some(hc => hc.name.toLowerCase() === name.toLowerCase());
}

function canNavigateToCompanionRole(role) {
  if (!role) return false;
  return Object.keys(state.companionRoles).some(r => r.toLowerCase() === role.toLowerCase());
}

function canNavigateToWard(wardName) {
  if (!wardName) return false;
  return state.wards.some(w => w.name.toLowerCase() === wardName.toLowerCase());
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
  const themeData = state.themes[month] || { theme: '', talks: [] };
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

function renderEmptyState(container, msg) {
  container.innerHTML = `
    <div class="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500 space-y-2">
      <svg class="w-10 h-10 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      <p class="text-sm font-semibold text-slate-700">No speaking assignments to show</p>
      <p class="text-xs text-slate-400 max-w-sm mx-auto">${msg}</p>
    </div>`;
}

// -------------------------------------------------------------
// Main View Dispatcher & Loading Skeleton
// -------------------------------------------------------------
export function renderCards() {
  const container = document.getElementById('scheduleFeed');
  if (!container) return;

  if (!state.isDataLoaded) {
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

  if (state.lastSyncError && !hasAnyScheduleData()) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-10 text-center border border-rose-200 text-slate-600 space-y-3 shadow-sm">
        <svg class="w-10 h-10 mx-auto text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <p class="text-sm font-bold text-slate-800">Unable to load schedule from Google Sheets</p>
        <p class="text-xs text-slate-500 max-w-sm mx-auto">Check your internet connection and try again.</p>
        <button type="button" data-action="retry-sync" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-sm active:scale-95">
          Try Again
        </button>
      </div>`;
    return;
  }

  if (state.currentTab === 'highCouncil') {
    renderHighCouncilView(container);
  } else if (state.currentTab === 'companion') {
    if (state.currentSelection && state.currentSelection.startsWith('ORG_')) {
      renderCompanionOrgView(container);
    } else {
      renderCompanionIndividualView(container);
    }
  } else if (state.currentTab === 'ward') {
    renderWardView(container);
  } else if (state.currentTab === 'month') {
    renderMonthView(container);
  }
}

// -------------------------------------------------------------
// View Renderers
// -------------------------------------------------------------
function renderHighCouncilView(container) {
  const speakerName = state.currentSelection;
  let renderedCount = 0;
  let activeCount = 0;
  let nextAssignment = null;
  const fragment = document.createDocumentFragment();

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    const isCurrent = isCurrentMonth(month);
    if (isPast && !state.showPastMonths) return;

    let matchedWard = null;
    let effective = null;
    let isRelieved = false;

    Object.keys(state.hcScheduleGrid).forEach(wName => {
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
    if (isOff && !state.showOffMonths) return;
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

        ${renderThemeDrawer(month, { defaultOpen: isCurrent })}
      `;
    }

    fragment.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'No assignments found matching the current filters. Try enabling "Past Months" or "Off Months".');
    return;
  }

  const countLabel = `${activeCount} ${state.showPastMonths ? 'total' : 'upcoming'} assignment${activeCount === 1 ? '' : 's'}`;
  const nextLabel = nextAssignment ? `Next: ${nextAssignment.month} — ${nextAssignment.wardName} (${nextAssignment.time})` : '';
  renderSummaryStrip(container, countLabel, nextLabel);
  container.appendChild(fragment);
}

function renderCompanionIndividualView(container) {
  const roleKey = state.currentSelection;
  const personName = state.companionRoles[roleKey] || '';
  let renderedCount = 0;
  let activeCount = 0;
  let nextAssignment = null;
  const fragment = document.createDocumentFragment();

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    const isCurrent = isCurrentMonth(month);
    if (isPast && !state.showPastMonths) return;

    let matchedWard = null;
    let effective = null;
    let isRelieved = false;

    Object.keys(state.compScheduleGrid).forEach(wName => {
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
    if (isOff && !state.showOffMonths) return;
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

        ${renderThemeDrawer(month, { defaultOpen: isCurrent })}
      `;
    }

    fragment.appendChild(card);
  });

  if (renderedCount === 0) {
    renderEmptyState(container, 'No assignments found matching the current filters. Try enabling "Past Months" or "Off Months".');
    return;
  }

  const countLabel = `${activeCount} ${state.showPastMonths ? 'total' : 'upcoming'} assignment${activeCount === 1 ? '' : 's'}`;
  const nextLabel = nextAssignment ? `Next: ${nextAssignment.month} — ${nextAssignment.wardName} (${nextAssignment.time})` : '';
  renderSummaryStrip(container, countLabel, nextLabel);
  container.appendChild(fragment);
}

function renderCompanionOrgView(container) {
  const orgMeta = ORG_DEFINITIONS[state.currentSelection];
  if (!orgMeta) return;

  let renderedCount = 0;
  let totalSpeakers = 0;
  const fragment = document.createDocumentFragment();

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    const isCurrent = isCurrentMonth(month);
    if (isPast && !state.showPastMonths) return;

    const assignments = [];
    Object.keys(state.compScheduleGrid).forEach(wName => {
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
          wardInfo,
          hcSpeaker: eff.hc
        });
      }
    });

    if (assignments.length === 0 && !state.showOffMonths) return;
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

  renderSummaryStrip(container, `${totalSpeakers} ${state.showPastMonths ? 'total' : 'upcoming'} speaking assignment${totalSpeakers === 1 ? '' : 's'} across ${orgMeta.name}`);
  container.appendChild(fragment);
}

function renderWardView(container) {
  const wardName = state.currentSelection;
  const wardInfo = getWardInfo(wardName);
  let renderedCount = 0;
  const fragment = document.createDocumentFragment();

  MONTHS.forEach(month => {
    const isPast = isMonthPast(month);
    const isCurrent = isCurrentMonth(month);
    if (isPast && !state.showPastMonths) return;
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

  renderSummaryStrip(container, `${renderedCount} ${state.showPastMonths ? 'total' : 'upcoming'} month${renderedCount === 1 ? '' : 's'} for ${wardInfo.name}`, wardInfo.time ? `Sacrament Meeting: ${wardInfo.time}` : '');
  container.appendChild(fragment);
}

function renderMonthView(container) {
  const selectedMonth = state.currentSelection;
  const themeData = state.themes[selectedMonth] || { theme: '', talks: [] };
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

  renderSummaryStrip(container, `${state.wards.length} unit${state.wards.length === 1 ? '' : 's'} scheduled for ${selectedMonth}`, 'Tap any ward or speaker to view their full schedule');

  const unitsGrid = document.createElement('div');
  unitsGrid.className = 'space-y-3';

  state.wards.forEach(w => {
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
