/**
 * Gestion des providers de modèles IA pour la génération d'images/vidéos
 * Migration de providers.py du backend v1
 */

import { config, resolveModelProvider, type ModelProvider } from "./config";

// ============================================================================
// Types
// ============================================================================

export type GeneratedArtifact = {
  content: Buffer;
  mimeType: string;
  fileExtension: string;
};

export type GenerationOptions = {
  size?: string;
  timeoutSeconds?: number;
};

// ============================================================================
// Errors
// ============================================================================

export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "model_not_found"
      | "model_disabled"
      | "model_missing_configuration"
      | "model_kind_mismatch"
      | "model_not_implemented"
      | "generation_provider_failed"
      | "generation_provider_invalid_response"
      | "timeout"
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

// ============================================================================
// Helper: Data URL
// ============================================================================

function dataUrl(content: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${content.toString("base64")}`;
}

// ============================================================================
// Helper: Extract image/video bytes from API response
// ============================================================================

async function extractMediaBytes(
  payload: unknown,
  timeoutSeconds: number
): Promise<{ content: Buffer; mimeType: string } | null> {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const obj = payload as Record<string, unknown>;

  // Direct base64 fields
  const directFields = ["b64_json", "image_base64", "video_base64", "result"];
  for (const field of directFields) {
    const value = obj[field];
    if (typeof value === "string" && value.trim()) {
      try {
        const content = Buffer.from(value, "base64");
        const mimeType = extractMimeType(obj) || "image/png";
        return { content, mimeType };
      } catch {
        // Continue to next field
      }
    }
  }

  // Nested arrays (data, output, response)
  const arrayFields = ["data", "output", "response"];
  for (const field of arrayFields) {
    const arr = obj[field];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const result = await extractMediaBytes(item, timeoutSeconds);
        if (result) return result;

        // URL in nested object
        if (typeof item === "object" && item !== null) {
          const itemObj = item as Record<string, unknown>;
          for (const urlField of ["url", "image_url"]) {
            const url = itemObj[urlField];
            if (typeof url === "string" && url.trim()) {
              const downloaded = await downloadMedia(url, timeoutSeconds);
              if (downloaded) return downloaded;
            }
          }
        }
      }
    }
  }

  // Direct URL fields
  for (const urlField of ["video_url", "output_url", "result_url", "url", "image_url"]) {
    const url = obj[urlField];
    if (typeof url === "string" && url.trim()) {
      const downloaded = await downloadMedia(url, timeoutSeconds);
      if (downloaded) return downloaded;
    }
  }

  return null;
}

async function downloadMedia(
  url: string,
  timeoutSeconds: number
): Promise<{ content: Buffer; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.0.36",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[Download] Failed: ${url}, status: ${response.status}`);
      return null;
    }

    const content = Buffer.from(await response.arrayBuffer());
    const mimeType =
      response.headers.get("content-type") ||
      guessMimeTypeFromUrl(url) ||
      "application/octet-stream";

    return { content, mimeType };
  } catch (error) {
    console.error(`[Download] Error: ${url}, error:`, error);
    return null;
  }
}

function extractMimeType(payload: Record<string, unknown>): string | null {
  const mimeType = payload["mime_type"];
  if (typeof mimeType === "string" && mimeType.trim()) {
    return mimeType;
  }

  const type = payload["type"];
  if (type === "video_generation_call") {
    return "video/mp4";
  }

  return null;
}

function guessMimeTypeFromUrl(url: string): string | null {
  const ext = url.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    mp4: "video/mp4",
    webm: "video/webm",
  };
  return ext ? mimeMap[ext] || null : null;
}

function getFileExtensionFromMimeType(mimeType: string): string {
  const extMap: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
  };
  return extMap[mimeType] || ".bin";
}

function extractTaskId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const obj = payload as Record<string, unknown>;
  for (const key of ["id", "video_id", "task_id", "job_id"]) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function providerEndpoint(provider: ModelProvider, path: string): string {
  const baseUrl = provider.baseUrl!.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (baseUrl.endsWith("/v1") && normalizedPath.startsWith("/v1/")) {
    return `${baseUrl}${normalizedPath.slice(3)}`;
  }
  return `${baseUrl}${normalizedPath}`;
}

// ============================================================================
// GPT Images 2 Generation
// ============================================================================

