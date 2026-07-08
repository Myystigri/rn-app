import type { SQLiteDatabase } from 'expo-sqlite';

import type { InkSessionSaveSnapshot } from '@/game/ink-session';
import type { ConversationState, GameEvent, PendingChoice } from '@/game/types';

type ConversationSaveRow = {
  conversation_id: string;
  status: ConversationState['status'];
  ink_state_json: string | null;
  event_sequence: number;
  visible_event_count: number | null;
  pending_choices_json: string;
};

type GameEventRow = {
  conversation_id: string;
  payload_json: string;
};

export async function loadConversationSnapshots(db: SQLiteDatabase) {
  const saveRows = await db.getAllAsync<ConversationSaveRow>(
    `
      SELECT
        conversation_id,
        status,
        ink_state_json,
        event_sequence,
        visible_event_count,
        pending_choices_json
      FROM conversation_saves
    `
  );

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

  const snapshots: Record<string, InkSessionSaveSnapshot> = {};
  for (const row of saveRows) {
    const pendingChoices = parseJson<PendingChoice[]>(row.pending_choices_json);
    if (!isConversationStatus(row.status) || !pendingChoices) {
      continue;
    }

    snapshots[row.conversation_id] = {
      status: row.status,
      inkStateJson: row.ink_state_json ?? undefined,
      sequence: row.event_sequence,
      visibleEventCount: row.visible_event_count ?? (eventsByConversation.get(row.conversation_id)?.length ?? 0),
      pendingChoices,
      events: eventsByConversation.get(row.conversation_id) ?? [],
    };
  }

  return snapshots;
}

export async function saveConversationSnapshot(
  db: SQLiteDatabase,
  conversationId: string,
  snapshot: InkSessionSaveSnapshot
) {
  if (snapshot.status === 'idle') {
    await deleteConversationSnapshot(db, conversationId);
    return;
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `
        INSERT INTO conversation_saves (
          conversation_id,
          status,
          ink_state_json,
          event_sequence,
          visible_event_count,
          pending_choices_json,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(conversation_id) DO UPDATE SET
          status = excluded.status,
          ink_state_json = excluded.ink_state_json,
          event_sequence = excluded.event_sequence,
          visible_event_count = excluded.visible_event_count,
          pending_choices_json = excluded.pending_choices_json,
          updated_at = excluded.updated_at
      `,
      conversationId,
      snapshot.status,
      snapshot.inkStateJson ?? null,
      snapshot.sequence,
      snapshot.visibleEventCount,
      JSON.stringify(snapshot.pendingChoices),
      new Date().toISOString()
    );

    await txn.runAsync('DELETE FROM game_events WHERE conversation_id = ?', conversationId);

    for (const [index, event] of snapshot.events.entries()) {
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
  });
}

export async function deleteConversationSnapshot(db: SQLiteDatabase, conversationId: string) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM game_events WHERE conversation_id = ?', conversationId);
    await txn.runAsync('DELETE FROM conversation_saves WHERE conversation_id = ?', conversationId);
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
