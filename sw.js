/**
 * Service Worker - Offline functionality and caching for image converter app
 * Implements intelligent caching strategies and offline fallbacks
 */

const CACHE_VERSION = 'v1.2.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Cache duration in milliseconds
const CACHE_DURATIONS = {
    static: 7 * 24 * 60 * 60 * 1000,    // 7 days
    dynamic: 24 * 60 * 60 * 1000,       // 1 day
    api: 5 * 60 * 1000,                 // 5 minutes
    images: 30 * 24 * 60 * 60 * 1000    // 30 days
};

// Static assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/auth.html',
    '/pricing.html',
    '/js/supabase-client.js',
    '/js/auth-manager.js',
    '/js/cache-manager.js',
    '/js/lazy-loader.js',
    '/js/config.js',
    '/js/error-handler.js',
    '/styles/styles.css',
    '/styles/shadcn-tokens.css',
    '/styles/shadcn-bridge.css',
    // Add critical tool pages
    '/tools/image-converter/index.html',
    '/tools/pdf-merger/index.html',
    '/tools/background-remover/index.html'
];

// API endpoints to cache
const API_ENDPOINTS = [
    '/api/user/profile',
    '/api/user/usage',
    '/api/user/files'
];

// Network-first resources (always try network first)
const NETWORK_FIRST = [
    '/api/auth/',
    '/api/stripe/',
    '/api/upload',
    '/api/convert'
];

// Cache-first resources (serve from cache if available)
const CACHE_FIRST = [
    '/js/',
    '/css/',
    '/styles/',
    '/images/',
    '/icons/'
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE).then((cache) => {
                console.log('Caching static assets...');
                return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
            }),

            // Initialize dynamic cache
            caches.open(DYNAMIC_CACHE),

            // Initialize API cache
            caches.open(API_CACHE)
        ]).then(() => {
            console.log('Service Worker installed successfully');
            // Skip waiting to activate immediately
            return self.skipWaiting();
        }).catch((error) => {
            console.error('Service Worker installation failed:', error);
        })
    );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');

    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE &&
                            cacheName !== DYNAMIC_CACHE &&
                            cacheName !== API_CACHE) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),

            // Take control of all clients
            self.clients.claim()
        ]).then(() => {
            console.log('Service Worker activated successfully');
        })
    );
});

/**
 * Fetch event - handle all network requests
 */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle different types of requests
    if (isAPIRequest(url)) {
        event.respondWith(handleAPIRequest(request));
    } else if (isStaticAsset(url)) {
        event.respondWith(handleStaticAsset(request));
    } else if (isImageRequest(url)) {
        event.respondWith(handleImageRequest(request));
    } else if (isNetworkFirst(url)) {
        event.respondWith(handleNetworkFirst(request));
    } else if (isCacheFirst(url)) {
        event.respondWith(handleCacheFirst(request));
    } else {
        event.respondWith(handleDynamicRequest(request));
    }
});

/**
 * Handle API requests with network-first strategy
 */
async function handleAPIRequest(request) {
    const url = new URL(request.url);

    try {
        // Always try network first for API requests
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Cache successful API responses
            const cache = await caches.open(API_CACHE);
            const responseClone = networkResponse.clone();

            // Add timestamp for cache expiration
            const response = new Response(responseClone.body, {
                status: responseClone.status,
                statusText: responseClone.statusText,
                headers: {
                    ...Object.fromEntries(responseClone.headers.entries()),
                    'sw-cached-at': Date.now().toString()
                }
            });

            cache.put(request, response);
            return networkResponse;
        }

        throw new Error(`API request failed: ${networkResponse.status}`);

    } catch (error) {
        console.log('API network request failed, trying cache:', error.message);

        // Try cache as fallback
        const cachedResponse = await getCachedResponse(API_CACHE, request);
        if (cachedResponse && !isCacheExpired(cachedResponse, CACHE_DURATIONS.api)) {
            console.log('Serving API response from cache');
            return cachedResponse;
        }

        // Return offline fallback for API requests
        return createOfflineAPIResponse(url);
    }
}

/**
 * Handle static assets with cache-first strategy
 */
