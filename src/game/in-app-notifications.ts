import { ConversationState } from '@/game/types';

export type InAppNotification = {
  key: string;
  sourceEventId: string;
  kind: 'message' | 'story';
  title: string;
  body: string;
  conversationId?: string;
  appId?: string;
};

export function collectNewInAppNotifications(
  conversationsById: Record<string, ConversationState>,
  seenEventIds: ReadonlySet<string>,
  activeConversationId: string | null
) {
  const currentEventIds = new Set(
    Object.values(conversationsById).flatMap((conversation) =>
      conversation.events.map((event) => event.id)
    )
  );
  const storyWasRestarted = [...seenEventIds].some((eventId) => !currentEventIds.has(eventId));
  const nextSeenEventIds = new Set(storyWasRestarted ? [] : seenEventIds);
  const notifications: InAppNotification[] = [];

  for (const conversation of Object.values(conversationsById)) {
    for (const event of conversation.events) {
      if (nextSeenEventIds.has(event.id)) {
        continue;
      }

      nextSeenEventIds.add(event.id);

      if (
        event.type === 'message' &&
        event.direction === 'incoming' &&
        event.conversationId !== activeConversationId
      ) {
        notifications.push({
          key: `message:${event.conversationId}`,
          sourceEventId: event.id,
          kind: 'message',
          title: conversation.title,
          body: event.text || (event.imagePath ? 'Sent an image' : 'New message'),
          conversationId: event.conversationId,
        });
        continue;
      }

      if (event.type === 'notification') {
        notifications.push({
          key: `story:${event.id}`,
          sourceEventId: event.id,
          kind: 'story',
          title: event.title,
          body: event.body,
          appId: event.appId,
        });
      }
    }
  }

  return { notifications, seenEventIds: nextSeenEventIds };
}

export function mergeInAppNotifications(
  current: InAppNotification[],
  incoming: InAppNotification[]
) {
  return incoming.reduce((notifications, notification) => {
    const withoutReplacedNotification = notifications.filter(
      (currentNotification) => currentNotification.key !== notification.key
    );

    return [notification, ...withoutReplacedNotification];
  }, current);
}

export function getActiveConversationId(pathname: string) {
  const match = pathname.match(/^\/conversations\/([^/]+)\/?$/);

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
