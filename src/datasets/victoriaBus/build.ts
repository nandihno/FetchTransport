import { access } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { emptyToNull, streamCsvRecords } from "../../core/csv.js";
import type { Manifest } from "../../core/dataset.js";
import { downloadFile } from "../../core/download.js";
import { ensureDirectory, removeIfExists } from "../../core/fs.js";
import { sha256File } from "../../core/hash.js";
import { logStep, logSummary } from "../../core/logging.js";
import { writeManifest } from "../../core/manifest.js";
import { executeSql, openDatabase, type SQLiteDatabase } from "../../core/sqlite.js";
import { extractZipEntryToFile, listZipEntryNames, openZipEntryStream } from "../../core/zip.js";
import { parseGtfsTimeToSeconds } from "../../utils/gtfsTime.js";
import type { VictoriaBusDatasetConfig } from "./config.js";
import { getVictoriaBusRowCounts } from "./rowCounts.js";
import { CREATE_SCHEMA_SQL, TAG_BUS_STOPS_SQL } from "./schema.js";

type BatchInserter<T> = {
  push(record: T): void;
  flush(): void;
};

function requiredValue(record: Record<string, string>, key: string): string {
  const value = record[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required value for ${key}`);
  }

  return value.trim();
}

function optionalValue(record: Record<string, string>, key: string): string | null {
  return emptyToNull(record[key]?.trim());
}

function parseRequiredInteger(record: Record<string, string>, key: string): number {
  const value = requiredValue(record, key);
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${key}: ${value}`);
  }

  return parsed;
}

function parseOptionalInteger(record: Record<string, string>, key: string, fallback?: number): number | null {
  const value = record[key]?.trim();
  if (!value) {
    return fallback ?? null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for ${key}: ${value}`);
  }

  return parsed;
}

function parseRequiredFloat(record: Record<string, string>, key: string): number {
  const value = requiredValue(record, key);
  const parsed = Number.parseFloat(value);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for ${key}: ${value}`);
  }

  return parsed;
}