async function handleStaticAsset(request) {
    try {
        // Try cache first
        const cachedResponse = await getCachedResponse(STATIC_CACHE, request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Fallback to network
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('Static asset request failed:', error.message);

        // Try dynamic cache as last resort
        const dynamicCached = await getCachedResponse(DYNAMIC_CACHE, request);
        if (dynamicCached) {
            return dynamicCached;
        }

        // Return offline fallback
        return createOfflineFallback(request);
    }
}

/**
 * Handle image requests with cache-first strategy and long TTL
 */
async function handleImageRequest(request) {
    try {
        // Try cache first
        const cachedResponse = await getCachedResponse(DYNAMIC_CACHE, request);
        if (cachedResponse && !isCacheExpired(cachedResponse, CACHE_DURATIONS.images)) {
            return cachedResponse;
        }

        // Fetch from network
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            const responseWithTimestamp = new Response(networkResponse.body, {
                status: networkResponse.status,
                statusText: networkResponse.statusText,
                headers: {
                    ...Object.fromEntries(networkResponse.headers.entries()),
                    'sw-cached-at': Date.now().toString()
                }
            });

            cache.put(request, responseWithTimestamp.clone());
            return networkResponse;
        }

        throw new Error(`Image request failed: ${networkResponse.status}`);

    } catch (error) {
        console.log('Image request failed:', error.message);

        // Return cached version even if expired
        const cachedResponse = await getCachedResponse(DYNAMIC_CACHE, request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return placeholder image
        return createImagePlaceholder();
    }
}

/**
 * Handle network-first requests
 */
async function handleNetworkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            // Cache successful responses
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('Network-first request failed, trying cache:', error.message);

        const cachedResponse = await getCachedResponse(DYNAMIC_CACHE, request);
        if (cachedResponse) {
            return cachedResponse;
        }

        return createOfflineFallback(request);
    }
}

/**
 * Handle cache-first requests
 */
async function handleCacheFirst(request) {
    try {
        // Try cache first
        const cachedResponse = await getCachedResponse(DYNAMIC_CACHE, request);
        if (cachedResponse && !isCacheExpired(cachedResponse, CACHE_DURATIONS.dynamic)) {
            return cachedResponse;
        }

        // Fetch from network
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            const responseWithTimestamp = new Response(networkResponse.body, {
                status: networkResponse.status,
                statusText: networkResponse.statusText,
                headers: {
                    ...Object.fromEntries(networkResponse.headers.entries()),
                    'sw-cached-at': Date.now().toString()
                }
            });

            cache.put(request, responseWithTimestamp.clone());
            return networkResponse;
        }

        throw new Error(`Cache-first request failed: ${networkResponse.status}`);

    } catch (error) {
        console.log('Cache-first request failed:', error.message);

        // Return cached version even if expired
        const cachedResponse = await getCachedResponse(DYNAMIC_CACHE, request);
        if (cachedResponse) {
            return cachedResponse;
        }

        return createOfflineFallback(request);
    }
}

/**
 * Handle dynamic requests (default strategy)
 */
async function handleDynamicRequest(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('Dynamic request failed, trying cache:', error.message);

        const cachedResponse = await getCachedResponse(DYNAMIC_CACHE, request);
        if (cachedResponse) {
            return cachedResponse;
        }

        return createOfflineFallback(request);
    }
}

/**
 * Get cached response from specified cache
 */
async function getCachedResponse(cacheName, request) {
    try {
        const cache = await caches.open(cacheName);
        return await cache.match(request);
    } catch (error) {
        console.warn('Error accessing cache:', error);
        return null;
    }
}

/**
 * Check if cached response is expired
 */
function isCacheExpired(response, maxAge) {
    const cachedAt = response.headers.get('sw-cached-at');
    if (!cachedAt) return false;

    const age = Date.now() - parseInt(cachedAt);
    return age > maxAge;
}

/**
 * Create offline fallback response
 */
function createOfflineFallback(request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('.html') || url.pathname === '/') {
        return createOfflinePageResponse();
    }

    if (url.pathname.endsWith('.js')) {
        return createOfflineJSResponse();
    }

    if (url.pathname.endsWith('.css')) {
        return createOfflineCSSResponse();
    }

    return new Response('Offline - Resource not available', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' }
    });
}

/**
 * Create offline page response
 */
