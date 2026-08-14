import {
  collectNewInAppNotifications,
  getActiveConversationId,
  mergeInAppNotifications,
} from '@/game/in-app-notifications';
import { ConversationState } from '@/game/types';

function conversation(
  id: string,
  title: string,
  events: ConversationState['events']
): ConversationState {
  return {
    id,
    title,
    events,
    pendingChoices: [],
    activeTyping: null,
  };
}

describe('in-app notifications', () => {
  it('collects only newly received messages outside the active conversation', () => {
    const conversations = {
      maya: conversation('maya', 'Maya', [
        {
          type: 'message',
          id: 'maya.incoming',
          conversationId: 'maya',
          speakerId: 'maya',
          direction: 'incoming',
          text: 'Are you there?',
        },
      ]),
      bob: conversation('bob', 'Bob', [
        {
          type: 'message',
          id: 'bob.outgoing',
          conversationId: 'bob',
          speakerId: 'player',
          direction: 'outgoing',
          text: 'Hello',
        },
      ]),
    };

    const activeResult = collectNewInAppNotifications(conversations, new Set(), 'maya');
    expect(activeResult.notifications).toEqual([]);

    const backgroundResult = collectNewInAppNotifications(conversations, new Set(), null);
    expect(backgroundResult.notifications).toEqual([
      expect.objectContaining({
        key: 'message:maya',
        sourceEventId: 'maya.incoming',
        title: 'Maya',
        body: 'Are you there?',
        conversationId: 'maya',
      }),
    ]);
  });

  it('stacks distinct notifications and replaces messages from the same conversation', () => {
    const firstMayaMessage = {
      key: 'message:maya',
      sourceEventId: 'maya.1',
      kind: 'message' as const,
      title: 'Maya',
      body: 'First',
      conversationId: 'maya',
    };
    const secondMayaMessage = {
      ...firstMayaMessage,
      sourceEventId: 'maya.2',
      body: 'Second',
    };
    const storyNotification = {
      key: 'story:unlock.insta',
      sourceEventId: 'unlock.insta',
      kind: 'story' as const,
      title: 'Insta unlocked',
      body: 'Insta is now available.',
      appId: 'insta',
    };

    const merged = mergeInAppNotifications(
      mergeInAppNotifications([], [firstMayaMessage, storyNotification]),
      [secondMayaMessage]
    );

    expect(merged).toEqual([secondMayaMessage, storyNotification]);
  });

  it('recognizes only the conversation screen itself as active', () => {
    expect(getActiveConversationId('/conversations/maya')).toBe('maya');
    expect(getActiveConversationId('/conversations/maya/contact')).toBeNull();
    expect(getActiveConversationId('/messages')).toBeNull();
  });

  it('recognizes a restarted story even when it reuses event ids', () => {
    const restartedConversation = conversation('maya', 'Maya', [
      {
        type: 'message',
        id: 'main.event.1',
        conversationId: 'maya',
        speakerId: 'maya',
        direction: 'incoming',
        text: 'A new playthrough',
      },
    ]);

    const result = collectNewInAppNotifications(
      { maya: restartedConversation },
      new Set(['main.event.1', 'main.event.2']),
      null
    );

    expect(result.notifications).toEqual([
      expect.objectContaining({ sourceEventId: 'main.event.1' }),
    ]);
  });
});
