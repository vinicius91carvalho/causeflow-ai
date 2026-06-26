export interface DriverCommand {
  operation: 'query' | 'describe_table' | 'list_tables' | 'explain';
  params: Record<string, unknown>;
}

export interface DriverResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields?: Array<{ name: string; type: string }>;
  executionTimeMs: number;
}

export interface IReadOnlyDriver {
  readonly type: 'postgres' | 'mongodb';
  validate(command: DriverCommand): { valid: boolean; reason?: string };
  execute(command: DriverCommand): Promise<DriverResult>;
  healthCheck(): Promise<boolean>;
  capabilities(): string[];
  close(): Promise<void>;
}
