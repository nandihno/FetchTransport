import { writeFile } from "node:fs/promises";
import type { Manifest } from "./dataset.js";

export async function writeManifest(path: string, manifest: Manifest): Promise<void> {
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
