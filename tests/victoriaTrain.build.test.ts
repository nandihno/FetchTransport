import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureDirectory } from "../src/core/fs.js";
import { createVictoriaTrainDataset } from "../src/datasets/victoriaTrain/config.js";
import { buildVictoriaTrain } from "../src/datasets/victoriaTrain/build.js";
import { validateVictoriaTrain } from "../src/datasets/victoriaTrain/validate.js";
import { INDEX_NAMES, TABLE_NAMES } from "../src/datasets/victoriaTrain/schema.js";

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/victoria-train");

async function createTestDataset(fixtureName: string) {
  const tempRoot = await mkdtemp(resolve(tmpdir(), "fetchtransport-"));
  const outputRoot = resolve(tempRoot, "dist/db/transport/victoria");
  const tempDirectory = resolve(tempRoot, "tmp/victoria-train");
  await ensureDirectory(outputRoot);

  return createVictoriaTrainDataset({
    sourceUrl: pathToFileURL(resolve(fixtureRoot, fixtureName)).href,
    tempDirectory,
    output: {
      sqlitePath: resolve(outputRoot, "gtfs_victorian_train.sqlite3"),
      manifestPath: resolve(outputRoot, "train-manifest.json"),
    },
  });
}

test("buildVictoriaTrain combines metro and regional train feeds without id collisions", async () => {
  const dataset = await createTestDataset("outer-gtfs-train.zip");

  await buildVictoriaTrain(dataset);
  await validateVictoriaTrain(dataset);

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

    const stopCount = db.prepare("SELECT COUNT(*) AS count FROM stops").get() as { count: number };
    assert.equal(stopCount.count, 3);

    const routeIds = db.prepare("SELECT route_id, route_type FROM routes ORDER BY route_id").all() as Array<{
      route_id: string;
      route_type: number;
    }>;
    assert.deepEqual(routeIds.map((row) => ({ ...row })), [
      { route_id: "1:route-1", route_type: 2 },
      { route_id: "2:route-1", route_type: 400 },
    ]);

    const tripRows = db.prepare("SELECT trip_id, route_id, service_id, direction_id FROM trips ORDER BY trip_id").all() as Array<{
      trip_id: string;
      route_id: string;
      service_id: string;
      direction_id: number;
    }>;
    assert.deepEqual(tripRows.map((row) => ({ ...row })), [
      { trip_id: "1:trip-1", route_id: "1:route-1", service_id: "1:WK", direction_id: 0 },
      { trip_id: "2:trip-1", route_id: "2:route-1", service_id: "2:WK", direction_id: 1 },
    ]);

    const stopTimes = db
      .prepare("SELECT trip_id, arrival_seconds, departure_seconds FROM stop_times ORDER BY trip_id, stop_sequence")
      .all() as Array<{ trip_id: string; arrival_seconds: number; departure_seconds: number }>;
    assert.deepEqual(stopTimes.map((row) => ({ ...row })), [
      { trip_id: "1:trip-1", arrival_seconds: 86_400, departure_seconds: 86_700 },
      { trip_id: "1:trip-1", arrival_seconds: 90_000, departure_seconds: 90_030 },
      { trip_id: "2:trip-1", arrival_seconds: 93_600, departure_seconds: 93_900 },
      { trip_id: "2:trip-1", arrival_seconds: 97_200, departure_seconds: 97_230 },
    ]);

    const sharedStop = db.prepare("SELECT route_type FROM stops WHERE stop_id = ?").get("station-shared") as {
      route_type: number;
    };
    assert.equal(sharedStop.route_type, 2);

    const calendarRows = db.prepare("SELECT service_id, start_date, end_date FROM calendar ORDER BY service_id").all() as Array<{
      service_id: string;
      start_date: string;
      end_date: string;
    }>;
    assert.deepEqual(calendarRows.map((row) => ({ ...row })), [
      { service_id: "1:WK", start_date: "20260101", end_date: "20260131" },
      { service_id: "2:WK", start_date: "20260115", end_date: "20260215" },
    ]);
  } finally {
    db.close();
  }

  const manifest = JSON.parse(await readFile(dataset.output.manifestPath, "utf8")) as {
    rowCounts: Record<string, number>;
    sqliteFile: string;
  };
  assert.equal(manifest.sqliteFile, "gtfs_victorian_train.sqlite3");
  assert.deepEqual(manifest.rowCounts, {
    stops: 3,
    routes: 2,
    trips: 2,
    stop_times: 4,
    calendar: 2,
    calendar_dates: 2,
  });
});

test("buildVictoriaTrain fails loudly when a required GTFS file is missing", async () => {
  const dataset = await createTestDataset("outer-gtfs-train-missing-stop-times.zip");

  await assert.rejects(
    () => buildVictoriaTrain(dataset),
    /Missing required GTFS file stop_times\.txt/,
  );
});
