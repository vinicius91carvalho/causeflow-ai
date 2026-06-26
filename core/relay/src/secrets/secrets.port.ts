export interface ISecretProvider {
  readonly scheme: string;
  resolve(ref: string): Promise<string>;
}

export class SecretResolver {
  private providers = new Map<string, ISecretProvider>();

  register(provider: ISecretProvider): void {
    this.providers.set(provider.scheme, provider);
  }

  async resolve(ref: string | undefined): Promise<string> {
    if (!ref) return '';
    const colonIdx = ref.indexOf(':');
    if (colonIdx < 0) return ref;
    const scheme = ref.slice(0, colonIdx);
    const path = ref.slice(colonIdx + 1);

    if (scheme === 'plain') return path;

    const provider = this.providers.get(scheme);
    if (!provider) {
      throw new Error(`No secret provider registered for scheme: ${scheme}`);
    }
    return provider.resolve(path);
  }

  async resolveMany(refs: Record<string, string>): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    for (const [key, ref] of Object.entries(refs)) {
      out[key] = await this.resolve(ref);
    }
    return out;
  }
}
