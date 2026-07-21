export type MessageDirection = 'incoming' | 'outgoing' | 'system';

export type DelayProfileId = 'fast' | 'normal' | 'slow';

export type PendingChoice = {
  id: number;
  text: string;
};

export type MessageEvent = {
  type: 'message';
  id: string;
  conversationId: string;
  speakerId: string;
  direction: MessageDirection;
  text: string;
  imagePath?: string;
  delayMs?: number;
};

export type NotificationEvent = {
  type: 'notification';
  id: string;
  conversationId: string;
  appId: string;
  title: string;
  body: string;
};

export type UnlockAppEvent = {
  type: 'unlock-app';
  id: string;
  conversationId: string;
  appId: string;
};

export type UnlockConversationEvent = {
  type: 'unlock-conversation';
  id: string;
  conversationId: string;
};

export type TypingEvent = {
  type: 'typing';
  id: string;
  speakerId: string;
  durationMs: number;
};

export type GameEvent =
  | MessageEvent
  | NotificationEvent
  | UnlockAppEvent
  | UnlockConversationEvent;

export type CompiledInkStory = Record<string, unknown>;

export type StoryDefinition = {
  id: string;
  entryPoint: string;
  compiledStory: CompiledInkStory;
  contentVersion: string;
};

export type ConversationDefinition = {
  id: string;
  title: string;
  unlockedByDefault?: boolean;
};

export type PersistedDeliveryState = {
  visibleEventCount: number;
  pendingEventId: string | null;
  availableAt: string | null;
  deliveredAt: string | null;
};

export type ConversationState = {
  id: string;
  title: string;
  events: GameEvent[];
  pendingChoices: PendingChoice[];
  activeTyping: TypingEvent | null;
};

export type GameSettings = {
  incomingMessageDelayEnabled: boolean;
  incomingMessageDelayProfile: DelayProfileId;
};

export type PhoneAppDefinition = {
  id: string;
  title: string;
  description: string;
  route: string | null;
  unlockedByDefault: boolean;
};

export type PhoneAppState = PhoneAppDefinition & {
  isUnlocked: boolean;
  badgeCount: number;
};

export type ConversationTimelineEntry = {
  id: string;
  eventType: 'notification' | 'unlock-app' | 'unlock-conversation';
  title: string;
  detail?: string;
};

export type GameSideEffectsState = {
  notifications: NotificationEvent[];
  unlockedAppIds: string[];
  unlockedConversationIds: string[];
  timelineByConversationId: Record<string, ConversationTimelineEntry[]>;
};
