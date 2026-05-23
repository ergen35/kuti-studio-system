/**
 * Entry point principal de Kuti Studio Backend v2
 * Serveur Elysia avec tous les modules métier
 */

import cors from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { config } from "@lib/config";
import { orphanCheckerCron } from "@lib/cron";
import { assetsModule } from "@modules/assets";
// Modules métier
// Modules
import { staticPlugin } from '@elysia/static';
import { authModule } from "@modules/authentication";
import { charactersModule } from "@modules/characters";
import { exportsModule } from "@modules/exports";
import { generationModule } from "@modules/generation";
import { healthModule } from "@modules/health";
import { inngestModule } from "@modules/inngest";
import { projectsModule } from "@modules/projects";
import { sceneGenerationModule } from "@modules/scene-generation";
import { storyModule } from "@modules/story";
import { versionsModule } from "@modules/versions";
import { warningsModule } from "@modules/warnings";
import { randomUUIDv7 } from "bun";
import { Elysia } from "elysia";
import { wideEvent } from "elysia-wide-event";
import { toJSONSchema } from 'zod';

export const app = new Elysia({
  aot: true,
  analytic: true,
  name: config.appName,
})
  // Logging global
  .use(
    wideEvent({
      generateRequestId: () => `req-${randomUUIDv7()}`,
      start: { version: config.appVersion },
    }),
  )

  // CORS
  .use(
    cors({
      origin: config.trustedOrigins,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Client-Key"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  )

  // API Documentation
  .use(
    openapi({
      enabled: process.env.NODE_ENV === "development",
      path: "/openapi",
      specPath: "/openapi/api-doc.json",
      documentation: {
        info: {
          title: "Kuti Backend",
          version: "1.0.0",
          description: "Authentication server.",
        },
      },
      mapJsonSchema: { zod: toJSONSchema },
    }),
  )
  .onError(({ error }) => {
    console.error("error", error);
  })

  // Static plugins
  .use(staticPlugin())

  // Cron jobs
  .use(orphanCheckerCron)

  // Modules
  .use(authModule)
  .use(healthModule)
  .use(projectsModule)
  .use(charactersModule)
  .use(storyModule)
  .use(generationModule)
  .use(assetsModule)
  .use(sceneGenerationModule)
  .use(versionsModule)
  .use(warningsModule)
  .use(exportsModule)
  .use(inngestModule)

  // Start server
  .listen(Number(config.port), () => {
    console.log(`🚀 ${config.appName} v${config.appVersion}`);
  });

export type App = typeof app;
