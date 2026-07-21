import { loadGameSnapshot } from '@/game/persistence/game-save-store';

describe('loadGameSnapshot', () => {
  it('retains valid persisted data while ignoring malformed conversations and events', async () => {
    const getAllAsync = jest
      .fn()
      .mockResolvedValueOnce([
        {
          conversation_id: '__story__',
          status: 'active',
          story_id: 'main',
          story_version: 'fnv1a-current',
          ink_state_json: '{"ink":true}',
          event_sequence: 8,
          visible_event_count: 0,
          delivery_event_id: null,
          delivery_available_at: null,
          last_delivered_at: null,
          pending_choices_json: '[]',
        },
        {
          conversation_id: 'maya',
          status: 'active',
          story_id: null,
          story_version: null,
          ink_state_json: null,
          event_sequence: 0,
          visible_event_count: 1,
          delivery_event_id: 'message.2',
          delivery_available_at: '2026-07-15T10:00:01.000Z',
          last_delivered_at: null,
          pending_choices_json: '[{"id":0,"text":"Reply"}]',
        },
        {
          conversation_id: 'invalid',
          status: 'unknown',
          story_id: null,
          story_version: null,
          ink_state_json: null,
          event_sequence: 0,
          visible_event_count: null,
          delivery_event_id: null,
          delivery_available_at: null,
          last_delivered_at: null,
          pending_choices_json: 'not-json',
        },
      ])
      .mockResolvedValueOnce([
        {
          conversation_id: 'maya',
          payload_json:
            '{"type":"message","id":"message.1","conversationId":"maya","speakerId":"maya","direction":"incoming","text":"Hello"}',
        },
        { conversation_id: 'maya', payload_json: 'not-json' },
      ]);
    const db = { getAllAsync };

    const snapshot = await loadGameSnapshot(db as never);

    expect(snapshot).toEqual({
      storyId: 'main',
      storyVersion: 'fnv1a-current',
      inkStateJson: '{"ink":true}',
      sequence: 8,
      conversationsById: {
        maya: {
          pendingChoices: [{ id: 0, text: 'Reply' }],
          events: [
            {
              type: 'message',
              id: 'message.1',
              conversationId: 'maya',
              speakerId: 'maya',
              direction: 'incoming',
              text: 'Hello',
            },
          ],
          delivery: {
            visibleEventCount: 1,
            pendingEventId: 'message.2',
            availableAt: '2026-07-15T10:00:01.000Z',
            deliveredAt: null,
          },
        },
      },
    });
  });

  it('returns null when no save rows exist', async () => {
    const db = { getAllAsync: jest.fn().mockResolvedValue([]) };

    await expect(loadGameSnapshot(db as never)).resolves.toBeNull();
    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
  });
});