async function generateWithGptImages2(
  provider: ModelProvider,
  prompt: string,
  options?: GenerationOptions
): Promise<GeneratedArtifact> {
  const size = options?.size || "1024x1536";
  const timeoutSeconds = options?.timeoutSeconds || 120;

  const imagePath = provider.key === "gpt_images_2" ? config.gptImages2UrlPath : "/images/generations";
  const endpoint = providerEndpoint(provider, imagePath);
  const body = {
    model: provider.apiModel,
    prompt,
    size,
    n: 1,
  };

  console.log(`[GPT Images 2] Request to ${endpoint}`);
  console.log(`[GPT Images 2] Model: ${provider.apiModel}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[GPT Images 2] HTTP Error ${response.status}:`, errorBody);
      throw new GenerationError(
        `Provider returned ${response.status}: ${errorBody}`,
        "generation_provider_failed"
      );
    }

    const payload = await response.json();
    const media = await extractMediaBytes(payload, timeoutSeconds);

    if (!media) {
      console.error("[GPT Images 2] Failed to extract image from response:", payload);
      throw new GenerationError(
        "Invalid response format from provider",
        "generation_provider_invalid_response"
      );
    }

    return {
      content: media.content,
      mimeType: media.mimeType,
      fileExtension: getFileExtensionFromMimeType(media.mimeType),
    };
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new GenerationError("Request timeout", "timeout");
    }
    throw new GenerationError(
      String(error),
      "generation_provider_failed"
    );
  }
}

// ============================================================================
// Sora 2 Generation (Video)
// ============================================================================

async function generateWithSora2(
  provider: ModelProvider,
  prompt: string,
  sourceImage?: Buffer,
  sourceImageMimeType?: string,
  options?: GenerationOptions
): Promise<GeneratedArtifact> {
  const timeoutSeconds = options?.timeoutSeconds || 300;
  const deadline = Date.now() + timeoutSeconds * 1000;

  const endpoint = providerEndpoint(provider, config.sora2VideosPath);

  const body: Record<string, unknown> = {
    model: provider.apiModel,
    prompt,
    seconds: "4",
    size: "1280x720",
  };

  if (sourceImage && sourceImageMimeType) {
    body.input_reference = { image_url: dataUrl(sourceImage, sourceImageMimeType) };
  }

  console.log(`[Sora 2] Request to ${endpoint}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Sora 2] HTTP Error ${response.status}:`, errorBody);
      throw new GenerationError(
        `Provider returned ${response.status}`,
        "generation_provider_failed"
      );
    }

    const payload = await response.json();
    const media = await extractMediaBytes(payload, timeoutSeconds);

    if (media) {
      return {
        content: media.content,
        mimeType: media.mimeType,
        fileExtension: getFileExtensionFromMimeType(media.mimeType),
      };
    }

    const videoId = extractTaskId(payload);
    if (!videoId) {
      console.error("[Sora 2] Failed to extract video ID from response:", payload);
      throw new GenerationError(
        "No video ID in response",
        "generation_provider_invalid_response"
      );
    }

    return await pollSoraVideo(provider, videoId, endpoint, deadline);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new GenerationError("Request timeout", "timeout");
    }
    throw new GenerationError(String(error), "generation_provider_failed");
  }
}

