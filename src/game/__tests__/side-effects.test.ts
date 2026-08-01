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
      time: '08:14',
    },
    {
      type: 'unlock-app',
      id: 'unlock.insta',
      conversationId: 'maya',
      appId: 'insta',
    },
    {
      type: 'unlock-conversation',
      id: 'unlock.bob',
      conversationId: 'bob',
    },
    {
      type: 'notification',
      id: 'notification.insta',
      conversationId: 'maya',
      appId: 'insta',
      title: 'Insta unlocked',
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
    expect(sideEffects.unlockedAppIds).toEqual(['insta']);
    expect(sideEffects.unlockedConversationIds).toEqual(['bob']);
    expect(sideEffects.timelineByConversationId.maya).toEqual([
      { id: 'unlock.insta', eventType: 'unlock-app', title: 'Unlocked Insta' },
      { id: 'unlock.bob', eventType: 'unlock-conversation', title: 'New conversation unlocked' },
      {
        id: 'notification.insta',
        eventType: 'notification',
        title: 'Insta unlocked',
        detail: 'New material is available.',
      },
    ]);

    const apps = buildPhoneApps(phoneAppDefinitions, sideEffects);
    expect(apps.filter((app) => app.isUnlocked).map((app) => app.id)).toEqual([
      'messages',
      'settings',
      'photos',
      'insta',
    ]);
    expect(apps.find((app) => app.id === 'insta')).toMatchObject({
      isUnlocked: true,
      badgeCount: 1,
    });
  });

  it('renders story time markers with their messages without exposing metadata events', () => {
    expect(buildConversationDisplayItems(maya)).toEqual([
      { id: 'message.1.time', type: 'time-marker', time: '08:14' },
      { id: 'message.1', type: 'message', event: maya.events[0] },
    ]);
  });

  it('does not repeat a consecutive story time marker', () => {
    const conversation: ConversationState = {
      ...maya,
      events: [
        maya.events[0],
        {
          type: 'message',
          id: 'message.2',
          conversationId: 'maya',
          speakerId: 'player',
          direction: 'outgoing',
          text: 'I am on my way.',
          time: '08:14',
        },
      ],
    };

    expect(buildConversationDisplayItems(conversation).filter((item) => item.type === 'time-marker')).toEqual([
      { id: 'message.1.time', type: 'time-marker', time: '08:14' },
    ]);
  });
});
