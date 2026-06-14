/**
 * Main.gs
 * --------------------------------------------------------------------------
 * Orchestration + scheduling.
 *
 *   runPipeline()        daily flow (fired by the trigger)
 *   createDailyTrigger() run once to schedule the 7 AM trigger
 *   backfill(window)     reprocess recent emails (safe: dedup)
 *
 * Run states: OK | NO_EMAIL | NO_DATA | ERROR
 * --------------------------------------------------------------------------
 */

function runPipeline() {
  try {
    const msg = latestEmail_();
    if (!msg) {
      logRun_('NO_EMAIL', 'No email found. Query: ' + buildGmailQuery_());
      notifyChat_('🟡 *E-commerce Sales*: no sales email arrived today.');
      return;
    }

    const res = processMessage_(msg);
    const dateDM = isoToDdMmYyyy_(res.report_date);

    if (!res.ok) {
      notifyChat_('🔴 *E-commerce Sales ' + dateDM +
        '*: email arrived but data could not be read. Check the format.');
      return;
    }
    if (res.plan && res.plan.indexOf('ERROR') !== -1) {
      notifyChat_('🔴 *E-commerce Sales ' + dateDM +
        '*: failed to update the Sales Plan. ' + res.plan);
      return;
    }

    notifyChat_('✅ *E-commerce Sales ' + dateDM +
      '* updated in the Sales Plan.\n' +
      '💰 MAIN total: ' + fmtAmount_(res.totalAmount) +
      '   |   🛒 ' + res.totalOrders + ' orders');

  } catch (e) {
    logRun_('ERROR', String(e && e.message ? e.message : e));
    notifyChat_('🔴 *E-commerce Sales*: ERROR — ' + (e && e.message ? e.message : e));
    throw e;
  }
}

function processMessage_(msg) {
  const date = reportDateFromSubject_(msg.getSubject());
  if (!date) {
    logRun_('ERROR', 'Could not read date from subject: ' + msg.getSubject());
    return { report_date: '', ok: false };
  }

  const rows = parseEmail_(msg.getBody(), date);
  if (rows.length === 0) {
    logRun_('NO_DATA', 'Email arrived but no rows parsed.', { report_date: date });
    return { report_date: date, ok: false };
  }

  const res = appendRawRows_(rows);

  let planMsg;
  try {
    const w = writeToPlan_(rows, date);
    planMsg = 'Plan: row ' + w.row + ' (' + w.cells + ' cells).';
  } catch (e) {
    planMsg = 'Plan ERROR: ' + (e && e.message ? e.message : e);
  }

  const main = rows.filter(function (r) { return r.table === 'MAIN'; });
  const totalAmount = main.reduce(function (a, r) { return a + (Number(r.amount_day_cy) || 0); }, 0);
  const totalOrders = main.reduce(function (a, r) { return a + (Number(r.orders_day_cy) || 0); }, 0);

  logRun_('OK', 'Processed. ' + planMsg, {
    report_date: date, inserted: res.inserted, duplicated: res.duplicated,
  });

  return {
    report_date: date, ok: true, plan: planMsg,
    inserted: res.inserted, duplicated: res.duplicated,
    totalAmount: round2_(totalAmount), totalOrders: totalOrders,
  };
}

/** 27037.9 -> 'S/. 27,037.90'. */
function fmtAmount_(n) {
  return 'S/. ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function latestEmail_() {
  const threads = GmailApp.search(buildGmailQuery_(), 0, 5);
  if (!threads || threads.length === 0) return null;
  const messages = threads[0].getMessages();
  return messages[messages.length - 1];
}

/** Backfill: reprocess a window of emails (dedup keeps it safe). */
function backfill(window) {
  const threads = GmailApp.search(buildGmailQuery_(window || 'newer_than:15d'), 0, 50);
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      if (msg.getSubject().indexOf(CONFIG.EMAIL_SUBJECT) === -1) return;
      processMessage_(msg);
    });
  });
  Logger.log('Backfill done.');
}

/** Schedule the daily 7 AM trigger. Run once. */
function createDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runPipeline') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runPipeline').timeBased().everyDays(1).atHour(7).create();
  Logger.log('Daily trigger created (7 AM).');
}
