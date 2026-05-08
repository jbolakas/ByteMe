import { db, type QueuedObservation } from "../db/schema";
import { postObservations } from "../api/client";

const BATCH_SIZE = 25;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 10;

function backoff(attempts: number): number {
  // Exponential backoff with jitter, capped.
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempts);
  const jitter = Math.random() * exp * 0.2;
  return exp + jitter;
}

let running = false;
let pollHandle: ReturnType<typeof setTimeout> | null = null;

export type SyncListener = (state: { pending: number; syncing: boolean }) => void;
const listeners = new Set<SyncListener>();
export function onSyncChange(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function notify() {
  const pending = await db.observations.where("status").anyOf(["pending", "error"]).count();
  for (const fn of listeners) fn({ pending, syncing: running });
}

async function claimBatch(): Promise<QueuedObservation[]> {
  const now = Date.now();
  // Pick rows that are pending/error and whose backoff window has elapsed.
  const candidates = await db.observations
    .where("status")
    .anyOf(["pending", "error"])
    .filter((row) => row.next_attempt_at <= now)
    .limit(BATCH_SIZE)
    .toArray();
  if (candidates.length === 0) return [];
  await db.observations.bulkUpdate(
    candidates.map((c) => ({ key: c.client_id, changes: { status: "syncing" as const } }))
  );
  return candidates;
}

async function flush(): Promise<void> {
  if (running) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  running = true;
  await notify();
  try {
    while (true) {
      const batch = await claimBatch();
      if (batch.length === 0) break;
      try {
        const results = await postObservations(batch);
        const byClient = new Map(results.map((r) => [r.client_id, r]));
        await db.observations.bulkUpdate(
          batch.map((row) => {
            const r = byClient.get(row.client_id);
            return {
              key: row.client_id,
              changes: r
                ? {
                    status: "synced" as const,
                    server_id: r.server_id,
                    last_error: null,
                  }
                : {
                    status: "error" as const,
                    last_error: "missing_in_response",
                    attempts: row.attempts + 1,
                    next_attempt_at: Date.now() + backoff(row.attempts + 1),
                  },
            };
          })
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await db.observations.bulkUpdate(
          batch.map((row) => {
            const attempts = row.attempts + 1;
            const giveUp = attempts >= MAX_ATTEMPTS;
            return {
              key: row.client_id,
              changes: {
                status: giveUp ? ("error" as const) : ("pending" as const),
                attempts,
                last_error: msg,
                next_attempt_at: Date.now() + backoff(attempts),
              },
            };
          })
        );
        // Stop the loop on transport failure; we'll retry on the next tick.
        break;
      }
    }
  } finally {
    running = false;
    await notify();
  }
}

export function startSyncWorker(): void {
  const tick = () => {
    void flush().finally(() => {
      pollHandle = setTimeout(tick, 5_000);
    });
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => void flush());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void flush();
    });
  }
  tick();
}

export async function flushNow(): Promise<void> {
  await flush();
}

export async function pendingCount(): Promise<number> {
  return db.observations.where("status").anyOf(["pending", "error"]).count();
}
