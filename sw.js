// Ein minimaler Service Worker, der dem Browser signalisiert: "Ich bin eine echte App"
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Leitet normale Anfragen einfach weiter
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request).catch(() => new Response("Du bist offline.")));
});
