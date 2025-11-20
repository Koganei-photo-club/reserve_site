/* service-worker.js */
// ===============================
// 📸 法政大学 小金井写真部 予約システム PWA SW
// ===============================

// キャッシュ名（更新時はバージョンを上げる）
const CACHE_NAME = "photo-club-cache-v2";

// キャッシュ対象
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

// ===============================
// 🟦 install: キャッシュの登録
// ===============================
self.addEventListener("install", (event) => {
  console.log("[SW] Install");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );

  self.skipWaiting();
});

// ===============================
// 🟩 activate: 古いキャッシュ削除
// ===============================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activate");

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// ===============================
// 🟨 fetch: キャッシュ優先
// ===============================
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => caches.match("/reserve_site/index.html"))
      );
    })
  );
});