import type { ISecretProvider } from './secrets.port.js';

interface GcpSmClient {
  accessSecretVersion(input: { name: string }): Promise<Array<{ payload?: { data?: Uint8Array | string } }>>;
}

export class GcpSecretManagerProvider implements ISecretProvider {
  readonly scheme = 'gcp-sm';
  private clientPromise: Promise<GcpSmClient> | null = null;

  private async client(): Promise<GcpSmClient> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const mod = await import('@google-cloud/secret-manager').catch(() => {
          throw new Error('Install @google-cloud/secret-manager to use gcp-sm: secrets');
        });
        const { SecretManagerServiceClient } = mod as unknown as {
          SecretManagerServiceClient: new () => GcpSmClient;
        };
        return new SecretManagerServiceClient();
      })();
    }
    return this.clientPromise;
  }

  async resolve(ref: string): Promise<string> {
    const c = await this.client();
    const name = ref.includes('/versions/') ? ref : `${ref}/versions/latest`;
    const [response] = await c.accessSecretVersion({ name });
    if (!response) throw new Error(`Secret ${ref} not accessible`);
    const data = response.payload?.data;
    if (!data) throw new Error(`Secret ${ref} has no data`);
    return typeof data === 'string' ? data : Buffer.from(data).toString('utf-8');
  }
}
