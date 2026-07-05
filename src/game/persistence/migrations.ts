import type { SQLiteDatabase } from 'expo-sqlite';

import { GAME_DATABASE_VERSION } from '@/game/persistence/schema';

export async function migrateGameDbIfNeeded(db: SQLiteDatabase) {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentDbVersion = versionRow?.user_version ?? 0;

  if (currentDbVersion >= GAME_DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS conversation_saves (
        conversation_id TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL,
        ink_state_json TEXT,
        event_sequence INTEGER NOT NULL,
        pending_choices_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS game_events (
        event_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_index INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (conversation_id, event_id)
      );

      CREATE INDEX IF NOT EXISTS idx_game_events_conversation_order
      ON game_events (conversation_id, event_index);
    `);

    currentDbVersion = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${GAME_DATABASE_VERSION}`);
}
