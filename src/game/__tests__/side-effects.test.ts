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
  status: 'ended',
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
      appId: 'case-files',
    },
    {
      type: 'notification',
      id: 'notification.case-files',
      appId: 'case-files',
      title: 'Case Files unlocked',
      body: 'New material is available.',
    },
    {
      type: 'scene-ended',
      id: 'scene.ended',
      sceneId: 'maya_introduction',
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
    expect(sideEffects.timelineByConversationId.maya).toEqual([
      { id: 'unlock.case-files', eventType: 'unlock-app', title: 'Unlocked Case Files' },
      {
        id: 'notification.case-files',
        eventType: 'notification',
        title: 'Case Files unlocked',
        detail: 'New material is available.',
      },
      { id: 'scene.ended', eventType: 'scene-ended', title: 'Scene ended' },
    ]);

    const apps = buildPhoneApps(phoneAppDefinitions, sideEffects);
    expect(apps.find((app) => app.id === 'case-files')).toMatchObject({ isUnlocked: true });
    expect(apps.find((app) => app.id === 'notifications')).toMatchObject({ badgeCount: 1 });
  });

  it('keeps message and timeline entries in story order for rendering', () => {
    const sideEffects = reduceGameSideEffects({ maya }, phoneAppDefinitionById);

    expect(buildConversationDisplayItems(maya, sideEffects.timelineByConversationId.maya)).toEqual([
      { id: 'message.1', type: 'message', event: maya.events[0] },
      { id: 'unlock.case-files', type: 'meta', eventType: 'unlock-app', title: 'Unlocked Case Files' },
      {
        id: 'notification.case-files',
        type: 'meta',
        eventType: 'notification',
        title: 'Case Files unlocked',
        detail: 'New material is available.',
      },
      { id: 'scene.ended', type: 'meta', eventType: 'scene-ended', title: 'Scene ended' },
    ]);
  });
});
