import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { emptyToNull, streamCsvRecords } from "../src/core/csv.js";
import { parseGtfsTimeToSeconds } from "../src/utils/gtfsTime.js";

test("parseGtfsTimeToSeconds parses standard and 24+ hour GTFS times", () => {
  assert.equal(parseGtfsTimeToSeconds("00:00:00"), 0);
  assert.equal(parseGtfsTimeToSeconds("23:59:59"), 86_399);
  assert.equal(parseGtfsTimeToSeconds("24:00:00"), 86_400);
  assert.equal(parseGtfsTimeToSeconds("25:15:30"), 90_930);
});

test("parseGtfsTimeToSeconds rejects invalid values", () => {
  assert.throws(() => parseGtfsTimeToSeconds("25:61:00"), /Invalid GTFS time/);
  assert.throws(() => parseGtfsTimeToSeconds("bad"), /Invalid GTFS time/);
});

test("streamCsvRecords handles BOM, quoted fields, and empty normalization", async () => {
  const input = Readable.from(["\ufeffstop_id,stop_name,stop_code\n1,\"Main, Stop\",\n"]);
  const records: Record<string, string>[] = [];

  for await (const record of streamCsvRecords(input)) {
    records.push(record);
  }

  assert.equal(records.length, 1);
  assert.equal(records[0].stop_name, "Main, Stop");
  assert.equal(emptyToNull(records[0].stop_code), null);
});
