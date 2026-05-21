const webpush = require('web-push');

webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

async function enviarNotificacion(subscription, payload) {
    try {
        // PostgreSQL JSONB puede llegar como objeto o como string
        let sub = subscription;
        if (typeof sub === 'string') {
            sub = JSON.parse(sub);
        }
        // Doble parse por si viene escapado
        if (typeof sub === 'string') {
            sub = JSON.parse(sub);
        }

        console.log('📤 Enviando a endpoint:', sub?.endpoint?.substring(0, 50));

        await webpush.sendNotification(sub, JSON.stringify(payload));
        return true;

    } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            console.log('🗑️ Subscription expirada');
            return 'expired';
        }
        console.error('❌ Error push:', error.message);
        return false;
    }
}

module.exports = { enviarNotificacion };