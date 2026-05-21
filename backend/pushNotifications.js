// pushNotifications.js
const webpush = require('web-push');

webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

async function enviarNotificacion(subscription, payload) {
    try {
        // subscription puede llegar como string (de la BD) o como objeto
        let sub;
try {
    sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
    // PostgreSQL JSONB a veces devuelve string con escapes dobles
    if (typeof sub === 'string') sub = JSON.parse(sub);
} catch(e) {
    console.error('❌ Error parseando subscription:', e.message, '| Raw:', subscription);
    return false;
}

        await webpush.sendNotification(sub, JSON.stringify(payload));
        return true;
    } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            return 'expired';
        }
        console.error('Error enviando push:', error.message);
        return false;
    }
}

module.exports = { enviarNotificacion };