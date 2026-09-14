/**
 * Dad House OS — Loop C replenish draft (S3 couch)
 * Journey SoT §3–§4. Draft only — never live Amazon charge.
 * KC2 stale size · KC4 event triad · KC5 cap-conflict blocks Confirm.
 */
(function () {
  "use strict";

  const STALE_MS = 90 * 24 * 60 * 60 * 1000;
  const STORAGE_KEY = "dadhouse_replenish_draft_v1";

  /** @type {any} */
  let seed = null;
  /** @type {any} */
  let state = null;

  const $ = (id) => document.getElementById(id);
  const screens = {
    staples: $("screen-staples"),
    event: $("screen-event"),
    "soft-size": $("screen-soft-size"),
    "stale-size": $("screen-stale-size"),
    confirm: $("screen-confirm"),
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== name);
    });
    state.screen = name;
    persist();
    if (window.DadHouseFeedback && DadHouseFeedback.syncVisibility) {
      DadHouseFeedback.syncVisibility();
    }
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.add("hidden"), 2800);
  }

  function money(cents) {
    return "$" + (cents / 100).toFixed(2);
  }

  function formatMeasured(iso) {
    if (!iso) return "Not measured";
    const d = new Date(iso);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `Measured ${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }

  function formatMeasuredLong(iso) {
    if (!iso) return "Not measured";
    const d = new Date(iso);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `Measured ${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  }

  function daysSince(iso) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  }

  function isStale(sizeRecord) {
    if (!sizeRecord || !sizeRecord.measured_at) return true;
    const threshold = (seed.demo && seed.demo.stale_days_threshold) || 90;
    return Date.now() - new Date(sizeRecord.measured_at).getTime() > threshold * 24 * 60 * 60 * 1000;
  }

  function activeSizeRecord() {
    if (state.flags.missingSize) return null;
    if (state.flags.staleSize) {
      return (seed.size_records_stale && seed.size_records_stale[0]) || null;
    }
    // Prefer runtime soft/updated size if present
    if (state.sizeRecord) return state.sizeRecord;
    return (seed.size_records && seed.size_records[0]) || null;
  }

  function underwearInv() {
    return state.inventory.find((i) => i.staple_category === "underwear");
  }

  function underwearRule() {
    return state.rules.find((r) => r.category === "underwear");
  }

  function underwearItem() {
    return seed.items.find((i) => i.category === "underwear");
  }

  function catalog() {
    return seed.catalog.underwear;
  }

  function persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          inventory: state.inventory,
          rules: state.rules,
          sizeRecord: state.sizeRecord,
          proposal: state.proposal,
          flags: state.flags,
          softSizePick: state.softSizePick,
          staleAcknowledged: state.staleAcknowledged,
          activeInvId: state.activeInvId,
          screen: state.screen,
        })
      );
    } catch (_) { /* ignore */ }
  }

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function resetState(fromPersisted) {
    const p = fromPersisted || null;
    state = {
      inventory: p && p.inventory
        ? p.inventory
        : JSON.parse(JSON.stringify(seed.house_inventory)),
      rules: p && p.rules
        ? p.rules
        : JSON.parse(JSON.stringify(seed.staple_rules)),
      sizeRecord: p && p.sizeRecord !== undefined
        ? p.sizeRecord
        : (seed.size_records && seed.size_records[0]
            ? JSON.parse(JSON.stringify(seed.size_records[0]))
            : null),
      proposal: (p && p.proposal) || null,
      flags: (p && p.flags) || { missingSize: false, staleSize: false },
      softSizePick: (p && p.softSizePick) || "Youth L",
      staleAcknowledged: !!(p && p.staleAcknowledged),
      activeInvId: (p && p.activeInvId) || "inv_underwear",
      screen: "staples",
    };
    $("toggle-missing-size").checked = !!state.flags.missingSize;
    $("toggle-stale-size").checked = !!state.flags.staleSize;
  }

  function setStockEvent(inv, kind) {
    // KC4: event triad only — no qty
    const now = new Date().toISOString();
    if (kind === "out") {
      inv.stock_state = "out";
      inv.last_event_kind = "out";
    } else if (kind === "low") {
      inv.stock_state = "low";
      inv.last_event_kind = "low";
    } else if (kind === "bought") {
      inv.stock_state = "ok";
      inv.last_event_kind = "bought";
    }
    inv.last_event_at = now;
    persist();
  }

  function estimatedSpend(orderQty) {
    return orderQty * catalog().unit_price_cents;
  }

  function buildProposal() {
    const rule = underwearRule();
    const size = activeSizeRecord();
    const orderQty = rule.order_qty;
    const est = estimatedSpend(orderQty);
    const capConflict = est > rule.max_spend_cents;
    const underwearSize = size ? size.underwear : state.softSizePick;

    state.proposal = {
      id: "prop_" + Date.now(),
      dad_user_id: seed.dad_user_id,
      staple_rule_id: rule.id,
      kid_id: seed.kids[0].id,
      category: "underwear",
      size_snapshot: size
        ? {
            underwear: size.underwear,
            shirt: size.shirt,
            pant: size.pant,
            shoe: size.shoe,
            measured_at: size.measured_at,
          }
        : {
            underwear: underwearSize,
            measured_at: new Date().toISOString(),
          },
      soft_size_needed: !size,
      order_qty: orderQty,
      max_spend_cents: rule.max_spend_cents,
      estimated_spend_cents: est,
      cap_conflict: capConflict,
      merchant_pref: "amazon",
      status: "draft",
      created_at: new Date().toISOString(),
      unit_price_cents: catalog().unit_price_cents,
      pack_label: catalog().pack_label,
    };
    persist();
    return state.proposal;
  }

  function recalcProposal() {
    const p = state.proposal;
    if (!p) return;
    p.estimated_spend_cents = estimatedSpend(p.order_qty);
    p.cap_conflict = p.estimated_spend_cents > p.max_spend_cents;
    // Mirror rule caps that may have been raised
    const rule = underwearRule();
    rule.order_qty = Math.max(rule.order_qty, p.order_qty); // don't force — keep proposal qty
    // Update rule max if proposal raised it
    if (p.max_spend_cents !== rule.max_spend_cents) {
      rule.max_spend_cents = p.max_spend_cents;
    }
    persist();
  }

  // ——— Render ———

  function renderStaples() {
    const list = $("staples-list");
    list.innerHTML = "";
    state.inventory.forEach((inv) => {
      const item = seed.items.find((i) => i.id === inv.item_id);
      const rule = state.rules.find((r) => r.item_id === inv.item_id || r.category === inv.staple_category);
      const name = item ? item.name : inv.staple_category;
      const row = document.createElement("div");
      row.className = "staple-row";
      row.innerHTML = `
        <div class="staple-head">
          <p class="staple-name">${escapeHtml(name)}</p>
          <span class="stock-pill stock-${inv.stock_state}">${inv.stock_state}</span>
        </div>
        <div class="triad-mini" data-inv="${inv.id}">
          <button type="button" class="btn btn-secondary ${inv.stock_state === "out" ? "active-out" : ""}" data-mini-event="out">Out</button>
          <button type="button" class="btn btn-secondary ${inv.stock_state === "low" ? "active-low" : ""}" data-mini-event="low">Low</button>
          <button type="button" class="btn btn-secondary ${inv.stock_state === "ok" && inv.last_event_kind === "bought" ? "active-bought" : ""}" data-mini-event="bought">Bought</button>
        </div>
        ${
          rule
            ? `<p class="rule-caps">Qty cap: ${rule.order_qty} pack${rule.order_qty === 1 ? "" : "s"} · Spend cap: ${money(rule.max_spend_cents)}</p>`
            : ""
        }
        <p class="rule-caps">Last: ${inv.last_event_kind || "—"} · ${formatMeasured(inv.last_event_at).replace("Measured ", "")}</p>
      `;
      list.appendChild(row);
    });

    // Alert row when underwear out
    const uw = underwearInv();
    const alert = $("alert-row");
    if (uw && uw.stock_state === "out") {
      alert.classList.remove("hidden");
      $("alert-text").textContent = "Underwear: Out → Order";
    } else if (uw && uw.stock_state === "low") {
      alert.classList.remove("hidden");
      $("alert-text").textContent = "Underwear: Low → Order";
    } else {
      alert.classList.add("hidden");
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderEvent() {
    const inv = state.inventory.find((i) => i.id === state.activeInvId) || underwearInv();
    const item = seed.items.find((i) => i.id === inv.item_id);
    const name = item ? item.name : inv.staple_category;
    $("event-title").textContent = `${name} at Dad’s`;
    $("event-meta").innerHTML = `
      <p><strong>stock_state:</strong> ${inv.stock_state}</p>
      <p><strong>last_event_kind:</strong> ${inv.last_event_kind || "—"}</p>
      <p><strong>last_event_at:</strong> ${inv.last_event_at || "—"}</p>
    `;
    document.querySelectorAll(".triad-btn").forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.event === inv.last_event_kind ||
        (btn.dataset.event === "bought" && inv.stock_state === "ok" && inv.last_event_kind === "bought") ||
        (btn.dataset.event === inv.stock_state));
    });
    const review = $("btn-review-order");
    const showReview = inv.stock_state === "out" || inv.stock_state === "low";
    review.classList.toggle("hidden", !showReview);
  }

  function renderConfirm() {
    const p = state.proposal;
    if (!p) return;
    const sizeLabel = (p.size_snapshot && p.size_snapshot.underwear) || "—";
    const measuredAt = p.size_snapshot && p.size_snapshot.measured_at;

    // KC2: size + measured_at LARGE
    $("confirm-size").textContent = sizeLabel;
    $("confirm-measured").textContent = formatMeasured(measuredAt);
    $("confirm-title").textContent = `Order ${p.category}?`;
    $("confirm-cart").textContent = `Amazon · ${p.pack_label} · ${sizeLabel}`;
    $("confirm-caps").textContent = `Qty cap: ${p.order_qty} pack${p.order_qty === 1 ? "" : "s"} · Spend cap: ${money(p.max_spend_cents)}`;
    $("confirm-price").textContent = `Estimated ${money(p.estimated_spend_cents)}`;
    $("proposal-status").textContent = `Status: ${p.status} · no charge`;

    const conflict = $("cap-conflict");
    const confirmBtn = $("btn-confirm-spend");
    confirmBtn.textContent = `Confirm spend ${money(p.estimated_spend_cents)}`;

    if (p.cap_conflict) {
      // KC5: Confirm DISABLED
      conflict.classList.remove("hidden");
      $("conflict-title").textContent =
        `Can’t confirm · pack ${money(p.estimated_spend_cents)} · spend cap ${money(p.max_spend_cents)}`;
      $("conflict-caps").textContent =
        `Qty cap: ${p.order_qty} pack${p.order_qty === 1 ? "" : "s"} · Spend cap: ${money(p.max_spend_cents)}`;
      confirmBtn.disabled = true;
      // Lower qty available only if order_qty > 1
      $("btn-lower-qty").disabled = p.order_qty <= 1;
    } else {
      conflict.classList.add("hidden");
      $("raise-cap-inline").classList.add("hidden");
      confirmBtn.disabled = p.status !== "draft";
    }
  }

  function renderStaleNag() {
    const size = activeSizeRecord();
    if (!size) return;
    $("stale-size-value").textContent = size.underwear;
    $("stale-measured").textContent = formatMeasuredLong(size.measured_at);
    const days = daysSince(size.measured_at);
    $("stale-nag-copy").textContent =
      `Measured ${days} days ago (>90). Don’t rubber-stamp last season into the cart.`;
  }

  // ——— Navigation / flow ———

  function openEvent(invId) {
    state.activeInvId = invId || "inv_underwear";
    showScreen("event");
    renderEvent();
  }

  function startReviewOrder() {
    state.staleAcknowledged = false;
    const size = activeSizeRecord();

    // Soft size if missing (journey §3.3)
    if (!size || state.flags.missingSize) {
      state.flags.missingSize = true;
      $("toggle-missing-size").checked = true;
      showScreen("soft-size");
      return;
    }

    // KC2: stale measured_at → hard-nag before confirm
    if (isStale(size) && !state.staleAcknowledged) {
      showScreen("stale-size");
      renderStaleNag();
      return;
    }

    buildProposal();
    showScreen("confirm");
    renderConfirm();
  }

  function afterSoftSizeContinue() {
    // Save soft SizeRecord (manual, measured_at=now)
    const now = new Date().toISOString();
    state.sizeRecord = {
      id: "size_soft_" + Date.now(),
      kid_id: seed.kids[0].id,
      shirt: state.softSizePick,
      pant: "",
      shoe: "",
      underwear: state.softSizePick,
      measured_at: now,
      source: "manual",
      confirmed_at: now,
      confirmed_by_user_id: seed.dad_user_id,
    };
    state.flags.missingSize = false;
    $("toggle-missing-size").checked = false;
    state.staleAcknowledged = true; // fresh
    persist();

    // Still check stale path if toggle stale somehow — fresh so skip
    buildProposal();
    showScreen("confirm");
    renderConfirm();
  }

  function confirmProposal() {
    const p = state.proposal;
    if (!p || p.cap_conflict || p.status !== "draft") return;

    // Final KC2 guard — never silent rubber-stamp stale
    const measured = p.size_snapshot && p.size_snapshot.measured_at;
    if (measured && isStale({ measured_at: measured }) && !state.staleAcknowledged) {
      showScreen("stale-size");
      renderStaleNag();
      return;
    }

    p.status = "confirmed";
    // Post-confirm → stock_state ok (Bought). No payment.
    const inv = underwearInv();
    if (inv) setStockEvent(inv, "bought");
    persist();
    toast("Marked in stock · Bought a pack");
    showScreen("staples");
    renderStaples();
  }

  function cancelProposal() {
    if (state.proposal && state.proposal.status === "draft") {
      state.proposal.status = "cancelled";
    }
    // stock_state unchanged on cancel
    persist();
    showScreen("staples");
    renderStaples();
  }

  function lowerQty() {
    const p = state.proposal;
    if (!p || p.order_qty <= 1) return;
    // Drop until under spend cap or floor 1
    while (p.order_qty > 1 && p.estimated_spend_cents > p.max_spend_cents) {
      p.order_qty -= 1;
      p.estimated_spend_cents = estimatedSpend(p.order_qty);
    }
    p.cap_conflict = p.estimated_spend_cents > p.max_spend_cents;
    // Sync rule order_qty display for honesty? Keep proposal qty independent of rule default
    persist();
    renderConfirm();
    if (p.cap_conflict) {
      toast("Still over spend cap — raise cap or cancel");
    }
  }

  function applyRaiseCap() {
    const raw = parseFloat($("input-raise-cap").value);
    if (!raw || raw <= 0) return;
    const cents = Math.round(raw * 100);
    const p = state.proposal;
    p.max_spend_cents = cents;
    const rule = underwearRule();
    rule.max_spend_cents = cents;
    p.cap_conflict = p.estimated_spend_cents > p.max_spend_cents;
    persist();
    $("raise-cap-inline").classList.add("hidden");
    renderConfirm();
    renderStaples();
  }

  // ——— Events ———

  function bind() {
    document.querySelectorAll(".btn-back").forEach((btn) => {
      btn.addEventListener("click", () => {
        const back = btn.dataset.back || "staples";
        if (back === "staples") {
          showScreen("staples");
          renderStaples();
        } else if (back === "event") {
          showScreen("event");
          renderEvent();
        }
      });
    });

    $("staples-list").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-mini-event]");
      if (!btn) return;
      const wrap = btn.closest("[data-inv]");
      const invId = wrap.dataset.inv;
      const kind = btn.dataset.miniEvent;
      const inv = state.inventory.find((i) => i.id === invId);
      if (!inv) return;
      setStockEvent(inv, kind);
      state.activeInvId = invId;
      // Open event sheet for review path when Out/Low; Bought just updates
      if (kind === "bought") {
        renderStaples();
        toast("Marked in stock · Bought a pack");
        return;
      }
      openEvent(invId);
    });

    $("btn-alert-order").addEventListener("click", () => {
      state.activeInvId = "inv_underwear";
      startReviewOrder();
    });

    document.querySelectorAll(".triad-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kind = btn.dataset.event;
        const inv = state.inventory.find((i) => i.id === state.activeInvId) || underwearInv();
        setStockEvent(inv, kind);
        renderEvent();
        renderStaples();
        if (kind === "bought") toast("Marked in stock · Bought a pack");
      });
    });

    $("btn-review-order").addEventListener("click", () => startReviewOrder());

    // Soft size chips
    $("soft-size-chips").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      state.softSizePick = chip.dataset.size;
      document.querySelectorAll("#soft-size-chips .chip").forEach((c) => {
        c.classList.toggle("selected", c === chip);
      });
    });
    $("btn-soft-continue").addEventListener("click", afterSoftSizeContinue);

    // Stale nag (KC2)
    $("btn-update-size").addEventListener("click", () => {
      // Inline fix → soft size picker (not full profile)
      showScreen("soft-size");
    });
    $("btn-confirm-size-anyway").addEventListener("click", () => {
      // Explicit acknowledge — not silent
      state.staleAcknowledged = true;
      persist();
      buildProposal();
      showScreen("confirm");
      renderConfirm();
    });
    $("btn-stale-cancel").addEventListener("click", () => {
      showScreen("staples");
      renderStaples();
    });

    $("btn-wrong-size").addEventListener("click", () => {
      showScreen("soft-size");
    });

    $("btn-lower-qty").addEventListener("click", lowerQty);
    $("btn-raise-cap").addEventListener("click", () => {
      $("raise-cap-inline").classList.remove("hidden");
      const p = state.proposal;
      $("input-raise-cap").value = (p.max_spend_cents / 100).toFixed(0);
      $("input-raise-cap").focus();
    });
    $("btn-apply-cap").addEventListener("click", applyRaiseCap);
    $("btn-cancel-proposal").addEventListener("click", cancelProposal);
    $("btn-cancel-confirm").addEventListener("click", cancelProposal);
    $("btn-confirm-spend").addEventListener("click", confirmProposal);
    $("btn-save-draft").addEventListener("click", () => {
      if (state.proposal) {
        state.proposal.status = "draft";
        persist();
        toast("Draft saved · no charge");
        showScreen("staples");
        renderStaples();
      }
    });

    $("toggle-missing-size").addEventListener("change", (e) => {
      state.flags.missingSize = e.target.checked;
      if (e.target.checked) {
        state.flags.staleSize = false;
        $("toggle-stale-size").checked = false;
        state.sizeRecord = null;
      } else if (!state.flags.staleSize) {
        state.sizeRecord = seed.size_records[0]
          ? JSON.parse(JSON.stringify(seed.size_records[0]))
          : null;
      }
      state.staleAcknowledged = false;
      persist();
    });

    $("toggle-stale-size").addEventListener("change", (e) => {
      state.flags.staleSize = e.target.checked;
      state.staleAcknowledged = false;
      if (e.target.checked) {
        state.flags.missingSize = false;
        $("toggle-missing-size").checked = false;
        state.sizeRecord = seed.size_records_stale[0]
          ? JSON.parse(JSON.stringify(seed.size_records_stale[0]))
          : null;
      } else if (!state.flags.missingSize) {
        state.sizeRecord = seed.size_records[0]
          ? JSON.parse(JSON.stringify(seed.size_records[0]))
          : null;
      }
      persist();
    });

    $("btn-reset").addEventListener("click", () => {
      localStorage.removeItem(STORAGE_KEY);
      resetState(null);
      showScreen("staples");
      renderStaples();
      toast("Fixture reset");
    });
  }

  async function init() {
    const res = await fetch("fixtures/seed.json");
    seed = await res.json();
    const persisted = loadPersisted();
    resetState(persisted);
    bind();
    showScreen("staples");
    renderStaples();

    if (window.DadHouseFeedback && typeof DadHouseFeedback.mount === "function") {
      DadHouseFeedback.mount({
        defaultScreen: "staples",
        visibleOn: ["confirm"],
        getScreen: function () {
          return (state && state.screen) || "staples";
        },
        getHandoffId: function () {
          return null;
        },
      });
    }

    // Deep-link support: ?out=1 opens Out → review path
    const params = new URLSearchParams(location.search);
    if (params.get("out") === "1") {
      const inv = underwearInv();
      setStockEvent(inv, "out");
      renderStaples();
      openEvent(inv.id);
    }
    if (params.get("order") === "1") {
      const inv = underwearInv();
      setStockEvent(inv, "out");
      renderStaples();
      startReviewOrder();
    }
  }

  init().catch((err) => {
    console.error(err);
    $("banner").textContent = "Failed to load fixtures/seed.json — serve via http.server";
  });
})();
