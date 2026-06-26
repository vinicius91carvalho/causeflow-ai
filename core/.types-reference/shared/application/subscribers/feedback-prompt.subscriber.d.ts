import type { IEventBus } from '../../domain/events.js';
import type { ChatPlatform } from '../ports/chat-platform.port.js';
export declare function registerFeedbackPromptSubscriber(deps: {
    eventBus: IEventBus;
    chatPlatform: ChatPlatform;
}): void;
