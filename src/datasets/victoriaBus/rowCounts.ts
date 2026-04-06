import { countRows, type SQLiteDatabase } from "../../core/sqlite.js";
import { TABLE_NAMES } from "./schema.js";

export function getVictoriaBusRowCounts(db: SQLiteDatabase): Record<string, number> {
  return Object.fromEntries(TABLE_NAMES.map((tableName) => [tableName, countRows(db, tableName)]));
}
