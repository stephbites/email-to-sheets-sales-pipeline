/**
 * Parser test (Node.js, no dependencies).
 *   node test/parser.test.js
 *
 * Mirrors the pure functions of apps-script/Parser.gs and runs them against
 * the synthetic fixture, asserting the extracted values and the day-total.
 */

// ---- pure functions copied from Parser.gs --------------------------------
function parseEmail_(html, reportDateISO) {
  const rows = [];
  extractTables_(html).forEach(function (t) {
    const trs = t.html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    trs.forEach(function (tr) {
      const cells = extractCells_(tr);
      if (cells.length < 10) return;
      if (isTotalRow_(cells)) return;
      const v = cells.slice(-8);
      if (!v.every(isNumeric_)) return;
      rows.push({
        report_date: reportDateISO, table: t.title,
        channel: cells[cells.length - 10], sub_channel: cells[cells.length - 9],
        orders_day_py: toInt_(v[0]), orders_day_cy: toInt_(v[1]),
        orders_mtd_py: toInt_(v[2]), orders_mtd_cy: toInt_(v[3]),
        amount_day_py: toFloat_(v[4]), amount_day_cy: toFloat_(v[5]),
        amount_mtd_py: toFloat_(v[6]), amount_mtd_cy: toFloat_(v[7]),
      });
    });
  });
  return rows;
}
function extractTables_(html) {
  const tables = []; const re = /<table[\s\S]*?<\/table>/gi; let m;
  while ((m = re.exec(html)) !== null) {
    const block = m[0];
    const td = block.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
    tables.push({ title: td ? plainText_(td[1]) : '', html: block });
  }
  return tables;
}
function extractCells_(trHtml) {
  const cells = []; const re = /<td[^>]*>([\s\S]*?)<\/td>/gi; let m;
  while ((m = re.exec(trHtml)) !== null) cells.push(plainText_(m[1]));
  return cells;
}
function plainText_(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
}
function isTotalRow_(c) { return c.some(function (x) { return x.trim().toLowerCase() === 'total'; }); }
function isNumeric_(s) { return /^-?\d+(\.\d+)?$/.test(String(s).replace(/,/g, '').trim()); }
function toInt_(s) { return parseInt(String(s).replace(/,/g, '').trim(), 10); }
function toFloat_(s) { return parseFloat(String(s).replace(/,/g, '').trim()); }
function reportDateFromSubject_(subject) {
  const m = String(subject).match(/\((\d{1,2})\/(\d{1,2})\/(\d{4})\)/);
  return m ? (m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2)) : null;
}

// ---- run ------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'sample-email.html'), 'utf8');
const date = '2026-06-12';
const rows = parseEmail_(html, date);

console.log('Rows parsed:', rows.length);
console.log(JSON.stringify(rows[0], null, 2));

let ok = 0, fail = 0;
function check(name, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) ok++;
  else { fail++; console.log('FAIL ' + name + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }
}

check('row count', rows.length, 6);

const store = rows[0];
check('row0 table', store.table, 'MAIN');
check('row0 channel', store.channel, 'ONLINE PE');
check('row0 sub_channel', store.sub_channel, 'WEB - ONLINE STORE');
check('row0 orders_day_cy', store.orders_day_cy, 110);
check('row0 amount_day_cy', store.amount_day_cy, 11000);
check('row0 amount_mtd_cy', store.amount_mtd_cy, 95000);

const riverport = rows.find(function (r) { return r.sub_channel === 'WEB - RIVERPORT'; });
check('riverport amount_day_cy', riverport.amount_day_cy, 800.5);
check('riverport orders_day_cy', riverport.orders_day_cy, 8);

// MAIN total (what COL_TOTAL would receive)
const main = rows.filter(function (r) { return r.table === 'MAIN'; });
const totalAmount = Math.round(main.reduce(function (a, r) { return a + r.amount_day_cy; }, 0) * 100) / 100;
const totalOrders = main.reduce(function (a, r) { return a + r.orders_day_cy; }, 0);
check('MAIN total amount_day_cy', totalAmount, 12220.5);
check('MAIN total orders_day_cy', totalOrders, 122);

// second table
const home = rows.find(function (r) { return r.table === 'STORES HOME'; });
check('home channel', home.channel, 'FLORAL');
check('home sub_channel', home.sub_channel, 'WEB - GIFTSHOP');
check('home amount_day_cy', home.amount_day_cy, 150);

// subject date
check('date from subject', reportDateFromSubject_('Daily Sales (12/06/2026)'), '2026-06-12');

console.log('\n================');
console.log('Asserts OK: ' + ok + ' | FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);
