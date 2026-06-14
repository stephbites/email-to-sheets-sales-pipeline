# Spec — Email-to-Sheets Sales Pipeline

> This project was built **spec-first**: the rules below were agreed before
> implementation, and the acceptance criteria map 1:1 to the parser test.
> (Anonymized portfolio version — see [README](README.md).)

## Objective
Automatically load the daily e-commerce sales that arrive by email (HTML) into
the wide "Sales Plan" sheet — with no human in the loop — and notify the team of
the outcome.

## Inputs
- A daily Gmail message whose subject contains `DAILY ECOMMERCE SALES SUMMARY`.
- Body is HTML with one or more tables; each data row is a channel / sub-channel
  with order counts and revenue (prior vs. current year, day and month-to-date).
- The report date is in the subject, format `(DD/MM/YYYY)`.

## Outputs
- Structured rows appended to `RAW_SALES` (long format, one per sub-channel).
- The matching date row in the wide "Sales Plan" sheet, updated.
- One line in the run log (status + detail).
- A message to a Google Chat space with the day's total.

## Business rules
- **Dedup:** a row is identified by `report_date · table · channel · sub_channel`;
  if the key already exists it is not stored again (idempotent).
- **Absent sub-channel = 0:** if a sub-channel is missing from a day's email, it
  is treated as 0 sales (not as "missing data").
- **Total column:** `COL_TOTAL` holds the **sum of the MAIN table's sub-channels**
  (not a single sub-channel).
- **Region columns:** each region is written to its own column, matched **by name,
  tolerant** to case / accents / spaces / dash variants.
- **Date source:** the report date comes from the **subject** (not the received
  date) and is written to the row whose column A equals that date. If the date is
  not present, it is an error — no row is invented.
- **Value used:** current-year, **day** figures (`amount_day_cy` / `orders_day_cy`).
  Prior year and month-to-date are reference only and are not loaded.

## Edge cases
| Situation | Status | Behavior |
|---|---|---|
| No email arrived | `NO_EMAIL` | 🟡 alert; nothing written; wait for next day. |
| Email arrives but 0 rows parsed (format changed) | `NO_DATA` | 🔴 alert ("check format"); no partial/garbage data written. |
| System down for several days | — | manual `backfill(window)`; dedup prevents duplicating already-loaded days. |
| Date not found in the plan sheet | `ERROR` | error reported; no row invented. |
| Unexpected exception | `ERROR` | 🔴 alert; error logged and re-thrown. |

> Design principle: **no silent outcomes** — every situation maps to a distinct
> status + alert, so "no email" can never be mistaken for "success".

## Acceptance criteria (mirrored by `test/parser.test.js`)
- [ ] Given the sample email, the parser extracts exactly the expected rows.
- [ ] Revenue strings with thousands separators (`11,000.00`) parse to numbers.
- [ ] The first row of a group (with an extra `rowspan` label cell) parses the
      same as the others — column mapping is counted from the right.
- [ ] `Total` rows and header rows are skipped.
- [ ] The MAIN-table day total equals the sum of its sub-channels.
- [ ] A region key matches regardless of case / spacing / dash variant.
- [ ] Reprocessing an already-stored report inserts **0** new RAW rows (dedup).

## Out of scope
- Charts / dashboards on top of the data.
- Editing or back-correcting historical rows already entered manually.
- Multi-currency or channels outside the configured region map.
