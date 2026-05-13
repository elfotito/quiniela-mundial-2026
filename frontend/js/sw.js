// Service Worker para Quiniela Mundial 2026
// Archivo: sw.js (debe estar en la raíz o en js/)

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.mensaje || 'Nueva notificación',
    icon: '/icon/android-chrome-192x192.png',
    badge: '/icon/favicon-32x32.png',
    tag: data.partidoId,
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.titulo || 'Quiniela', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

// Install: cachear recursos básicos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker');
  event.waitUntil(clients.claim());
});