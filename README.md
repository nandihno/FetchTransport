# FetchTransport

Offline Node.js + TypeScript builder for transport SQLite artifacts that can be bundled into an iOS app. The first supported dataset is Victorian bus static GTFS from Transport Victoria.

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

Validate the generated database and manifest:

```bash
npm run validate:victoria-bus
```

Clean temporary and output artifacts for this dataset:

```bash
npm run clean:victoria-bus
```

Run unit and integration tests:

```bash
npm test
```

## Output Artifacts

The builder writes:

- `dist/db/transport/victoria/gtfs_victorian_bus.sqlite3`
- `dist/db/transport/victoria/manifest.json`

To bundle the database into the iOS app, copy both files into:

- `db/transport/victoria/`

## Two-Week Operator Checklist

1. Run `npm install` if dependencies are not already present.
2. Run `npm run build:victoria-bus`.
3. Run `npm run validate:victoria-bus`.
4. Copy `dist/db/transport/victoria/gtfs_victorian_bus.sqlite3` and `dist/db/transport/victoria/manifest.json` into the iOS repo under `db/transport/victoria/`.
5. Record the manifest `generatedAt` timestamp and `sha256` for release tracking.
