import type { ISecretProvider } from './secrets.port.js';

export class EnvSecretProvider implements ISecretProvider {
  readonly scheme = 'env';

  async resolve(ref: string): Promise<string> {
    const value = process.env[ref];
    if (value === undefined) {
      throw new Error(`Env var not set: ${ref}`);
    }
    return value;
  }
}
