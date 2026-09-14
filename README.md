# Dad House OS — Pilot 0 MVP

Shareable static MVP: **packing-lot** (Tonight / T-12h) + **replenish-draft** + in-product feedback stub.

**Public URL:** https://bnjmnsmith6.github.io/dad-house-os-mvp/

| Surface | Path |
|---|---|
| Packing (primary) | `/` or `/index.html` |
| Replenish draft | `/replenish/` |
| Empty-travelers win demo | `/?win=1` or `/?empty_travelers=1` |

## How to try (3-prompt async)

1. Open night-before (or pretend T-12h) — mark Travelers.
2. Flip airplane mode — still usable? (`?offline=1` also latches offline sim)
3. Tap **Something off?** once — even if nothing’s wrong (tests the feedback loop).

Do **not** ask “would you pay $59?”

## Demo flags

| Flag | Effect |
|---|---|
| `?demo=1` | Dev tools (sim offline toggle, clear handoffs) |
| `?offline=1` | Force offline banner / latch |
| `?win=1` / `?empty_travelers=1` | Empty Travelers = win copy |
| `?resetsw=1` | Unregister service workers (QA) |

## Feedback

- Sticky **Something off?** on Today, Checklist, and Replenish confirm.
- Submit → `localStorage` queue key **`dadhouse_feedback_queue`** + `mailto:` compose ($0 egress).
- Success toast: *Thanks — noted for tonight’s list*
- No account required. Never blocks packing.

## HOLD (out of scope)

- Live Amazon charge / OAuth
- Co-parent sync
- Qty hygiene / drawer counting
- Founding $29 / paid CTA
- Growth publish until Red-Team Pass

## Local serve

```bash
cd mvp-ship && python3 -m http.server 8080
# open http://localhost:8080/
```

Product brief: `/workspace/product/mvp-ship-brief-feedback-2026-09-14.md`
