import {
  buildConversationDisplayItems,
  buildPhoneApps,
  reduceGameSideEffects,
} from '@/game/side-effects';
import { phoneAppDefinitionById, phoneAppDefinitions } from '@/game/catalog';
import { ConversationState } from '@/game/types';

const maya: ConversationState = {
  id: 'maya',
  title: 'Maya',
  pendingChoices: [],
  activeTyping: null,
  events: [
    {
      type: 'message',
      id: 'message.1',
      conversationId: 'maya',
      speakerId: 'maya',
      direction: 'incoming',
      text: 'I found something.',
    },
    {
      type: 'unlock-app',
      id: 'unlock.case-files',
      conversationId: 'maya',
      appId: 'case-files',
    },
    {
      type: 'unlock-conversation',
      id: 'unlock.bob',
      conversationId: 'bob',
    },
    {
      type: 'notification',
      id: 'notification.case-files',
      conversationId: 'maya',
      appId: 'case-files',
      title: 'Case Files unlocked',
      body: 'New material is available.',
    },
  ],
};

describe('side-effect projections', () => {
  it('derives timeline, notifications, and unlocked applications from events', () => {
    const sideEffects = reduceGameSideEffects(
      {
        maya,
        duplicate: {
          ...maya,
          id: 'duplicate',
          events: [maya.events[2]],
        },
      },
      phoneAppDefinitionById
    );

    expect(sideEffects.notifications).toHaveLength(1);
    expect(sideEffects.unlockedAppIds).toEqual(['case-files']);
    expect(sideEffects.unlockedConversationIds).toEqual(['bob']);
    expect(sideEffects.timelineByConversationId.maya).toEqual([
      { id: 'unlock.case-files', eventType: 'unlock-app', title: 'Unlocked Case Files' },
      { id: 'unlock.bob', eventType: 'unlock-conversation', title: 'New conversation unlocked' },
      {
        id: 'notification.case-files',
        eventType: 'notification',
        title: 'Case Files unlocked',
        detail: 'New material is available.',
      },
    ]);

    const apps = buildPhoneApps(phoneAppDefinitions, sideEffects);
    expect(apps.find((app) => app.id === 'case-files')).toMatchObject({ isUnlocked: true });
    expect(apps.find((app) => app.id === 'notifications')).toMatchObject({ badgeCount: 1 });
  });

  it('renders messages without exposing metadata events in the conversation', () => {
    expect(buildConversationDisplayItems(maya)).toEqual([
      { id: 'message.1', type: 'message', event: maya.events[0] },
    ]);
  });
});