function createBatchInserter<T>(
  db: SQLiteDatabase,
  insert: (record: T) => void,
  batchSize = 1_000,
): BatchInserter<T> {
  const batch: T[] = [];
  const flushTransaction = (records: T[]) => {
    if (records.length === 0) {
      return;
    }

    db.exec("BEGIN");
    try {
      for (const record of records) {
        insert(record);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  return {
    push(record) {
      batch.push(record);
      if (batch.length >= batchSize) {
        flushTransaction(batch.splice(0, batch.length));
      }
    },
    flush() {
      if (batch.length > 0) {
        flushTransaction(batch.splice(0, batch.length));
      }
    },
  };
}

async function importStops(db: SQLiteDatabase, nestedZipPath: string): Promise<number> {
  const stream = await openZipEntryStream(nestedZipPath, "stops.txt");
  const statement = db.prepare(`
    INSERT INTO stops (
      stop_id,
      stop_name,
      stop_code,
      stop_lat,
      stop_lon,
      location_type,
      parent_station
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const inserter = createBatchInserter(db, (record: unknown[]) => {
    statement.run(...record);
  });

  let rowCount = 0;
  for await (const record of streamCsvRecords(stream)) {
    inserter.push([
      requiredValue(record, "stop_id"),
      requiredValue(record, "stop_name"),
      optionalValue(record, "stop_code"),
      parseRequiredFloat(record, "stop_lat"),
      parseRequiredFloat(record, "stop_lon"),
      parseOptionalInteger(record, "location_type", 0),
      optionalValue(record, "parent_station"),
    ]);
    rowCount += 1;
  }

  inserter.flush();
  return rowCount;
}

async function importRoutes(db: SQLiteDatabase, nestedZipPath: string): Promise<number> {
  const stream = await openZipEntryStream(nestedZipPath, "routes.txt");
  const statement = db.prepare(`
    INSERT INTO routes (
      route_id,
      route_short_name,
      route_long_name,
      route_type
    ) VALUES (?, ?, ?, ?)
  `);
  const inserter = createBatchInserter(db, (record: unknown[]) => {
    statement.run(...record);
  });

  let rowCount = 0;
  for await (const record of streamCsvRecords(stream)) {
    inserter.push([
      requiredValue(record, "route_id"),
      optionalValue(record, "route_short_name"),
      optionalValue(record, "route_long_name"),
      parseRequiredInteger(record, "route_type"),
    ]);
    rowCount += 1;
  }

  inserter.flush();
  return rowCount;
}

async function importTrips(db: SQLiteDatabase, nestedZipPath: string): Promise<number> {
  const stream = await openZipEntryStream(nestedZipPath, "trips.txt");
  const statement = db.prepare(`
    INSERT INTO trips (
      trip_id,
      route_id,
      service_id,
      trip_headsign,
      direction_id
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const inserter = createBatchInserter(db, (record: unknown[]) => {
    statement.run(...record);
  });

  let rowCount = 0;
  for await (const record of streamCsvRecords(stream)) {
    inserter.push([
      requiredValue(record, "trip_id"),
      requiredValue(record, "route_id"),
      requiredValue(record, "service_id"),
      optionalValue(record, "trip_headsign"),
      parseOptionalInteger(record, "direction_id", 0),
    ]);
    rowCount += 1;
  }

  inserter.flush();
  return rowCount;
}

async function importStopTimes(db: SQLiteDatabase, nestedZipPath: string): Promise<number> {
  const stream = await openZipEntryStream(nestedZipPath, "stop_times.txt");
  const statement = db.prepare(`
    INSERT INTO stop_times (
      trip_id,
      stop_id,
      arrival_time,
      departure_time,
      stop_sequence,
      arrival_seconds,
      departure_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const inserter = createBatchInserter(db, (record: unknown[]) => {
    statement.run(...record);
  }, 5_000);

  let rowCount = 0;
  for await (const record of streamCsvRecords(stream)) {
    const arrivalTime = optionalValue(record, "arrival_time");
    const departureTime = optionalValue(record, "departure_time");

    inserter.push([
      requiredValue(record, "trip_id"),
      requiredValue(record, "stop_id"),
      arrivalTime,
      departureTime,
      parseRequiredInteger(record, "stop_sequence"),
      parseGtfsTimeToSeconds(arrivalTime),
      parseGtfsTimeToSeconds(departureTime),
    ]);
    rowCount += 1;
  }

  inserter.flush();
  return rowCount;
}

async function importCalendar(db: SQLiteDatabase, nestedZipPath: string, entryName: string): Promise<number> {
  const stream = await openZipEntryStream(nestedZipPath, entryName);
  const statement = db.prepare(`
    INSERT INTO calendar (
      service_id,
      monday,
      tuesday,
      wednesday,
      thursday,
      friday,
      saturday,
      sunday,
      start_date,
      end_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const inserter = createBatchInserter(db, (record: unknown[]) => {
    statement.run(...record);
  });

  let rowCount = 0;
  for await (const record of streamCsvRecords(stream)) {
    inserter.push([
      requiredValue(record, "service_id"),
      parseRequiredInteger(record, "monday"),
      parseRequiredInteger(record, "tuesday"),
      parseRequiredInteger(record, "wednesday"),
      parseRequiredInteger(record, "thursday"),
      parseRequiredInteger(record, "friday"),
      parseRequiredInteger(record, "saturday"),
      parseRequiredInteger(record, "sunday"),
      requiredValue(record, "start_date"),
      requiredValue(record, "end_date"),
    ]);
    rowCount += 1;
  }

  inserter.flush();
  return rowCount;
}

async function importCalendarDates(db: SQLiteDatabase, nestedZipPath: string, entryName: string): Promise<number> {
  const stream = await openZipEntryStream(nestedZipPath, entryName);
  const statement = db.prepare(`
    INSERT INTO calendar_dates (
      service_id,
      date,
      exception_type
    ) VALUES (?, ?, ?)
  `);
  const inserter = createBatchInserter(db, (record: unknown[]) => {
    statement.run(...record);
  });

  let rowCount = 0;
  for await (const record of streamCsvRecords(stream)) {
    inserter.push([
      requiredValue(record, "service_id"),
      requiredValue(record, "date"),
      parseRequiredInteger(record, "exception_type"),
    ]);
    rowCount += 1;
  }

  inserter.flush();
  return rowCount;
}

async function importOptional(
  availableEntries: Set<string>,
  entryName: string,
  importer: () => Promise<number>,
): Promise<number> {
  if (!availableEntries.has(entryName)) {
    return 0;
  }

  return importer();
}

export async function buildVictoriaBus(dataset: VictoriaBusDatasetConfig): Promise<void> {
  const outputDirectory = dirname(dataset.output.sqlitePath);
  const manifestDirectory = dirname(dataset.output.manifestPath);
  const outerZipPath = resolve(dataset.tempDirectory, "gtfs.zip");
  const nestedZipPath = resolve(dataset.tempDirectory, basename(dataset.nestedArchivePath));
  const legacyManifestPath = resolve(manifestDirectory, "manifest.json");

  await removeIfExists(dataset.tempDirectory);
  await ensureDirectory(dataset.tempDirectory);
  await ensureDirectory(outputDirectory);
  await ensureDirectory(manifestDirectory);
  await removeIfExists(dataset.output.sqlitePath);
  await removeIfExists(dataset.output.manifestPath);
  if (legacyManifestPath !== dataset.output.manifestPath) {
    await removeIfExists(legacyManifestPath);
  }

  logStep(`Downloading outer archive from ${dataset.sourceUrl}`);
  await downloadFile(dataset.sourceUrl, outerZipPath);

  logStep(`Extracting nested archive ${dataset.nestedArchivePath}`);
  await extractZipEntryToFile(outerZipPath, dataset.nestedArchivePath, nestedZipPath);

  const entryNames = new Set(await listZipEntryNames(nestedZipPath));
  for (const requiredFile of dataset.requiredFiles) {
    if (!entryNames.has(requiredFile)) {
      throw new Error(`Missing required GTFS file ${requiredFile} in ${nestedZipPath}`);
    }
  }

  logStep(`Building SQLite database at ${dataset.output.sqlitePath}`);
  const db = openDatabase(dataset.output.sqlitePath);
  let closed = false;
  try {
    executeSql(db, CREATE_SCHEMA_SQL);

    const importedCounts: Record<string, number> = {
      stops: await importStops(db, nestedZipPath),
      routes: await importRoutes(db, nestedZipPath),
      trips: await importTrips(db, nestedZipPath),
      stop_times: await importStopTimes(db, nestedZipPath),
      calendar: await importOptional(entryNames, "calendar.txt", () => importCalendar(db, nestedZipPath, "calendar.txt")),
      calendar_dates: await importOptional(
        entryNames,
        "calendar_dates.txt",
        () => importCalendarDates(db, nestedZipPath, "calendar_dates.txt"),
      ),
    };

    executeSql(db, TAG_BUS_STOPS_SQL);
    const rowCounts = getVictoriaBusRowCounts(db);

    const manifest: Manifest = {
      dataset: dataset.id,
      sourceUrl: dataset.sourceUrl,
      modeFolder: dataset.modeFolder,
      generatedAt: new Date().toISOString(),
      sqliteFile: basename(dataset.output.sqlitePath),
      sha256: "",
      rowCounts,
      notes: dataset.notes,
    };

    db.close();
    closed = true;

    logStep(`Hashing SQLite database at ${dataset.output.sqlitePath}`);
    const sha256 = await sha256File(dataset.output.sqlitePath);
    manifest.sha256 = sha256;

    logStep(`Writing manifest to ${dataset.output.manifestPath}`);
    await writeManifest(dataset.output.manifestPath, manifest);
    await access(dataset.output.manifestPath);

    logSummary("Build summary", [
      `dataset: ${dataset.id}`,
      `sqlite: ${dataset.output.sqlitePath}`,
      `manifest: ${dataset.output.manifestPath}`,
      ...Object.entries(rowCounts).map(([tableName, count]) => `${tableName}: ${count} rows`),
      `sha256: ${sha256}`,
    ]);
  } catch (error) {
    if (!closed) {
      db.close();
    }
    throw error;
  }
}
