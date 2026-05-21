const CACHE = "schoolos-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? { title: "SchoolOS", body: "New notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.ico" })
  );
});
