/**
 * Configuration centralisée pour Kuti Studio Backend
 * Remplace l'ancien settings.py du backend v1
 */

import { z } from "zod";

// ============================================================================
// Schéma de validation de la configuration
// ============================================================================

const configSchema = z.object({
  // Core
  nodeEnv: z.enum(["development", "production", "test"]).default("development"),
  port: z.coerce.number().default(8000),
  trustedOrigins: z.array(z.string()).default([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]),

  // App info
  appName: z.string().default("Kuti Studio Backend"),
  appVersion: z.string().default("0.2.0"),

  // Paths
  dataDir: z.string().default("./kuti-data"),
  assetsDir: z.string().default("./public"),

  // Database
  databaseUrl: z.string(),

  // Better Auth (optionnel pour l'instant)
  betterAuthUrl: z.string().optional(),
  betterAuthSecret: z.string().optional(),

  // Inngest
  inngestEventKey: z.string().optional(),
  inngestSigningKey: z.string().optional(),

  // Redis (pour Inngest/BentoCache)
  redisUrl: z.string().optional(),

  // Model Providers (Images)
  gptImages15BaseUrl: z.string().optional(),
  gptImages15ApiKey: z.string().optional(),
  gptImages15Enabled: z.boolean().default(true),

  gptImages2BaseUrl: z.string().optional(),
  gptImages2ApiKey: z.string().optional(),
  gptImages2Enabled: z.boolean().default(true),
  gptImages2UrlPath: z.string().default("/images/generations"),

  // Model Providers (Video)
  sora2BaseUrl: z.string().optional(),
  sora2ApiKey: z.string().optional(),
  sora2Enabled: z.boolean().default(true),

  seedance2BaseUrl: z.string().optional(),
  seedance2ApiKey: z.string().optional(),
  seedance2Enabled: z.boolean().default(true),

  // Model Providers (Audio)
  elevenLabsBaseUrl: z.string().optional(),
  elevenLabsApiKey: z.string().optional(),
  elevenLabsEnabled: z.boolean().default(true),
});

// ============================================================================
// Types
// ============================================================================

export type Config = z.infer<typeof configSchema>;

export type ModelKind = "image" | "video" | "audio";

export type ModelProvider = {
  key: string;
  kind: ModelKind;
  displayName: string;
  baseUrl: string | null;
  apiKey: string | null;
  enabled: boolean;
  apiModel: string | null;
};

// ============================================================================
// Configuration parsée depuis l'environnement
// ============================================================================

function parseConfig(): Config {
  const rawConfig = {
    // Core
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    trustedOrigins: process.env.TRUSTED_ORIGINS
      ? process.env.TRUSTED_ORIGINS.split(",").map((s) => s.trim())
      : undefined,

    // App info
    appName: process.env.APP_NAME,
    appVersion: process.env.npm_package_version,

    // Paths
    dataDir: process.env.KUTI_DATA_DIR,
    assetsDir: process.env.ASSETS_DIR,

    // Database
    databaseUrl: process.env.DATABASE_URL,

    // Better Auth
    betterAuthUrl: process.env.BETTER_AUTH_URL,
    betterAuthSecret: process.env.BETTER_AUTH_SECRET,

    // Inngest
    inngestEventKey: process.env.INNGEST_EVENT_KEY,
    inngestSigningKey: process.env.INNGEST_SIGNING_KEY,

    // Redis
    redisUrl: process.env.REDIS_URL,

    // Model Providers - GPT Images 1.5
    gptImages15BaseUrl: process.env.GPT_IMAGES_1_5_BASE_URL,
    gptImages15ApiKey: process.env.GPT_IMAGES_1_5_API_KEY,
    gptImages15Enabled: process.env.GPT_IMAGES_1_5_ENABLED === "false" ? false : undefined,

    // Model Providers - GPT Images 2
    gptImages2BaseUrl: process.env.GPT_IMAGES_2_BASE_URL,
    gptImages2ApiKey: process.env.GPT_IMAGES_2_API_KEY,
    gptImages2Enabled: process.env.GPT_IMAGES_2_ENABLED === "false" ? false : undefined,
    gptImages2UrlPath: process.env.GPT_IMAGES_2_URL_PATH,

    // Model Providers - Sora 2
    sora2BaseUrl: process.env.SORA_2_BASE_URL,
    sora2ApiKey: process.env.SORA_2_API_KEY,
    sora2Enabled: process.env.SORA_2_ENABLED === "false" ? false : undefined,

    // Model Providers - Seedance 2
    seedance2BaseUrl: process.env.SEEDANCE_2_BASE_URL,
    seedance2ApiKey: process.env.SEEDANCE_2_API_KEY,
    seedance2Enabled: process.env.SEEDANCE_2_ENABLED === "false" ? false : undefined,

    // Model Providers - ElevenLabs
    elevenLabsBaseUrl: process.env.ELEVEN_LABS_BASE_URL,
    elevenLabsApiKey: process.env.ELEVEN_LABS_API_KEY,
    elevenLabsEnabled: process.env.ELEVEN_LABS_ENABLED === "false" ? false : undefined,
  };

  return configSchema.parse(rawConfig);
}

