import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

type TransactionTask = (transaction: SQLiteDatabase) => Promise<void>;

export function withGameTransaction(db: SQLiteDatabase, task: TransactionTask) {
  if (Platform.OS === 'web') {
    return db.withTransactionAsync(() => task(db));
  }

  return db.withExclusiveTransactionAsync((transaction) => task(transaction));
}
