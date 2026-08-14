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
          id: 'main.event.1',
          conversationId: mayaConversationId,
          speakerId: 'maya',
          direction: 'incoming',
          text: "So ?! How's the phone ?? Does it still work ?",
          time: '11:01',
        },
      ],
      pendingChoices: [
        { id: 0, text: "Haven't really had time to play with it yet" },
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
      'main.event.1',
      'main.event.2',
      'main.event.3',
      'main.event.4',
      'main.event.5',
      'main.event.6',
      'main.event.7',
      'intro.unlock.insta',
      'intro.notification.insta',
    ]);
    expect(conversation?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'notification',
          id: 'intro.notification.insta',
          appId: 'insta',
          title: 'Insta unlocked',
          body: 'Insta is now available on your phone.',
        }),
      ])
    );
    expect(conversation?.pendingChoices).toEqual([
      { id: 0, text: "I don't like social networks" },
      { id: 1, text: "Sure I'll try and download it" },
    ]);
  });

  it('continues through a second choice in the same conversation', () => {
    const session = createSession();
    session.start();
    session.choose(mayaConversationId, 1);
    session.choose(mayaConversationId, 0);

    expect(session.conversationSnapshot(mayaConversationId)?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'unlock-app',
          id: 'intro.unlock.insta',
          conversationId: 'maya',
          appId: 'insta',
        }),
      ])
    );
    expect(session.conversationSnapshot(mayaConversationId)?.pendingChoices).toEqual([
      { id: 0, text: "I don't like social networks" },
      { id: 1, text: "Sure I'll try and download it" },
    ]);
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
