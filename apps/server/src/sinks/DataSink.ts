export interface Observation {
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
}

export interface UpsertResult {
  client_id: string;
  server_id: string;
  status: "inserted" | "updated" | "skipped";
}

export interface DataSink {
  init(): Promise<void>;
  upsertObservations(rows: Observation[]): Promise<UpsertResult[]>;
  close(): Promise<void>;
}