function createOfflinePageResponse() {
    const offlineHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline - Image Converter</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .offline-container {
          text-align: center;
          max-width: 500px;
          padding: 2rem;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .offline-title {
          font-size: 2rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }
        .offline-message {
          font-size: 1.1rem;
          margin-bottom: 2rem;
          opacity: 0.9;
          line-height: 1.6;
        }
        .offline-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        .offline-button {
          padding: 0.75rem 1.5rem;
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          color: white;
          text-decoration: none;
          font-weight: 500;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        .offline-button:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
        .cached-tools {
          margin-top: 2rem;
          padding: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
        }
        .cached-tools h3 {
          margin-top: 0;
          margin-bottom: 1rem;
        }
        .tool-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
        }
        .tool-link {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: white;
          text-decoration: none;
          font-size: 0.9rem;
          transition: background 0.3s ease;
        }
        .tool-link:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1 class="offline-title">You're Offline</h1>
        <p class="offline-message">
          No internet connection detected. Some features may be limited, but you can still use cached tools and view previously loaded content.
        </p>
        <div class="offline-actions">
          <button class="offline-button" onclick="window.location.reload()">
            Try Again
          </button>
          <a href="/" class="offline-button">
            Go Home
          </a>
        </div>
        <div class="cached-tools">
          <h3>Available Offline Tools</h3>
          <div class="tool-list">
            <a href="/tools/image-converter/" class="tool-link">Image Converter</a>
            <a href="/tools/pdf-merger/" class="tool-link">PDF Merger</a>
            <a href="/tools/background-remover/" class="tool-link">Background Remover</a>
          </div>
        </div>
      </div>
      <script>
        // Auto-retry connection every 30 seconds
        setInterval(() => {
          if (navigator.onLine) {
            window.location.reload();
          }
        }, 30000);
        
        // Listen for online event
        window.addEventListener('online', () => {
          window.location.reload();
        });
      </script>
    </body>
    </html>
  `;

    return new Response(offlineHTML, {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
    });
}

/**
 * Create offline JavaScript response
 */
function createOfflineJSResponse() {
    const offlineJS = `
    // Offline fallback JavaScript
    console.warn('JavaScript file not available offline');
    
    // Provide basic offline functionality
    window.isOffline = true;
    
    // Show offline notification
    if (typeof window.showToast === 'function') {
      window.showToast('Some features are limited while offline', 'warning');
    }
  `;

    return new Response(offlineJS, {
        status: 200,
        headers: { 'Content-Type': 'application/javascript' }
    });
}

/**
 * Create offline CSS response
 */
function createOfflineCSSResponse() {
    const offlineCSS = `
    /* Offline fallback styles */
    .offline-indicator {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #f59e0b;
      color: white;
      text-align: center;
      padding: 0.5rem;
      font-size: 0.9rem;
      z-index: 10000;
    }
  `;

    return new Response(offlineCSS, {
        status: 200,
        headers: { 'Content-Type': 'text/css' }
    });
}

/**
 * Create offline API response
 */
function createOfflineAPIResponse(url) {
    const offlineData = {
        error: 'offline',
        message: 'This feature requires an internet connection',
        offline: true,
        timestamp: Date.now()
    };

    return new Response(JSON.stringify(offlineData), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Create image placeholder
 */
function createImagePlaceholder() {
    // Simple SVG placeholder
    const placeholder = `
    <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="Arial, sans-serif" font-size="16">
        Image not available offline
      </text>
    </svg>
  `;

    return new Response(placeholder, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' }
    });
}

/**
 * Helper functions to determine request types
 */
function isAPIRequest(url) {
    return url.pathname.startsWith('/api/') ||
        url.hostname.includes('supabase') ||
        API_ENDPOINTS.some(endpoint => url.pathname.startsWith(endpoint));
}

function isStaticAsset(url) {
    return STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset));
}

function isImageRequest(url) {
    return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname);
}

function isNetworkFirst(url) {
    return NETWORK_FIRST.some(pattern => url.pathname.startsWith(pattern));
}

function isCacheFirst(url) {
    return CACHE_FIRST.some(pattern => url.pathname.startsWith(pattern));
}

/**
 * Background sync for offline actions
 */
self.addEventListener('sync', (event) => {
    console.log('Background sync triggered:', event.tag);

    if (event.tag === 'upload-files') {
        event.waitUntil(syncOfflineUploads());
    } else if (event.tag === 'sync-usage') {
        event.waitUntil(syncUsageData());
    }
});

/**
 * Sync offline uploads when connection is restored
 */
async function syncOfflineUploads() {
    try {
        // Get offline uploads from IndexedDB
        const offlineUploads = await getOfflineUploads();

        for (const upload of offlineUploads) {
            try {
                // Attempt to upload file
                const response = await fetch('/api/upload', {
                    method: 'POST',
                    body: upload.formData
                });

                if (response.ok) {
                    // Remove from offline storage
                    await removeOfflineUpload(upload.id);
                    console.log('Synced offline upload:', upload.filename);
                }
            } catch (error) {
                console.error('Failed to sync upload:', error);
            }
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
}

/**
 * Sync usage data when connection is restored
 */
async function syncUsageData() {
    try {
        // Get offline usage data
        const offlineUsage = await getOfflineUsage();

        if (offlineUsage.length > 0) {
            const response = await fetch('/api/usage/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(offlineUsage)
            });

            if (response.ok) {
                await clearOfflineUsage();
                console.log('Synced offline usage data');
            }
        }
    } catch (error) {
        console.error('Usage sync failed:', error);
    }
}

/**
 * IndexedDB helpers for offline storage
 */
async function getOfflineUploads() {
    // Implementation would use IndexedDB to store offline uploads
    return [];
}

async function removeOfflineUpload(id) {
    // Implementation would remove upload from IndexedDB
}

async function getOfflineUsage() {
    // Implementation would get usage data from IndexedDB
    return [];
}

async function clearOfflineUsage() {
    // Implementation would clear usage data from IndexedDB
}

/**
 * Push notification handling
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: data.tag || 'default',
        data: data.data || {},
        actions: data.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

/**
 * Notification click handling
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    const action = event.action;

    if (action === 'open-dashboard') {
        event.waitUntil(
            clients.openWindow('/dashboard.html')
        );
    } else if (data.url) {
        event.waitUntil(
            clients.openWindow(data.url)
        );
    }
});

console.log('Service Worker loaded successfully');