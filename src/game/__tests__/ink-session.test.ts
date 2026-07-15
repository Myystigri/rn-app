import { conversationDefinitions, mainStoryDefinition } from '@/game/catalog';
import { InkStorySession } from '@/game/ink-session';
import { PersistedDeliveryState } from '@/game/types';

const mayaConversationId = 'maya';

function createDeliveryState(visibleEventCount: number): PersistedDeliveryState {
  return {
    visibleEventCount,
    pendingEventId: null,
    availableAt: null,
    deliveredAt: null,
  };
}

function createSession() {
  return new InkStorySession(mainStoryDefinition, conversationDefinitions);
}

describe('InkStorySession', () => {
  it('maps the opening knot into app-owned messages and choices', () => {
    const session = createSession();

    session.startConversation(mayaConversationId);

    expect(session.conversationSnapshot(mayaConversationId)).toMatchObject({
      status: 'active',
      events: [
        {
          type: 'message',
          id: 'intro.maya.001',
          conversationId: mayaConversationId,
          speakerId: 'maya',
          direction: 'incoming',
          text: 'Are you there?',
        },
      ],
      pendingChoices: [
        { id: 0, text: "Yeah. What's going on?" },
        { id: 1, text: 'Who is this?' },
      ],
    });
  });

  it('restores shared Ink state and continues from the saved choice point', () => {
    const session = createSession();
    session.startConversation(mayaConversationId);

    const snapshot = session.serialize({
      [mayaConversationId]: createDeliveryState(1),
    });
    const restored = InkStorySession.restore(mainStoryDefinition, conversationDefinitions, snapshot);

    restored.choose(mayaConversationId, 0);

    const conversation = restored.conversationSnapshot(mayaConversationId);
    expect(conversation?.events.map((event) => event.id)).toEqual([
      'intro.maya.001',
      'intro.player.001',
      'intro.maya.0012',
      'intro.maya.002',
      'intro.maya.005',
    ]);
    expect(conversation?.events[2]).toMatchObject({
      type: 'message',
      imagePath: 'img.png',
      text: '',
    });
    expect(conversation?.pendingChoices).toEqual([
      { id: 0, text: 'Call the police.' },
      { id: 1, text: 'Lock yourself in the bathroom.' },
    ]);
  });

  it('emits ending side effects after the final choice', () => {
    const session = createSession();
    session.startConversation(mayaConversationId);
    session.choose(mayaConversationId, 1);
    session.choose(mayaConversationId, 0);

    const conversation = session.conversationSnapshot(mayaConversationId);
    expect(conversation?.status).toBe('ended');
    expect(conversation?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'unlock-app', id: 'intro.unlock.case-files', appId: 'case-files' }),
        expect.objectContaining({
          type: 'notification',
          id: 'intro.notification.case-files',
          appId: 'case-files',
        }),
        expect.objectContaining({ type: 'scene-ended', sceneId: 'maya_introduction' }),
      ])
    );

    expect(session.conversationSnapshot('bob')).toMatchObject({
      status: 'active',
      events: [
        { type: 'message', id: 'intro.unknown.001', conversationId: 'bob', speakerId: 'bob' },
      ],
    });
  });

  it('rejects an incompatible saved story version', () => {
    const session = createSession();
    const snapshot = session.serialize({
      [mayaConversationId]: createDeliveryState(0),
    });

    expect(() =>
      InkStorySession.restore(mainStoryDefinition, conversationDefinitions, {
        ...snapshot,
        storyVersion: 'fnv1a-outdated',
      })
    ).toThrow('Story version mismatch');
  });
});
