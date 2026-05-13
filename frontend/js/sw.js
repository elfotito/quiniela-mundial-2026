self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  var data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data = { titulo: 'Notificación', mensaje: 'Nueva notificación' };
    }
  }
  
  var options = {
    body: data.mensaje || 'Nueva notificación',
    icon: '/icon/android-chrome-192x192.png',
    badge: '/icon/favicon-32x32.png'
  };
  
  event.waitUntil(
    self.registration.showNotification(data.titulo || 'Quiniela', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});