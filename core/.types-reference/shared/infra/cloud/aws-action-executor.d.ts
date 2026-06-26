import type { CloudCredentials } from '../../application/ports/cloud-provider.port.js';
export declare function restartService(creds: CloudCredentials, params: Record<string, unknown>): Promise<{
    success: boolean;
    output?: string;
}>;
export declare function scaleService(creds: CloudCredentials, params: Record<string, unknown>): Promise<{
    success: boolean;
    output?: string;
}>;
export declare function rollbackService(creds: CloudCredentials, params: Record<string, unknown>): Promise<{
    success: boolean;
    output?: string;
}>;
export declare function runSSMCommand(creds: CloudCredentials, params: Record<string, unknown>): Promise<{
    success: boolean;
    output?: string;
}>;
