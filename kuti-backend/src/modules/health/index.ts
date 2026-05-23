/**
 * Module Health - Endpoints de santé et configuration
 * Remplace les routes /health, /config, /models du backend v1
 */

import { config, getPublicModelCatalog } from "@lib/config";
import { Elysia } from "elysia";
import { z } from "zod";

// ============================================================================
// DTOs
// ============================================================================

const healthResponseSchema = z.object({
  status: z.string(),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
  dataDir: z.string(),
});

const configResponseSchema = z.object({
  appName: z.string(),
  appVersion: z.string(),
  environment: z.string(),
  locale: z.string(),
  dataDir: z.string(),
  projectDataDir: z.string(),
  exportsDir: z.string(),
  openapiUrl: z.string(),
});

const modelProviderSchema = z.object({
  key: z.string(),
  kind: z.enum(["image", "video", "audio"]),
  displayName: z.string(),
  baseUrl: z.string().nullable(),
  enabled: z.boolean(),
  configured: z.boolean(),
  hasApiKey: z.boolean(),
});

// ============================================================================
// Module
// ============================================================================

export const healthModule = new Elysia({
  prefix: "/api",
  name: "healthModule",
  detail: { tags: ["Health"] },
})
  // Health check (compat v1 + standard)
  .get(
    "/health",
    () => ({
      status: "ok",
      service: config.appName,
      version: config.appVersion,
      timestamp: new Date().toISOString(),
      dataDir: config.dataDir,
    }),
    {
      response: healthResponseSchema,
      detail: {
        operationId: "getHealth",
        summary: "Health check endpoint",
      },
    }
  )
  .get(
    "/healthz",
    () => ({ ok: true }),
    {
      detail: {
        operationId: "getHealthz",
        summary: "Simple health check",
      },
    }
  )

  // Config (compat v1)
  .get(
    "/config",
    () => ({
      appName: config.appName,
      appVersion: config.appVersion,
      environment: config.nodeEnv,
      locale: "en", // À rendre configurable si nécessaire
      dataDir: config.dataDir,
      projectDataDir: `${config.dataDir}/projects`,
      exportsDir: `${config.dataDir}/exports`,
      openapiUrl: "/openapi/doc.json",
    }),
    {
      response: configResponseSchema,
      detail: {
        operationId: "getConfig",
        summary: "Get application configuration",
      },
    }
  )

  // Models (compat v1)
  .get(
    "/models",
    () => getPublicModelCatalog(),
    {
      response: z.array(modelProviderSchema),
      detail: {
        operationId: "listModels",
        summary: "List available AI model providers",
      },
    }
  )
