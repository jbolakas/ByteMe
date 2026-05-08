import type { QueuedObservation } from "../db/schema";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

export interface UpsertResult {
  client_id: string;
  server_id: string;
  status: "inserted" | "updated" | "skipped";
}

export async function postObservations(
  rows: QueuedObservation[]
): Promise<UpsertResult[]> {
  const payload = {
    observations: rows.map(({ status, attempts, next_attempt_at, last_error, server_id, created_at, ...rest }) => rest),
  };
  const res = await fetch(`${API_BASE}/observations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`server ${res.status}`);
  const data = (await res.json()) as { results: UpsertResult[] };
  return data.results;
}

export async function annotatePhoto(photo_b64: string): Promise<string> {
  const res = await fetch(`${API_BASE}/annotate-photo`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ photo_b64, media_type: "image/jpeg" }),
  });
  if (!res.ok) throw new Error(`server ${res.status}`);
  const data = (await res.json()) as { annotation: string };
  return data.annotation;
}
