export const API_BASE_URL = ((import.meta.env.VITE_KUTI_API_URL as string | undefined) || "http://127.0.0.1:8000").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : `API request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers,
    body,
  });

  if (!response.ok) {
    let detail: unknown = response.statusText;
    try {
      const payload = await response.json();
      detail = payload.detail ?? payload;
    } catch {
      detail = await response.text();
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new ApiError(
      response.status,
      `Expected JSON from ${API_BASE_URL}/api${path}, received ${contentType || "unknown content type"}. ${text.slice(0, 80)}`,
    );
  }

  return (await response.json()) as T;
}

export type ProjectStatus = "draft" | "active" | "archived" | "maintenance";
export type StoryStatus = "active" | "draft" | "archived";
export type CharacterStatus = "active" | "draft" | "archived";
export type WarningStatus = "open" | "ignored" | "resolved";
export type WarningSeverity = "info" | "warning" | "critical";
export type ExportFormat = "json" | "tree" | "zip";
export type ExportKind = "work" | "publication";

export type Project = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  rootPath: string;
  settingsJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  archivedAt: string | null;
};

export type ProjectListResponse = { items: Project[] };

export type Character = {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  alias: string | null;
  narrativeRole: string | null;
  description: string;
  physicalDescription: string;
  colorPaletteJson: string[];
  costumeElementsJson: string[];
  keyTraitsJson: string[];
  personality: string;
  narrativeArc: string;
  tagsJson: string[];
  status: CharacterStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type CharacterRelation = {
  id: string;
  projectId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  relationType: string;
  strength: number;
  narrativeDependency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type VoiceSample = {
  id: string;
  projectId: string;
  characterId: string;
  assetPath: string | null;
  label: string;
  voiceNotes: string;
  createdAt: string;
};

export type CharacterImage = {
  id: string;
  projectId: string;
  characterId: string;
  filePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string;
  prompt: string;
  strategy: string | null;
  style: string | null;
  variationIndex: number | null;
  createdAt: string;
};

export type CharacterDetail = Character & {
  relationshipsSummary: string | null;
  relations: CharacterRelation[];
  voiceSamples: VoiceSample[];
  images?: CharacterImage[];
};

export type Tome = {
  id: string;
  projectId: string;
  title: string;
  slug: string;
  synopsis: string;
  status: StoryStatus;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type Chapter = {
  id: string;
  projectId: string;
  tomeId: string;
  title: string;
  slug: string;
  synopsis: string;
  status: StoryStatus;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type Scene = {
  id: string;
  projectId: string;
  tomeId: string;
  chapterId: string;
  title: string;
  slug: string;
  sceneType: string;
  location: string;
  summary: string;
  content: string;
  notes: string;
  charactersJson: string[];
  tagsJson: string[];
  status: StoryStatus;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type StoryReference = {
  id: string;
  projectId: string;
  sceneId: string;
  referenceKind: string;
  targetSlug: string;
  rawToken: string;
  createdAt: string;
};

export type StorySummary = {
  tomes: Tome[];
  chapters: Chapter[];
  scenes: Scene[];
  orphanReferences: { reference: StoryReference; reason: string }[];
};

export type Asset = {
  id: string;
  projectId: string;
  slug: string;
  name: string;
  originalFilename: string;
  mimeType: string;
  checksum: string;
  sizeBytes: number;
  storagePath: string;
  description: string;
  tagsJson: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type AssetLink = {
  id: string;
  projectId: string;
  assetId: string;
  targetKind: string;
  targetId: string;
  note: string;
  createdAt: string;
};

export type AssetDetail = Asset & { links: AssetLink[] };

export type Warning = {
  id: string;
  projectId: string;
  fingerprint: string;
  kind: string;
  severity: WarningSeverity;
  status: WarningStatus;
  title: string;
  message: string;
  entityKind: string;
  entityId: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type Version = {
  id: string;
  projectId: string;
  branchName: string;
  versionIndex: number;
  label: string;
  summary: string;
  createdAt: string;
};

export type VersionBranch = {
  branchName: string;
  versionCount: number;
  latestVersionId: string | null;
  latestCreatedAt: string | null;
};

export type ExportRecord = {
  id: string;
  projectId: string;
  kind: ExportKind;
  format: ExportFormat;
  status: "pending" | "ready" | "failed";
  label: string;
  summary: string;
  artifactPath: string | null;
  artifactName: string | null;
  metadataJson: Record<string, unknown>;
  sizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
};

export type ModelProvider = {
  key: string;
  kind: string;
  displayName: string;
  baseUrl: string | null;
  enabled: boolean;
  configured: boolean;
  hasApiKey: boolean;
};

export type GenerationPanel = {
  id: string;
  boardId: string;
  stepId: string | null;
  orderIndex: number;
  title: string;
  caption: string;
  prompt: string;
  status: string;
  imagePath: string;
  imageName: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GenerationBoard = {
  id: string;
  projectId: string;
  jobId: string;
  sourceKind: string;
  strategy: string;
  title: string;
  summary: string;
  status: string;
  artifactPath: string | null;
  artifactName: string | null;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
  panels: GenerationPanel[];
};

export type GenerationJob = {
  id: string;
  projectId: string;
  sourceKind: string;
  sourceId: string;
  sourceLabel: string;
  sourceVersionId: string | null;
  strategy: string;
  modelKey: string | null;
  modelName: string | null;
  modelKind: string | null;
  entrypoint: string;
  title: string;
  prompt: string;
  summary: string;
  status: string;
  progress: number;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  board: GenerationBoard | null;
};

// =============================================================================
// Scene Generation Types (Manga)
// =============================================================================

export type SceneGenerationConfig = {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  systemPrompt: string;
  stylePreset: "shonen" | "shojo" | "seinen" | "generic";
  colorMode: "bw" | "color" | "spot_color";
  defaultImageCount: number;
  allowMultiPage: boolean;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SceneMangaPage = {
  id: string;
  projectId: string;
  sceneId: string;
  tomeId: string;
  chapterId: string;
  jobId: string;
  boardId: string;
  panelId: string;
  pageNumber: number;
  label: string;
  status: "draft" | "selected" | "rejected";
  imageUrl: string | null;
  caption: string | null;
  prompt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SceneGenerationListResponse = {
  sceneId: string;
  pages: SceneMangaPage[];
  totalPages: number;
};

export type PromptPreviewResponse = {
  systemPrompt: string;
  sceneSection: string;
  fullPrompt: string;
  characterSummaries: { slug: string; name: string; hasReference: boolean; summary: string }[];
  warnings: string[];
};

export const api = {
  health: () => request<Record<string, unknown>>("/health"),
  models: () => request<ModelProvider[]>("/models"),
  projects: () => request<ProjectListResponse>("/projects"),
  createProject: (body: { name: string; status?: ProjectStatus; settingsJson?: Record<string, unknown> }) => request<Project>("/projects", { method: "POST", body }),
  project: (projectId: string) => request<Project>(`/projects/${projectId}`),
  updateProject: (projectId: string, body: Partial<Pick<Project, "name" | "status" | "settingsJson">>) => request<Project>(`/projects/${projectId}`, { method: "PATCH", body }),
  openProject: (projectId: string) => request<Project>(`/projects/${projectId}/open`, { method: "POST" }),
  archiveProject: (projectId: string) => request<Project>(`/projects/${projectId}/archive`, { method: "POST" }),
  cloneProject: (projectId: string, body: { name?: string }) => request<Project>(`/projects/${projectId}/clone`, { method: "POST", body }),

  characters: (projectId: string) => request<{ items: Character[] }>(`/projects/${projectId}/characters`),
  character: (projectId: string, characterId: string) => request<CharacterDetail>(`/projects/${projectId}/characters/${characterId}`),
  createCharacter: (projectId: string, body: Partial<Character> & { name: string }) => request<Character>(`/projects/${projectId}/characters`, { method: "POST", body }),
  updateCharacter: (projectId: string, characterId: string, body: Partial<Character>) => request<Character>(`/projects/${projectId}/characters/${characterId}`, { method: "PATCH", body }),
  archiveCharacter: (projectId: string, characterId: string) => request<Character>(`/projects/${projectId}/characters/${characterId}/archive`, { method: "POST" }),
  deleteCharacter: (projectId: string, characterId: string) => request<void>(`/projects/${projectId}/characters/${characterId}`, { method: "DELETE" }),
  createRelation: (projectId: string, characterId: string, body: { sourceCharacterId: string; targetCharacterId: string; relationType: string; strength: number; narrativeDependency?: string; notes?: string }) => request<CharacterRelation>(`/projects/${projectId}/characters/${characterId}/relations`, { method: "POST", body }),
  createVoiceSample: (projectId: string, characterId: string, body: { label: string; assetPath?: string; voiceNotes?: string }) => request<VoiceSample>(`/projects/${projectId}/characters/${characterId}/voice-samples`, { method: "POST", body }),
  generateCharacterImage: (projectId: string, characterId: string, body: { strategy?: string; style?: string; imageCount?: number; modelKey?: string }) => request<GenerationJob>(`/projects/${projectId}/characters/${characterId}/generate-image`, { method: "POST", body }),
  characterImages: (projectId: string, characterId: string) => request<{ items: CharacterImage[] }>(`/projects/${projectId}/characters/${characterId}/images`),
  projectCharacterImages: (projectId: string) => request<Record<string, CharacterImage[]>>(`/projects/${projectId}/characters/images`),
  deleteCharacterImage: (projectId: string, characterId: string, imageId: string) => request<void>(`/projects/${projectId}/characters/${characterId}/images/${imageId}`, { method: "DELETE" }),
  characterImageUrl: (projectId: string, characterId: string, imageId: string) => `${API_BASE_URL}/api/projects/${projectId}/characters/${characterId}/images/${imageId}/file`,
  generationJob: (projectId: string, jobId: string) => request<GenerationJob>(`/projects/${projectId}/generation/jobs/${jobId}`),
  generationPanelImageUrl: (projectId: string, boardId: string, panelId: string) => `${API_BASE_URL}/api/projects/${projectId}/generation/boards/${boardId}/panels/${panelId}/image`,

  story: (projectId: string) => request<StorySummary>(`/projects/${projectId}/story`),
  references: (projectId: string) => request<StoryReference[]>(`/projects/${projectId}/story/references`),
  createTome: (projectId: string, body: { title: string; synopsis?: string; status?: StoryStatus; orderIndex?: number }) => request<Tome>(`/projects/${projectId}/story/tomes`, { method: "POST", body }),
  updateTome: (projectId: string, tomeId: string, body: Partial<Tome>) => request<Tome>(`/projects/${projectId}/story/tomes/${tomeId}`, { method: "PATCH", body }),
  createChapter: (projectId: string, body: { tomeId: string; title: string; synopsis?: string; status?: StoryStatus; orderIndex?: number }) => request<Chapter>(`/projects/${projectId}/story/chapters`, { method: "POST", body }),
  updateChapter: (projectId: string, chapterId: string, body: Partial<Chapter>) => request<Chapter>(`/projects/${projectId}/story/chapters/${chapterId}`, { method: "PATCH", body }),
  createScene: (projectId: string, body: Partial<Scene> & { tomeId: string; chapterId: string; title: string }) => request<Scene>(`/projects/${projectId}/story/scenes`, { method: "POST", body }),
  updateScene: (projectId: string, sceneId: string, body: Partial<Scene>) => request<Scene>(`/projects/${projectId}/story/scenes/${sceneId}`, { method: "PATCH", body }),
  deleteScene: (projectId: string, sceneId: string) => request<void>(`/projects/${projectId}/story/scenes/${sceneId}`, { method: "DELETE" }),

  assets: (projectId: string) => request<{ items: Asset[] }>(`/projects/${projectId}/assets`),
  asset: (projectId: string, assetId: string) => request<AssetDetail>(`/projects/${projectId}/assets/${assetId}`),
  importAsset: (projectId: string, body: { sourcePath: string; name?: string; description?: string; tagsJson?: string[]; mimeType?: string }) => request<Asset>(`/projects/${projectId}/assets/import`, { method: "POST", body }),
  updateAsset: (projectId: string, assetId: string, body: Partial<Asset>) => request<Asset>(`/projects/${projectId}/assets/${assetId}`, { method: "PATCH", body }),
  archiveAsset: (projectId: string, assetId: string) => request<Asset>(`/projects/${projectId}/assets/${assetId}/archive`, { method: "POST" }),
  deleteAsset: (projectId: string, assetId: string) => request<void>(`/projects/${projectId}/assets/${assetId}`, { method: "DELETE" }),
  createAssetLink: (projectId: string, assetId: string, body: { assetId: string; targetKind: string; targetId: string; note?: string }) => request<AssetLink>(`/projects/${projectId}/assets/${assetId}/links`, { method: "POST", body }),

  warnings: (projectId: string) => request<Warning[]>(`/projects/${projectId}/warnings`),
  scanWarnings: (projectId: string) => request<{ items: Warning[] }>(`/projects/${projectId}/warnings/scan`, { method: "POST" }),
  updateWarning: (projectId: string, warningId: string, body: { status: WarningStatus; note?: string }) => request<Warning>(`/projects/${projectId}/warnings/${warningId}`, { method: "PATCH", body }),

  versions: (projectId: string) => request<Version[]>(`/projects/${projectId}/versions`),
  branches: (projectId: string) => request<VersionBranch[]>(`/projects/${projectId}/versions/branches`),
  createVersion: (projectId: string, body: { branchName?: string; label?: string; summary?: string }) => request<Version>(`/projects/${projectId}/versions`, { method: "POST", body }),
  restoreVersion: (projectId: string, versionId: string, body?: { label?: string; summary?: string }) => request<Version>(`/projects/${projectId}/versions/${versionId}/restore`, { method: "POST", body: body ?? {} }),

  exports: (projectId: string) => request<ExportRecord[]>(`/projects/${projectId}/exports`),
  createExport: (projectId: string, body: { kind: ExportKind; format: ExportFormat; label?: string; summary?: string }) => request<ExportRecord>(`/projects/${projectId}/exports`, { method: "POST", body }),

  generationJobs: (projectId: string) => request<GenerationJob[]>(`/projects/${projectId}/generation/jobs`),
  generationBoards: (projectId: string) => request<GenerationBoard[]>(`/projects/${projectId}/generation/boards`),
  createGenerationJob: (projectId: string, body: { sourceKind: string; sourceId: string; strategy: string; modelKey?: string; mode?: string; selectionIds?: string[]; gridRows?: number; gridCols?: number; imageCount?: number; title?: string; summary?: string }) => request<GenerationJob>(`/projects/${projectId}/generation/jobs`, { method: "POST", body }),
  validateBoard: (projectId: string, boardId: string, body?: { note?: string }) => request<GenerationBoard>(`/projects/${projectId}/generation/boards/${boardId}/validate`, { method: "POST", body: body ?? {} }),
  updatePanel: (projectId: string, boardId: string, panelId: string, body: { status?: string; caption?: string; title?: string }) => request<GenerationPanel>(`/projects/${projectId}/generation/boards/${boardId}/panels/${panelId}`, { method: "PATCH", body }),

  // Scene Generation (Manga)
  sceneGenerationConfigs: (projectId: string, sceneId: string) => request<SceneGenerationConfig[]>(`/projects/${projectId}/story/scenes/${sceneId}/generation-configs`),
  createSceneGenerationConfig: (projectId: string, sceneId: string, body: { name: string; isDefault?: boolean; systemPrompt: string; stylePreset?: string; colorMode?: string; defaultImageCount?: number; allowMultiPage?: boolean; metadataJson?: Record<string, unknown> }) => request<SceneGenerationConfig>(`/projects/${projectId}/story/scenes/${sceneId}/generation-configs`, { method: "POST", body }),
  updateSceneGenerationConfig: (projectId: string, sceneId: string, configId: string, body: Partial<Omit<SceneGenerationConfig, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>>) => request<SceneGenerationConfig>(`/projects/${projectId}/story/scenes/${sceneId}/generation-configs/${configId}`, { method: "PATCH", body }),
  deleteSceneGenerationConfig: (projectId: string, sceneId: string, configId: string) => request<void>(`/projects/${projectId}/story/scenes/${sceneId}/generation-configs/${configId}`, { method: "DELETE" }),
  setDefaultSceneGenerationConfig: (projectId: string, sceneId: string, configId: string) => request<SceneGenerationConfig>(`/projects/${projectId}/story/scenes/${sceneId}/generation-configs/${configId}/set-default`, { method: "POST" }),

  generateSceneManga: (projectId: string, sceneId: string, body: { configId?: string; imageCount?: number; styleOverride?: Record<string, unknown>; characterImageRefs?: Record<string, string>; additionalContext?: string }) => request<{ jobId: string; status: string; message: string }>(`/projects/${projectId}/story/scenes/${sceneId}/generate`, { method: "POST", body }),
  previewScenePrompt: (projectId: string, sceneId: string, body: { configId?: string; characterImageRefs?: Record<string, string>; additionalContext?: string }) => request<PromptPreviewResponse>(`/projects/${projectId}/story/scenes/${sceneId}/preview-prompt`, { method: "POST", body }),

  sceneMangaPages: (projectId: string, sceneId: string) => request<SceneGenerationListResponse>(`/projects/${projectId}/story/scenes/${sceneId}/manga-pages`),
  updateSceneMangaPage: (projectId: string, sceneId: string, pageId: string, body: { label?: string; status?: 'draft' | 'selected' | 'rejected' }) => request<SceneMangaPage>(`/projects/${projectId}/story/scenes/${sceneId}/manga-pages/${pageId}`, { method: "PATCH", body }),
  deleteSceneMangaPage: (projectId: string, sceneId: string, pageId: string) => request<void>(`/projects/${projectId}/story/scenes/${sceneId}/manga-pages/${pageId}`, { method: "DELETE" }),

  fileUrl: (path: string) => `${API_BASE_URL}/api${path}`,
};

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return String(error.detail);
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export function csv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
