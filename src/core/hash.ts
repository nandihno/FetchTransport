import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  const input = createReadStream(path);

  for await (const chunk of input) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}
