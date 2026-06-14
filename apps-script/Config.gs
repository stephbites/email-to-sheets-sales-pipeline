/**
 * Config.gs
 * --------------------------------------------------------------------------
 * Single place for every parameter you may need to change.
 * (Anonymized portfolio version — fill in real IDs for a real deployment.)
 * --------------------------------------------------------------------------
 */

const CONFIG = {
  // --- Gmail search -----------------------------------------------------
  EMAIL_SUBJECT: 'DAILY ECOMMERCE SALES SUMMARY',  // stable part of the subject
  EMAIL_SENDER: '',                                // optional: from:(domain)
  EMAIL_WINDOW: 'newer_than:2d',                   // only recent mail

  // --- Storage sheets (in the bound spreadsheet) ------------------------
  RAW_SHEET: 'RAW_SALES',     // append-only long-format history
  LOG_SHEET: 'Run_Log',       // one line per run
  DEBUG_SHEET: 'DEBUG_HTML',  // used by Explorer.gs only

  // --- Wide "Sales Plan" sheet (a separate spreadsheet) -----------------
  PLAN_SPREADSHEET_ID: 'YOUR_PLAN_SPREADSHEET_ID',
  PLAN_GID: 0,                // the specific tab (gid from the URL)
  PLAN_FIRST_ROW: 8,          // first data row (dates live in column A)

  // --- Google Chat ------------------------------------------------------
  CHAT_WEBHOOK_URL: '',       // empty => notifications are skipped (safe)

  TIMEZONE: 'America/Lima',
};

/**
 * Region -> columns in the wide "Sales Plan" sheet.
 * { amount: <revenue column>, orders: <order-count column> }
 * Matched case/accent/space-insensitively (see SheetStore.gs).
 */
const REGION_MAP = {
  'WEB - RIVERPORT': { amount: 'D', orders: 'E' },
  'WEB - HILLCREST': { amount: 'F', orders: 'G' },
  'WEB - LAKEVIEW':  { amount: 'H', orders: 'I' },
  'WEB - SUNDALE':   { amount: 'J', orders: 'K' },
};

/** Columns B,C hold the TOTAL of the MAIN table (sum of all its sub-channels). */
const COL_TOTAL = { amount: 'B', orders: 'C' };

/** Builds the Gmail search query from CONFIG. */
function buildGmailQuery_(windowOverride) {
  let q = 'subject:"' + CONFIG.EMAIL_SUBJECT + '"';
  if (CONFIG.EMAIL_SENDER) q += ' from:(' + CONFIG.EMAIL_SENDER + ')';
  q += ' ' + (windowOverride || CONFIG.EMAIL_WINDOW);
  return q;
}
