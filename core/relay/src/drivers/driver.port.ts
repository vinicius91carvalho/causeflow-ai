import type { DriverType, ResourceConfig } from '../config/schema.js';

export interface DriverCommand {
  operation: string;
  params: Record<string, unknown>;
}

export interface DriverField {
  name: string;
  type: string;
}

export interface DriverResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields?: DriverField[];
  executionTimeMs: number;
  warnings?: string[];
}

export interface DriverValidation {
  valid: boolean;
  reason?: string;
}

export interface IReadOnlyDriver {
  readonly type: DriverType;
  validate(command: DriverCommand): DriverValidation;
  execute(command: DriverCommand): Promise<DriverResult>;
  healthCheck(): Promise<boolean>;
  capabilities(): string[];
  close(): Promise<void>;
}

export interface DriverFactory {
  readonly type: DriverType;
  create(resource: ResourceConfig, secrets: Record<string, string>): Promise<IReadOnlyDriver>;
}

export class DriverRegistry {
  private factories = new Map<DriverType, DriverFactory>();

  register(factory: DriverFactory): void {
    this.factories.set(factory.type, factory);
  }

  get(type: DriverType): DriverFactory | undefined {
    return this.factories.get(type);
  }

  listTypes(): DriverType[] {
    return Array.from(this.factories.keys());
  }
}
