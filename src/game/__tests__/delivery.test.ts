import {
  buildConversationState,
  createDeliveryRuntime,
  hasDuePendingDelivery,
  markEventDelivered,
  reconcileDeliveryRuntime,
  scheduleDelayedDelivery,
} from '@/game/delivery';
import { defaultGameSettings } from '@/game/settings';
import { ConversationState, MessageEvent } from '@/game/types';

const incomingMessage: MessageEvent = {
  type: 'message',
  id: 'message.1',
  conversationId: 'maya',
  speakerId: 'maya',
  direction: 'incoming',
  text: 'Are you there?',
  delayMs: 1_000,
};

function createConversation(): ConversationState {
  return {
    id: 'maya',
    title: 'Maya',
    events: [incomingMessage],
    pendingChoices: [{ id: 0, text: 'Reply' }],
    activeTyping: null,
  };
}

describe('delivery runtime', () => {
  it('hides undelivered messages and choices while a message is pending', () => {
    const runtime = createDeliveryRuntime();
    const now = new Date('2026-07-15T10:00:00.000Z');
    scheduleDelayedDelivery(runtime, incomingMessage, 1_000, now);

    expect(buildConversationState(createConversation(), runtime)).toMatchObject({
      events: [],
      pendingChoices: [],
      activeTyping: {
        speakerId: 'maya',
        durationMs: 1_000,
      },
    });
  });

  it('reconstructs typing and delivers a due message after restoring state', () => {
    const now = new Date('2026-07-15T10:00:00.000Z');
    const runtime = createDeliveryRuntime({
      visibleEventCount: 0,
      pendingEventId: incomingMessage.id,
      availableAt: '2026-07-15T10:00:01.000Z',
    });

    reconcileDeliveryRuntime(runtime, createConversation(), defaultGameSettings, now);
    expect(runtime.activeTyping).toMatchObject({ speakerId: 'maya', durationMs: 1_000 });
    expect(hasDuePendingDelivery(runtime, incomingMessage, now)).toBe(false);

    const dueAt = new Date('2026-07-15T10:00:01.000Z');
    expect(hasDuePendingDelivery(runtime, incomingMessage, dueAt)).toBe(true);

    markEventDelivered(runtime, dueAt);
    expect(buildConversationState(createConversation(), runtime)).toMatchObject({
      events: [incomingMessage],
      pendingChoices: [{ id: 0, text: 'Reply' }],
      activeTyping: null,
    });
    expect(runtime.deliveredAt).toBe(dueAt.toISOString());
  });

  it('clears stale delivery metadata when it does not match the next message', () => {
    const runtime = createDeliveryRuntime({
      pendingEventId: 'message.other',
      availableAt: '2026-07-15T10:00:01.000Z',
    });

    reconcileDeliveryRuntime(
      runtime,
      createConversation(),
      defaultGameSettings,
      new Date('2026-07-15T10:00:00.000Z')
    );

    expect(runtime).toMatchObject({
      pendingEventId: null,
      availableAt: null,
      activeTyping: null,
    });
  });
});
