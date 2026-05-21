self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(clients.claim());  // FIX: era "event" → "e"
});

self.addEventListener('push', function(event) {
  var data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data = { title: 'Quiniela Mundial 2026', body: 'Nueva notificación' };
    }
  }
  
  var options = {
    body: data.body || 'Nueva notificación',          // FIX: era data.mensaje
    icon: '/icon/android-chrome-192x192.png',
    badge: '/icon/favicon-32x32.png',
    vibrate: [200, 100, 200],                          // NUEVO: vibra en móvil
    data: { url: data.url || '/index.html' }           // NUEVO: guarda la URL
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Quiniela Mundial 2026', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var urlDestino = event.notification.data?.url || '/index.html';  // FIX: usa la URL del partido
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Si ya hay una pestaña abierta, navégala ahí
      for (var i = 0; i < clientList.length; i++) {
        if ('focus' in clientList[i]) {
          clientList[i].focus();
          clientList[i].navigate(urlDestino);
          return;
        }
      }
      // Si no hay pestaña abierta, abre una nueva
      return clients.openWindow(urlDestino);
    })
  );
});