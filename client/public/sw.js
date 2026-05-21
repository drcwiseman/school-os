const CACHE = "schoolos-v3";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  // Never cache API or hashed build assets — always fetch fresh
  if (url.pathname.includes("/api/") || url.pathname.startsWith("/assets/")) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "SchoolOS", body: "New notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.ico" }),
  );
});
