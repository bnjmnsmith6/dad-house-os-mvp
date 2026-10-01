/* Dad's Second Home Checklist v1 (vanilla JS, static, localStorage only).
 * Content lives in checklist-data.js. No account, no cookies. No third-party script
 * loads unless the counter is switched on below.
 */
(function () {
  "use strict";

  /* ---------- Signals (locked Sep 27): started, finished, marked_travels, came_back ----------
   * Counter: GoatCounter (hosted, free). OFF until BOTH lines below are set:
   *   GOATCOUNTER_CODE = "<site code>"   (the part before .goatcounter.com)
   *   COUNTER_ENABLED = true
   * While off, nothing loads and nothing leaves the phone.
   * Sent per event: path = title = event name, event = true, referrer = the ?ref= partner tag
   * (or "" so the browser's referrer URL is never used). We also strip count.js's screen
   * width (s) and page query string (q). No ID, no date. GoatCounter sets no cookies. */
  var COUNTER_ENABLED = false;
  var GOATCOUNTER_CODE = ""; // empty = off
  var COUNTER_SUPPORTS_PROPS = false; // GoatCounter events carry only a name => came_back_travels_yes / _no
  var GC_SCRIPT = "https://gc.zgo.at/count.js";
  var GC_TIMEOUT_MS = 10000;
  var gc = { status: "idle", queue: [] }; // idle | loading | ready | failed
  function counterOn() {
    return COUNTER_ENABLED && /^[a-z0-9-]+$/.test(GOATCOUNTER_CODE);
  }
  function gcFlush() {
    var q = gc.queue;
    gc.queue = [];
    q.forEach(function (ev) {
      try {
        window.goatcounter.count({ path: ev.name, title: ev.name, event: true, referrer: ev.ref || "" });
      } catch (_) {}
    });
  }
  function gcFail() { gc.status = "failed"; gc.queue = []; } // blocked or offline: drop silently
  function gcLoad() {
    if (gc.status !== "idle") return;
    gc.status = "loading";
    try {
      window.goatcounter = { no_onload: true, no_events: true }; // no automatic pageview / click binding
      var sc = document.createElement("script");
      sc.async = true;
      sc.src = GC_SCRIPT;
      sc.setAttribute("data-goatcounter", "https://" + GOATCOUNTER_CODE + ".goatcounter.com/count");
      var timer = setTimeout(function () { if (gc.status === "loading") gcFail(); }, GC_TIMEOUT_MS);
      sc.onload = function () {
        clearTimeout(timer);
        var g = window.goatcounter;
        if (!g || typeof g.count !== "function") return gcFail();
        if (typeof g.get_data === "function") {
          var orig = g.get_data;
          g.get_data = function (vars) { var d = orig(vars); delete d.s; delete d.q; return d; };
        }
        gc.status = "ready";
        gcFlush();
      };
      sc.onerror = function () { clearTimeout(timer); gcFail(); };
      document.head.appendChild(sc);
    } catch (_) { gcFail(); }
  }
  function send(name, props) {
    if (!counterOn() || gc.status === "failed") return;
    gc.queue.push({ name: name, ref: props && props.ref });
    if (gc.status === "ready") gcFlush(); else gcLoad();
  }
  var trackLog = (window.__clTrackLog = []); // in-page only, for QA; never stored or sent
  function track(name, props) {
    props = props || {};
    if (state.ref) props.ref = state.ref;
    if (name === "came_back" && !COUNTER_SUPPORTS_PROPS) {
      name = "came_back_travels_" + props.travels;
      delete props.travels;
    }
    trackLog.push({ name: name, props: props });
    if (window.console && console.debug) console.debug("[checklist track]", name, props, counterOn() ? "" : "(counter off)");
    if (!counterOn()) return;
    try { send(name, props); } catch (_) {}
  }

  /* ---------- Storage ---------- */
  var KEY = "dadhouse_checklist_v1";
  var EVENTS_KEY = "dadhouse_checklist_events_v1"; // once-per-phone flags; kept apart from the list
  var DAY = 86400000;
  var RETURN_GAP = 3 * DAY;
  var CONTENT = window.CHECKLIST_CONTENT;
  var CHOICES = ["have", "need", "travels"];
  var SHORT = { have: "Have", need: "Need", travels: "Travels" };

  function read(k, fallback) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : fallback; }
    catch (_) { return fallback; }
  }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  var state = read(KEY, null) || {
    v: 1, started: false, finished: false, kids: [], marks: {}, sizes: {}, packed: {},
    room: 0, lastVisit: null, ref: null
  };
  ["marks", "sizes", "packed"].forEach(function (k) { if (!state[k] || typeof state[k] !== "object") state[k] = {}; });
  if (!Array.isArray(state.kids)) state.kids = [];
  var fired = read(EVENTS_KEY, {});
  function save() { write(KEY, state); }
  function once(name, props) {
    if (fired[name]) return;
    fired[name] = true;
    write(EVENTS_KEY, fired);
    track(name, props);
  }

  /* ---------- Partner tag: ?ref= read from URL, kept on the phone (first tag wins) ---------- */
  function readRef() {
    var raw = new URLSearchParams(location.search).get("ref");
    if (!raw) return;
    var clean = String(raw).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (clean && !state.ref) { state.ref = clean; save(); }
  }

  /* ---------- Came back after 3+ days (phone computes; fires on every such return) ---------- */
  function anyTravels() {
    return Object.keys(state.marks).some(function (id) { return state.marks[id] === "travels" && itemById[id]; });
  }
  function checkReturn(now) {
    var stored = read(KEY, null); // re-read: another tab may have been open since
    var last = stored && typeof stored.lastVisit === "number" ? stored.lastVisit : state.lastVisit;
    if (typeof last === "number" && now - last >= RETURN_GAP) {
      track("came_back", { travels: anyTravels() ? "yes" : "no" });
    }
    state.lastVisit = now;
    save();
  }

  /* ---------- Content helpers ---------- */
  var itemById = {};
  CONTENT.rooms.forEach(function (r) {
    r.main.concat(r.more).forEach(function (it) { itemById[it.id] = it; });
  });
  function bands() { return state.kids.map(function (k) { return k.age; }).filter(Boolean); }
  function fits(it) {
    var b = bands();
    if (!it.ages || !b.length) return true;
    return b.some(function (x) { return it.ages.indexOf(x) !== -1; });
  }
  function visibleRooms() {
    return CONTENT.rooms.map(function (r) {
      return { id: r.id, name: r.name, main: r.main.filter(fits), more: r.more.filter(fits) };
    }).filter(function (r) { return r.main.length || r.more.length; });
  }
  function kidCount() { return Math.max(1, state.kids.length); }
  function kidLabel(i) {
    if (state.kids.length < 2) return "Size";
    var k = state.kids[i] || {};
    var band = CONTENT.ageBands.filter(function (b) { return b.id === k.age; })[0];
    return "Kid " + (i + 1) + (band ? " (" + band.label.split(" ")[0].toLowerCase() + ")" : "");
  }
  function orderedIds(stateName) {
    var out = [];
    CONTENT.rooms.forEach(function (r) {
      r.main.concat(r.more).forEach(function (it) { if (state.marks[it.id] === stateName) out.push(it.id); });
    });
    return out;
  }
  function sizeText(id) {
    var s = state.sizes[id];
    if (!s) return "";
    var parts = [];
    for (var i = 0; i < kidCount(); i++) {
      if (s[i]) parts.push(state.kids.length > 1 ? "kid " + (i + 1) + ": " + s[i] : s[i]);
    }
    return parts.length ? " (size " + parts.join(", ") + ")" : "";
  }

  /* ---------- DOM ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var current = "intro";
  function show(name) {
    current = name;
    document.querySelectorAll(".screen").forEach(function (s) {
      s.classList.toggle("hidden", s.getAttribute("data-screen") !== name);
    });
    window.scrollTo(0, 0);
  }
  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add("hidden"); }, 2200);
  }

  /* ---------- Kids screen ---------- */
  function renderKids() {
    document.querySelectorAll(".cl-count .cl-chip").forEach(function (b) {
      b.classList.toggle("on", Number(b.getAttribute("data-count")) === state.kids.length);
    });
    var wrap = $("kid-ages");
    wrap.innerHTML = "";
    state.kids.forEach(function (k, i) {
      var row = el("div", "cl-kid-row");
      row.appendChild(el("p", null, state.kids.length > 1 ? "Kid " + (i + 1) : "Age"));
      var g = el("div", "cl-bands");
      CONTENT.ageBands.forEach(function (b) {
        var c = el("button", "cl-chip" + (k.age === b.id ? " on" : ""), b.label);
        c.type = "button";
        c.addEventListener("click", function () { k.age = k.age === b.id ? null : b.id; save(); renderKids(); });
        g.appendChild(c);
      });
      row.appendChild(g);
      wrap.appendChild(row);
    });
  }

  /* ---------- Room screen ---------- */
  function itemRow(it) {
    var li = el("li", "cl-item");
    li.setAttribute("data-id", it.id);
    var head = el("div", "cl-head");
    var name = el("span", "cl-name", it.name);
    head.appendChild(name);
    if (it.hint) head.appendChild(el("span", "cl-hint", "often travels"));
    li.appendChild(head);
    var sizeLink = null;
    if (it.size) {
      sizeLink = el("button", "cl-size-link");
      sizeLink.type = "button";
      head.appendChild(sizeLink);
    }
    var seg = el("div", "cl-seg");
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", it.name);
    var btns = {};
    function paint() {
      var s = state.marks[it.id] || "";
      li.className = "cl-item" + (s ? " s-" + s : "");
      CHOICES.forEach(function (c) { btns[c].setAttribute("aria-pressed", s === c ? "true" : "false"); });
    }
    CHOICES.forEach(function (c) {
      var b = el("button", "cl-opt cl-opt-" + c, SHORT[c]);
      b.type = "button";
      b.setAttribute("data-choice", c);
      b.addEventListener("click", function () {
        var next = state.marks[it.id] === c ? "" : c; // tap the selected one again to clear
        if (next) state.marks[it.id] = next; else delete state.marks[it.id];
        if (next !== "travels") delete state.packed[it.id];
        save();
        paint();
        if (next === "travels") once("marked_travels");
      });
      btns[c] = b;
      seg.appendChild(b);
    });
    li.appendChild(seg);
    paint();
    if (it.size) {
      var sz = el("div", "cl-sizes hidden");
      var paintLink = function () {
        var t = sizeText(it.id);
        sizeLink.textContent = t ? t.replace(/^ \((size )?|\)$/g, "").replace(/^/, "Size ") + " · edit" : "Add sizes";
        sizeLink.classList.toggle("has", !!t);
        sizeLink.setAttribute("aria-expanded", sz.classList.contains("hidden") ? "false" : "true");
      };
      sizeLink.addEventListener("click", function () {
        sz.classList.toggle("hidden");
        paintLink();
        if (!sz.classList.contains("hidden")) { var f = sz.querySelector("input"); if (f) f.focus(); }
      });
      for (var i = 0; i < kidCount(); i++) {
        (function (i) {
          var lab = el("label", null, state.kids.length > 1 ? "Kid " + (i + 1) : "Size");
          var inp = el("input");
          inp.type = "text";
          inp.inputMode = "text";
          inp.maxLength = 12;
          inp.placeholder = "optional";
          inp.autocomplete = "off";
          inp.value = (state.sizes[it.id] && state.sizes[it.id][i]) || "";
          inp.setAttribute("aria-label", it.name + " " + kidLabel(i).toLowerCase() + " (optional)");
          inp.addEventListener("input", function () {
            var arr = state.sizes[it.id] || [];
            arr[i] = inp.value.trim();
            state.sizes[it.id] = arr;
            save();
            paintLink();
          });
          lab.appendChild(inp);
          sz.appendChild(lab);
        })(i);
      }
      li.appendChild(sz);
      paintLink();
    }
    return li;
  }
  function renderRoom() {
    var rooms = visibleRooms();
    if (state.room >= rooms.length) state.room = rooms.length - 1;
    if (state.room < 0) state.room = 0;
    var r = rooms[state.room];
    $("room-step").textContent = "Room " + (state.room + 1) + " of " + rooms.length;
    $("room-name").textContent = r.name;
    var list = $("room-items");
    list.innerHTML = "";
    r.main.forEach(function (it) { list.appendChild(itemRow(it)); });
    var more = $("room-more");
    more.open = false;
    more.classList.toggle("hidden", !r.more.length);
    var moreMarked = r.more.filter(function (it) { return state.marks[it.id]; }).length;
    $("room-more-summary").textContent = "More ideas (" + r.more.length + ")" + (moreMarked ? " · " + moreMarked + " marked" : "");
    var ml = $("room-more-items");
    ml.innerHTML = "";
    r.more.forEach(function (it) { ml.appendChild(itemRow(it)); });
    $("btn-room-next").textContent = state.room === rooms.length - 1 ? "See my lists" : "Next room";
    save();
  }

  /* ---------- Result + share ---------- */
  function fillList(ul, ids, emptyText) {
    ul.innerHTML = "";
    if (!ids.length) { ul.appendChild(el("li", "cl-empty", emptyText)); return; }
    ids.forEach(function (id) { ul.appendChild(el("li", null, itemById[id].name + sizeText(id))); });
  }
  function renderResult() {
    var need = orderedIds("need"), trav = orderedIds("travels");
    $("need-count").textContent = need.length;
    $("travels-count").textContent = trav.length;
    fillList($("need-list"), need, "Nothing marked Need it.");
    fillList($("travels-list"), trav, "Nothing marked Travels.");
    $("btn-share-need").disabled = !need.length;
    $("btn-share-travels").disabled = !trav.length;
    $("btn-result-handoff").classList.toggle("hidden", !trav.length);
  }
  function shareText(kind) {
    var ids = orderedIds(kind);
    var title = kind === "need" ? "Still need" : "Travels each handoff";
    return title + ":\n" + ids.map(function (id) { return "- " + itemById[id].name + sizeText(id); }).join("\n");
  }
  function copyFallback(text) {
    var ta = el("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta);
    return ok;
  }
  function share(kind) {
    var text = shareText(kind);
    window.__clLastShare = text; // QA hook, in-page only
    function copy() {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () { toast("Copied. Paste it anywhere."); },
          function () { toast(copyFallback(text) ? "Copied. Paste it anywhere." : "Couldn't copy. Long-press the list to copy."); });
      }
      toast(copyFallback(text) ? "Copied. Paste it anywhere." : "Couldn't copy. Long-press the list to copy.");
      return Promise.resolve();
    }
    if (navigator.share) {
      return navigator.share({ text: text }).catch(function (err) {
        if (err && err.name === "AbortError") return; // he closed the share sheet
        return copy();
      });
    }
    return copy();
  }

  /* ---------- Travels (return view) ---------- */
  function renderTravels() {
    var ids = orderedIds("travels");
    var ul = $("travels-check");
    ul.innerHTML = "";
    ids.forEach(function (id) {
      var li = el("li", "check-item" + (state.packed[id] ? " packed" : ""));
      li.setAttribute("role", "checkbox");
      li.setAttribute("tabindex", "0");
      li.setAttribute("aria-checked", state.packed[id] ? "true" : "false");
      li.setAttribute("data-id", id);
      li.appendChild(el("span", "check-toggle"));
      var body = el("div", "item-body");
      body.appendChild(el("span", "item-name", itemById[id].name));
      var sz = sizeText(id);
      if (sz) body.appendChild(el("span", "item-meta", sz.replace(/^ \(|\)$/g, "")));
      li.appendChild(body);
      function toggle() {
        if (state.packed[id]) delete state.packed[id]; else state.packed[id] = true;
        save();
        renderTravels();
      }
      li.addEventListener("click", toggle);
      li.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } });
      ul.appendChild(li);
    });
    var done = ids.filter(function (id) { return state.packed[id]; }).length;
    $("travels-sub").textContent = done === ids.length && ids.length ? "All packed. Good to go." : "Tap each one as it's packed. " + done + " of " + ids.length + ".";
  }

  /* ---------- Navigation ---------- */
  function goRoom(i) { state.room = i; renderRoom(); show("room"); }
  function goResult() {
    state.finished = true;
    save();
    renderResult();
    show("result");
    once("finished");
  }
  function goTravels() { renderTravels(); show("travels"); }

  function bind() {
    $("btn-start").addEventListener("click", function () {
      state.started = true;
      save();
      once("started");
      renderKids();
      show("kids");
    });
    document.querySelectorAll(".cl-count .cl-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        var n = Number(b.getAttribute("data-count"));
        var kids = state.kids.slice(0, n);
        while (kids.length < n) kids.push({ age: null });
        state.kids = kids;
        save();
        renderKids();
      });
    });
    $("btn-kids-skip").addEventListener("click", function () { state.kids = []; save(); goRoom(0); });
    $("btn-kids-next").addEventListener("click", function () { goRoom(0); });
    $("btn-room-back").addEventListener("click", function () {
      if (state.room === 0) { renderKids(); show("kids"); } else goRoom(state.room - 1);
    });
    $("btn-room-next").addEventListener("click", function () {
      if (state.room >= visibleRooms().length - 1) goResult(); else goRoom(state.room + 1);
    });
    $("room-more").addEventListener("toggle", function () {});
    $("btn-share-need").addEventListener("click", function () { share("need"); });
    $("btn-share-travels").addEventListener("click", function () { share("travels"); });
    $("btn-share-travels2").addEventListener("click", function () { share("travels"); });
    $("btn-result-edit").addEventListener("click", function () { goRoom(0); });
    $("btn-result-handoff").addEventListener("click", goTravels);
    $("btn-travels-edit").addEventListener("click", function () { goRoom(0); });
    $("btn-travels-result").addEventListener("click", function () { renderResult(); show("result"); });
    $("btn-travels-clear").addEventListener("click", function () { state.packed = {}; save(); renderTravels(); toast("Ticks cleared."); });

    // Home-screen apps resume without reloading: re-check the 3-day gap when it comes back.
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") checkReturn(Date.now());
      else { state.lastVisit = Date.now(); save(); }
    });
  }

  function init() {
    readRef();
    bind();
    checkReturn(Date.now());
    if (anyTravels()) goTravels();
    else if (state.finished) { renderResult(); show("result"); }
    else if (state.started) goRoom(state.room || 0);
    else show("intro");

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("../sw.js").catch(function () {});
    }
  }
  init();
})();
