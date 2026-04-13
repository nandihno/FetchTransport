import { Command } from "commander";
import { rimraf } from "rimraf";
import { logStep } from "./core/logging.js";
import { queenslandBusDataset } from "./datasets/queenslandBus/config.js";
import { victoriaBusDataset } from "./datasets/victoriaBus/config.js";

const datasets = new Map([
  [victoriaBusDataset.id, victoriaBusDataset],
  [queenslandBusDataset.id, queenslandBusDataset],
]);

function getDataset(id: string) {
  const dataset = datasets.get(id);
  if (!dataset) {
    throw new Error(`Unknown dataset "${id}"`);
  }

  return dataset;
}

const program = new Command();
program.name("fetchtransport");

program
  .command("build")
  .argument("<dataset>")
  .action(async (datasetId: string) => {
    await getDataset(datasetId).build();
  });

program
  .command("validate")
  .argument("<dataset>")
  .action(async (datasetId: string) => {
    await getDataset(datasetId).validate();
  });

program
  .command("clean")
  .argument("<dataset>")
  .action(async (datasetId: string) => {
    const dataset = getDataset(datasetId);
    logStep(`Cleaning ${dataset.output.sqlitePath}`);
    await rimraf([dataset.output.sqlitePath, dataset.output.manifestPath, dataset["tempDirectory"]]);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
