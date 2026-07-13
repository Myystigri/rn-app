import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  ConversationSessionSaveSnapshot,
  InkStorySaveSnapshot,
} from '@/game/ink-session';
import type { ConversationState, GameEvent, PendingChoice } from '@/game/types';
import { withGameTransaction } from '@/game/persistence/transaction';

const STORY_SAVE_ID = '__story__';

type ConversationSaveRow = {
  conversation_id: string;
  status: ConversationState['status'];
  story_id: string | null;
  story_version: string | null;
  ink_state_json: string | null;
  event_sequence: number;
  visible_event_count: number | null;
  delivery_event_id: string | null;
  delivery_available_at: string | null;
  last_delivered_at: string | null;
  pending_choices_json: string;
};

type GameEventRow = {
  conversation_id: string;
  payload_json: string;
};

export async function loadGameSnapshot(db: SQLiteDatabase): Promise<InkStorySaveSnapshot | null> {
  const saveRows = await db.getAllAsync<ConversationSaveRow>(
    `
      SELECT
        conversation_id,
        status,
        story_id,
        story_version,
        ink_state_json,
        event_sequence,
        visible_event_count,
        delivery_event_id,
        delivery_available_at,
        last_delivered_at,
        pending_choices_json
      FROM conversation_saves
    `
  );

  if (saveRows.length === 0) {
    return null;
  }

  const eventRows = await db.getAllAsync<GameEventRow>(
    `
      SELECT conversation_id, payload_json
      FROM game_events
      ORDER BY conversation_id ASC, event_index ASC
    `
  );

  const eventsByConversation = new Map<string, GameEvent[]>();
  for (const row of eventRows) {
    const event = parseJson<GameEvent>(row.payload_json);
    if (!event) {
      continue;
    }

    const existingEvents = eventsByConversation.get(row.conversation_id);
    if (existingEvents) {
      existingEvents.push(event);
      continue;
    }

    eventsByConversation.set(row.conversation_id, [event]);
  }

  const storyRow = saveRows.find((row) => row.conversation_id === STORY_SAVE_ID);
  const fallbackStoryRow = storyRow ?? saveRows.find((row) => row.ink_state_json);
  const conversationsById: Record<string, ConversationSessionSaveSnapshot> = {};

  for (const row of saveRows) {
    if (row.conversation_id === STORY_SAVE_ID) {
      continue;
    }

    const pendingChoices = parseJson<PendingChoice[]>(row.pending_choices_json);
    if (!isConversationStatus(row.status) || !pendingChoices) {
      continue;
    }

    const events = eventsByConversation.get(row.conversation_id) ?? [];
    conversationsById[row.conversation_id] = {
      status: row.status,
      pendingChoices,
      events,
      delivery: {
        visibleEventCount: row.visible_event_count ?? events.length,
        pendingEventId: row.delivery_event_id,
        availableAt: row.delivery_available_at,
        deliveredAt: row.last_delivered_at,
      },
    };
  }

  return {
    storyId: fallbackStoryRow?.story_id ?? undefined,
    storyVersion: fallbackStoryRow?.story_version ?? undefined,
    inkStateJson: fallbackStoryRow?.ink_state_json ?? undefined,
    sequence: fallbackStoryRow?.event_sequence ?? 0,
    conversationsById,
  };
}

export async function saveGameSnapshot(db: SQLiteDatabase, snapshot: InkStorySaveSnapshot) {
  if (!snapshot.inkStateJson && isEveryConversationIdle(snapshot)) {
    await deleteGameSnapshot(db);
    return;
  }

  await withGameTransaction(db, async (txn) => {
    await txn.runAsync('DELETE FROM game_events');
    await txn.runAsync('DELETE FROM conversation_saves');

    await txn.runAsync(
      `
        INSERT INTO conversation_saves (
          conversation_id,
          status,
          story_id,
          story_version,
          ink_state_json,
          event_sequence,
          visible_event_count,
          delivery_event_id,
          delivery_available_at,
          last_delivered_at,
          pending_choices_json,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      STORY_SAVE_ID,
      getStoryStatus(snapshot),
      snapshot.storyId ?? null,
      snapshot.storyVersion ?? null,
      snapshot.inkStateJson ?? null,
      snapshot.sequence,
      0,
      null,
      null,
      null,
      JSON.stringify([]),
      new Date().toISOString()
    );

    for (const [conversationId, conversation] of Object.entries(snapshot.conversationsById)) {
      await txn.runAsync(
        `
          INSERT INTO conversation_saves (
            conversation_id,
            status,
            story_id,
            story_version,
            ink_state_json,
            event_sequence,
            visible_event_count,
            delivery_event_id,
            delivery_available_at,
            last_delivered_at,
            pending_choices_json,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        conversationId,
        conversation.status,
        null,
        null,
        null,
        0,
        conversation.delivery.visibleEventCount,
        conversation.delivery.pendingEventId,
        conversation.delivery.availableAt,
        conversation.delivery.deliveredAt,
        JSON.stringify(conversation.pendingChoices),
        new Date().toISOString()
      );

      for (const [index, event] of conversation.events.entries()) {
        await txn.runAsync(
          `
            INSERT INTO game_events (
              event_id,
              conversation_id,
              event_type,
              event_index,
              payload_json
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          event.id,
          conversationId,
          event.type,
          index,
          JSON.stringify(event)
        );
      }
    }
  });
}

export async function deleteGameSnapshot(db: SQLiteDatabase) {
  await withGameTransaction(db, async (txn) => {
    await txn.runAsync('DELETE FROM game_events');
    await txn.runAsync('DELETE FROM conversation_saves');
  });
}

function parseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function isConversationStatus(value: string): value is ConversationState['status'] {
  return value === 'idle' || value === 'active' || value === 'ended';
}

function getStoryStatus(snapshot: InkStorySaveSnapshot): ConversationState['status'] {
  const conversations = Object.values(snapshot.conversationsById);
  if (conversations.some((conversation) => conversation.status === 'active')) {
    return 'active';
  }

  if (conversations.some((conversation) => conversation.status === 'ended')) {
    return 'ended';
  }

  return 'idle';
}

function isEveryConversationIdle(snapshot: InkStorySaveSnapshot) {
  return Object.values(snapshot.conversationsById).every(
    (conversation) =>
      conversation.status === 'idle' &&
      conversation.events.length === 0 &&
      conversation.pendingChoices.length === 0
  );
}
