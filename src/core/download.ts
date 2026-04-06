import { createReadStream, createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

export async function downloadFile(sourceUrl: string, destinationPath: string): Promise<void> {
  const url = new URL(sourceUrl);

  if (url.protocol === "file:") {
    const localPath = fileURLToPath(url);
    await stat(localPath);
    await pipeline(createReadStream(localPath), createWriteStream(destinationPath));
    return;
  }

  const response = await fetch(sourceUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${sourceUrl}: ${response.status} ${response.statusText}`);
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(destinationPath));
}
