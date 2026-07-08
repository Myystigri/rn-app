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
  delayMs?: number;
};

export type ChoicesEvent = {
  type: 'choices';
  id: string;
  choices: PendingChoice[];
};

export type NotificationEvent = {
  type: 'notification';
  id: string;
  appId: string;
  title: string;
  body: string;
};

export type UnlockAppEvent = {
  type: 'unlock-app';
  id: string;
  appId: string;
};

export type TypingEvent = {
  type: 'typing';
  id: string;
  speakerId: string;
  durationMs: number;
};

export type SceneEndedEvent = {
  type: 'scene-ended';
  id: string;
  sceneId: string;
};

export type GameEvent =
  | MessageEvent
  | ChoicesEvent
  | NotificationEvent
  | UnlockAppEvent
  | TypingEvent
  | SceneEndedEvent;

export type CompiledInkStory = Record<string, unknown>;

export type ConversationDefinition = {
  id: string;
  title: string;
  startSceneId: string;
  compiledStory: CompiledInkStory;
};

export type ConversationState = {
  id: string;
  title: string;
  status: 'idle' | 'active' | 'ended';
  events: GameEvent[];
  pendingChoices: PendingChoice[];
  activeTyping: TypingEvent | null;
};

export type GameSettings = {
  incomingMessageDelayEnabled: boolean;
  incomingMessageDelayProfile: DelayProfileId;
};
