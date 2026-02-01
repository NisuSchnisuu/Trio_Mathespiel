const CACHE_NAME = 'trio-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './firebase-config.js',
    './assets/Trio-logo-192x192.png',
    './assets/Trio-logo-512x512.png'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});
