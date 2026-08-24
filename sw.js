const CACHE_NAME = "weathermood-v0.12.0";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/fonts/Iansui-Regular.woff2",
  "./faveicon/favicon.ico",
  "./faveicon/favicon-16x16.png",
  "./faveicon/favicon-32x32.png",
  "./faveicon/apple-touch-icon.png",
  "./faveicon/android-chrome-192x192.png",
  "./faveicon/android-chrome-512x512.png",
  "./assets/fluent-emoji/cloud.png",
  "./assets/fluent-emoji/drizzle.png",
  "./assets/fluent-emoji/fog.png",
  "./assets/fluent-emoji/rain.png",
  "./assets/fluent-emoji/snow.png",
  "./assets/fluent-emoji/sun.png",
  "./assets/fluent-emoji/thunderstorm.png",
  "./assets/fluent-emoji/tornado.png",
  "./assets/fluent-emoji/wind.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

// 程式碼類資源改用 network-first，避免改版後仍執行舊的 app.js / styles.css。
const isCodeAsset = (request, url) =>
  request.mode === "navigate" || /\.(?:js|css|webmanifest)$/.test(url.pathname);

const putIfOk = (request, response) => {
  if (!response || !response.ok || response.type !== "basic") return response;
  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  return response;
};

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (isCodeAsset(event.request, url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => putIfOk(event.request, response))
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html"))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request)
        .then((response) => putIfOk(event.request, response))
        .catch(() => caches.match("./index.html")),
    ),
  );
});
