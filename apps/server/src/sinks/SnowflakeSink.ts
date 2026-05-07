import type { DataSink, Observation, UpsertResult } from "./DataSink.js";

// Stub: wired later. Same interface as MockSink so the route layer doesn't change.
// Implementation will use snowflake-sdk and a MERGE on client_id.
export class SnowflakeSink implements DataSink {
  async init(): Promise<void> {
    throw new Error("SnowflakeSink not implemented yet");
  }
  async upsertObservations(_rows: Observation[]): Promise<UpsertResult[]> {
    throw new Error("SnowflakeSink not implemented yet");
  }
  async close(): Promise<void> {}
}
