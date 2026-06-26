export interface IMeterEventService {
    reportUsage(params: {
        eventName: string;
        stripeCustomerId: string;
        value?: number;
    }): Promise<void>;
}
