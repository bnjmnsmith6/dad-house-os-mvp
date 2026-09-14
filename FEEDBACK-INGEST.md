# Feedback ingest (Formsubmit stub)

## Endpoint pattern

In `shared/feedback.js`:

```js
var FEEDBACK_EMAIL = ""; // PLACEHOLDER — set monitor address when Orch/Ben provides; empty disables HTTP egress
var FORM_ENDPOINT = FEEDBACK_EMAIL
  ? ("https://formsubmit.co/ajax/" + encodeURIComponent(FEEDBACK_EMAIL))
  : "";
```

POSTs JSON to `FORM_ENDPOINT` with headers `Content-Type: application/json` and `Accept: application/json`.

Body fields (Something-off payload + Formsubmit helpers):

| Field | Notes |
|---|---|
| `id` | Client-generated queue id |
| `category` | Wrong size / Missing item / Confusing / Other |
| `line` | Optional one-liner (≤140) |
| `screen` | Active screen id |
| `offline` | Boolean (or `?offline=1` sim) |
| `handoff_id` | Proto id when available |
| `app_version` | e.g. `pilot0-mvp-2026-09-14b` |
| `timestamp` | ISO-8601 |
| `_subject` | `[Dad House] Something off — {category}` |
| `source` | `dad-house-os-mvp` |

## Empty `FEEDBACK_EMAIL`

While `FEEDBACK_EMAIL === ""`:

- `FORM_ENDPOINT` is empty → **no HTTP egress**
- Submit still enqueues to `localStorage` and toasts *Thanks — noted for tonight’s list*
- No `mailto:` popup (avoids GitHub noreply) — queue-only by default
- `flushQueue()` is a no-op until an address is set

## First Formsubmit confirm (once email is set)

1. Set `FEEDBACK_EMAIL` to the monitor inbox (see flip steps below).
2. Bump `feedback.js?v=` cache-bust + SW `CACHE` version; commit/push Pages.
3. Submit one Something-off from the live site while online.
4. Formsubmit emails a **one-time activation / confirm** link to that inbox — click it.
5. Later submits land as emails; queue items flip `sent: true` on HTTP success.

## Researcher pipe

- Drop directory: `/workspace/research/feedback-raw/`
- Poller (Researcher) exports / copies queue JSON batches here.
- Schema matches the Something-off payload above (`id`, `category`, `line`, `screen`, `offline`, `handoff_id`, `app_version`, `timestamp`, `sent`).
- Do not commit PII beyond proto ids.

## localStorage key

`dadhouse_feedback_queue` — array of queue items `{ id, category, line, screen, offline, handoff_id, app_version, timestamp, sent }`.

Inspect: `DadHouseFeedback.readQueue()` · flush: `DadHouseFeedback.flushQueue()`.

## How to flip email

1. Edit `shared/feedback.js` → set `FEEDBACK_EMAIL` to the monitor address (no Ben ask until Orch provides).
2. Bump `?v=` on `feedback.js` in `index.html` + `replenish/index.html`, and SW `CACHE` / asset query.
3. Commit + push `origin/main` so Pages picks up the new script.
4. Complete Formsubmit’s first-confirm email (above).
5. Online clients call `flushQueue` on mount, `online`, and `visibilitychange`.
