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
        const sub = typeof subscription === 'string' 
            ? JSON.parse(subscription) 
            : subscription;

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