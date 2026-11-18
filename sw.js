/* Meal Prep Helper — service worker
   This small file lets the app open with no internet connection.
   The first time the app loads, it saves a copy of the app's files on the phone.
   After that, the app opens from that saved copy and quietly checks for a newer
   version in the background, so changes you publish show up on the next launch. */

'use strict';

const CACHE = 'meal-prep-helper-v1'; // change the number to force everyone to re-download all files
const FONT_CACHE = 'meal-prep-helper-fonts';

// The app's own files. Paths are relative, so this works at any GitHub Pages address.
const APP_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

// 1. Install: save the app's files.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate: delete saved copies from older versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(n => n !== CACHE && n !== FONT_CACHE).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. Fetch: answer requests from the saved copy, and refresh it in the background.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Google Fonts: keep a copy so the fonts also work offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(fromCacheThenUpdate(event, FONT_CACHE, request));
    return;
  }

  // Only handle this app's own files; leave everything else alone.
  if (url.origin !== self.location.origin) return;

  // Opening the app (or any page inside it) always gets index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fromCacheThenUpdate(event, CACHE, request, './index.html')
    );
    return;
  }

  event.respondWith(fromCacheThenUpdate(event, CACHE, request));
});

// Returns the saved copy right away if there is one, while fetching a fresh copy
// to save for next time. With no saved copy, waits for the network.
async function fromCacheThenUpdate(event, cacheName, request, fallbackPath) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true })
    || (fallbackPath && await cache.match(fallbackPath));

  const network = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === 'opaque')) {
        return cache.put(request, response.clone()).then(() => response);
      }
      return response;
    })
    .catch(() => null);
  event.waitUntil(network); // lets the background refresh finish

  if (cached) return cached;
  const fresh = await network;
  return fresh || new Response('You are offline and this file has not been saved yet.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain' },
  });
}
