export interface ScheduledJob {
    name: string;
    intervalMs: number;
    execute: () => Promise<void>;
}
export declare class InProcessScheduler {
    private timers;
    private running;
    start(jobs: ScheduledJob[]): void;
    stop(): Promise<void>;
}
