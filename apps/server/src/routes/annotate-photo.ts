import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const Body = z.object({
  photo_b64: z.string().min(1),
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  prompt: z.string().max(2000).optional(),
});

const DEFAULT_PROMPT =
  "You are a field-observation assistant. Describe what is visible in 1-2 sentences. " +
  "Note any species, landmarks, or hazards. Be concise and factual.";

export const annotatePhotoRoute: FastifyPluginAsync = async (app) => {
  app.post("/annotate-photo", async (req, reply) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Dev fallback so the PWA flow works without a key.
      return reply.send({
        annotation: "[mock annotation — set ANTHROPIC_API_KEY to enable Claude vision]",
        model: "mock",
      });
    }

    const { photo_b64, media_type, prompt } = parsed.data;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type, data: photo_b64 } },
              { type: "text", text: prompt ?? DEFAULT_PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return reply.code(502).send({ error: "upstream_error", status: res.status, body: text });
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const annotation =
      data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    return reply.send({ annotation, model: "claude-sonnet-4-6" });
  });
};
