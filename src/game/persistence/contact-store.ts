import type { SQLiteDatabase } from 'expo-sqlite';

import { withGameTransaction } from '@/game/persistence/transaction';

const CONTACT_NAMES_SETTING = 'contactNames';

export async function loadContactNames(db: SQLiteDatabase): Promise<Record<string, string>> {
  const row = await db.getFirstAsync<{ value_json: string }>(
    'SELECT value_json FROM app_settings WHERE setting_key = ?',
    CONTACT_NAMES_SETTING
  );

  if (!row) {
    return {};
  }

  try {
    const value = JSON.parse(row.value_json) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    );
  } catch {
    return {};
  }
}

export async function saveContactNames(db: SQLiteDatabase, names: Record<string, string>) {
  await withGameTransaction(db, async (txn) => {
    await txn.runAsync(
      `
        INSERT INTO app_settings (setting_key, value_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(setting_key) DO UPDATE SET
          value_json = excluded.value_json,
          updated_at = excluded.updated_at
      `,
      CONTACT_NAMES_SETTING,
      JSON.stringify(names),
      new Date().toISOString()
    );
  });
}
