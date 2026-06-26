export interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}

export interface PushNotificationPayload {
    title: string;
    body: string;
    icon?: string;
    url?: string;
    data?: Record<string, unknown>;
}
