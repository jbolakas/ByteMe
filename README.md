# ByteMe

Offline-first field-observation capture.

```
[Mobile PWA]
  ├── Capture (GPS + camera + voice + form)
  ├── Local queue (IndexedDB via Dexie)
  └── Sync worker (background, retries with backoff)
        ↓ HTTPS (when online)
[Backend API — Fastify]
  ├── POST /observations          (batch upsert)
  ├── POST /annotate-photo        (Claude vision proxy)
  └── DataSink interface
        ├── MockSink   → local SQLite mirroring Snowflake schema
        └── SnowflakeSink → wired later, same interface
```

## Layout

- `apps/server` — Fastify API, `DataSink` interface, `MockSink` (better-sqlite3), `SnowflakeSink` stub.
- `apps/web` — Vite + React PWA, Dexie queue, sync worker with exponential backoff.

## Run

```bash
npm install                   # installs both workspaces
npm run dev:server            # http://localhost:3001
npm run dev:web               # http://localhost:5173 (proxies /api → :3001)
```

Set `ANTHROPIC_API_KEY` to enable real Claude vision in `/annotate-photo`; otherwise it returns a mock annotation so the offline flow still works.

## Switching the sink

`DATA_SINK=mock` (default) writes to `data/mock.sqlite`. `DATA_SINK=snowflake` selects `SnowflakeSink` (stub — fill in `snowflake-sdk` MERGE on `client_id`). The route layer is sink-agnostic.

## Sync semantics

- Each capture gets a client-generated UUID (`client_id`) and is queued in IndexedDB.
- The worker drains in batches of 25, retries on failure with exponential backoff + jitter (cap 5 min, 10 attempts).
- The server upserts on `client_id`, so retries are idempotent.
- The worker flushes on `online`, `visibilitychange → visible`, and a 5 s poll.
