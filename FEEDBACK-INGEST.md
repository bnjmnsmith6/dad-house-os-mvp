# Feedback ingest (Formsubmit deferred)

## Orch lock (2026-09-14c)

- `FEEDBACK_EMAIL=""` — **stays empty** per Orch lock. Do not ask Ben for inbox.
- **No Formsubmit live.** Activation deferred until Orch provides a monitor address.
- **Current egress:** localStorage queue + blank-To `mailto:?subject=…&body=…` compose on every successful Something-off submit.
- `feedback-raw` poller / Researcher pipe remains **future**.

## Endpoint pattern

In `shared/feedback.js`:

```js
var FEEDBACK_EMAIL = ""; // Orch lock — stays empty; empty disables Formsubmit / HTTP egress
var FORM_ENDPOINT = FEEDBACK_EMAIL
  ? ("https://formsubmit.co/ajax/" + encodeURIComponent(FEEDBACK_EMAIL))
  : "";
```

When `FEEDBACK_EMAIL` is later set, POSTs JSON to `FORM_ENDPOINT` with headers `Content-Type: application/json` and `Accept: application/json`.

Body fields (Something-off payload + Formsubmit helpers):

| Field | Notes |
|---|---|
| `id` | Client-generated queue id |
| `category` | Wrong size / Missing item / Confusing / Other |
| `line` | Optional one-liner (≤140) |
| `screen` | Active screen id |
| `offline` | Boolean (or `?offline=1` sim) |
| `handoff_id` | Proto id when available |
| `app_version` | e.g. `pilot0-mvp-2026-09-14c` |
| `timestamp` | ISO-8601 |
| `_subject` | `[Dad House] Something off — {category}` |
| `source` | `dad-house-os-mvp` |

## Empty `FEEDBACK_EMAIL` (current)

While `FEEDBACK_EMAIL === ""`:

- `FORM_ENDPOINT` is empty → **no HTTP / Formsubmit egress**
- Submit always enqueues to `localStorage`, toasts *Thanks — noted for tonight’s list*, then opens device mail compose via `mailto:?subject=…&body=…` (blank To — JSON body; **not** `users.noreply.github.com`)
- Mailto try/catch never blocks queue or toast
- `flushQueue()` is a no-op until an address is set
- No dependency on `?mailto=1` — mailto is the default when Formsubmit is off

## First Formsubmit confirm (deferred — once email is set)

1. Set `FEEDBACK_EMAIL` to the monitor inbox (Orch provides; do not ask Ben).
2. Bump `feedback.js?v=` cache-bust + SW `CACHE` version; commit/push Pages.
3. Submit one Something-off from the live site while online.
4. Formsubmit emails a **one-time activation / confirm** link to that inbox — click it.
5. Later submits land as emails; queue items flip `sent: true` on HTTP success.
6. When Formsubmit is live, mailto is skipped (`FORM_ENDPOINT` set).

## Researcher pipe (future)

- Drop directory: `/workspace/research/feedback-raw/`
- Poller (Researcher) exports / copies queue JSON batches here — **not active yet**.
- Schema matches the Something-off payload above (`id`, `category`, `line`, `screen`, `offline`, `handoff_id`, `app_version`, `timestamp`, `sent`).
- Do not commit PII beyond proto ids.

## localStorage key

`dadhouse_feedback_queue` — array of queue items `{ id, category, line, screen, offline, handoff_id, app_version, timestamp, sent }`.

Inspect: `DadHouseFeedback.readQueue()` · flush: `DadHouseFeedback.flushQueue()`.

## How to flip email (when Orch unlocks)

1. Edit `shared/feedback.js` → set `FEEDBACK_EMAIL` to the monitor address (no Ben ask).
2. Bump `?v=` on `feedback.js` in `index.html` + `replenish/index.html`, and SW `CACHE` / asset query.
3. Commit + push `origin/main` so Pages picks up the new script.
4. Complete Formsubmit’s first-confirm email (above).
5. Online clients call `flushQueue` on mount, `online`, and `visibilitychange`.
