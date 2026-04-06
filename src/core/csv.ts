import { parse } from "csv-parse";

export async function *streamCsvRecords(
  input: NodeJS.ReadableStream,
): AsyncGenerator<Record<string, string>, void, void> {
  const parser = parse({
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  input.pipe(parser);

  for await (const record of parser) {
    yield record as Record<string, string>;
  }
}

export function emptyToNull(value: string | undefined): string | null {
  if (value === undefined || value === "") {
    return null;
  }

  return value;
}
