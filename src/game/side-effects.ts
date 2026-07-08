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
    }
  | {
      id: string;
      type: 'meta';
      eventType: ConversationTimelineEntry['eventType'];
      title: string;
      detail?: string;
    };

export function createInitialSideEffectsState(): GameSideEffectsState {
  return {
    notifications: [],
    unlockedAppIds: [],
    timelineByConversationId: {},
  };
}

export function reduceGameSideEffects(
  conversationsById: Record<string, ConversationState>,
  phoneAppsById: Record<string, PhoneAppDefinition>
): GameSideEffectsState {
  const notifications: NotificationEvent[] = [];
  const unlockedAppIds = new Set<string>();
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

      if (event.type === 'scene-ended') {
        timeline.push({
          id: event.id,
          eventType: 'scene-ended',
          title: 'Scene ended',
        });
      }
    }

    timelineByConversationId[conversationId] = timeline;
  }

  return {
    notifications,
    unlockedAppIds: [...unlockedAppIds],
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
  conversation: ConversationState,
  timeline: ConversationTimelineEntry[]
): ConversationDisplayItem[] {
  const timelineById = new Map(timeline.map((entry) => [entry.id, entry]));
  const items: ConversationDisplayItem[] = [];

  for (const event of conversation.events) {
    if (event.type === 'message') {
      items.push({
        id: event.id,
        type: 'message',
        event,
      });
      continue;
    }

    const entry = timelineById.get(event.id);
    if (!entry) {
      continue;
    }

    items.push({
      id: entry.id,
      type: 'meta',
      eventType: entry.eventType,
      title: entry.title,
      detail: entry.detail,
    });
  }

  return items;
}
