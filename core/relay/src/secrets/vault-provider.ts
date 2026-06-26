import type { ISecretProvider } from './secrets.port.js';

export class VaultProvider implements ISecretProvider {
  readonly scheme = 'vault';

  constructor(
    private readonly address: string,
    private readonly token: string,
    private readonly namespace?: string,
  ) {}

  async resolve(ref: string): Promise<string> {
    const [path, field = 'value'] = ref.split('#');
    const url = `${this.address.replace(/\/$/, '')}/v1/${path}`;
    const headers: Record<string, string> = {
      'X-Vault-Token': this.token,
    };
    if (this.namespace) headers['X-Vault-Namespace'] = this.namespace;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Vault request failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as { data?: { data?: Record<string, unknown>; [k: string]: unknown } };
    const data = body.data?.data ?? body.data;
    if (!data || typeof data !== 'object') {
      throw new Error(`Vault returned unexpected shape for ${path}`);
    }
    const value = (data as Record<string, unknown>)[field];
    if (typeof value !== 'string') {
      throw new Error(`Vault secret ${path}#${field} is not a string`);
    }
    return value;
  }
}
