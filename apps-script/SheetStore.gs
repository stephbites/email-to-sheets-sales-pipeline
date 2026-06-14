/**
 * SheetStore.gs
 * --------------------------------------------------------------------------
 * Writes the day's figures into the wide "Sales Plan" sheet:
 *   - finds the row whose column A matches the report date,
 *   - writes COL_TOTAL = the MAIN table total (sum of its sub-channels),
 *   - writes each mapped region (REGION_MAP) into its amount/orders columns.
 *
 * Values used: current-year, day figures (amount_day_cy / orders_day_cy).
 * Region matching is normalization-tolerant (case/accents/spaces/dashes).
 * Idempotent; throws if the date row does not exist (never invents rows).
 * --------------------------------------------------------------------------
 */

/** @return {{row:number, cells:number}} */
function writeToPlan_(rows, reportDateISO) {
  const sh = getPlanSheet_();
  const target = isoToDdMmYyyy_(reportDateISO);
  const row = findRowByDate_(sh, target);
  if (row === -1) {
    throw new Error('Date ' + target + ' not found in column A of the Sales Plan.');
  }

  const writes = [];

  // MAIN total -> COL_TOTAL
  const main = rows.filter(function (r) { return r.table === 'MAIN'; });
  const sumAmount = main.reduce(function (a, r) { return a + (Number(r.amount_day_cy) || 0); }, 0);
  const sumOrders = main.reduce(function (a, r) { return a + (Number(r.orders_day_cy) || 0); }, 0);
  writes.push({ col: COL_TOTAL.amount, value: round2_(sumAmount) });
  writes.push({ col: COL_TOTAL.orders, value: sumOrders });

  // Mapped regions
  rows.forEach(function (r) {
    const m = columnsForSubChannel_(r.sub_channel);
    if (!m) return;
    writes.push({ col: m.amount, value: Number(r.amount_day_cy) || 0 });
    writes.push({ col: m.orders, value: Number(r.orders_day_cy) || 0 });
  });

  writes.forEach(function (w) { sh.getRange(w.col + row).setValue(w.value); });
  return { row: row, cells: writes.length };
}

/** Region columns for a sub-channel, tolerant to formatting differences. */
function columnsForSubChannel_(subChannel) {
  const target = normalizeKey_(subChannel);
  const keys = Object.keys(REGION_MAP);
  for (let i = 0; i < keys.length; i++) {
    if (normalizeKey_(keys[i]) === target) return REGION_MAP[keys[i]];
  }
  return null;
}

/** 'WEB - RIVERPORT' / 'web–riverport' -> 'WEBRIVERPORT'. */
function normalizeKey_(s) {
  return String(s).toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, '');
}

function findRowByDate_(sh, target) {
  const start = CONFIG.PLAN_FIRST_ROW;
  const last = sh.getLastRow();
  const n = last - start + 1;
  if (n <= 0) return -1;
  const vals = sh.getRange(start, 1, n, 1).getDisplayValues();
  for (let i = 0; i < vals.length; i++) {
    if (normalizeDate_(vals[i][0]) === target) return start + i;
  }
  return -1;
}

function getPlanSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.PLAN_SPREADSHEET_ID);
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === CONFIG.PLAN_GID) return sheets[i];
  }
  throw new Error('Sales Plan tab gid ' + CONFIG.PLAN_GID + ' not found.');
}

/** '2026-06-12' -> '12/06/2026'. */
function isoToDdMmYyyy_(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? (m[3] + '/' + m[2] + '/' + m[1]) : String(iso);
}

/** '1/6/2026' or '01/06/2026' -> '01/06/2026'. */
function normalizeDate_(s) {
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return String(s).trim();
  return ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2) + '/' + m[3];
}

function round2_(n) { return Math.round(n * 100) / 100; }
