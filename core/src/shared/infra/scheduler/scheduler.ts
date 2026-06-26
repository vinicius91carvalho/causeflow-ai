import { logger } from '../logger.js';

export interface ScheduledJob {
    name: string;
    intervalMs: number;
    execute: () => Promise<void>;
}

export class InProcessScheduler {
    timers: ReturnType<typeof setInterval>[] = [];
    running = false;
    start(jobs: ScheduledJob[]): void {
        if (this.running)
            return;
        this.running = true;
        for (const job of jobs) {
            logger.info({ job: job.name, intervalMs: job.intervalMs }, 'Scheduling job');
            const timer = setInterval(async () => {
                try {
                    logger.info({ job: job.name }, 'Executing scheduled job');
                    await job.execute();
                    logger.info({ job: job.name }, 'Scheduled job completed');
                }
                catch (err) {
                    logger.error({ err, job: job.name }, 'Scheduled job failed');
                }
            }, job.intervalMs);
            this.timers.push(timer);
        }
    }
    async stop(): Promise<void> {
        for (const timer of this.timers) {
            clearInterval(timer);
        }
        this.timers = [];
        this.running = false;
    }
}
