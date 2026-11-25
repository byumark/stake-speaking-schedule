import {
  MONTHS,
  ORG_DEFINITIONS,
  state,
  getWardInfo,
  isMonthPast,
  getEffectiveAssignment,
  syncUrlParams
} from './state.js';

// -------------------------------------------------------------
// Clipboard & Native Share Helpers
// -------------------------------------------------------------
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

export async function copyScheduleToClipboard(showToast) {
  const lines = [];
  const timestamp = new Date().toLocaleDateString();

  if (state.currentTab === 'highCouncil') {
    const hc = state.currentSelection;
    lines.push(`Speaking Schedule for ${hc} (Generated ${timestamp})`);
    lines.push('----------------------------------------');
    MONTHS.forEach(m => {
      const isPast = isMonthPast(m);
      if (isPast && !state.showPastMonths) return;

      let assignedWard = null;
      let effective = null;
      Object.keys(state.hcScheduleGrid).forEach(wName => {
        const eff = getEffectiveAssignment(wName, m);
        if (eff.hc === hc) {
          assignedWard = wName;
          effective = eff;
        }
      });

      if (!assignedWard) {
        if (state.showOffMonths) lines.push(`${m}: Off Month ${isPast ? '[Past]' : ''}`);
        return;
      }

      const ward = getWardInfo(assignedWard);
      const theme = state.themes[m] ? state.themes[m].theme : '';

      lines.push(`${m}${isPast ? ' [Past]' : ''}: ${ward.name} (${ward.time || '10:00 AM'})${effective.hcOverridden ? ` [Sub for ${effective.origHC}]` : ''}`);
      lines.push(`  Building: ${ward.building} (${ward.address})`);
      lines.push(`  Speaking With: ${effective.compName || 'None'}${effective.compRole && effective.compRole !== effective.compName ? ` [${effective.compRole}]` : ''}`);
      if (theme) lines.push(`  Theme: "${theme}"`);
      lines.push('');
    });
  } else if (state.currentTab === 'companion') {
    if (state.currentSelection.startsWith('ORG_')) {
      const orgMeta = ORG_DEFINITIONS[state.currentSelection];
      lines.push(`${orgMeta.name} Presidency Schedule (Generated ${timestamp})`);
      lines.push('----------------------------------------');
      MONTHS.forEach(m => {
        const isPast = isMonthPast(m);
        if (isPast && !state.showPastMonths) return;
        const entries = [];
        Object.keys(state.compScheduleGrid).forEach(wName => {
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
      const role = state.currentSelection;
      const name = state.companionRoles[role] || role;
      lines.push(`Speaking Schedule for ${role} - ${name} (Generated ${timestamp})`);
      lines.push('----------------------------------------');
      MONTHS.forEach(m => {
        const isPast = isMonthPast(m);
        if (isPast && !state.showPastMonths) return;

        let assignedWard = null;
        let effective = null;
        Object.keys(state.compScheduleGrid).forEach(wName => {
          const eff = getEffectiveAssignment(wName, m);
          if (eff.compRole === role) {
            assignedWard = wName;
            effective = eff;
          }
        });

        if (!assignedWard) {
          if (state.showOffMonths) lines.push(`${m}: Off Month ${isPast ? '[Past]' : ''}`);
          return;
        }

        const ward = getWardInfo(assignedWard);
        const theme = state.themes[m] ? state.themes[m].theme : '';

        lines.push(`${m}${isPast ? ' [Past]' : ''}: ${ward.name} (${ward.time || '10:00 AM'})${effective.compOverridden ? ` [Sub for ${effective.origCompName}]` : ''}`);
        lines.push(`  Building: ${ward.building} (${ward.address})`);
        lines.push(`  Speaking With: ${effective.hc || 'None'} (High Council)`);
        if (theme) lines.push(`  Theme: "${theme}"`);
        lines.push('');
      });
    }
  } else if (state.currentTab === 'ward') {
    const wardName = state.currentSelection;
    const ward = getWardInfo(wardName);
    lines.push(`Sacrament Meeting Speaking Schedule: ${ward.name} (Generated ${timestamp})`);
    lines.push(`Building: ${ward.building} (${ward.address}) - Time: ${ward.time}`);
    lines.push('----------------------------------------');
    MONTHS.forEach(m => {
      const isPast = isMonthPast(m);
      if (isPast && !state.showPastMonths) return;
      const eff = getEffectiveAssignment(wardName, m);
      const theme = state.themes[m] ? state.themes[m].theme : '';

      lines.push(`${m}${isPast ? ' [Past]' : ''}:`);
      lines.push(`  High Council: ${eff.hc || 'None'}${eff.hcOverridden ? ` (Replaced ${eff.origHC})` : ''}`);
      lines.push(`  Companion: ${eff.compName || 'None'}${eff.compRole && eff.compRole !== eff.compName ? ` (${eff.compRole})` : ''}${eff.compOverridden ? ` (Replaced ${eff.origCompName})` : ''}`);
      if (theme) lines.push(`  Theme: "${theme}"`);
      lines.push('');
    });
  } else if (state.currentTab === 'month') {
    const m = state.currentSelection;
    const isPast = isMonthPast(m);
    const theme = state.themes[m] ? state.themes[m].theme : '';
    lines.push(`Stake Speaking Itinerary: ${m} ${isPast ? '[Past Month]' : ''} (Generated ${timestamp})`);
    if (theme) lines.push(`Monthly Theme: "${theme}"`);
    lines.push('----------------------------------------');
    state.wards.forEach(w => {
      const eff = getEffectiveAssignment(w.name, m);
      lines.push(`${w.name} (${w.time}) [${w.building}]:`);
      lines.push(`  High Council: ${eff.hc || 'None'}${eff.hcOverridden ? ` (Sub for ${eff.origHC})` : ''} | Companion: ${eff.compName || 'None'}${eff.compOverridden ? ` (Sub for ${eff.origCompName})` : ''}`);
    });
  }

  await copyToClipboardText(lines.join('\n'));
  if (showToast) showToast('Schedule text copied to clipboard!');
}

export async function shareCurrentView(showToast) {
  syncUrlParams();
  const shareUrl = window.location.href;
  const select = document.getElementById('itemSelect');
  const selectedLabel = select && select.selectedOptions && select.selectedOptions[0]
    ? select.selectedOptions[0].textContent
    : state.currentSelection;
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
  if (showToast) showToast('Share link copied to clipboard!');
}
