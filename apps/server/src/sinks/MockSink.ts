import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DataSink, Observation, UpsertResult } from "./DataSink.js";

// SQLite schema mirroring the target Snowflake table. Columns and types are
// chosen so a SnowflakeSink can map 1:1 (TEXT→VARCHAR, REAL→FLOAT, INTEGER→NUMBER).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS observations (
  server_id        TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL UNIQUE,
  user_id          TEXT NOT NULL,
  captured_at      TEXT NOT NULL,
  lat              REAL,
  lon              REAL,
  accuracy_m       REAL,
  notes            TEXT,
  voice_transcript TEXT,
  photo_b64        TEXT,
  photo_annotation TEXT,
  schema_version   INTEGER NOT NULL,
  ingested_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS observations_user_idx ON observations(user_id, captured_at);
`;

export class MockSink implements DataSink {
  private db!: Database.Database;
  constructor(private readonly path: string) {}

  async init(): Promise<void> {
    mkdirSync(dirname(this.path), { recursive: true });
    this.db = new Database(this.path);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  async upsertObservations(rows: Observation[]): Promise<UpsertResult[]> {
    const select = this.db.prepare<[string]>(
      "SELECT server_id FROM observations WHERE client_id = ?"
    );
    const insert = this.db.prepare(`
      INSERT INTO observations (
        server_id, client_id, user_id, captured_at, lat, lon, accuracy_m,
        notes, voice_transcript, photo_b64, photo_annotation, schema_version
      ) VALUES (
        @server_id, @client_id, @user_id, @captured_at, @lat, @lon, @accuracy_m,
        @notes, @voice_transcript, @photo_b64, @photo_annotation, @schema_version
      )
    `);
    const update = this.db.prepare(`
      UPDATE observations SET
        user_id = @user_id,
        captured_at = @captured_at,
        lat = @lat,
        lon = @lon,
        accuracy_m = @accuracy_m,
        notes = @notes,
        voice_transcript = @voice_transcript,
        photo_b64 = @photo_b64,
        photo_annotation = @photo_annotation,
        schema_version = @schema_version
      WHERE client_id = @client_id
    `);

    const tx = this.db.transaction((batch: Observation[]): UpsertResult[] => {
      const out: UpsertResult[] = [];
      for (const row of batch) {
        const existing = select.get(row.client_id) as { server_id: string } | undefined;
        if (existing) {
          update.run(row);
          out.push({ client_id: row.client_id, server_id: existing.server_id, status: "updated" });
        } else {
          const server_id = randomUUID();
          insert.run({ ...row, server_id });
          out.push({ client_id: row.client_id, server_id, status: "inserted" });
        }
      }
      return out;
    });

    return tx(rows);
  }

  async close(): Promise<void> {
    this.db?.close();
  }
}
