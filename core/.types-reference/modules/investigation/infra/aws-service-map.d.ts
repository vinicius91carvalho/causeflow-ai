/**
 * Maps AWS service short names to their SDK v3 client package + class name.
 * Used by aws-api-tool.ts to dynamically resolve clients.
 */
export interface AwsServiceEntry {
    pkg: string;
    client: string;
}
export declare const AWS_SERVICE_MAP: Record<string, AwsServiceEntry>;
export declare function getServiceEntry(service: string): AwsServiceEntry;
