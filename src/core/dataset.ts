export type Manifest = {
  dataset: string;
  sourceUrl: string;
  modeFolder: string;
  generatedAt: string;
  sqliteFile: string;
  sha256: string;
  rowCounts: Record<string, number>;
  notes: string[] | string;
};

export type DatasetOutput = {
  sqlitePath: string;
  manifestPath: string;
};

export type DatasetDefinition = {
  id: string;
  sourceUrl: string;
  modeFolder: string;
  nestedArchivePath: string;
  requiredFiles: string[];
  optionalFiles: string[];
  output: DatasetOutput;
  build(): Promise<void>;
  validate(): Promise<void>;
};
