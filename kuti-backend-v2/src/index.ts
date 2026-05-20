import cors from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { authModule } from "@modules/authentication";
import { uploadModule } from "@modules/upload";
import { usersModule } from "@modules/users";
import { randomUUIDv7 } from "bun";
import { Elysia } from "elysia";
import { wideEvent } from "elysia-wide-event";
import { z } from "zod";

export const app = new Elysia({
  aot: true,
  analytic: true,
  name: "Application API",
})
  .use(
    wideEvent({
      generateRequestId: () => `req-${randomUUIDv7()}`,
      start: { version: process.env.npm_package_version },
    }),
  )
  .use(
    cors({
      origin: String(process.env.TRUSTED_ORIGINS || "").split(","),
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Client-Key"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
  .use(
    openapi({
      mapJsonSchema: { zod: z.toJSONSchema },
      path: "/openapi",
      specPath: "/openapi/doc.json",
      enabled: process.env.NODE_ENV === "development",
    }),
  )
  .use(authModule)
  .use(uploadModule)
  .use(usersModule)
  .get("/healthz", () => ({ ok: true }))
  .listen(Number(8000));
