import { getMessaging } from "firebase-admin/messaging";
import { db, COLLECTIONS } from "../config";

export interface PriceDropPayload {
  deviceId: string;
  currentPriceUsd: number;
  currency: string;
  targetPriceUsd: number;
  source: string;
}

/**
 * Fan-out price-drop notifications via FCM (web push) and email.
 * Looks up the user's FCM registration tokens on `users/{uid}`; email is
 * stubbed — drop SendGrid/Resend into `sendEmail` for production.
 */
export async function sendPriceDropNotification(
  userId: string,
  payload: PriceDropPayload,
  channels: ("push" | "email")[],
): Promise<void> {
  const userDoc = await db.collection(COLLECTIONS.users).doc(userId).get();
  const user = userDoc.data();

  const message = {
    device: payload.deviceId,
    priceUsd: payload.currentPriceUsd,
    currency: payload.currency,
  };

  if (channels.includes("push")) {
    const tokens: string[] = user?.fcmTokens ?? [];
    if (tokens.length > 0) {
      const results = await getMessaging().sendEachForMulticast({
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
      const invalid: string[] = [];
      results.responses.forEach((response, i) => {
        if (response.success === false) invalid.push(tokens[i]!);
      });
      if (invalid.length > 0) {
        await userDoc.ref.update({
          fcmTokens: (user?.fcmTokens ?? []).filter(
            (t: string) => !invalid.includes(t),
          ),
        });
      }
    }
  }

  if (channels.includes("email") && user?.email) {
    await sendEmail(user.email, message);
  }
}

async function sendEmail(
  to: string,
  message: { device: string; priceUsd: number; currency: string },
): Promise<void> {
  console.info(`[email] (stub) → ${to}: ${message.device} @ ${message.currency}${message.priceUsd}`);
}
