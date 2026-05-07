import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { DataSink, Observation } from "../sinks/DataSink.js";

const ObservationSchema = z.object({
  client_id: z.string().min(1),
  user_id: z.string().min(1),
  captured_at: z.string().min(1),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  accuracy_m: z.number().nullable(),
  notes: z.string().nullable(),
  voice_transcript: z.string().nullable(),
  photo_b64: z.string().nullable(),
  photo_annotation: z.string().nullable(),
  schema_version: z.number().int().positive(),
});

const BatchSchema = z.object({
  observations: z.array(ObservationSchema).min(1).max(500),
});

export const observationsRoutes = (sink: DataSink): FastifyPluginAsync => async (app) => {
  app.post("/observations", async (req, reply) => {
    const parsed = BatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    const rows: Observation[] = parsed.data.observations;
    const results = await sink.upsertObservations(rows);
    return reply.send({ results });
  });
};
