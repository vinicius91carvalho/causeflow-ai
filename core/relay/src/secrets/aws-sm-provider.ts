import type { ISecretProvider } from './secrets.port.js';

interface AwsSmClient {
  getSecretValue(input: { SecretId: string; VersionStage?: string }): Promise<{
    SecretString?: string;
    SecretBinary?: Uint8Array;
  }>;
}

export class AwsSecretsManagerProvider implements ISecretProvider {
  readonly scheme = 'aws-sm';
  private clientPromise: Promise<AwsSmClient> | null = null;

  constructor(private readonly region?: string) {}

  private async client(): Promise<AwsSmClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const mod = await import('@aws-sdk/client-secrets-manager').catch(() => {
          throw new Error('Install @aws-sdk/client-secrets-manager to use aws-sm: secrets');
        });
        const { SecretsManagerClient, GetSecretValueCommand } = mod as unknown as {
          SecretsManagerClient: new (opts: { region?: string }) => {
            send(cmd: unknown): Promise<{ SecretString?: string; SecretBinary?: Uint8Array }>;
          };
          GetSecretValueCommand: new (input: { SecretId: string }) => unknown;
        };
        const raw = new SecretsManagerClient({ region: this.region });
        return {
          async getSecretValue(input) {
            const cmd = new GetSecretValueCommand({ SecretId: input.SecretId });
            return raw.send(cmd);
          },
        };
      })();
    }
    return this.clientPromise;
  }

  async resolve(ref: string): Promise<string> {
    const [arnOrName, jsonKey] = ref.split('#');
    const c = await this.client();
    const resp = await c.getSecretValue({ SecretId: arnOrName! });
    const raw = resp.SecretString ?? (resp.SecretBinary ? Buffer.from(resp.SecretBinary).toString('utf-8') : '');
    if (!jsonKey) return raw;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const value = parsed[jsonKey];
      if (typeof value !== 'string') throw new Error(`Key ${jsonKey} not found or not a string in secret`);
      return value;
    } catch (err) {
      throw new Error(`Failed to extract key ${jsonKey}: ${(err as Error).message}`);
    }
  }
}
