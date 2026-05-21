/* SchoolOS PWA — push only; do not intercept navigations (was caching stale UI). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "SchoolOS", body: "New notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.ico" }),
  );
});
