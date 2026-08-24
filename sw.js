const CACHE_NAME = "weathermood-v0.10.1";
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isApiRequest = url.pathname === "/api" || url.pathname.startsWith("/api/");
  if (event.request.method !== "GET" || url.origin !== self.location.origin || isApiRequest) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html"))),
  );
});
