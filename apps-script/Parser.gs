/**
 * Parser.gs
 * --------------------------------------------------------------------------
 * Turns the email's HTML tables into structured rows (long format).
 *
 * Robust strategy: instead of counting columns from the LEFT (where the first
 * row of each group carries an extra rowspan label cell), it counts FROM THE
 * RIGHT — the last 8 cells are the values, the one before is the sub-channel,
 * and the one before that is the channel. Headers (non-numeric) and "Total"
 * rows are skipped automatically.
 * --------------------------------------------------------------------------
 */

/**
 * @param {string} html  email body (HTML)
 * @param {string} reportDateISO  'YYYY-MM-DD'
 * @return {Array<Object>} one object per (date, table, channel, sub_channel)
 */
function parseEmail_(html, reportDateISO) {
  const rows = [];
  extractTables_(html).forEach(function (t) {
    const trs = t.html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    trs.forEach(function (tr) {
      const cells = extractCells_(tr);
      if (cells.length < 10) return;          // not a data row
      if (isTotalRow_(cells)) return;          // skip "Total"
      const v = cells.slice(-8);
      if (!v.every(isNumeric_)) return;        // skip header rows
      rows.push({
        report_date: reportDateISO,
        table: t.title,
        channel: cells[cells.length - 10],
        sub_channel: cells[cells.length - 9],
        orders_day_py: toInt_(v[0]), orders_day_cy: toInt_(v[1]),
        orders_mtd_py: toInt_(v[2]), orders_mtd_cy: toInt_(v[3]),
        amount_day_py: toFloat_(v[4]), amount_day_cy: toFloat_(v[5]),
        amount_mtd_py: toFloat_(v[6]), amount_mtd_cy: toFloat_(v[7]),
      });
    });
  });
  return rows;
}

/** Each <table> with its title (text of the first cell). */
function extractTables_(html) {
  const tables = [];
  const re = /<table[\s\S]*?<\/table>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const block = m[0];
    const td = block.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    tables.push({ title: td ? plainText_(td[1]) : '', html: block });
  }
  return tables;
}

/** Plain text of every <td> in a <tr>. */
function extractCells_(trHtml) {
  const cells = [];
  const re = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let m;
  while ((m = re.exec(trHtml)) !== null) cells.push(plainText_(m[1]));
  return cells;
}

/** Strip tags and normalize whitespace/entities. */
function plainText_(s) {
  return String(s)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTotalRow_(cells) {
  return cells.some(function (c) { return c.trim().toLowerCase() === 'total'; });
}

function isNumeric_(s) {
  return /^-?\d+(\.\d+)?$/.test(String(s).replace(/,/g, '').trim());
}

function toInt_(s) { return parseInt(String(s).replace(/,/g, '').trim(), 10); }
function toFloat_(s) { return parseFloat(String(s).replace(/,/g, '').trim()); }

/** '... (12/06/2026)' -> '2026-06-12' (subject date is dd/mm/yyyy). */
function reportDateFromSubject_(subject) {
  const m = String(subject).match(/\((\d{1,2})\/(\d{1,2})\/(\d{4})\)/);
  if (!m) return null;
  return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}
