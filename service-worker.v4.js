/* service-worker.js */
// ===============================
// 📸 法政大学 小金井写真部 予約システム PWA SW（最終安定版）
// ===============================

const CACHE_NAME = "photo-club-cache-v4";

const ASSETS = [
  "/reserve_site/",
  "/reserve_site/index.html",
  "/reserve_site/css/root-style.css",
  "/reserve_site/js/root-script.js",

  // カメラ
  "/reserve_site/camera/index.html",
  "/reserve_site/camera/reserve.html",
  "/reserve_site/camera/css/style.css",
  "/reserve_site/camera/js/camera-calendar.js",

  // PC
  "/reserve_site/pc/index.html",
  "/reserve_site/pc/reserve.html",
  "/reserve_site/pc/css/style.css",
  "/reserve_site/pc/js/pc-calendar.js",

  // アイコン
  "/reserve_site/icons/icon-192.png",
  "/reserve_site/icons/icon-512.png",
  "/reserve_site/icons/icon-180.png"
];


// install
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

// activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))
      )
    )
  );
  self.clients.claim();
});

// fetch
self.addEventListener("fetch", (event) => {

  // 🟥 1. POST は完全にバイパス
  if (event.request.method !== "GET") {
    return;
  }

  const url = event.request.url;

  // 🟥 2. GAS など外部 API はキャッシュせずバイパス
  if (url.includes("script.google.com") || url.includes("https://script.google.com/macros/s/AKfycbzGVbtYBaY8lJrAitp-PMzheO8fmz6a5yN41TD0ut9NnkZ2bA5Mb7rHe-k_WUMI6pvopg/exec")) {
    return;
  }

  // 🟦 3. GitHub Pages の GET をキャッシュ優先で返す
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});