// ============================================================================
// Instance unique de configuration
// ============================================================================

export const config = parseConfig();

// ============================================================================
// Helpers pour les model providers
// ============================================================================

export function buildModelCatalog(): Record<string, ModelProvider> {
  return {
    sora_2: {
      key: "sora_2",
      kind: "video",
      displayName: "Sora 2",
      baseUrl: config.sora2BaseUrl ?? null,
      apiKey: config.sora2ApiKey ?? null,
      enabled: config.sora2Enabled,
      apiModel: "sora-2",
    },
    seedance_2: {
      key: "seedance_2",
      kind: "video",
      displayName: "Seedance 2",
      baseUrl: config.seedance2BaseUrl ?? null,
      apiKey: config.seedance2ApiKey ?? null,
      enabled: config.seedance2Enabled,
      apiModel: "seedance-2",
    },
    gpt_images_1_5: {
      key: "gpt_images_1_5",
      kind: "image",
      displayName: "GPT Images 1.5",
      baseUrl: config.gptImages15BaseUrl ?? null,
      apiKey: config.gptImages15ApiKey ?? null,
      enabled: config.gptImages15Enabled,
      apiModel: "gpt-image-1.5",
    },
    gpt_images_2: {
      key: "gpt_images_2",
      kind: "image",
      displayName: "GPT Images 2",
      baseUrl: config.gptImages2BaseUrl ?? null,
      apiKey: config.gptImages2ApiKey ?? null,
      enabled: config.gptImages2Enabled,
      apiModel: "gpt-image-2",
    },
    eleven_labs: {
      key: "eleven_labs",
      kind: "audio",
      displayName: "Eleven Labs",
      baseUrl: config.elevenLabsBaseUrl ?? null,
      apiKey: config.elevenLabsApiKey ?? null,
      enabled: config.elevenLabsEnabled,
      apiModel: "eleven-labs",
    },
  };
}

export function getPublicModelCatalog(): Array<{
  key: string;
  kind: ModelKind;
  displayName: string;
  baseUrl: string | null;
  enabled: boolean;
  configured: boolean;
  hasApiKey: boolean;
}> {
  const catalog = buildModelCatalog();

  return Object.values(catalog).map((provider) => ({
    key: provider.key,
    kind: provider.kind,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    enabled: provider.enabled,
    configured: provider.enabled && !!provider.baseUrl && !!provider.apiKey,
    hasApiKey: !!provider.apiKey,
  }));
}

export function resolveModelProvider(
  modelKey?: string,
  kind?: ModelKind
): ModelProvider {
  const catalog = buildModelCatalog();

  // Si un modelKey spécifique est fourni
  if (modelKey) {
    const provider = catalog[modelKey];
    if (!provider) {
      throw new Error("model_not_found");
    }
    if (!provider.enabled) {
      throw new Error("model_disabled");
    }
    if (!provider.baseUrl || !provider.apiKey) {
      throw new Error("model_missing_configuration");
    }
    if (kind && provider.kind !== kind) {
      throw new Error("model_kind_mismatch");
    }
    return provider;
  }

  // Sinon, chercher le premier provider configuré du kind demandé
  if (kind) {
    const preferredKeys: Record<ModelKind, string[]> = {
      video: ["sora_2", "seedance_2"],
      image: ["gpt_images_2", "gpt_images_1_5"],
      audio: ["eleven_labs"],
    };

    for (const key of preferredKeys[kind]) {
      const provider = catalog[key];
      if (
        provider &&
        provider.enabled &&
        provider.baseUrl &&
        provider.apiKey &&
        provider.kind === kind
      ) {
        return provider;
      }
    }

    throw new Error("model_not_configured");
  }

  // Par défaut, retourner GPT Images 2
  const defaultProvider = catalog["gpt_images_2"];
  if (!defaultProvider || !defaultProvider.enabled) {
    throw new Error("model_not_configured");
  }

  return defaultProvider;
}

// ============================================================================
// Helpers pour les chemins
// ============================================================================

export function getProjectDataDir(slug: string): string {
  return `${config.dataDir}/projects/${slug}`;
}

// Alias pour compatibilité
export const getProjectDir = getProjectDataDir;

export function getGenerationDir(projectSlug: string, jobId: string): string {
  return `${config.dataDir}/projects/${projectSlug}/generation/${jobId}`;
}

export function getExportsDir(projectSlug: string): string {
  return `${config.dataDir}/projects/${projectSlug}/exports`;
}

export function getAssetsDir(projectSlug: string): string {
  return `${config.dataDir}/projects/${projectSlug}/assets`;
}

export function getAssetsRootDir(): string {
  return config.assetsDir;
}
