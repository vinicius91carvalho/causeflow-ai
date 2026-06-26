export declare function startInvestigationConsumer(queueUrl: string): {
    start: () => Promise<void>;
    stop: () => void;
};
