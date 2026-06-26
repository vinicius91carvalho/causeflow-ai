import type { CloudProvider } from './ports/cloud-provider.port.js';
import type { ChatPlatform } from './ports/chat-platform.port.js';
import type { AlertParser } from './ports/alert-source.port.js';
import type { CredentialVendor } from './ports/credential-vendor.port.js';
export class ProviderRegistry {
    cloudProviders = new Map<string, CloudProvider>();
    chatPlatforms = new Map<string, ChatPlatform>();
    alertParsers = new Map<string, AlertParser>();
    credentialVendor: CredentialVendor | null = null;
    registerCloudProvider(name: string, provider: CloudProvider): void {
        this.cloudProviders.set(name, provider);
    }
    registerChatPlatform(name: string, platform: ChatPlatform): void {
        this.chatPlatforms.set(name, platform);
    }
    registerAlertParser(source: string, parser: AlertParser): void {
        this.alertParsers.set(source, parser);
    }
    registerCredentialVendor(vendor: CredentialVendor): void {
        this.credentialVendor = vendor;
    }
    getCloudProvider(name: string): CloudProvider | undefined {
        return this.cloudProviders.get(name);
    }
    getChatPlatform(name: string): ChatPlatform | undefined {
        return this.chatPlatforms.get(name);
    }
    getAlertParser(source: string): AlertParser | undefined {
        return this.alertParsers.get(source);
    }
    getCredentialVendor(): CredentialVendor | null {
        return this.credentialVendor;
    }
    listCloudProviders(): string[] {
        return [...this.cloudProviders.keys()];
    }
    listChatPlatforms(): string[] {
        return [...this.chatPlatforms.keys()];
    }
    listAlertParsers(): string[] {
        return [...this.alertParsers.keys()];
    }
}
