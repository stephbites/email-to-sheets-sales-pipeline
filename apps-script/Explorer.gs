/**
 * Explorer.gs
 * --------------------------------------------------------------------------
 * One-time helper (NOT part of the daily flow).
 *
 * Dumps the latest matching email's raw HTML into a DEBUG_HTML sheet so you
 * can tune the parser and the column map to the REAL structure instead of
 * guessing. Run `dumpEmailHtml` once, then read the DEBUG_HTML tab.
 * --------------------------------------------------------------------------
 */
function dumpEmailHtml() {
  const threads = GmailApp.search(buildGmailQuery_('newer_than:30d'), 0, 5);
  if (!threads || threads.length === 0) {
    throw new Error('No matching email. Check EMAIL_SUBJECT/EMAIL_SENDER in Config.gs.');
  }
  const messages = threads[0].getMessages();
  const msg = messages[messages.length - 1];
  const html = msg.getBody();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.DEBUG_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.DEBUG_SHEET);
  sh.clear();
  sh.getRange('A1').setValue('Subject:'); sh.getRange('B1').setValue(msg.getSubject());
  sh.getRange('A2').setValue('Date:'); sh.getRange('B2').setValue(msg.getDate());
  sh.getRange('A3').setValue('Length:'); sh.getRange('B3').setValue(html.length);

  // A cell holds ~50k chars; split if longer.
  const CHUNK = 45000;
  for (let i = 0, row = 5; i < html.length; i += CHUNK, row++) {
    sh.getRange(row, 1).setValue(html.substring(i, i + CHUNK));
  }
  Logger.log('Dumped ' + html.length + ' chars into "' + CONFIG.DEBUG_SHEET + '".');
}
