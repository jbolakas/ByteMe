import Fastify from "fastify";
import cors from "@fastify/cors";
import { MockSink } from "./sinks/MockSink.js";
import { observationsRoutes } from "./routes/observations.js";
import { annotatePhotoRoute } from "./routes/annotate-photo.js";
import type { DataSink } from "./sinks/DataSink.js";

async function buildSink(): Promise<DataSink> {
  const kind = process.env.DATA_SINK ?? "mock";
  if (kind === "snowflake") {
    const { SnowflakeSink } = await import("./sinks/SnowflakeSink.js");
    const sink = new SnowflakeSink();
    await sink.init();
    return sink;
  }
  const sink = new MockSink(process.env.SQLITE_PATH ?? "data/mock.sqlite");
  await sink.init();
  return sink;
}

async function main() {
  const sink = await buildSink();
  const app = Fastify({
    logger: true,
    bodyLimit: 25 * 1024 * 1024, // photos arrive base64-encoded in batches
  });

  await app.register(cors, { origin: true });
  app.get("/health", async () => ({ ok: true }));
  await app.register(observationsRoutes(sink));
  await app.register(annotatePhotoRoute);

  const port = Number(process.env.PORT ?? 3001);
  const host = process.env.HOST ?? "0.0.0.0";
  await app.listen({ port, host });

  const shutdown = async () => {
    await app.close();
    await sink.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
