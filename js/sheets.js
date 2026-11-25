import { MONTHS, state, hasAnyScheduleData, saveCachedSheetData } from './state.js';

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

export async function syncGoogleSheetData({ manual = false, setStatusBadge, showToast, onDataReady } = {}) {
  if (state.isSyncing) return;
  state.isSyncing = true;

  const hadExistingData = hasAnyScheduleData();
  if (setStatusBadge) {
    setStatusBadge('loading', hadExistingData ? 'Refreshing Schedule...' : 'Syncing Google Sheets...');
  }

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
        state.highCouncil = list;
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
        state.wards = list;
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
        state.companionRoles = dict;
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
          if (!state.themes[m]) state.themes[m] = { theme: '', talks: [] };
          state.themes[m].theme = t;
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
        if (!state.themes[m]) state.themes[m] = { theme: '', talks: [] };
        state.themes[m].talks = monthTalks[m];
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
          state.hcScheduleGrid = newGrid;
          coreSuccessCount++;
        }
      }
    } else {
      console.warn('High Council schedule grid warning:', hcScheduleRes.reason);
    }

    // 6. Parse Companion Schedule Grid (uses parsed wards above)
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
          if (wardName && state.wards.some(w => w.name.toLowerCase() === wardName.toLowerCase())) {
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
            if (rKey && rName && rKey.toUpperCase() !== 'TOTAL' && !state.companionRoles[rKey]) {
              state.companionRoles[rKey] = rName;
            }
          }
        });
        if (Object.keys(newGrid).length > 0) {
          state.compScheduleGrid = newGrid;
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
          state.overrides = parsedOverrides;
        }
      }
    }

    state.isDataLoaded = true;

    if (coreSuccessCount === 0) {
      state.lastSyncError = true;
      if (hasAnyScheduleData()) {
        if (setStatusBadge) setStatusBadge('warn', 'Offline · Showing Cached Schedule');
        if (manual && showToast) showToast('Offline — showing cached schedule');
      } else if (setStatusBadge) {
        setStatusBadge('error', 'Connection Error · Tap to Retry');
      }
    } else {
      state.lastSyncError = false;
      saveCachedSheetData();
      if (setStatusBadge) {
        if (coreSuccessCount === coreTotal) {
          setStatusBadge('live', 'Live Google Sheet Connected');
        } else {
          setStatusBadge('warn', 'Partially Synced · Tap to Refresh');
        }
      }
      if (manual && showToast) showToast('Schedule refreshed from Google Sheets');
    }

    if (onDataReady) onDataReady();
  } catch (err) {
    console.error('Google Sheet sync error:', err);
    state.isDataLoaded = true;
    state.lastSyncError = true;
    if (setStatusBadge) {
      if (hasAnyScheduleData()) {
        setStatusBadge('warn', 'Offline · Showing Cached Schedule');
      } else {
        setStatusBadge('error', 'Connection Error · Tap to Retry');
      }
    }
    if (onDataReady) onDataReady({ errorOnly: true });
  } finally {
    state.isSyncing = false;
  }
}
