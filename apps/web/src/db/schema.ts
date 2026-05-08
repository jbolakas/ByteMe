import Dexie, { type Table } from "dexie";

export const SCHEMA_VERSION = 1;

export type SyncStatus = "pending" | "syncing" | "synced" | "error";

export interface QueuedObservation {
  client_id: string;
  user_id: string;
  captured_at: string;
  lat: number | null;
  lon: number | null;
  accuracy_m: number | null;
  notes: string | null;
  voice_transcript: string | null;
  photo_b64: string | null;
  photo_annotation: string | null;
  schema_version: number;
  status: SyncStatus;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
  server_id: string | null;
  created_at: number;
}

class ByteMeDB extends Dexie {
  observations!: Table<QueuedObservation, string>;
  constructor() {
    super("byteme");
    this.version(1).stores({
      // primary key + indices used by the sync worker / UI
      observations: "client_id, status, next_attempt_at, created_at",
    });
  }
}

export const db = new ByteMeDB();
