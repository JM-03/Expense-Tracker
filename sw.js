const CACHE_NAME = 'holiday-tracker-v1';
const ASSETS = [
    './',
    './index.html',
    './index.css',
    './app.js',
    './firebase-config.js',
    './manifest.json',
    './icon-192.png'
];

// Install — cache semua asset
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — hapus cache lama
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — network first, fallback ke cache
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Jangan cache Firebase & Google Fonts API requests
    if (url.hostname.includes('firebasestorage') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('firestore')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache response yang valid
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
