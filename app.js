/**
 * Dad House OS — Loop B parking-lot packing prototype (synced to v2 index.html)
 * Journey SoT: parking-lot-journey-v2.md §0–2
 */
(function () {
  "use strict";

  const STORAGE_KEY = "dadhouse_packing_lot_v2";
  const MAX_CRITICAL = 5;
  const STALE_MS = 6 * 60 * 60 * 1000; // 6h
  const SIZE_STALE_DAYS = 90;

  let seed = null;
  let state = null;
  let addWhen = "tomorrow";
  let addKidId = null;

  const $ = (id) => document.getElementById(id);

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function defaultState(seedData) {
    return {
      handoffs: JSON.parse(JSON.stringify(seedData.handoffs || [])),
      packingLists: {},
      lastRefreshedAt: null,
      weatherSource: "stub",
      activeHandoffId: null,
      offlineSim: false,
      forceOffline: false,
      probeOffline: false,
      onlineStreak: 0,
    };
  }

  function isOnline() {
    if (state && state.offlineSim) return false;
    if (state && state.forceOffline) return false;
    // navigator.onLine alone is flaky under DevTools/SW; also trust last probe
    if (state && state.probeOffline) return false;
    return navigator.onLine !== false;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function kidName(id) {
    const k = (seed.kids || []).find((x) => x.id === id);
    return k ? k.display_name : "Kid";
  }

  function sizeRecordFor(kidId) {
    return (seed.size_records || []).find((s) => s.kid_id === kidId) || null;
  }

  function sizeIsStale(sr) {
    if (!sr || !sr.measured_at) return true;
    const age = Date.now() - new Date(sr.measured_at).getTime();
    return age > SIZE_STALE_DAYS * 24 * 60 * 60 * 1000;
  }

  function listIsStale() {
    if (!state.lastRefreshedAt) return true;
    if (!isOnline()) return true;
    return Date.now() - new Date(state.lastRefreshedAt).getTime() > STALE_MS;
  }

  function formatWhen(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (_) {
      return iso;
    }
  }

  function formatTimeShort(iso) {
    try {
      return new Date(iso).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch (_) {
      return "";
    }
  }

  function countdownText(iso) {
    if (!isOnline()) return "Handoff · morning";
    const ms = new Date(iso).getTime() - Date.now();
    if (ms < -60 * 60 * 1000) return "Past handoff";
    if (ms < 0) return "Happening now";
    const min = Math.round(ms / 60000);
    if (min < 60) return "Leaves in " + min + " min";
    const h = Math.floor(min / 60);
    return "Leaves in " + h + "h " + (min % 60) + "m";
  }

  function upcomingHandoffs() {
    return (state.handoffs || [])
      .slice()
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }


  /** Primary open path: handoff within next 12h (night-before / morning-of). */
  function isT12hWindow(handoff) {
    if (!handoff || !handoff.starts_at) return false;
    const ms = new Date(handoff.starts_at).getTime() - Date.now();
    return ms >= -30 * 60 * 1000 && ms <= 12 * 60 * 60 * 1000;
  }

  function nextHandoff() {
    const list = upcomingHandoffs();
    const now = Date.now() - 30 * 60 * 1000;
    // Primary: night-before / T-12h window (desk score)
    const t12 = list.find((h) => isT12hWindow(h));
    if (t12) return t12;
    return (
      list.find((h) => new Date(h.starts_at).getTime() >= now) ||
      list[0] ||
      null
    );
  }

  function activeHandoff() {
    if (state.activeHandoffId) {
      const h = state.handoffs.find((x) => x.id === state.activeHandoffId);
      if (h) return h;
    }
    return nextHandoff();
  }

  function stockStateForItem(itemId, category) {
    const inv = (seed.house_inventory || []).find(
      (i) => i.item_id === itemId || i.staple_category === category
    );
    return inv && inv.stock_state ? inv.stock_state : "ok";
  }

  function stubWeather() {
    const w = (seed && seed.weather_stub) || {
      summary: "Cool rain showers",
      temp_f: 52,
      rainy: true,
      cold: true,
    };
    return {
      fetched_at: new Date().toISOString(),
      summary: w.summary,
      temp_f: w.temp_f,
      rainy: !!w.rainy,
      cold: !!w.cold,
      source: "stub",
    };
  }

  async function fetchWeather() {
    if (!isOnline()) {
      const w = stubWeather();
      w.source = "stub-offline";
      return w;
    }
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=47.6062&longitude=-122.3321" +
        "&current=temperature_2m,precipitation,weather_code&temperature_unit=fahrenheit&timezone=auto";
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error("weather http");
      const data = await res.json();
      const cur = data.current || {};
      const temp = cur.temperature_2m;
      const precip = cur.precipitation || 0;
      const rainy =
        precip > 0 ||
        [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(cur.weather_code);
      const cold = typeof temp === "number" && temp <= 55;
      let summary = cold ? "Cool" : "Mild";
      if (rainy) summary += " / rain likely";
      else summary += " / dry";
      return {
        fetched_at: new Date().toISOString(),
        summary,
        temp_f: temp,
        rainy,
        cold,
        source: "open-meteo",
      };
    } catch (_) {
      const w = stubWeather();
      w.source = "stub-fallback";
      return w;
    }
  }

  function isOvernight(handoff) {
    if (typeof handoff.overnight === "boolean") return handoff.overnight;
    return handoff.direction === "to_dad";
  }

  function prevState(prevList, itemRef, name) {
    if (!prevList) return { packed: false, left_behind: false, confirmed_with_kid: null };
    const hit = (prevList.items || []).find(
      (x) =>
        (itemRef && x.item_ref === itemRef) ||
        (name && x.name === name)
    );
    if (!hit) return { packed: false, left_behind: false, confirmed_with_kid: null };
    return {
      packed: !!hit.packed,
      left_behind: !!hit.left_behind,
      confirmed_with_kid:
        hit.confirmed_with_kid === true
          ? true
          : hit.confirmed_with_kid === false
            ? false
            : null,
    };
  }

  function generatePackingList(handoff, weather, prevList, wipePacked) {
    const items = seed.items || [];
    const overnight = isOvernight(handoff);
    const out = [];
    const seen = new Set();

    function push(row) {
      if (seen.has(row.item_ref || row.name)) return;
      seen.add(row.item_ref || row.name);
      if (!wipePacked && prevList) {
        const p = prevState(prevList, row.item_ref, row.name);
        row.packed = p.packed;
        row.left_behind = p.left_behind;
        if (row.affinity === "follows_kid") {
          row.confirmed_with_kid = p.confirmed_with_kid;
        }
      }
      out.push(row);
    }

    items.forEach((it) => {
      if (it.default_affinity === "follows_kid" && (it.kind === "travel" || it.kind === "sports")) {
        push({
          id: "pli_" + it.id,
          item_ref: it.id,
          name: it.name,
          required: true,
          packed: false,
          left_behind: false,
          affinity: "follows_kid",
          confirmed_with_kid: null,
          note: "Confirm with kid / other house",
          critical: true,
        });
      }
    });

    if (weather && (weather.rainy || weather.cold)) {
      const jacket = items.find((i) => i.category === "jacket");
      if (jacket) {
        push({
          id: "pli_weather_" + jacket.id,
          item_ref: jacket.id,
          name: jacket.name,
          required: true,
          packed: false,
          left_behind: false,
          affinity: jacket.default_affinity || "follows_kid",
          confirmed_with_kid: jacket.default_affinity === "follows_kid" ? null : undefined,
          note: "Weather",
          critical: true,
        });
      }
      const boots = items.find((i) => i.category === "boots");
      if (boots && weather.rainy) {
        push({
          id: "pli_weather_" + boots.id,
          item_ref: boots.id,
          name: boots.name,
          required: true,
          packed: false,
          left_behind: false,
          affinity: boots.default_affinity || "dad_house",
          note: "Rain",
          critical: true,
        });
      }
    }

    // Staples NEVER on critical traveler list (Product/Orchestrator 2026-09-14).
    // low/out → restock alert on Today only (see renderRestockAlert), not a pack row.

    // Preserve one-offs from prev
    if (prevList && !wipePacked) {
      (prevList.items || []).forEach((x) => {
        if (x.one_off) {
          push({
            id: x.id,
            item_ref: x.item_ref,
            name: x.name,
            required: true,
            packed: !!x.packed,
            left_behind: !!x.left_behind,
            affinity: "follows_kid",
            confirmed_with_kid: x.confirmed_with_kid == null ? null : !!x.confirmed_with_kid,
            note: x.note || "One-off · Confirm with kid",
            one_off: true,
            critical: true,
          });
        }
      });
    }

    // Rank: follows_kid first, then weather, then staples, then rest
    out.sort((a, b) => {
      const rank = (x) =>
        x.affinity === "follows_kid" ? 0 : x.note && /Weather|Rain/.test(x.note) ? 1 : x.note && /Staple/.test(x.note) ? 2 : 3;
      return rank(a) - rank(b);
    });

    return {
      id: "pack_" + handoff.id,
      handoff_id: handoff.id,
      generated_at: new Date().toISOString(),
      weather_snapshot: weather
        ? {
            fetched_at: weather.fetched_at,
            summary: weather.summary,
            temp_f: weather.temp_f,
          }
        : null,
      items: out,
    };
  }

  async function ensureList(handoff, forceRegen) {
    const prev = state.packingLists[handoff.id] || null;
    if (prev && !forceRegen) return prev;
    let weather = null;
    try {
      weather = await fetchWeather();
      state.weatherSource = weather.source;
    } catch (_) {
      weather = stubWeather();
      state.weatherSource = weather.source;
    }
    const list = generatePackingList(handoff, weather, prev, false);
    handoff.weather_snapshot = list.weather_snapshot;
    handoff.packing_list_id = list.id;
    state.packingLists[handoff.id] = list;
    state.lastRefreshedAt = new Date().toISOString();
    saveState();
    return list;
  }

  function openFollowsCount(list) {
    return (list.items || []).filter(
      (i) => i.affinity === "follows_kid" && i.confirmed_with_kid !== true && !i.left_behind
    ).length;
  }

  function dadHouseUnresolved(list) {
    return (list.items || []).filter(
      (i) =>
        i.affinity !== "follows_kid" &&
        !i.packed &&
        !i.left_behind
    ).length;
  }

  function travelerCount(list) {
    return ((list && list.items) || []).length;
  }

  function isEmptyWin(list) {
    // Empty Travelers + house already doubled / nothing unduplicable = success
    return travelerCount(list) === 0;
  }

  function statusCopy(list) {
    const stale = listIsStale();
    const refreshed = state.lastRefreshedAt
      ? formatTimeShort(state.lastRefreshedAt)
      : "—";

    if (isEmptyWin(list)) {
      return {
        text: "Dad-house ready · 0 travelers",
        cls: "win",
      };
    }

    const n = openFollowsCount(list);

    if (n > 0) {
      return {
        text: "Dad-house ready · " + n + " to confirm with kid",
        cls: "amber",
      };
    }
    if (stale) {
      return {
        text:
          "Dad-house ready · 0 to confirm with kid · list from " + refreshed,
        cls: "stale",
      };
    }
    if (dadHouseUnresolved(list) === 0) {
      return { text: "Dad-house ready · packing done", cls: "done" };
    }
    return {
      text: "Dad-house ready · " + dadHouseUnresolved(list) + " still to pack",
      cls: "neutral",
    };
  }

  function criticalSplit(list) {
    const items = list.items || [];
    const critical = items.filter((i) => i.critical !== false).slice(0, MAX_CRITICAL);
    // If more than 5 total, rest under More — prefer keeping follows_kid in critical
    if (items.length <= MAX_CRITICAL) {
      return { critical: items, more: [] };
    }
    const ranked = items.slice().sort((a, b) => {
      const r = (x) => (x.affinity === "follows_kid" ? 0 : x.critical ? 1 : 2);
      return r(a) - r(b);
    });
    return {
      critical: ranked.slice(0, MAX_CRITICAL),
      more: ranked.slice(MAX_CRITICAL),
    };
  }

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("hidden", el.dataset.screen !== name);
    });
    if (window.DadHouseFeedback && DadHouseFeedback.syncVisibility) {
      DadHouseFeedback.syncVisibility();
    }
  }

  function updateBanner() {
    const el = $("banner");
    if (!el) return;
    // MUST use isOnline() — includes forceOffline/probeOffline/offlineSim.
    // navigator.onLine alone lies under DevTools Offline (probes 503 while onLine stays true).
    const online = state ? isOnline() : navigator.onLine !== false;
    const refreshed =
      state && state.lastRefreshedAt
        ? formatTimeShort(state.lastRefreshedAt)
        : "—";
    el.classList.remove("hidden", "stale", "offline");
    el.removeAttribute("hidden");
    el.style.display = "block";
    if (!online) {
      el.classList.add("offline");
      el.setAttribute("data-offline", "1");
      el.textContent =
        "Offline · list from " + refreshed + " · Weather may be stale.";
      return;
    }
    el.removeAttribute("data-offline");
    const stale = state ? listIsStale() : true;
    if (stale) {
      el.classList.add("stale");
      el.textContent =
        "Last refreshed " + refreshed + " · pull to update · Weather may be stale.";
    } else {
      el.textContent = "Last refreshed " + refreshed;
    }
  }


  function renderRestockAlert() {
    let el = document.getElementById("restock-alert");
    if (!el) {
      el = document.createElement("div");
      el.id = "restock-alert";
      el.className = "card restock-alert hidden";
      const block = document.getElementById("handoff-block");
      const status = document.getElementById("status-line");
      if (block && status && status.parentNode === block) {
        block.insertBefore(el, status.nextSibling);
      } else if (block) {
        block.appendChild(el);
      } else {
        return;
      }
    }
    const lows = [];
    ((seed && seed.house_inventory) || []).forEach((inv) => {
      if (inv.stock_state === "low" || inv.stock_state === "out") {
        const label = inv.staple_category || inv.item_id || "staple";
        lows.push(label + ": " + inv.stock_state);
      }
    });
    if (!lows.length) {
      el.classList.add("hidden");
      el.innerHTML = "";
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML =
      '<p class="eyebrow">Restock (not a traveler)</p>' +
      "<p><strong>" +
      lows.map(escapeHtml).join(" · ") +
      "</strong> — buy for Dad’s drawers; don’t put on the handoff list.</p>" +
      '<p><a class="restock-link" href="replenish/">Open replenish draft →</a></p>';
  }

  function renderSizeNag(kidId) {
    let nag = $("size-nag");
    if (!nag) {
      nag = document.createElement("div");
      nag.id = "size-nag";
      nag.className = "card nag-card";
      const block = $("handoff-block");
      if (block) block.insertBefore(nag, block.firstChild);
    }
    const sr = sizeRecordFor(kidId);
    if (sizeIsStale(sr)) {
      nag.classList.remove("hidden");
      nag.innerHTML =
        "<p><strong>Sizes may be last season</strong> — update when you can. (Should · non-blocking)</p>";
    } else {
      nag.classList.add("hidden");
      nag.innerHTML = "";
    }
  }

  function cycleDadHouse(item) {
    // unpacked → packed → left_behind → unpacked
    if (!item.packed && !item.left_behind) {
      item.packed = true;
      item.left_behind = false;
    } else if (item.packed && !item.left_behind) {
      item.packed = false;
      item.left_behind = true;
    } else {
      item.packed = false;
      item.left_behind = false;
    }
  }

  function cycleFollows(item) {
    // null/unsure → Kid has it → Still unsure
    if (item.confirmed_with_kid === true) {
      item.confirmed_with_kid = false;
    } else {
      item.confirmed_with_kid = true;
    }
    item.packed = false; // never green ✓ certainty
  }

  function rowHtml(item, inline) {
    const follows = item.affinity === "follows_kid";
    const left = !!item.left_behind;
    const packed = !!item.packed && !follows;
    const kidHas = follows && item.confirmed_with_kid === true;
    const unsure = follows && item.confirmed_with_kid !== true;

    let cls = "check-item";
    if (follows) cls += " uncertain";
    if (kidHas) cls += " kid-has";
    if (packed) cls += " packed";
    if (left) cls += " left-behind";

    let badge = "";
    if (follows) {
      badge = kidHas
        ? '<span class="badge badge-ok">Kid has it</span>'
        : '<span class="badge badge-uncertain">Still unsure</span>';
    } else if (left) {
      badge = '<span class="badge badge-left">Left at Dad’s</span>';
    } else if (packed) {
      badge = '<span class="badge badge-packed-only">Packed</span>';
    } else {
      badge = '<span class="badge badge-dad">At Dad’s</span>';
    }

    let mark = "";
    if (follows) mark = kidHas ? "✓?" : "?";
    else if (left) mark = "↩";
    else if (packed) mark = "✓";

    return (
      '<li class="' +
      cls +
      '" data-id="' +
      escapeHtml(item.id) +
      '">' +
      '<button type="button" class="check-toggle" aria-label="Toggle">' +
      mark +
      "</button>" +
      '<div class="item-body">' +
      '<p class="item-name">' +
      escapeHtml(item.name) +
      "</p>" +
      '<p class="item-meta">' +
      badge +
      " " +
      escapeHtml(item.note || "") +
      "</p>" +
      "</div></li>"
    );
  }

  function bindRowClicks(container, list, thenRender) {
    container.querySelectorAll(".check-item").forEach((li) => {
      const id = li.dataset.id;
      const item = (list.items || []).find((x) => x.id === id);
      if (!item) return;
      // Full row is the hit target (craft §9 thumb / one-handed lot)
      li.addEventListener("click", () => {
        if (item.affinity === "follows_kid") cycleFollows(item);
        else cycleDadHouse(item);
        saveState();
        thenRender();
      });
    });
  }

  async function renderToday() {
    const empty = $("empty-state");
    const sheet = $("add-sheet");
    const block = $("handoff-block");
    const h = activeHandoff();

    updateBanner();

    if (!h) {
      empty.classList.remove("hidden");
      block.classList.add("hidden");
      if (!sheet.classList.contains("open-force")) sheet.classList.add("hidden");
      return;
    }

    empty.classList.add("hidden");
    sheet.classList.add("hidden");
    block.classList.remove("hidden");
    state.activeHandoffId = h.id;

    let list = state.packingLists[h.id];
    if (!list) {
      list = await ensureList(h, true);
    }
    if (state._forceEmptyTravelers) {
      list.items = [];
      state.packingLists[h.id] = list;
      saveState();
    }

    const name = kidName((h.kid_ids || [])[0]);
    const offlineSafe = !isOnline();
    const msLeft = new Date(h.starts_at).getTime() - Date.now();
    const countdownClass = msLeft > 3 * 60 * 60 * 1000 ? "countdown far" : "countdown near";
    const t12 = isT12hWindow(h);
    $("next-handoff-card").innerHTML =
      '<p class="eyebrow">' + (t12 ? "Tonight / morning · primary" : "Next handoff") + "</p>" +
      "<h2>" +
      escapeHtml(name) +
      " · Handoff" +
      (offlineSafe ? "" : " " + escapeHtml(formatTimeShort(h.starts_at))) +
      "</h2>" +
      '<div class="' + countdownClass + '">' +
      escapeHtml(countdownText(h.starts_at)) +
      "</div>" +
      '<p class="meta">' +
      escapeHtml(formatWhen(h.starts_at)) +
      "</p>" +
      '<p class="meta">' +
      escapeHtml(h.location_text || "Location TBD") +
      (isOvernight(h) ? " · overnight" : "") +
      "</p>";

    const st = statusCopy(list);
    $("status-line").className = "card status-card " + st.cls;
    $("status-line").textContent = st.text;

    renderSizeNag((h.kid_ids || [])[0]);
    renderRestockAlert();

    const emptyWin = $("empty-win");
    const split = criticalSplit(list);
    const crit = $("today-critical");
    const moreWrap = $("today-more");
    const moreList = $("today-more-list");
    const moreSum = $("today-more-summary");
    const actions = document.querySelector("#handoff-block .actions");

    if (isEmptyWin(list)) {
      // Success-empty: never nag "Add items" / "Build your list"
      if (emptyWin) emptyWin.classList.remove("hidden");
      crit.innerHTML = "";
      moreWrap.classList.add("hidden");
      moreList.innerHTML = "";
      if (actions) actions.classList.add("hidden");
    } else {
      if (emptyWin) emptyWin.classList.add("hidden");
      if (actions) actions.classList.remove("hidden");
      crit.innerHTML = split.critical.map((i) => rowHtml(i, true)).join("");
      bindRowClicks(crit, list, renderToday);

      if (split.more.length) {
        moreWrap.classList.remove("hidden");
        moreSum.textContent =
          "More (not blocking lot) · " + split.more.length + " hidden";
        moreList.innerHTML = split.more.map((i) => rowHtml(i, true)).join("");
        bindRowClicks(moreList, list, renderToday);
      } else {
        moreWrap.classList.add("hidden");
        moreList.innerHTML = "";
      }
    }
  }

  function renderChecklist() {
    const h = activeHandoff();
    if (!h) {
      showScreen("today");
      renderToday();
      return;
    }
    const list = state.packingLists[h.id];
    if (!list) return;

    const name = kidName((h.kid_ids || [])[0]);
    $("checklist-eyebrow").textContent =
      formatWhen(h.starts_at) + " · " + (h.location_text || "");
    $("checklist-title").textContent = name + " — what should leave with you";

    const w = list.weather_snapshot || h.weather_snapshot;
    const wEl = $("weather-line");
    if (w) {
      wEl.innerHTML =
        "<strong>" +
        escapeHtml(w.summary || "Weather") +
        "</strong>" +
        (w.temp_f != null ? " · " + Math.round(w.temp_f) + "°F" : "") +
        '<div class="src">Weather may be stale · source: ' +
        escapeHtml(state.weatherSource || "stub") +
        (!isOnline() ? " · offline" : "") +
        "</div>";
    } else {
      wEl.textContent = "Weather unavailable · using last list";
    }

    const st = statusCopy(list);
    $("checklist-status").className = "pct-line " + st.cls;
    $("checklist-status").textContent = st.text;

    const split = criticalSplit(list);
    const ul = $("checklist");
    if (isEmptyWin(list)) {
      ul.innerHTML =
        '<li class="check-item empty-win-row"><div class="item-body">' +
        '<p class="item-name">You’re set for tonight</p>' +
        '<p class="item-meta">Nothing special needs to travel — Dad house already has the doubles. That’s a win.</p>' +
        "</div></li>";
    } else {
    ul.innerHTML = split.critical.map((i) => rowHtml(i, false)).join("");
    }
    bindRowClicks(ul, list, () => {
      renderChecklist();
      renderToday();
    });

    const moreWrap = $("more-items");
    const moreList = $("checklist-more");
    const moreSum = $("more-summary");
    if (split.more.length) {
      moreWrap.classList.remove("hidden");
      moreSum.textContent =
        "More (not blocking lot) · " + split.more.length + " hidden";
      moreList.innerHTML = split.more.map((i) => rowHtml(i, false)).join("");
      bindRowClicks(moreList, list, () => {
        renderChecklist();
        renderToday();
      });
    } else {
      moreWrap.classList.add("hidden");
      moreList.innerHTML = "";
    }

    updateBanner();
  }

  function openAddSheet() {
    $("empty-state").classList.add("hidden");
    $("add-sheet").classList.remove("hidden");
    addWhen = "tomorrow";
    document.querySelectorAll("#when-chips .chip").forEach((c) => {
      c.classList.toggle("chip-active", c.dataset.when === "tomorrow");
    });
    $("pick-datetime-wrap").classList.add("hidden");
    const kids = seed.kids || [];
    addKidId = kids[0] ? kids[0].id : null;
    const whoWrap = $("who-wrap");
    const whoChips = $("who-chips");
    if (kids.length > 1) {
      whoWrap.classList.remove("hidden");
      whoChips.innerHTML = kids
        .map(
          (k, i) =>
            '<button type="button" class="chip' +
            (i === 0 ? " chip-active" : "") +
            '" data-kid="' +
            escapeHtml(k.id) +
            '">' +
            escapeHtml(k.display_name) +
            "</button>"
        )
        .join("");
      whoChips.querySelectorAll(".chip").forEach((c) => {
        c.addEventListener("click", () => {
          whoChips.querySelectorAll(".chip").forEach((x) => x.classList.remove("chip-active"));
          c.classList.add("chip-active");
          addKidId = c.dataset.kid;
        });
      });
    } else {
      whoWrap.classList.add("hidden");
    }
  }

  function closeAddSheet() {
    $("add-sheet").classList.add("hidden");
    if (!activeHandoff()) $("empty-state").classList.remove("hidden");
  }

  function whenToIso() {
    const now = new Date();
    if (addWhen === "pick") {
      const v = $("paste-datetime").value;
      if (!v) return null;
      const picked = new Date(v);
      if (picked.getTime() <= now.getTime()) {
        // Bump to next hour if user picked a past time
        const d = new Date(now);
        d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() + 1);
        return d.toISOString();
      }
      return picked.toISOString();
    }
    if (addWhen === "tomorrow") {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(7, 20, 0, 0);
      return d.toISOString();
    }
    // Today: at least 1 hour ahead — never Past handoff
    const d = new Date(now.getTime() + 60 * 60 * 1000);
    d.setSeconds(0, 0);
    return d.toISOString();
  }

  async function saveHandoff() {
    const iso = whenToIso();
    if (!iso) {
      alert("Pick a date + time");
      return;
    }
    const kids = seed.kids || [];
    const kidId = addKidId || (kids[0] && kids[0].id);
    if (!kidId) {
      alert("Add a kid first");
      return;
    }
    const h = {
      id: "handoff_" + Date.now(),
      dad_user_id: seed.dad_user_id || "dad_demo_001",
      kid_ids: [kidId],
      starts_at: iso,
      location_text: ($("paste-location").value || "").trim() || "School lot",
      direction: "to_dad",
      overnight: true,
      status: "upcoming",
    };
    state.handoffs.unshift(h);
    state.activeHandoffId = h.id;
    saveState();
    closeAddSheet();
    $("handoff-block").classList.remove("hidden");
    await ensureList(h, true);
    await renderToday();
  }

  function bind() {
    $("btn-open-add-handoff").addEventListener("click", openAddSheet);
    $("btn-add-another").addEventListener("click", openAddSheet);
    $("btn-cancel-add").addEventListener("click", closeAddSheet);
    $("btn-save-handoff").addEventListener("click", () => {
      saveHandoff();
    });

    document.querySelectorAll("#when-chips .chip").forEach((c) => {
      c.addEventListener("click", () => {
        document
          .querySelectorAll("#when-chips .chip")
          .forEach((x) => x.classList.remove("chip-active"));
        c.classList.add("chip-active");
        addWhen = c.dataset.when;
        $("pick-datetime-wrap").classList.toggle("hidden", addWhen !== "pick");
      });
    });

    $("btn-open-checklist").addEventListener("click", async () => {
      const h = activeHandoff();
      if (!h) return;
      await ensureList(h, false);
      showScreen("checklist");
      renderChecklist();
    });

    $("btn-back").addEventListener("click", () => {
      showScreen("today");
      renderToday();
    });

    $("btn-add-one-off").addEventListener("click", () => {
      const h = activeHandoff();
      if (!h) return;
      const list = state.packingLists[h.id];
      if (!list) return;
      const name = ($("one-off-input").value || "").trim();
      if (!name) return;
      list.items.push({
        id: "oneoff_" + Date.now(),
        name: name,
        required: true,
        packed: false,
        left_behind: false,
        affinity: "follows_kid",
        confirmed_with_kid: null,
        note: "One-off · Confirm with kid",
        one_off: true,
        critical: true,
      });
      $("one-off-input").value = "";
      saveState();
      renderChecklist();
      renderToday();
    });

    $("btn-regen").addEventListener("click", async () => {
      const h = activeHandoff();
      if (!h) return;
      const prev = state.packingLists[h.id];
      const ok = confirm(
        "Update suggestions from weather? Packed / left-behind / confirm-with-kid states stay."
      );
      if (!ok) return;
      // force regen but preserve state inside generatePackingList
      delete state.packingLists[h.id];
      await ensureList(h, true);
      // ensureList already merges via prev — re-pass: we deleted so need to merge manually
      if (prev) {
        const list = state.packingLists[h.id];
        (prev.items || []).forEach((p) => {
          const hit = (list.items || []).find(
            (x) => x.item_ref === p.item_ref || x.name === p.name
          );
          if (hit) {
            hit.packed = p.packed;
            hit.left_behind = p.left_behind;
            hit.confirmed_with_kid = p.confirmed_with_kid;
          } else if (p.one_off) {
            list.items.push(p);
          }
        });
        saveState();
      }
      renderChecklist();
      renderToday();
    });

    // Soft secondary only when success-empty (never primary nag)
    const addTravelerBtn = $("btn-add-traveler");
    if (addTravelerBtn && !addTravelerBtn._bound) {
      addTravelerBtn._bound = true;
      addTravelerBtn.addEventListener("click", () => {
        const h = activeHandoff();
        if (!h) return;
        showScreen("checklist");
        renderChecklist();
        const input = $("one-off-input");
        if (input) {
          input.focus();
          input.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        if (window.DadHouseFeedback && DadHouseFeedback.syncVisibility) {
          DadHouseFeedback.syncVisibility();
        }
      });
    }

    // Dev only (?demo=1): clear handoffs + show internal footers. Hidden for ICP/stills.
    const params0 = new URLSearchParams(location.search);
    const demoMode = params0.get("demo") === "1";
    if (params0.get("offline") === "1") {
      state.offlineSim = true;
      state.forceOffline = true;
      state.probeOffline = true;
    }
    // Demo: force empty travelers = win (Dad house already doubled)
    if (params0.get("empty_travelers") === "1" || params0.get("win") === "1") {
      state._forceEmptyTravelers = true;
    }
    document.querySelectorAll(".foot-note, .dev-only").forEach((el) => {
      el.classList.toggle("hidden", !demoMode);
    });
    // Demo: explicit Offline latch toggle (does not rely on DevTools)
    let offBtn = $("btn-toggle-offline");
    if (demoMode) {
      if (!offBtn) {
        offBtn = document.createElement("button");
        offBtn.type = "button";
        offBtn.id = "btn-toggle-offline";
        offBtn.className = "linkish dev-only";
        const foot = document.querySelector("#screen-today .foot-note");
        if (foot) foot.parentNode.insertBefore(offBtn, foot);
      }
      const syncOffLabel = () => {
        offBtn.textContent = state.offlineSim
          ? "Sim offline: ON (tap to clear)"
          : "Sim offline: OFF (tap to latch)";
      };
      syncOffLabel();
      offBtn.classList.remove("hidden");
      offBtn.onclick = () => {
        state.offlineSim = !state.offlineSim;
        if (state.offlineSim) {
          state.forceOffline = true;
          state.probeOffline = true;
        }
        syncOffLabel();
        updateBanner();
        renderToday();
      };
    } else if (offBtn) {
      offBtn.classList.add("hidden");
    }
    let clearBtn = $("btn-clear-handoffs");
    if (demoMode) {
      if (!clearBtn) {
        clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.id = "btn-clear-handoffs";
        clearBtn.className = "linkish dev-only";
        clearBtn.textContent = "Clear handoffs (empty test)";
        const foot = document.querySelector("#screen-today .foot-note");
        if (foot) foot.parentNode.insertBefore(clearBtn, foot);
      }
      clearBtn.classList.remove("hidden");
      clearBtn.addEventListener("click", () => {
        if (!confirm("Clear all handoffs for empty-state test?")) return;
        state.handoffs = [];
        state.packingLists = {};
        state.activeHandoffId = null;
        saveState();
        showScreen("today");
        renderToday();
      });
    } else if (clearBtn) {
      clearBtn.classList.add("hidden");
    }

    window.addEventListener("online", () => {
      updateBanner();
      renderToday();
    });
    window.addEventListener("offline", () => {
      updateBanner();
      renderToday();
    });

    if (window.DadHouseFeedback && typeof DadHouseFeedback.mount === "function") {
      DadHouseFeedback.mount({
        defaultScreen: "today",
        visibleOn: ["today", "checklist"],
        getScreen: function () {
          var vis = document.querySelector(".screen:not(.hidden)");
          return vis && vis.dataset ? vis.dataset.screen : "today";
        },
        getHandoffId: function () {
          try {
            var h = activeHandoff();
            return h ? h.id : null;
          } catch (_) {
            return null;
          }
        },
      });
    }
  }

  async function loadSeed() {
    const paths = [
      "fixtures/seed.json",
      "../../schema/fixtures/example.json",
    ];
    for (const p of paths) {
      try {
        const res = await fetch(p);
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    throw new Error("Could not load seed fixtures");
  }

  // Paint banner immediately (survives Offline reload before seed fetch)
  function paintBannerEarly() {
    try { updateBanner(); } catch (_) {}
  }
  window.addEventListener("offline", paintBannerEarly);
  window.addEventListener("online", paintBannerEarly);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { paintBannerEarly(); });
  } else {
    paintBannerEarly();
  }
  // Connection watch starts after init has state; offline events still paint early


  function mustStayOffline() {
    const params = new URLSearchParams(location.search);
    return params.get("offline") === "1" || !!(state && state.offlineSim);
  }

  async function probeConnection() {
    if (!state) {
      updateBanner();
      return;
    }

    // Hard QA / sim latch — NEVER clear while ?offline=1 or offlineSim
    if (mustStayOffline()) {
      state.forceOffline = true;
      state.probeOffline = true;
      state.onlineStreak = 0;
      updateBanner();
      return;
    }

    // Browser offline bit
    if (navigator.onLine === false) {
      state.forceOffline = true;
      state.probeOffline = true;
      state.onlineStreak = 0;
      updateBanner();
      return;
    }

    // Network probe (dedicated path — SW must not CACHE)
    let ok = false;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2000);
      const res = await fetch("./__dadhouse_probe?" + Date.now(), {
        method: "GET",
        cache: "no-store",
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      ok =
        res.status === 204 &&
        res.headers.get("x-dadhouse-sw") === "network";
    } catch (_) {
      ok = false;
    }

    if (!ok) {
      state.forceOffline = true;
      state.probeOffline = true;
      state.onlineStreak = 0;
    } else if (state.forceOffline || state.probeOffline) {
      // Sticky clear: need 3 consecutive successes while onLine
      state.onlineStreak = (state.onlineStreak || 0) + 1;
      if (state.onlineStreak >= 3) {
        state.forceOffline = false;
        state.probeOffline = false;
        state.onlineStreak = 0;
      }
      // else keep latched offline despite one optimistic success
    } else {
      state.onlineStreak = 0;
      state.forceOffline = false;
      state.probeOffline = false;
    }

    updateBanner();
    try {
      const checklist = $("screen-checklist");
      if (checklist && !checklist.classList.contains("hidden")) renderChecklist();
    } catch (_) {}
  }

  function startConnectionWatch() {
    const tick = () => {
      try {
        probeConnection();
      } catch (_) {
        updateBanner();
      }
    };
    tick();
    setInterval(tick, 2000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pageshow", tick);
    window.addEventListener("offline", () => {
      if (state) {
        state.forceOffline = true;
        state.probeOffline = true;
        state.onlineStreak = 0;
      }
      updateBanner();
      try {
        renderToday();
      } catch (_) {}
      try {
        const checklist = $("screen-checklist");
        if (checklist && !checklist.classList.contains("hidden")) renderChecklist();
      } catch (_) {}
    });
    window.addEventListener("online", () => {
      // Do not clear latch — probeConnection requires 3 successes
      probeConnection();
      try {
        renderToday();
      } catch (_) {}
    });
  }

  async function init() {
    seed = await loadSeed();
    // Ensure inventory has stock_state
    (seed.house_inventory || []).forEach((inv) => {
      if (!inv.stock_state) inv.stock_state = "ok";
    });

    const saved = loadState();
    state = defaultState(seed);
    if (saved && saved.handoffs) {
      state.handoffs = saved.handoffs;
      state.packingLists = saved.packingLists || {};
      state.lastRefreshedAt = saved.lastRefreshedAt || null;
      state.activeHandoffId = saved.activeHandoffId || null;
      // merge new fixture handoffs
      (seed.handoffs || []).forEach((fh) => {
        if (!state.handoffs.some((h) => h.id === fh.id)) state.handoffs.push(fh);
      });
    }

    bind();

    // Red-Team empty test: ?empty=1 clears handoffs (fixture path)
    const params = new URLSearchParams(location.search);
    if (params.get("empty") === "1") {
      state.handoffs = [];
      state.packingLists = {};
      state.activeHandoffId = null;
      saveState();
    }
    if (params.get("resetsw") === "1" && "serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}
    }

    // Cold open → next handoff Today
    const h = nextHandoff();
    if (h) {
      state.activeHandoffId = h.id;
      if (!state.packingLists[h.id]) await ensureList(h, true);
    }

    showScreen("today");
    await renderToday();
    updateBanner();
    startConnectionWatch();

    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("sw.js");
      } catch (_) {}
    }
  }

  init().catch((err) => {
    console.error(err);
    // Still show offline banner + any cached localStorage shell
    try {
      const saved = loadState();
      if (saved) {
        state = saved;
        if (!state.packingLists) state.packingLists = {};
        if (!state.handoffs) state.handoffs = [];
      } else if (!state) {
        state = { handoffs: [], packingLists: {}, lastRefreshedAt: null, activeHandoffId: null };
      }
      if (!seed) seed = { kids: [], items: [], size_records: [], house_inventory: [], handoffs: [] };
      bind();
      showScreen("today");
      renderToday();
    } catch (e2) {
      console.error(e2);
    }
    updateBanner();
    const card = $("empty-state");
    if (card && !(state && state.handoffs && state.handoffs.length)) {
      card.classList.remove("hidden");
      const msg = document.createElement("p");
      msg.className = "muted";
      msg.textContent = "Cached shell · " + String(err.message || err);
      card.appendChild(msg);
    }
  });
})();
