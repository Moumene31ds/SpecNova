"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPriceDropNotification = sendPriceDropNotification;
const messaging_1 = require("firebase-admin/messaging");
const config_1 = require("../config");
/**
 * Fan-out price-drop notifications via FCM (web push) and email.
 * Looks up the user's FCM registration tokens on `users/{uid}`; email is
 * stubbed — drop SendGrid/Resend into `sendEmail` for production.
 */
async function sendPriceDropNotification(userId, payload, channels) {
    const userDoc = await config_1.db.collection(config_1.COLLECTIONS.users).doc(userId).get();
    const user = userDoc.data();
    const message = {
        device: payload.deviceId,
        priceUsd: payload.currentPriceUsd,
        currency: payload.currency,
    };
    if (channels.includes("push")) {
        const tokens = user?.fcmTokens ?? [];
        if (tokens.length > 0) {
            const results = await (0, messaging_1.getMessaging)().sendEachForMulticast({
                tokens,
                data: {
                    kind: "price-drop",
                    device: payload.deviceId,
                    priceUsd: String(payload.currentPriceUsd),
                    currency: payload.currency,
                    click_action: `/phone/${payload.deviceId}`,
                },
                notification: {
                    title: "Price drop! 💸",
                    body: `${payload.deviceId} now $${payload.currentPriceUsd} — below your $${payload.targetPriceUsd} target.`,
                },
                webpush: {
                    fcmOptions: {
                        link: `/phone/${payload.deviceId}`,
                    },
                },
            });
            // Prune invalid tokens so retries don't fail the whole multicast.
            const invalid = [];
            results.responses.forEach((response, i) => {
                if (response.success === false)
                    invalid.push(tokens[i]);
            });
            if (invalid.length > 0) {
                await userDoc.ref.update({
                    fcmTokens: (user?.fcmTokens ?? []).filter((t) => !invalid.includes(t)),
                });
            }
        }
    }
    if (channels.includes("email") && user?.email) {
        await sendEmail(user.email, message);
    }
}
async function sendEmail(to, message) {
    console.info(`[email] (stub) → ${to}: ${message.device} @ ${message.currency}${message.priceUsd}`);
}
//# sourceMappingURL=price-drop-fcm.js.map