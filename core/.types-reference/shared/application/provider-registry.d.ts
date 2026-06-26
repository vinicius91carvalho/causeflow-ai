import type { CloudProvider } from './ports/cloud-provider.port.js';
import type { ChatPlatform } from './ports/chat-platform.port.js';
import type { AlertParser } from './ports/alert-source.port.js';
import type { CredentialVendor } from './ports/credential-vendor.port.js';
export declare class ProviderRegistry {
    private cloudProviders;
    private chatPlatforms;
    private alertParsers;
    private credentialVendor;
    registerCloudProvider(name: string, provider: CloudProvider): void;
    registerChatPlatform(name: string, platform: ChatPlatform): void;
    registerAlertParser(source: string, parser: AlertParser): void;
    registerCredentialVendor(vendor: CredentialVendor): void;
    getCloudProvider(name: string): CloudProvider | undefined;
    getChatPlatform(name: string): ChatPlatform | undefined;
    getAlertParser(source: string): AlertParser | undefined;
    getCredentialVendor(): CredentialVendor | null;
    listCloudProviders(): string[];
    listChatPlatforms(): string[];
    listAlertParsers(): string[];
}
