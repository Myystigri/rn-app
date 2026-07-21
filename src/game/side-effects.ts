import {
  ConversationState,
  ConversationTimelineEntry,
  GameSideEffectsState,
  MessageEvent,
  NotificationEvent,
  PhoneAppDefinition,
  PhoneAppState,
} from '@/game/types';

export type ConversationDisplayItem =
  | {
      id: string;
      type: 'message';
      event: MessageEvent;
    };

export function createInitialSideEffectsState(): GameSideEffectsState {
  return {
    notifications: [],
    unlockedAppIds: [],
    unlockedConversationIds: [],
    timelineByConversationId: {},
  };
}

export function reduceGameSideEffects(
  conversationsById: Record<string, ConversationState>,
  phoneAppsById: Record<string, PhoneAppDefinition>
): GameSideEffectsState {
  const notifications: NotificationEvent[] = [];
  const unlockedAppIds = new Set<string>();
  const unlockedConversationIds = new Set<string>();
  const seenNotificationIds = new Set<string>();
  const timelineByConversationId: Record<string, ConversationTimelineEntry[]> = {};

  for (const [conversationId, conversation] of Object.entries(conversationsById)) {
    const timeline: ConversationTimelineEntry[] = [];

    for (const event of conversation.events) {
      if (event.type === 'notification') {
        if (!seenNotificationIds.has(event.id)) {
          notifications.push(event);
          seenNotificationIds.add(event.id);
        }

        timeline.push({
          id: event.id,
          eventType: 'notification',
          title: event.title,
          detail: event.body,
        });
        continue;
      }

      if (event.type === 'unlock-app') {
        unlockedAppIds.add(event.appId);
        timeline.push({
          id: event.id,
          eventType: 'unlock-app',
          title: `Unlocked ${phoneAppsById[event.appId]?.title ?? event.appId}`,
        });
        continue;
      }

      if (event.type === 'unlock-conversation') {
        unlockedConversationIds.add(event.conversationId);
        timeline.push({
          id: event.id,
          eventType: 'unlock-conversation',
          title: 'New conversation unlocked',
        });
        continue;
      }

    }

    timelineByConversationId[conversationId] = timeline;
  }

  return {
    notifications,
    unlockedAppIds: [...unlockedAppIds],
    unlockedConversationIds: [...unlockedConversationIds],
    timelineByConversationId,
  };
}

export function buildPhoneApps(
  phoneApps: PhoneAppDefinition[],
  sideEffects: GameSideEffectsState
): PhoneAppState[] {
  const unlockedAppIds = new Set(sideEffects.unlockedAppIds);
  const notificationCount = sideEffects.notifications.length;

  return phoneApps.map((app) => ({
    ...app,
    isUnlocked: app.unlockedByDefault || unlockedAppIds.has(app.id),
    badgeCount: app.id === 'messages' ? 0 : app.id === 'notifications' ? notificationCount : 0,
  }));
}

export function buildConversationDisplayItems(
  conversation: ConversationState
): ConversationDisplayItem[] {
  const items: ConversationDisplayItem[] = [];

  for (const event of conversation.events) {
    if (event.type !== 'message') {
      continue;
    }

    items.push({
      id: event.id,
      type: 'message',
      event,
    });
  }

  return items;
}
