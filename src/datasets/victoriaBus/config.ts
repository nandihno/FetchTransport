import { resolve } from "node:path";
import type { DatasetDefinition } from "../../core/dataset.js";
import { DIST_DIR, TMP_DIR } from "../../utils/paths.js";
import { buildVictoriaBus } from "./build.js";
import { validateVictoriaBus } from "./validate.js";

export type VictoriaBusDatasetConfig = DatasetDefinition & {
  notes: string[];
  tempDirectory: string;
};

export type VictoriaBusDatasetOverrides = Partial<
  Omit<VictoriaBusDatasetConfig, "build" | "validate">
> & {
  output?: Partial<VictoriaBusDatasetConfig["output"]>;
};

export function createVictoriaBusDataset(
  overrides: VictoriaBusDatasetOverrides = {},
): VictoriaBusDatasetConfig {
  const outputDirectory = resolve(DIST_DIR, "db/transport/victoria");
  const sqlitePath = overrides.output?.sqlitePath ?? resolve(outputDirectory, "gtfs_victorian_bus.sqlite3");
  const manifestPath = overrides.output?.manifestPath ?? resolve(outputDirectory, "manifest.json");

  const dataset: VictoriaBusDatasetConfig = {
    id: overrides.id ?? "victoria-bus",
    sourceUrl: overrides.sourceUrl
      ?? "https://opendata.transport.vic.gov.au/dataset/3f4e292e-7f8a-4ffe-831f-1953be0fe448/resource/fb152201-859f-4882-9206-b768060b50ad/download/gtfs.zip",
    modeFolder: overrides.modeFolder ?? "4",
    nestedArchivePath: overrides.nestedArchivePath ?? "4/google_transit.zip",
    requiredFiles: overrides.requiredFiles ?? ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"],
    optionalFiles: overrides.optionalFiles ?? ["calendar.txt", "calendar_dates.txt"],
    output: {
      sqlitePath,
      manifestPath,
    },
    notes: overrides.notes ?? [
      "Built from the Transport Victoria GTFS outer archive using mode folder 4.",
      "SQLite schema and index names are aligned with the existing iOS Victorian bus database contract.",
    ],
    tempDirectory: overrides.tempDirectory ?? resolve(TMP_DIR, "victoria-bus"),
    async build() {
      await buildVictoriaBus(dataset);
    },
    async validate() {
      await validateVictoriaBus(dataset);
    },
  };

  return dataset;
}

export const victoriaBusDataset = createVictoriaBusDataset();
