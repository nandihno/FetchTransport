import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import yauzl, { Entry, ZipFile } from "yauzl";

type ZipEntries = Map<string, Entry>;

function openZip(zipPath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: false }, (error, zipFile) => {
      if (error) {
        reject(error);
        return;
      }

      if (!zipFile) {
        reject(new Error(`Unable to open zip archive at ${zipPath}`));
        return;
      }

      resolve(zipFile);
    });
  });
}

async function collectEntries(zipPath: string): Promise<ZipEntries> {
  const zipFile = await openZip(zipPath);

  return new Promise((resolve, reject) => {
    const entries: ZipEntries = new Map();

    zipFile.on("entry", (entry) => {
      entries.set(entry.fileName, entry);
      zipFile.readEntry();
    });

    zipFile.once("end", () => {
      zipFile.close();
      resolve(entries);
    });

    zipFile.once("error", (error) => {
      zipFile.close();
      reject(error);
    });

    zipFile.readEntry();
  });
}

export async function listZipEntryNames(zipPath: string): Promise<string[]> {
  const entries = await collectEntries(zipPath);
  return [...entries.keys()];
}

export async function extractZipEntryToFile(
  zipPath: string,
  entryName: string,
  destinationPath: string,
): Promise<void> {
  const zipFile = await openZip(zipPath);

  return new Promise((resolve, reject) => {
    let handled = false;

    const finalizeError = (error: Error) => {
      zipFile.close();
      reject(error);
    };

    zipFile.on("entry", (entry) => {
      if (entry.fileName !== entryName) {
        zipFile.readEntry();
        return;
      }

      handled = true;
      zipFile.openReadStream(entry, async (error, stream) => {
        if (error || !stream) {
          finalizeError(error ?? new Error(`Unable to stream ${entryName} from ${zipPath}`));
          return;
        }

        try {
          await pipeline(stream, createWriteStream(destinationPath));
          zipFile.close();
          resolve();
        } catch (pipelineError) {
          finalizeError(pipelineError as Error);
        }
      });
    });

    zipFile.once("end", () => {
      if (!handled) {
        finalizeError(new Error(`Missing archive entry ${entryName} in ${zipPath}`));
      }
    });

    zipFile.once("error", finalizeError);
    zipFile.readEntry();
  });
}

export async function openZipEntryStream(zipPath: string, entryName: string): Promise<NodeJS.ReadableStream> {
  const zipFile = await openZip(zipPath);

  return new Promise((resolve, reject) => {
    let resolved = false;

    const closeZip = () => {
      zipFile.close();
    };

    const rejectWith = (error: Error) => {
      closeZip();
      reject(error);
    };

    zipFile.on("entry", (entry) => {
      if (resolved) {
        return;
      }

      if (entry.fileName !== entryName) {
        zipFile.readEntry();
        return;
      }

      resolved = true;
      zipFile.openReadStream(entry, (error, stream) => {
        if (error || !stream) {
          rejectWith(error ?? new Error(`Unable to stream ${entryName} from ${zipPath}`));
          return;
        }

        stream.once("end", closeZip);
        stream.once("close", closeZip);
        stream.once("error", closeZip);
        resolve(stream);
      });
    });

    zipFile.once("end", () => {
      if (!resolved) {
        rejectWith(new Error(`Missing archive entry ${entryName} in ${zipPath}`));
      }
    });

    zipFile.once("error", rejectWith);
    zipFile.readEntry();
  });
}
