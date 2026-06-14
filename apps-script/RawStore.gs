/**
 * RawStore.gs
 * --------------------------------------------------------------------------
 * Append-only history (RAW_SALES, long format) + a run log.
 *
 * Dedup key = report_date · table · channel · sub_channel.
 * If the key already exists, the row is NOT inserted again — so re-runs and
 * reprocessing never double-count.
 * --------------------------------------------------------------------------
 */

const RAW_HEADERS = [
  'report_date', 'table', 'channel', 'sub_channel',
  'orders_day_py', 'orders_day_cy', 'orders_mtd_py', 'orders_mtd_cy',
  'amount_day_py', 'amount_day_cy', 'amount_mtd_py', 'amount_mtd_cy',
  'key', 'inserted_at',
];

const LOG_HEADERS = ['timestamp', 'status', 'message', 'report_date', 'inserted', 'duplicated'];

/** @return {{inserted:number, duplicated:number}} */
function appendRawRows_(rows) {
  const sh = getOrCreateSheet_(CONFIG.RAW_SHEET, RAW_HEADERS);
  const keyCol = RAW_HEADERS.indexOf('key') + 1;

  const seen = new Set();
  const last = sh.getLastRow();
  if (last > 1) {
    sh.getRange(2, keyCol, last - 1, 1).getValues()
      .forEach(function (r) { seen.add(String(r[0])); });
  }

  const at = now_();
  const fresh = [];
  let duplicated = 0;
  rows.forEach(function (r) {
    const key = rowKey_(r);
    if (seen.has(key)) { duplicated++; return; }
    seen.add(key);
    fresh.push(rawRowToArray_(r, key, at));
  });

  if (fresh.length) {
    sh.getRange(sh.getLastRow() + 1, 1, fresh.length, RAW_HEADERS.length).setValues(fresh);
  }
  return { inserted: fresh.length, duplicated: duplicated };
}

function rowKey_(r) {
  return [r.report_date, r.table, r.channel, r.sub_channel].join(' || ');
}

function rawRowToArray_(r, key, at) {
  return [
    r.report_date, r.table, r.channel, r.sub_channel,
    r.orders_day_py, r.orders_day_cy, r.orders_mtd_py, r.orders_mtd_cy,
    r.amount_day_py, r.amount_day_cy, r.amount_mtd_py, r.amount_mtd_cy,
    key, at,
  ];
}

/** Always called (OK / NO_EMAIL / NO_DATA / ERROR). */
function logRun_(status, message, data) {
  data = data || {};
  const sh = getOrCreateSheet_(CONFIG.LOG_SHEET, LOG_HEADERS);
  sh.appendRow([
    now_(), status, message || '', data.report_date || '',
    data.inserted == null ? '' : data.inserted,
    data.duplicated == null ? '' : data.duplicated,
  ]);
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function now_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}
