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
        story_id TEXT,
        story_version TEXT,
        ink_state_json TEXT,
        event_sequence INTEGER NOT NULL,
        visible_event_count INTEGER NOT NULL DEFAULT 0,
        delivery_event_id TEXT,
        delivery_available_at TEXT,
        last_delivered_at TEXT,
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

      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    currentDbVersion = 3;
  }

  if (currentDbVersion === 1) {
    await db.execAsync(`
      ALTER TABLE conversation_saves
      ADD COLUMN visible_event_count INTEGER NOT NULL DEFAULT 0;

      UPDATE conversation_saves
      SET visible_event_count = (
        SELECT COUNT(*)
        FROM game_events
        WHERE game_events.conversation_id = conversation_saves.conversation_id
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        setting_key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    currentDbVersion = 2;
  }

  if (currentDbVersion === 2) {
    const existingColumns = await getTableColumns(db, 'conversation_saves');
    const migrationStatements: string[] = [];

    if (!existingColumns.has('story_id')) {
      migrationStatements.push(`
        ALTER TABLE conversation_saves
        ADD COLUMN story_id TEXT
      `);
    }

    if (!existingColumns.has('story_version')) {
      migrationStatements.push(`
        ALTER TABLE conversation_saves
        ADD COLUMN story_version TEXT
      `);
    }

    if (!existingColumns.has('delivery_event_id')) {
      migrationStatements.push(`
        ALTER TABLE conversation_saves
        ADD COLUMN delivery_event_id TEXT
      `);
    }

    if (!existingColumns.has('delivery_available_at')) {
      migrationStatements.push(`
        ALTER TABLE conversation_saves
        ADD COLUMN delivery_available_at TEXT
      `);
    }

    if (!existingColumns.has('last_delivered_at')) {
      migrationStatements.push(`
        ALTER TABLE conversation_saves
        ADD COLUMN last_delivered_at TEXT
      `);
    }

    for (const statement of migrationStatements) {
      await db.execAsync(statement);
    }

    currentDbVersion = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${GAME_DATABASE_VERSION}`);
}

async function getTableColumns(db: SQLiteDatabase, tableName: string) {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return new Set(rows.map((row) => row.name));
}
