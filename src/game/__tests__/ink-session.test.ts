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

    session.start();

    expect(session.conversationSnapshot(mayaConversationId)).toMatchObject({
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
    session.start();

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

  it('routes a cross-conversation choice and its continuation to Bob', () => {
    const session = createSession();
    session.start();
    session.choose(mayaConversationId, 1);
    session.choose(mayaConversationId, 0);

    expect(session.conversationSnapshot(mayaConversationId)?.pendingChoices).toEqual([]);
    expect(session.conversationSnapshot('bob')).toMatchObject({
      events: [
        { type: 'unlock-conversation', id: 'intro.unlock.bob', conversationId: 'bob' },
        { type: 'message', id: 'intro.unknown.001', conversationId: 'bob', speakerId: 'bob' },
      ],
      pendingChoices: [
        { id: 0, text: 'Yo Bob' },
        { id: 1, text: 'new phone' },
      ],
    });

    session.choose(mayaConversationId, 0);
    expect(session.conversationSnapshot('bob')?.pendingChoices).toHaveLength(2);

    session.choose('bob', 0);

    expect(session.conversationSnapshot(mayaConversationId)?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'unlock-app',
          id: 'intro.unlock.case-files',
          conversationId: 'maya',
          appId: 'case-files',
        }),
        expect.objectContaining({
          type: 'notification',
          id: 'intro.notification.case-files',
          conversationId: 'maya',
          appId: 'case-files',
        }),
      ])
    );
    expect(session.conversationSnapshot('bob')?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'message', id: 'intro.player.005', conversationId: 'bob' }),
        expect.objectContaining({ type: 'message', id: 'intro.unknown.002', conversationId: 'bob' }),
      ])
    );
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
