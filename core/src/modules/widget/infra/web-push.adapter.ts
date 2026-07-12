import type {
  PushSubscriptionData,
  PushNotificationPayload,
} from '../domain/push-subscription.types.js';
import { logger } from '../../../shared/infra/logger.js';

export class WebPushAdapter {
  private vapidPublicKey: string;
  private vapidPrivateKey: string;
  private vapidSubject: string;

  constructor(vapidPublicKey: string, vapidPrivateKey: string, vapidSubject: string) {
    this.vapidPublicKey = vapidPublicKey;
    this.vapidPrivateKey = vapidPrivateKey;
    this.vapidSubject = vapidSubject;
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  async send(
    subscription: PushSubscriptionData,
    payload: PushNotificationPayload,
  ): Promise<boolean> {
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      logger.warn('VAPID keys not configured, skipping push notification');
      return false;
    }

    try {
      // Dynamic import to avoid requiring web-push as a hard dependency.
      // ESM dynamic import wraps CJS modules under .default.
      const webPushMod = await import('web-push');
      const webPush = (webPushMod.default ?? webPushMod) as typeof import('web-push');
      webPush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);

      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        JSON.stringify(payload),
      );
      return true;
    } catch (err) {
      logger.error({ err, endpoint: subscription.endpoint }, 'Failed to send push notification');
      return false;
    }
  }
}
