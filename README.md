# FetchTransport

Offline Node.js + TypeScript builder for transport SQLite artifacts that can be bundled into an iOS app. The supported datasets are Victorian bus static GTFS from Transport Victoria and Queensland SEQ bus static GTFS from TransLink.

## Requirements

- Node.js 22 or newer
- npm

## Install

```bash
npm install
```

## Commands

Build the Victorian bus SQLite database and manifest:

```bash
npm run build:victoria-bus
```

Validate the generated Victorian database and manifest:

```bash
npm run validate:victoria-bus
```

Clean temporary and output artifacts for the Victorian dataset:

```bash
npm run clean:victoria-bus
```

Build the Queensland bus SQLite database and manifest:

```bash
npm run build:queensland-bus
```

Validate the generated Queensland database and manifest:

```bash
npm run validate:queensland-bus
```

Clean temporary and output artifacts for the Queensland dataset:

```bash
npm run clean:queensland-bus
```

Run unit and integration tests:

```bash
npm test
```

## Output Artifacts

The builder writes:

- `dist/db/transport/victoria/gtfs_victorian_bus.sqlite3`
- `dist/db/transport/victoria/manifest.json`
- `dist/db/transport/queensland/gtfs_seq.sqlite3`
- `dist/db/transport/queensland/manifest.json`

To bundle the databases into the iOS app, copy the generated files into:

- `myLatest/db/transport/victoria/`
- `myLatest/db/transport/queensland/`

## Operator Checklist

1. Run `npm install` if dependencies are not already present.
2. Run `npm run build:victoria-bus` and/or `npm run build:queensland-bus`.
3. Run `npm run validate:victoria-bus` and/or `npm run validate:queensland-bus`.
4. Copy the generated SQLite database and `manifest.json` into the matching folder under the iOS repo.
5. Record the manifest `generatedAt` timestamp and `sha256` for release tracking.