async function pollSoraVideo(
  provider: ModelProvider,
  videoId: string,
  videosEndpoint: string,
  deadline: number,
): Promise<GeneratedArtifact> {
  const videoEndpoint = `${videosEndpoint.replace(/\/$/, "")}/${encodeURIComponent(videoId)}`;
  const contentEndpoint = `${videoEndpoint}/content`;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const response = await fetch(videoEndpoint, {
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new GenerationError(`Poll failed: ${response.status}`, "generation_provider_failed");
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const media = await extractMediaBytes(payload, 60);
    if (media) {
      return {
        content: media.content,
        mimeType: media.mimeType,
        fileExtension: getFileExtensionFromMimeType(media.mimeType),
      };
    }

    const status = String(payload.status || "").toLowerCase();
    if (status === "completed" || status === "succeeded" || status === "success") {
      const downloaded = await downloadAuthorizedMedia(contentEndpoint, provider.apiKey!, 120);
      if (!downloaded) {
        throw new GenerationError("Video completed but content download failed", "generation_provider_invalid_response");
      }
      return {
        content: downloaded.content,
        mimeType: downloaded.mimeType,
        fileExtension: getFileExtensionFromMimeType(downloaded.mimeType),
      };
    }

    if (status === "failed" || status === "error" || status === "cancelled" || status === "canceled") {
      const message = typeof payload.error === "object" && payload.error !== null
        ? JSON.stringify(payload.error)
        : "Video generation failed";
      throw new GenerationError(message, "generation_provider_failed");
    }
  }

  throw new GenerationError("Polling timeout", "timeout");
}

async function downloadAuthorizedMedia(
  url: string,
  apiKey: string,
  timeoutSeconds: number,
): Promise<{ content: Buffer; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "video/mp4,video/*,*/*",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return {
      content: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") || "video/mp4",
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Seedance 2 Generation (Video)
// ============================================================================

async function pollSeedanceTask(
  provider: ModelProvider,
  taskId: string,
  deadline: number,
  timeoutSeconds: number
): Promise<GeneratedArtifact> {
  const pollPath = config.seedance2PollPath.replace(":taskId", encodeURIComponent(taskId));
  const pollEndpoint = providerEndpoint(provider, pollPath);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5s between polls

    const response = await fetch(pollEndpoint, {
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new GenerationError(
        `Poll failed: ${response.status}`,
        "generation_provider_failed"
      );
    }

    const payload = await response.json();

    // Check for completed media
    const media = await extractMediaBytes(payload, timeoutSeconds);
    if (media) {
      return {
        content: media.content,
        mimeType: media.mimeType,
        fileExtension: getFileExtensionFromMimeType(media.mimeType),
      };
    }

    // Check status
    const status = String((payload as Record<string, unknown>)["status"] || "").toLowerCase();

    if (["succeeded", "success", "completed", "done"].includes(status)) {
      throw new GenerationError(
        "Task completed but no media found",
        "generation_provider_invalid_response"
      );
    }

    if (["failed", "error", "cancelled", "canceled"].includes(status)) {
      throw new GenerationError("Task failed", "generation_provider_failed");
    }
  }

  throw new GenerationError("Polling timeout", "timeout");
}

async function generateWithSeedance2(
  provider: ModelProvider,
  prompt: string,
  sourceImage?: Buffer,
  sourceImageMimeType?: string,
  options?: GenerationOptions
): Promise<GeneratedArtifact> {
  const timeoutSeconds = options?.timeoutSeconds || 300;
  const deadline = Date.now() + timeoutSeconds * 1000;

  const endpoint = providerEndpoint(provider, config.seedance2GeneratePath);

  const body: Record<string, unknown> = {
    model: provider.apiModel,
    prompt,
    resolution: "720p",
    duration: 5,
    aspect_ratio: "16:9",
  };

  if (sourceImage && sourceImageMimeType) {
    body["image_url"] = dataUrl(sourceImage, sourceImageMimeType);
  }

  console.log(`[Seedance 2] Request to ${endpoint}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 1min for initial request

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Seedance 2] HTTP Error ${response.status}:`, errorBody);
      throw new GenerationError(
        `Provider returned ${response.status}`,
        "generation_provider_failed"
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;

    // Try to get media immediately (might be ready for fast generations)
    const immediateMedia = await extractMediaBytes(payload, timeoutSeconds);
    if (immediateMedia) {
      return {
        content: immediateMedia.content,
        mimeType: immediateMedia.mimeType,
        fileExtension: getFileExtensionFromMimeType(immediateMedia.mimeType),
      };
    }

    // Extract task ID for polling
    let taskId: string | null = null;
    for (const key of ["task_id", "id", "job_id"]) {
      const value = payload[key];
      if (typeof value === "string" && value.trim()) {
        taskId = value;
        break;
      }
    }

    if (!taskId) {
      throw new GenerationError(
        "No task ID in response",
        "generation_provider_invalid_response"
      );
    }

    // Poll for completion
    return await pollSeedanceTask(provider, taskId, deadline, timeoutSeconds);
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new GenerationError("Request timeout", "timeout");
    }
    throw new GenerationError(String(error), "generation_provider_failed");
  }
}

// ============================================================================
// Main Generation Function
// ============================================================================

export async function generateMediaArtifact(
  provider: ModelProvider,
  prompt: string,
  options?: GenerationOptions & {
    sourceImage?: Buffer;
    sourceImageMimeType?: string;
  }
): Promise<GeneratedArtifact> {
  // Validate provider is configured
  if (!provider.baseUrl || !provider.apiKey) {
    throw new GenerationError(
      "Provider not configured",
      "model_missing_configuration"
    );
  }

  // Route to appropriate provider
  switch (provider.key) {
    case "gpt_images_2":
      return generateWithGptImages2(provider, prompt, options);

    case "gpt_images_1_5":
      // GPT Images 1.5 utilise la même API que 2.0
      return generateWithGptImages2(provider, prompt, options);

    case "sora_2":
      return generateWithSora2(
        provider,
        prompt,
        options?.sourceImage,
        options?.sourceImageMimeType,
        options
      );

    case "seedance_2":
      return generateWithSeedance2(
        provider,
        prompt,
        options?.sourceImage,
        options?.sourceImageMimeType,
        options
      );

    case "eleven_labs":
      throw new GenerationError(
        "ElevenLabs not yet implemented",
        "model_not_implemented"
      );

    default:
      throw new GenerationError(
        `Unknown provider: ${provider.key}`,
        "model_not_implemented"
      );
  }
}

/**
 * Génère une image à partir d'un modèle IA
 */
export async function generateImage(
  prompt: string,
  options?: GenerationOptions & {
    modelKey?: string;
    sourceImage?: Buffer;
    sourceImageMimeType?: string;
  }
): Promise<GeneratedArtifact> {
  const provider = resolveModelProvider(options?.modelKey, "image");
  return generateMediaArtifact(provider, prompt, options);
}

/**
 * Génère une vidéo à partir d'un modèle IA
 */
export async function generateVideo(
  prompt: string,
  options?: GenerationOptions & {
    modelKey?: string;
    sourceImage?: Buffer;
    sourceImageMimeType?: string;
  }
): Promise<GeneratedArtifact> {
  const provider = resolveModelProvider(options?.modelKey, "video");
  return generateMediaArtifact(provider, prompt, options);
}
