import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureDirectory } from "../src/core/fs.js";
import { createVictoriaBusDataset } from "../src/datasets/victoriaBus/config.js";
import { buildVictoriaBus } from "../src/datasets/victoriaBus/build.js";
import { validateVictoriaBus } from "../src/datasets/victoriaBus/validate.js";
import { INDEX_NAMES, TABLE_NAMES } from "../src/datasets/victoriaBus/schema.js";

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/victoria-bus");

async function createTestDataset(fixtureName: string) {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "fetchtransport-"));
  const outputRoot = resolve(tempRoot, "dist/db/transport/victoria");
  const tempDirectory = resolve(tempRoot, "tmp/victoria-bus");
  await ensureDirectory(outputRoot);

  return createVictoriaBusDataset({
    sourceUrl: pathToFileURL(resolve(fixtureRoot, fixtureName)).href,
    tempDirectory,
    output: {
      sqlitePath: resolve(outputRoot, "gtfs_victorian_bus.sqlite3"),
      manifestPath: resolve(outputRoot, "gtfs_victorian_bus_manifest.json"),
    },
  });
}

test("buildVictoriaBus creates schema-compatible artifacts from nested GTFS zip", async () => {
  const dataset = await createTestDataset("outer-gtfs.zip");

  await buildVictoriaBus(dataset);
  await validateVictoriaBus(dataset);

  await stat(dataset.output.sqlitePath);
  await stat(dataset.output.manifestPath);

  const db = new DatabaseSync(dataset.output.sqlitePath, { readOnly: true });
  try {
    for (const tableName of TABLE_NAMES) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(tableName) as { name?: string } | undefined;
      assert.equal(row?.name, tableName);
    }

    for (const indexName of INDEX_NAMES) {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
        .get(indexName) as { name?: string } | undefined;
      assert.equal(row?.name, indexName);
    }

    const stopTimes = db
      .prepare("SELECT arrival_seconds, departure_seconds FROM stop_times ORDER BY stop_sequence")
      .all() as Array<{ arrival_seconds: number; departure_seconds: number }>;
    assert.deepEqual({ ...stopTimes[0] }, { arrival_seconds: 86_400, departure_seconds: 86_700 });
    assert.deepEqual({ ...stopTimes[1] }, { arrival_seconds: 90_000, departure_seconds: 90_030 });

    const trips = db.prepare("SELECT direction_id FROM trips WHERE trip_id = ?").get("trip-1") as { direction_id: number };
    assert.equal(trips.direction_id, 0);

    const taggedStop = db.prepare("SELECT route_type FROM stops WHERE stop_id = ?").get("stop-1") as { route_type: number };
    assert.equal(taggedStop.route_type, 3);
  } finally {
    db.close();
  }

  const manifest = JSON.parse(await readFile(dataset.output.manifestPath, "utf8")) as {
    rowCounts: Record<string, number>;
    sqliteFile: string;
  };
  assert.equal(manifest.sqliteFile, "gtfs_victorian_bus.sqlite3");
  assert.equal(manifest.rowCounts.stop_times, 2);
});

test("buildVictoriaBus fails loudly when a required GTFS file is missing", async () => {
  const dataset = await createTestDataset("outer-gtfs-missing-stop-times.zip");

  await assert.rejects(
    () => buildVictoriaBus(dataset),
    /Missing required GTFS file stop_times\.txt/,
  );
});
