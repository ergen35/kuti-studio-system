/**
 * Entry point principal de Kuti Studio Backend v2
 * Serveur Elysia avec tous les modules métier
 */

import cors from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { config } from "@lib/config";
import { orphanCheckerCron } from "@lib/cron";
import { assetsModule } from "@modules/assets";
// Modules métier
// Modules
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

  // API Documentation (Swagger UI)
  .use(
    swagger({
      documentation: {
        info: {
          title: config.appName,
          version: config.appVersion,
          description: "Kuti Studio Backend API",
        },
        tags: [
          { name: "Health", description: "Health and configuration" },
          { name: "Authentication", description: "Better Auth endpoints" },
          { name: "Projects", description: "Project management" },
          { name: "Characters", description: "Character management" },
          { name: "Story", description: "Story structure (Tomes, Chapters, Scenes)" },
          { name: "Generation", description: "AI image/video generation" },
          { name: "Assets", description: "Project assets management" },
          { name: "Scene Generation", description: "Scene manga generation" },
          { name: "Versions", description: "Project versioning" },
          { name: "Warnings", description: "Consistency warnings" },
          { name: "Exports", description: "Project exports" },
        ],
      },
      path: "/openapi",
      scalarConfig: {
        darkMode: true,
      },
    }),
  )

  .onError(({ error }) => {
    console.error("error", error);
  })

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
    console.log(`   Environment: ${config.nodeEnv}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   Data directory: ${config.dataDir}`);
    console.log(`   OpenAPI: http://localhost:${config.port}/openapi`);
  });

export type App = typeof app;
