import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = resolve(currentDirectory, "../..");
export const DIST_DIR = resolve(ROOT_DIR, "dist");
export const TMP_DIR = resolve(ROOT_DIR, "tmp");
