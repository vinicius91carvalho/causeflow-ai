export interface ShutdownComponent {
    name: string;
    shutdown(): Promise<void>;
}
export declare class AppLifecycle {
    private components;
    private shutdownTimeout;
    private isShuttingDown;
    constructor(timeoutMs?: number);
    register(component: ShutdownComponent): void;
    install(): void;
    shutdown(): Promise<void>;
    private shutdownSequential;
}
