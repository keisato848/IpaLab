/**
 * expo-sqlite + Drizzle ORM クライアント（詳細設計§7）
 * - DB は遅延初期化（SSR/テスト時に import しても安全）
 * - マイグレーションは起動時に一度だけ適用
 */
import * as SQLite from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

let _db: ExpoSQLiteDatabase<typeof schema> | null = null;

export function getDb(): ExpoSQLiteDatabase<typeof schema> {
    if (_db) return _db;
    const sqlite = SQLite.openDatabaseSync('daidoko.db');
    _db = drizzle(sqlite, { schema });
    return _db;
}

/** テスト用リセット */
export function _resetDbForTest(): void {
    _db = null;
}
