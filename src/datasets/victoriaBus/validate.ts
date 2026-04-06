import { access, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { sha256File } from "../../core/hash.js";
import { logSummary } from "../../core/logging.js";
import { countRows, indexExists, openDatabase, tableExists, type SQLiteDatabase } from "../../core/sqlite.js";
import type { VictoriaBusDatasetConfig } from "./config.js";
import { getVictoriaBusRowCounts } from "./rowCounts.js";
import { INDEX_NAMES, TABLE_NAMES } from "./schema.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function validateDbSchema(db: SQLiteDatabase): void {
  for (const tableName of TABLE_NAMES) {
    assert(tableExists(db, tableName), `Missing table ${tableName}`);
  }

  for (const indexName of INDEX_NAMES) {
    assert(indexExists(db, indexName), `Missing index ${indexName}`);
  }
}

function validateRequiredRowCounts(db: SQLiteDatabase): void {
  for (const tableName of ["stops", "routes", "trips", "stop_times"]) {
    assert(countRows(db, tableName) > 0, `Expected ${tableName} to contain rows`);
  }
}

function validateBusStopTagging(db: SQLiteDatabase): void {
  const busRouteCount = countRows(db, "routes");
  if (busRouteCount === 0) {
    return;
  }

  const busRoutes = db
    .prepare("SELECT COUNT(*) AS count FROM routes WHERE route_type = 3")
    .get() as { count: number };

  if (busRoutes.count === 0) {
    return;
  }

  const taggedStops = db
    .prepare("SELECT COUNT(*) AS count FROM stops WHERE route_type = 3")
    .get() as { count: number };

  assert(taggedStops.count > 0, "Expected at least one bus stop with route_type = 3");
}

export async function validateVictoriaBus(dataset: VictoriaBusDatasetConfig): Promise<void> {
  await access(dataset.output.sqlitePath);
  await access(dataset.output.manifestPath);

  const db = openDatabase(dataset.output.sqlitePath);

  try {
    validateDbSchema(db);
    validateRequiredRowCounts(db);
    validateBusStopTagging(db);

    const rowCounts = getVictoriaBusRowCounts(db);
    const manifest = JSON.parse(await readFile(dataset.output.manifestPath, "utf8")) as {
      sqliteFile: string;
      sha256: string;
      rowCounts: Record<string, number>;
    };

    assert(
      manifest.sqliteFile === basename(dataset.output.sqlitePath),
      `Manifest sqliteFile mismatch: expected ${basename(dataset.output.sqlitePath)}, received ${manifest.sqliteFile}`,
    );

    for (const [tableName, count] of Object.entries(rowCounts)) {
      assert(
        manifest.rowCounts[tableName] === count,
        `Manifest rowCounts mismatch for ${tableName}: expected ${count}, received ${manifest.rowCounts[tableName]}`,
      );
    }

    const sha256 = await sha256File(dataset.output.sqlitePath);
    assert(manifest.sha256 === sha256, "Manifest sha256 does not match database hash");

    logSummary("Validation summary", [
      `database: ${dataset.output.sqlitePath}`,
      `manifest: ${dataset.output.manifestPath}`,
      ...Object.entries(rowCounts).map(([tableName, count]) => `${tableName}: ${count} rows`),
      `sha256: ${sha256}`,
      "status: ok",
    ]);
  } finally {
    db.close();
  }
}
