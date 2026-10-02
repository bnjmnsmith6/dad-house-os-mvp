/* Dad House OS MVP Pilot 0 SW v22 (adds /checklist/) */
const CACHE = "dadhouse-mvp-pilot0-v24";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./app.js?v=15",
  "./styles.css",
  "./styles.css?v=15",
  "./sw.js",
  "./shared/feedback.js",
  "./shared/feedback.js?v=17",
  "./fixtures/seed.json",
  "./fixtures/calendar-handoffs.json",
  "./replenish/",
  "./replenish/index.html",
  "./replenish/app.js",
  "./replenish/styles.css",
  "./replenish/fixtures/seed.json",
  "./checklist/",
  "./checklist/index.html",
  "./checklist/checklist.js?v=5",
  "./checklist/checklist-data.js?v=6",
  "./checklist/checklist.css?v=4",
  "./checklist/manifest.webmanifest",
  "./checklist/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function withSwHeader(res, value) {
  const headers = new Headers(res.headers);
  headers.set("x-dadhouse-sw", value);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept cross-origin
  if (url.origin !== self.location.origin) return;

  // Inner network hop from probe handler — never recurse into probe logic / never CACHE
  if (req.headers.get("X-Dadhouse-Probe-Inner") === "1") {
    event.respondWith(
      fetch(req).catch(
        () => new Response("offline", { status: 503, headers: { "x-dadhouse-sw": "offline" } })
      )
    );
    return;
  }

  // netcheck / dedicated probe: NETWORK ONLY via bypassing SW cache entirely.
  // Use fetch to absolute http URL of a tiny data response we synthesize on success
  // by attempting real network to favicon-less unique path that isn't in CACHE.
  if (
    url.pathname.endsWith("/__dadhouse_probe") ||
    url.searchParams.has("probe") ||
    url.searchParams.has("netcheck")
  ) {
    event.respondWith(
      (async () => {
        try {
          // Bypass HTTP cache; do not call caches.match. If offline, fetch throws.
          const probeReq = new Request(
            self.registration.scope + "fixtures/seed.json?netcheck=" + Date.now(),
            {
              cache: "reload",
              method: "GET",
              headers: { "X-Dadhouse-Probe-Inner": "1" },
            }
          );
          // Important: fetch from SW goes to network (not re-handled by this SW for no-cors issues)
          const res = await fetch(probeReq);
          if (!res.ok) throw new Error("bad status");
          return new Response("ok", {
            status: 204,
            headers: {
              "x-dadhouse-sw": "network",
              "Cache-Control": "no-store",
            },
          });
        } catch (_) {
          return new Response("offline", {
            status: 503,
            statusText: "Offline",
            headers: {
              "x-dadhouse-sw": "offline",
              "Content-Type": "text/plain",
            },
          });
        }
      })()
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        fetch(req)
          .then((res) => {
            if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          })
          .catch(() => {});
        return withSwHeader(hit, "cache");
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
          return withSwHeader(res, "network");
        })
        .catch(async () => {
          // Checklist pages (incl. ?ref= links) fall back to the checklist shell, not the MVP.
          const inChecklist = url.pathname.includes("/checklist/");
          if (inChecklist && req.mode === "navigate") {
            const cl =
              (await caches.match("./checklist/index.html")) || (await caches.match("./checklist/"));
            if (cl) return withSwHeader(cl, "cache");
          }
          const page =
            (await caches.match("./index.html")) || (await caches.match("./"));
          if (page) return withSwHeader(page, "cache");
          const name = url.pathname.split("/").pop();
          const file =
            (await caches.match("./" + name)) ||
            (await caches.match("./" + name + "?v=16"));
          if (file) return withSwHeader(file, "cache");
          return new Response("offline", { status: 503 });
        });
    })
  );
});
