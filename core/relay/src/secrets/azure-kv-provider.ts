import type { ISecretProvider } from './secrets.port.js';

interface AzureKvClient {
  getSecret(name: string): Promise<{ value?: string }>;
}

export class AzureKeyVaultProvider implements ISecretProvider {
  readonly scheme = 'azure-kv';
  private clientPromise: Promise<AzureKvClient> | null = null;

  constructor(private readonly vaultUrl: string) {}

  private async client(): Promise<AzureKvClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const kv = await import('@azure/keyvault-secrets').catch(() => {
          throw new Error('Install @azure/keyvault-secrets and @azure/identity to use azure-kv: secrets');
        });
        const id = await import('@azure/identity').catch(() => {
          throw new Error('Install @azure/identity');
        });
        const { SecretClient } = kv as unknown as {
          SecretClient: new (url: string, credential: unknown) => AzureKvClient;
        };
        const { DefaultAzureCredential } = id as unknown as {
          DefaultAzureCredential: new () => unknown;
        };
        return new SecretClient(this.vaultUrl, new DefaultAzureCredential());
      })();
    }
    return this.clientPromise;
  }

  async resolve(ref: string): Promise<string> {
    const c = await this.client();
    const resp = await c.getSecret(ref);
    if (!resp.value) throw new Error(`Secret ${ref} returned empty value`);
    return resp.value;
  }
}
