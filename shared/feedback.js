/**
 * Dad House OS — Pilot 0 feedback stub (FB1–FB8)
 * Sticky "Something off?" → sheet → localStorage queue + mailto egress.
 * Never blocks packing. No account required.
 */
(function (global) {
  "use strict";

  var QUEUE_KEY = "dadhouse_feedback_queue";
  var APP_VERSION = "pilot0-mvp-2026-09-14";
  var MAILTO = "bnjmnsmith6@users.noreply.github.com";

  function $(id) {
    return document.getElementById(id);
  }

  function readQueue() {
    try {
      var raw = localStorage.getItem(QUEUE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function writeQueue(arr) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
    } catch (_) {}
  }

  function isOffline() {
    if (navigator.onLine === false) return true;
    try {
      var params = new URLSearchParams(location.search);
      if (params.get("offline") === "1") return true;
    } catch (_) {}
    return false;
  }

  function currentScreen(opts) {
    if (opts && typeof opts.getScreen === "function") {
      try {
        var s = opts.getScreen();
        if (s) return s;
      } catch (_) {}
    }
    var visible = document.querySelector(".screen:not(.hidden)");
    if (visible && visible.dataset && visible.dataset.screen) {
      return visible.dataset.screen;
    }
    return opts && opts.defaultScreen ? opts.defaultScreen : "unknown";
  }

  function handoffId(opts) {
    if (opts && typeof opts.getHandoffId === "function") {
      try {
        return opts.getHandoffId() || null;
      } catch (_) {}
    }
    return null;
  }

  function ensureStyles() {
    if ($("dadhouse-feedback-styles")) return;
    var css = document.createElement("style");
    css.id = "dadhouse-feedback-styles";
    css.textContent = [
      ".fb-entry{",
      "position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));",
      "z-index:40;min-height:48px;padding:12px 16px;border-radius:999px;",
      "border:1px solid #4a5568;background:#243044;color:#f2f5f9;",
      "font:600 0.95rem system-ui,-apple-system,sans-serif;cursor:pointer;",
      "box-shadow:0 8px 24px rgba(0,0,0,.35);",
      "}",
      ".fb-entry:active{transform:scale(.98)}",
      ".fb-overlay{",
      "position:fixed;inset:0;z-index:50;background:rgba(8,12,18,.62);",
      "display:flex;align-items:flex-end;justify-content:center;",
      "padding:12px 12px calc(12px + env(safe-area-inset-bottom,0px));",
      "}",
      ".fb-overlay.hidden{display:none!important}",
      ".fb-sheet{",
      "width:100%;max-width:430px;background:#1a2332;border:1px solid #2e3c52;",
      "border-radius:20px 20px 16px 16px;padding:20px 18px 16px;color:#f2f5f9;",
      "font-family:system-ui,-apple-system,sans-serif;",
      "}",
      ".fb-sheet h2{margin:0 0 14px;font-size:1.25rem;letter-spacing:-.01em}",
      ".fb-cats{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}",
      ".fb-cat{",
      "min-height:48px;text-align:left;padding:12px 14px;border-radius:12px;",
      "border:1px solid #2e3c52;background:#243044;color:#f2f5f9;",
      "font:600 1rem inherit;cursor:pointer;",
      "}",
      ".fb-cat[aria-checked='true']{border-color:#5b8fd9;background:#2b4c7e}",
      ".fb-field{display:block;margin-bottom:14px}",
      ".fb-field input{",
      "width:100%;min-height:48px;box-sizing:border-box;border-radius:12px;",
      "border:1px solid #2e3c52;background:#0e131a;color:#f2f5f9;",
      "padding:12px 14px;font:1rem inherit;",
      "}",
      ".fb-actions{display:flex;flex-direction:column;gap:8px}",
      ".fb-send{",
      "min-height:52px;border:none;border-radius:14px;background:#4a9fe8;color:#fff;",
      "font:700 1.05rem inherit;cursor:pointer;",
      "}",
      ".fb-send:disabled{opacity:.45;cursor:not-allowed}",
      ".fb-dismiss{",
      "min-height:48px;border:none;border-radius:14px;background:transparent;",
      "color:#9aa8bc;font:600 1rem inherit;cursor:pointer;",
      "}",
      ".fb-toast{",
      "position:fixed;left:50%;bottom:calc(78px + env(safe-area-inset-bottom,0px));",
      "transform:translateX(-50%);z-index:60;max-width:90%;",
      "padding:12px 16px;border-radius:12px;background:#243830;color:#c8e0d4;",
      "border:1px solid #3d6b55;font:600 0.95rem system-ui,sans-serif;",
      "box-shadow:0 8px 20px rgba(0,0,0,.35);",
      "}",
      ".fb-toast.hidden{display:none!important}",
    ].join("");
    document.head.appendChild(css);
  }

  function ensureDom() {
    if ($("fb-entry")) return;
    ensureStyles();

    var entry = document.createElement("button");
    entry.type = "button";
    entry.id = "fb-entry";
    entry.className = "fb-entry";
    entry.textContent = "Something off?";
    entry.setAttribute("aria-haspopup", "dialog");
    document.body.appendChild(entry);

    var overlay = document.createElement("div");
    overlay.id = "fb-overlay";
    overlay.className = "fb-overlay hidden";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "fb-title");
    overlay.innerHTML =
      '<div class="fb-sheet">' +
      '<h2 id="fb-title">What felt off?</h2>' +
      '<div class="fb-cats" role="radiogroup" aria-label="What felt off">' +
      '<button type="button" class="fb-cat" role="radio" aria-checked="false" data-cat="Wrong size">Wrong size</button>' +
      '<button type="button" class="fb-cat" role="radio" aria-checked="false" data-cat="Missing item">Missing item</button>' +
      '<button type="button" class="fb-cat" role="radio" aria-checked="false" data-cat="Confusing">Confusing</button>' +
      '<button type="button" class="fb-cat" role="radio" aria-checked="false" data-cat="Other">Other</button>' +
      "</div>" +
      '<label class="fb-field"><input id="fb-line" type="text" maxlength="140" placeholder="One line (optional)" autocomplete="off" /></label>' +
      '<div class="fb-actions">' +
      '<button type="button" class="fb-send" id="fb-send" disabled>Send</button>' +
      '<button type="button" class="fb-dismiss" id="fb-not-now">Not now</button>' +
      "</div></div>";
    document.body.appendChild(overlay);

    var toast = document.createElement("div");
    toast.id = "fb-toast";
    toast.className = "fb-toast hidden";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  function showToast(msg) {
    var el = $("fb-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () {
      el.classList.add("hidden");
    }, 2600);
  }

  function openSheet() {
    var overlay = $("fb-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    var send = $("fb-send");
    if (send) send.disabled = !selectedCategory();
  }

  function closeSheet() {
    var overlay = $("fb-overlay");
    if (overlay) overlay.classList.add("hidden");
    document.querySelectorAll(".fb-cat").forEach(function (btn) {
      btn.setAttribute("aria-checked", "false");
    });
    var line = $("fb-line");
    if (line) line.value = "";
    var send = $("fb-send");
    if (send) send.disabled = true;
  }

  function selectedCategory() {
    var hit = document.querySelector('.fb-cat[aria-checked="true"]');
    return hit ? hit.getAttribute("data-cat") : null;
  }

  function buildPayload(opts) {
    var lineEl = $("fb-line");
    var line = lineEl ? (lineEl.value || "").trim().slice(0, 140) : "";
    return {
      category: selectedCategory(),
      line: line || null,
      screen: currentScreen(opts),
      offline: isOffline(),
      handoff_id: handoffId(opts),
      app_version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }

  function mailtoCompose(payload) {
    var subject = encodeURIComponent(
      "[Dad House feedback] " + (payload.category || "Other")
    );
    var body = encodeURIComponent(JSON.stringify(payload, null, 2));
    return "mailto:" + MAILTO + "?subject=" + subject + "&body=" + body;
  }

  function submit(opts) {
    var cat = selectedCategory();
    if (!cat) return;
    var payload = buildPayload(opts);
    var q = readQueue();
    q.push(payload);
    writeQueue(q);
    // $0 egress — never block packing if mailto fails
    try {
      var a = document.createElement("a");
      a.href = mailtoCompose(payload);
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try {
          a.remove();
        } catch (_) {}
      }, 0);
    } catch (_) {}
    closeSheet();
    showToast("Thanks — noted for tonight’s list");
  }

  function setVisible(show) {
    var entry = $("fb-entry");
    if (!entry) return;
    entry.style.display = show ? "" : "none";
  }

  /**
   * @param {{
   *   getScreen?: () => string,
   *   getHandoffId?: () => string|null,
   *   defaultScreen?: string,
   *   visibleOn?: string[] | ((screen:string)=>boolean)
   * }} opts
   */
  function mount(opts) {
    opts = opts || {};
    ensureDom();

    var entry = $("fb-entry");
    var overlay = $("fb-overlay");
    var send = $("fb-send");
    var dismiss = $("fb-not-now");

    entry.onclick = function () {
      openSheet();
    };
    dismiss.onclick = function () {
      closeSheet();
    };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeSheet();
    });
    document.querySelectorAll(".fb-cat").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".fb-cat").forEach(function (b) {
          b.setAttribute("aria-checked", "false");
        });
        btn.setAttribute("aria-checked", "true");
        send.disabled = false;
      });
    });
    send.onclick = function () {
      submit(opts);
    };

    function syncVisibility() {
      var screen = currentScreen(opts);
      var show = true;
      if (typeof opts.visibleOn === "function") {
        show = !!opts.visibleOn(screen);
      } else if (Array.isArray(opts.visibleOn)) {
        show = opts.visibleOn.indexOf(screen) !== -1;
      }
      setVisible(show);
    }

    syncVisibility();
    // Observe screen class changes lightly
    var obs = new MutationObserver(syncVisibility);
    document.querySelectorAll(".screen").forEach(function (el) {
      obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    });

    global.DadHouseFeedback = global.DadHouseFeedback || {};
    global.DadHouseFeedback.queueKey = QUEUE_KEY;
    global.DadHouseFeedback.readQueue = readQueue;
    global.DadHouseFeedback.syncVisibility = syncVisibility;
    global.DadHouseFeedback.setVisible = setVisible;
  }

  global.DadHouseFeedback = {
    mount: mount,
    queueKey: QUEUE_KEY,
    readQueue: readQueue,
    APP_VERSION: APP_VERSION,
  };
})(window);
