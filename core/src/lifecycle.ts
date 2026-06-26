import { logger } from './shared/infra/logger.js';

export interface ShutdownComponent {
    name: string;
    shutdown(): Promise<void>;
}

export class AppLifecycle {
    components: ShutdownComponent[] = [];
    shutdownTimeout;
    isShuttingDown = false;
    constructor(timeoutMs: number = 30_000) {
        this.shutdownTimeout = timeoutMs;
    }
    register(component: ShutdownComponent): void {
        this.components.push(component);
    }
    install(): void {
        const handler = () => {
            void this.shutdown();
        };
        process.on('SIGTERM', handler);
        process.on('SIGINT', handler);
    }
    async shutdown(): Promise<void> {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        logger.info({ components: this.components.map((c) => c.name) }, 'Graceful shutdown initiated');
        const timeout = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Shutdown timeout exceeded')), this.shutdownTimeout);
        });
        try {
            await Promise.race([
                this.shutdownSequential(),
                timeout,
            ]);
            logger.info('Graceful shutdown complete');
            process.exit(0);
        }
        catch (err) {
            logger.error({ err }, 'Shutdown failed or timed out');
            process.exit(1);
        }
    }
    async shutdownSequential() {
        for (const component of this.components) {
            try {
                logger.info({ component: component.name }, 'Shutting down component');
                await component.shutdown();
            }
            catch (err) {
                logger.error({ err, component: component.name }, 'Component shutdown failed');
            }
        }
    }
}
