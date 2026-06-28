// =====================================================
// TrekWorks Trip Mode (TTM) Service Worker
// Trip: FJ / GJN-2026-Aug
// Scope: subdomain root (./)
// =====================================================

const CACHE_VERSION = "tw-fj-gjn-2026-aug-2026-06-28-install-refactor-v2";
const CACHE_NAME = `trekworks-${CACHE_VERSION}`;

// -----------------------------------------------------
// Trip Mode storage (IndexedDB)
// -----------------------------------------------------
const DB_NAME = "trekworks";
const DB_VERSION = 1;
const STORE_NAME = "settings";
const TRIP_MODE_KEY = "tripMode:FJ-GJN-2026-Aug";
const DEFAULT_MODE = "online";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getTripMode() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(TRIP_MODE_KEY);
      req.onsuccess = () => resolve(req.result || DEFAULT_MODE);
      req.onerror = () => resolve(DEFAULT_MODE);
    });
  } catch {
    return DEFAULT_MODE;
  }
}

// -----------------------------------------------------
// Core assets
// -----------------------------------------------------
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./fj-gjn-2026-aug-offline.html",
  "./fj-gjn-2026-aug-manifest.json",

  "./fj-gjn-2026-aug-accommodation.html",
  "./fj-gjn-2026-aug-activities.html",
  "./fj-gjn-2026-aug-data-and-esim.html",
  "./fj-gjn-2026-aug-flights.html",
  "./fj-gjn-2026-aug-guides.html",
  "./fj-gjn-2026-aug-hire-car.html",
  "./fj-gjn-2026-aug-insurance.html",
  "./fj-gjn-2026-aug-task-list-guide.html",

  "./fj-gjn-2026-aug-external.html",

  "./assets/icons/icon-FJ-2026-192.png",
  "./assets/icons/icon-FJ-2026-512.png",
  "./assets/audio/fiji-theme.mp3"
];

// -----------------------------------------------------
// Install
// -----------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          const req = new Request(asset, { cache: "reload" });
          const res = await fetch(req);
          if (!res || !res.ok) throw new Error(`Precache failed: ${asset} (${res && res.status})`);
          await cache.put(req, res);
        })
      );
    })()
  );

  self.skipWaiting();
});

// -----------------------------------------------------
// Activate
// -----------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("trekworks-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// -----------------------------------------------------
// Fetch handling
// -----------------------------------------------------
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(handleNavigation(event.request));
});

// -----------------------------------------------------
// Navigation strategy
// -----------------------------------------------------
async function handleNavigation(request) {
  const url = new URL(request.url);
  const cache = await caches.open(CACHE_NAME);

  const isExternalRouter =
    url.pathname.endsWith("/fj-gjn-2026-aug-external.html") ||
    url.pathname === "/fj-gjn-2026-aug-external.html";

  const isTripDocument =
    request.destination === "document" && !isExternalRouter;

  const canonicalExternalRequest = new Request("./fj-gjn-2026-aug-external.html");
  const tripMode = await getTripMode();

  // ================= OFFLINE =================
  if (tripMode === "offline") {
    if (isExternalRouter) {
      return (
        (await cache.match(canonicalExternalRequest)) ||
        (await cache.match("./fj-gjn-2026-aug-offline.html"))
      );
    }

    if (isTripDocument) {
      return (
        (await cache.match(request)) ||
        (await cache.match("./index.html")) ||
        (await cache.match("./fj-gjn-2026-aug-offline.html"))
      );
    }
  }

  // ================= ONLINE =================
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      if (isExternalRouter) {
        cache.put(canonicalExternalRequest, response.clone());
      } else {
        cache.put(request, response.clone());
      }
    }

    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("./index.html")) ||
      (await cache.match("./fj-gjn-2026-aug-offline.html"))
    );
  }
}
