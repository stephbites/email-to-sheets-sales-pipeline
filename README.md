# 📧➡️📊 Email-to-Sheets Sales Pipeline

A **serverless Google Apps Script** pipeline that turns a daily HTML sales-report
email into structured data: it parses the email, stores an append-only history,
fills a wide-format tracking sheet (the "Sales Plan"), and posts a daily summary
to a Google Chat space — fully automated, zero infrastructure, zero cost.

> ⚠️ This is an **anonymized portfolio version** of a real project delivered for a
> client. Company name (**"Nimbus Commerce"**), regions, emails, IDs and figures are
> **fictional / synthetic**. No client data is included.

📐 **Built spec-first** — the rules, edge cases and acceptance criteria were agreed
before coding. See [SPEC.md](SPEC.md); the acceptance criteria map 1:1 to the parser test.

---

## The problem

Every morning, someone had to **manually copy** an e-commerce sales report — that
arrives as an HTML email — into a shared "Sales Plan" spreadsheet: read each
channel's orders and revenue, find the right date row, and type the numbers in.

It was slow, easy to get wrong, and it depended on a person being available.

## The solution

A scheduled Apps Script that, **every day at 7:00 AM**, with no human in the loop:

1. **Finds** the latest sales email in Gmail (by subject).
2. **Parses** the HTML tables into structured rows (per channel / sub-channel).
3. **Stores** every row in an append-only history sheet (`RAW_SALES`), deduplicated.
4. **Writes** the day's figures into the wide-format "Sales Plan" sheet, matching the
   correct date row and the correct column per region.
5. **Notifies** the team in a Google Chat space with the day's total.

```
┌─────────────────────────┐
│ Gmail                   │
│ Daily sales email (HTML)│
└────────────┬────────────┘
             ▼
┌─────────────────────────┐      ┌──────────────────────┐
│ Apps Script (7 AM cron) │─────▶│ RAW_SALES            │  append-only history
│ parse HTML tables       │      │ (long format, dedup) │
└────────────┬────────────┘      └──────────────────────┘
             │
             ├──────────────▶  Sales Plan sheet  (wide format, by date row)
             │
             ├──────────────▶  Run log  (OK / NO_EMAIL / NO_DATA / ERROR)
             │
             └──────────────▶  Google Chat space  (daily summary)
```

## Why it's robust (engineering highlights)

| Concern | How it's handled |
|---|---|
| **Fragile HTML parsing** | Parses by **structure, counting columns from the right** — so an extra `rowspan` label cell or a "short" email (fewer rows) never breaks it. Covered by a **reproducible test** against a fixture. |
| **Duplicate data** | Every row has a unique key (`date · table · channel · sub_channel`); re-runs and reprocessing are **idempotent** — no double counting. |
| **"No email" ≠ "bad format"** | Distinct states (`NO_EMAIL`, `NO_DATA`, `ERROR`) so the team is alerted *differently* for each — a silent gap can't masquerade as success. |
| **Channel name drift** | Region matching is **normalization-tolerant** (case / accents / weird spaces / dash variants), so a template tweak doesn't silently drop a region. |
| **Recovery / backfill** | A `backfill()` function reprocesses a date range; dedup makes it safe to re-run. |
| **Raw vs. curated** | `RAW_SALES` is an immutable history; the wide "Sales Plan" is the curated, human-facing view. |
| **Cost & ops** | 100% serverless on Google's free tier. No servers, no bill, near-zero maintenance. |

## How a row is modeled (long format)

```json
{
  "report_date": "2026-06-12",
  "table": "MAIN",
  "channel": "ONLINE PE",
  "sub_channel": "WEB - RIVERPORT",
  "orders_day_py": 5,  "orders_day_cy": 8,
  "orders_mtd_py": 40, "orders_mtd_cy": 55,
  "amount_day_py": 500.00,  "amount_day_cy": 800.50,
  "amount_mtd_py": 4000.00, "amount_mtd_cy": 6200.75
}
```
`py` = prior year, `cy` = current year, `mtd` = month-to-date. Storing **long**
(one row per channel) is what makes "short" emails a non-issue.

## Tech stack

- **Google Apps Script** (V8 / JavaScript) — Gmail, Sheets, Chat, time-based triggers
- **Google Sheets** as storage (raw history + curated plan)
- **Google Chat** incoming webhook for notifications
- **Node.js** for a dependency-free parser test

## Repository layout

```
.
├── SPEC.md              # spec-first: rules + edge cases + acceptance criteria
├── apps-script/
│   ├── Config.gs        # all parameters: subject, sheet IDs, region→column map
│   ├── Parser.gs        # HTML → structured rows (the core logic)
│   ├── RawStore.gs      # append-only history + dedup + run log
│   ├── SheetStore.gs    # wide-format writer (date row + tolerant region match)
│   ├── Notify.gs        # Google Chat webhook
│   ├── Main.gs          # orchestration, daily trigger, backfill
│   └── Explorer.gs      # one-time helper: dump a real email's HTML to tune the parser
└── test/
    ├── sample-email.html # synthetic, anonymized email fixture
    └── parser.test.js    # runs the parser against the fixture and asserts values
```

## Run the test

No dependencies required:

```bash
node test/parser.test.js
```

It parses the synthetic email and asserts the extracted values and the computed
day-total — the same guard that catches a future template change.

## Setup (real deployment)

1. Create a Google Sheet, open **Extensions → Apps Script**, and add the `.gs` files.
2. Fill in `Config.gs` (email subject, target spreadsheet ID/GID, region→column map).
3. Run `Explorer.gs` once to capture a real email's HTML and tune the column map.
4. Run `runPipeline` manually to verify, then `createDailyTrigger` to schedule it.
5. (Optional) Add a Google Chat webhook URL in `Config.gs` for notifications.

## License

MIT — see [LICENSE](LICENSE).
