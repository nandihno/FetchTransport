import { resolve } from "node:path";
import type { DatasetDefinition } from "../../core/dataset.js";
import { DIST_DIR, TMP_DIR } from "../../utils/paths.js";
import { buildQueenslandBus } from "./build.js";
import { validateQueenslandBus } from "./validate.js";

export type QueenslandBusDatasetConfig = DatasetDefinition & {
  notes: string[];
  tempDirectory: string;
};

export type QueenslandBusDatasetOverrides = Partial<
  Omit<QueenslandBusDatasetConfig, "build" | "validate">
> & {
  output?: Partial<QueenslandBusDatasetConfig["output"]>;
};

export function createQueenslandBusDataset(
  overrides: QueenslandBusDatasetOverrides = {},
): QueenslandBusDatasetConfig {
  const outputDirectory = resolve(DIST_DIR, "db/transport/queensland");
  const sqlitePath = overrides.output?.sqlitePath ?? resolve(outputDirectory, "gtfs_seq.sqlite3");
  const manifestPath = overrides.output?.manifestPath ?? resolve(outputDirectory, "gtfs_queensland_bus_manifest.json");

  const dataset: QueenslandBusDatasetConfig = {
    id: overrides.id ?? "queensland-bus",
    sourceUrl: overrides.sourceUrl
      ?? "https://gtfsrt.api.translink.com.au/GTFS/SEQ_GTFS.zip",
    modeFolder: overrides.modeFolder ?? "SEQ",
    nestedArchivePath: overrides.nestedArchivePath ?? "",
    requiredFiles: overrides.requiredFiles ?? ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"],
    optionalFiles: overrides.optionalFiles ?? ["calendar.txt", "calendar_dates.txt"],
    output: {
      sqlitePath,
      manifestPath,
    },
    notes: overrides.notes ?? [
      "Built from the TransLink South East Queensland GTFS static ZIP.",
      "SQLite schema and index names are aligned with the existing iOS Queensland bus database contract.",
    ],
    tempDirectory: overrides.tempDirectory ?? resolve(TMP_DIR, "queensland-bus"),
    async build() {
      await buildQueenslandBus(dataset);
    },
    async validate() {
      await validateQueenslandBus(dataset);
    },
  };

  return dataset;
}

export const queenslandBusDataset = createQueenslandBusDataset();
