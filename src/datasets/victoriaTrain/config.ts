import { resolve } from "node:path";
import type { DatasetDefinition } from "../../core/dataset.js";
import { DIST_DIR, TMP_DIR } from "../../utils/paths.js";
import { buildVictoriaTrain } from "./build.js";
import { validateVictoriaTrain } from "./validate.js";

export type VictoriaTrainFeed = {
  modeFolder: string;
  nestedArchivePath: string;
};

export type VictoriaTrainDatasetConfig = DatasetDefinition & {
  feeds: VictoriaTrainFeed[];
  notes: string[];
  tempDirectory: string;
  stopRouteType: number;
  trainRouteTypes: number[];
};

export type VictoriaTrainDatasetOverrides = Partial<
  Omit<VictoriaTrainDatasetConfig, "build" | "validate" | "modeFolder" | "nestedArchivePath">
> & {
  output?: Partial<VictoriaTrainDatasetConfig["output"]>;
};

export function createVictoriaTrainDataset(
  overrides: VictoriaTrainDatasetOverrides = {},
): VictoriaTrainDatasetConfig {
  const outputDirectory = resolve(DIST_DIR, "db/transport/victoria");
  const sqlitePath = overrides.output?.sqlitePath ?? resolve(outputDirectory, "gtfs_victorian_train.sqlite3");
  const manifestPath = overrides.output?.manifestPath ?? resolve(outputDirectory, "train-manifest.json");

  const feeds = overrides.feeds ?? [
    { modeFolder: "1", nestedArchivePath: "1/google_transit.zip" },
    { modeFolder: "2", nestedArchivePath: "2/google_transit.zip" },
  ];

  const dataset: VictoriaTrainDatasetConfig = {
    id: overrides.id ?? "victoria-train",
    sourceUrl: overrides.sourceUrl
      ?? "https://opendata.transport.vic.gov.au/dataset/3f4e292e-7f8a-4ffe-831f-1953be0fe448/resource/fb152201-859f-4882-9206-b768060b50ad/download/gtfs.zip",
    modeFolder: feeds.map((feed) => feed.modeFolder).join(","),
    nestedArchivePath: feeds.map((feed) => feed.nestedArchivePath).join(","),
    feeds,
    requiredFiles: overrides.requiredFiles ?? ["stops.txt", "routes.txt", "trips.txt", "stop_times.txt"],
    optionalFiles: overrides.optionalFiles ?? ["calendar.txt", "calendar_dates.txt"],
    output: {
      sqlitePath,
      manifestPath,
    },
    notes: overrides.notes ?? [
      "Built from the Transport Victoria GTFS outer archive using mode folders 1 and 2.",
      "Combines regional and metropolitan rail feeds into one SQLite artifact.",
      "route_id, trip_id, and service_id values are namespaced by mode folder to avoid cross-feed identifier collisions.",
    ],
    tempDirectory: overrides.tempDirectory ?? resolve(TMP_DIR, "victoria-train"),
    stopRouteType: overrides.stopRouteType ?? 2,
    trainRouteTypes: overrides.trainRouteTypes ?? [2, 400],
    async build() {
      await buildVictoriaTrain(dataset);
    },
    async validate() {
      await validateVictoriaTrain(dataset);
    },
  };

  return dataset;
}

export const victoriaTrainDataset = createVictoriaTrainDataset();
