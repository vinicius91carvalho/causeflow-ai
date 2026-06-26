export interface RedriveResult {
    moved: number;
    failed: number;
}
export declare function redriveDLQ(dlqUrl: string, targetUrl: string, limit?: number): Promise<RedriveResult>;
