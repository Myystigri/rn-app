import type { SQLiteDatabase } from 'expo-sqlite';

import { defaultGameSettings, isDelayProfileId } from '@/game/settings';
import { GameSettings } from '@/game/types';
import { withGameTransaction } from '@/game/persistence/transaction';

type AppSettingRow = {
  setting_key: string;
  value_json: string;
};

export async function loadGameSettings(db: SQLiteDatabase): Promise<GameSettings> {
  const rows = await db.getAllAsync<AppSettingRow>(
    `
      SELECT setting_key, value_json
      FROM app_settings
    `
  );

  const settings: GameSettings = { ...defaultGameSettings };

  for (const row of rows) {
    const value = parseJson<unknown>(row.value_json);

    if (row.setting_key === 'incomingMessageDelayEnabled' && typeof value === 'boolean') {
      settings.incomingMessageDelayEnabled = value;
    }

    if (row.setting_key === 'incomingMessageDelayProfile' && typeof value === 'string' && isDelayProfileId(value)) {
      settings.incomingMessageDelayProfile = value;
    }
  }

  return settings;
}

export async function saveGameSettings(db: SQLiteDatabase, settings: GameSettings) {
  const updatedAt = new Date().toISOString();

  await withGameTransaction(db, async (txn) => {
    await upsertSetting(
      txn,
      'incomingMessageDelayEnabled',
      settings.incomingMessageDelayEnabled,
      updatedAt
    );
    await upsertSetting(
      txn,
      'incomingMessageDelayProfile',
      settings.incomingMessageDelayProfile,
      updatedAt
    );
  });
}

async function upsertSetting(db: SQLiteDatabase, key: string, value: unknown, updatedAt: string) {
  await db.runAsync(
    `
      INSERT INTO app_settings (
        setting_key,
        value_json,
        updated_at
      )
      VALUES (?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `,
    key,
    JSON.stringify(value),
    updatedAt
  );
}

function parseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
