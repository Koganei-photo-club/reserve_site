// ===============================
// 📸 写真部 PWA Service Worker
// ===============================

const CACHE_NAME = "photo-club-cache-v1";

// キャッシュするファイル一覧
const ASSETS = [
  "/",                     // ルート
  "/index.html",
  "/css/root-style.css",
  "/js/root-script.js",

  // カメラ
  "/camera/index.html",
  "/camera/reserve.html",
  "/camera/css/style.css",
  "/camera/js/camera-calendar.js",

  // PC
  "/pc/index.html",
  "/pc/reserve.html",
  "/pc/css/style.css",
  "/pc/js/pc-calendar.js",

  // 共通画像
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-180.png",

  // フォントなど必要に応じて追加
];

// ===============================
// 🔧 インストール時：キャッシュ登録
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
// 🔄 有効化：古いキャッシュの削除
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
// 📦 fetch：キャッシュ優先 → ネット
// ===============================
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() =>
          caches.match("/") // オフライン時のフォールバック
        )
      );
    })
  );
});