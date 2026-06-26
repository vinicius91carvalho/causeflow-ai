import type { WidgetApiClient } from './api-client.js';

export class WidgetPushManager {
  private apiClient: WidgetApiClient;
  private vapidPublicKey: string;

  constructor(apiClient: WidgetApiClient, vapidPublicKey: string) {
    this.apiClient = apiClient;
    this.vapidPublicKey = vapidPublicKey;
  }

  async subscribe(sessionId: string): Promise<boolean> {
    if (!this.vapidPublicKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey) as BufferSource,
      });

      await this.apiClient.subscribePush(sessionId, subscription);
      return true;
    } catch {
      return false;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
  }
}
