import { DatabaseSync } from "node:sqlite";

export type SQLiteDatabase = DatabaseSync;

export function openDatabase(path: string): SQLiteDatabase {
  return new DatabaseSync(path);
}

export function executeSql(db: SQLiteDatabase, sql: string): void {
  db.exec(sql);
}

export function tableExists(db: SQLiteDatabase, tableName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;

  return row?.name === tableName;
}

export function indexExists(db: SQLiteDatabase, indexName: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
    .get(indexName) as { name?: string } | undefined;

  return row?.name === indexName;
}

export function countRows(db: SQLiteDatabase, tableName: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as { count: number };
  return row.count;
}
