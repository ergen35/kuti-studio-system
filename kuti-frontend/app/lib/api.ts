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
  root_path: string;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  archived_at: string | null;
};

export type ProjectListResponse = { items: Project[] };

export type Character = {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  alias: string | null;
  narrative_role: string | null;
  description: string;
  physical_description: string;
  color_palette_json: string[];
  costume_elements_json: string[];
  key_traits_json: string[];
  personality: string;
  narrative_arc: string;
  tags_json: string[];
  status: CharacterStatus;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CharacterRelation = {
  id: string;
  project_id: string;
  source_character_id: string;
  target_character_id: string;
  relation_type: string;
  strength: number;
  narrative_dependency: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type VoiceSample = {
  id: string;
  project_id: string;
  character_id: string;
  asset_path: string | null;
  label: string;
  voice_notes: string;
  created_at: string;
};

export type CharacterDetail = Character & {
  relationships_summary: string | null;
  relations: CharacterRelation[];
  voice_samples: VoiceSample[];
};

export type Tome = {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  synopsis: string;
  status: StoryStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type Chapter = {
  id: string;
  project_id: string;
  tome_id: string;
  title: string;
  slug: string;
  synopsis: string;
  status: StoryStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type Scene = {
  id: string;
  project_id: string;
  tome_id: string;
  chapter_id: string;
  title: string;
  slug: string;
  scene_type: string;
  location: string;
  summary: string;
  content: string;
  notes: string;
  characters_json: string[];
  tags_json: string[];
  status: StoryStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type StoryReference = {
  id: string;
  project_id: string;
  scene_id: string;
  reference_kind: string;
  target_slug: string;
  raw_token: string;
  created_at: string;
};

export type StorySummary = {
  tomes: Tome[];
  chapters: Chapter[];
  scenes: Scene[];
  orphan_references: { reference: StoryReference; reason: string }[];
};

export type Asset = {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  original_filename: string;
  mime_type: string;
  checksum: string;
  size_bytes: number;
  storage_path: string;
  description: string;
  tags_json: string[];
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type AssetLink = {
  id: string;
  project_id: string;
  asset_id: string;
  target_kind: string;
  target_id: string;
  note: string;
  created_at: string;
};

export type AssetDetail = Asset & { links: AssetLink[] };

export type Warning = {
  id: string;
  project_id: string;
  fingerprint: string;
  kind: string;
  severity: WarningSeverity;
  status: WarningStatus;
  title: string;
  message: string;
  entity_kind: string;
  entity_id: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type Version = {
  id: string;
  project_id: string;
  branch_name: string;
  version_index: number;
  label: string;
  summary: string;
  created_at: string;
};

export type VersionBranch = {
  branch_name: string;
  version_count: number;
  latest_version_id: string | null;
  latest_created_at: string | null;
};

export type ExportRecord = {
  id: string;
  project_id: string;
  kind: ExportKind;
  format: ExportFormat;
  status: "pending" | "ready" | "failed";
  label: string;
  summary: string;
  artifact_path: string | null;
  artifact_name: string | null;
  metadata_json: Record<string, unknown>;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
};

export type ModelProvider = {
  key: string;
  kind: string;
  display_name: string;
  base_url: string | null;
  enabled: boolean;
  configured: boolean;
  has_api_key: boolean;
};

export type GenerationPanel = {
  id: string;
  board_id: string;
  step_id: string | null;
  order_index: number;
  title: string;
  caption: string;
  prompt: string;
  status: string;
  image_path: string;
  image_name: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type GenerationBoard = {
  id: string;
  project_id: string;
  job_id: string;
  source_kind: string;
  strategy: string;
  title: string;
  summary: string;
  status: string;
  artifact_path: string | null;
  artifact_name: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
  panels: GenerationPanel[];
};

export type GenerationJob = {
  id: string;
  project_id: string;
  source_kind: string;
  source_id: string;
  source_label: string;
  source_version_id: string | null;
  strategy: string;
  model_key: string | null;
  model_name: string | null;
  model_kind: string | null;
  entrypoint: string;
  title: string;
  prompt: string;
  summary: string;
  status: string;
  progress: number;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  board: GenerationBoard | null;
};

export const api = {
  health: () => request<Record<string, unknown>>("/health"),
  models: () => request<ModelProvider[]>("/models"),
  projects: () => request<ProjectListResponse>("/projects"),
  createProject: (body: { name: string; status?: ProjectStatus; settings_json?: Record<string, unknown> }) => request<Project>("/projects", { method: "POST", body }),
  project: (projectId: string) => request<Project>(`/projects/${projectId}`),
  updateProject: (projectId: string, body: Partial<Pick<Project, "name" | "status" | "settings_json">>) => request<Project>(`/projects/${projectId}`, { method: "PATCH", body }),
  openProject: (projectId: string) => request<Project>(`/projects/${projectId}/open`, { method: "POST" }),
  archiveProject: (projectId: string) => request<Project>(`/projects/${projectId}/archive`, { method: "POST" }),
  cloneProject: (projectId: string, body: { name?: string }) => request<Project>(`/projects/${projectId}/clone`, { method: "POST", body }),

  characters: (projectId: string) => request<{ items: Character[] }>(`/projects/${projectId}/characters`),
  character: (projectId: string, characterId: string) => request<CharacterDetail>(`/projects/${projectId}/characters/${characterId}`),
  createCharacter: (projectId: string, body: Partial<Character> & { name: string }) => request<Character>(`/projects/${projectId}/characters`, { method: "POST", body }),
  updateCharacter: (projectId: string, characterId: string, body: Partial<Character>) => request<Character>(`/projects/${projectId}/characters/${characterId}`, { method: "PATCH", body }),
  archiveCharacter: (projectId: string, characterId: string) => request<Character>(`/projects/${projectId}/characters/${characterId}/archive`, { method: "POST" }),
  deleteCharacter: (projectId: string, characterId: string) => request<void>(`/projects/${projectId}/characters/${characterId}`, { method: "DELETE" }),
  createRelation: (projectId: string, characterId: string, body: { source_character_id: string; target_character_id: string; relation_type: string; strength: number; narrative_dependency?: string; notes?: string }) => request<CharacterRelation>(`/projects/${projectId}/characters/${characterId}/relations`, { method: "POST", body }),
  createVoiceSample: (projectId: string, characterId: string, body: { label: string; asset_path?: string; voice_notes?: string }) => request<VoiceSample>(`/projects/${projectId}/characters/${characterId}/voice-samples`, { method: "POST", body }),

  story: (projectId: string) => request<StorySummary>(`/projects/${projectId}/story`),
  references: (projectId: string) => request<StoryReference[]>(`/projects/${projectId}/story/references`),
  createTome: (projectId: string, body: { title: string; synopsis?: string; status?: StoryStatus; order_index?: number }) => request<Tome>(`/projects/${projectId}/story/tomes`, { method: "POST", body }),
  updateTome: (projectId: string, tomeId: string, body: Partial<Tome>) => request<Tome>(`/projects/${projectId}/story/tomes/${tomeId}`, { method: "PATCH", body }),
  createChapter: (projectId: string, body: { tome_id: string; title: string; synopsis?: string; status?: StoryStatus; order_index?: number }) => request<Chapter>(`/projects/${projectId}/story/chapters`, { method: "POST", body }),
  createScene: (projectId: string, body: Partial<Scene> & { tome_id: string; chapter_id: string; title: string }) => request<Scene>(`/projects/${projectId}/story/scenes`, { method: "POST", body }),
  updateScene: (projectId: string, sceneId: string, body: Partial<Scene>) => request<Scene>(`/projects/${projectId}/story/scenes/${sceneId}`, { method: "PATCH", body }),
  deleteScene: (projectId: string, sceneId: string) => request<void>(`/projects/${projectId}/story/scenes/${sceneId}`, { method: "DELETE" }),

  assets: (projectId: string) => request<{ items: Asset[] }>(`/projects/${projectId}/assets`),
  asset: (projectId: string, assetId: string) => request<AssetDetail>(`/projects/${projectId}/assets/${assetId}`),
  importAsset: (projectId: string, body: { source_path: string; name?: string; description?: string; tags_json?: string[]; mime_type?: string }) => request<Asset>(`/projects/${projectId}/assets/import`, { method: "POST", body }),
  updateAsset: (projectId: string, assetId: string, body: Partial<Asset>) => request<Asset>(`/projects/${projectId}/assets/${assetId}`, { method: "PATCH", body }),
  archiveAsset: (projectId: string, assetId: string) => request<Asset>(`/projects/${projectId}/assets/${assetId}/archive`, { method: "POST" }),
  deleteAsset: (projectId: string, assetId: string) => request<void>(`/projects/${projectId}/assets/${assetId}`, { method: "DELETE" }),
  createAssetLink: (projectId: string, assetId: string, body: { asset_id: string; target_kind: string; target_id: string; note?: string }) => request<AssetLink>(`/projects/${projectId}/assets/${assetId}/links`, { method: "POST", body }),

  warnings: (projectId: string) => request<Warning[]>(`/projects/${projectId}/warnings`),
  scanWarnings: (projectId: string) => request<{ items: Warning[] }>(`/projects/${projectId}/warnings/scan`, { method: "POST" }),
  updateWarning: (projectId: string, warningId: string, body: { status: WarningStatus; note?: string }) => request<Warning>(`/projects/${projectId}/warnings/${warningId}`, { method: "PATCH", body }),

  versions: (projectId: string) => request<Version[]>(`/projects/${projectId}/versions`),
  branches: (projectId: string) => request<VersionBranch[]>(`/projects/${projectId}/versions/branches`),
  createVersion: (projectId: string, body: { branch_name?: string; label?: string; summary?: string }) => request<Version>(`/projects/${projectId}/versions`, { method: "POST", body }),
  restoreVersion: (projectId: string, versionId: string, body?: { label?: string; summary?: string }) => request<Version>(`/projects/${projectId}/versions/${versionId}/restore`, { method: "POST", body: body ?? {} }),

  exports: (projectId: string) => request<ExportRecord[]>(`/projects/${projectId}/exports`),
  createExport: (projectId: string, body: { kind: ExportKind; format: ExportFormat; label?: string; summary?: string }) => request<ExportRecord>(`/projects/${projectId}/exports`, { method: "POST", body }),

  generationJobs: (projectId: string) => request<GenerationJob[]>(`/projects/${projectId}/generation/jobs`),
  generationBoards: (projectId: string) => request<GenerationBoard[]>(`/projects/${projectId}/generation/boards`),
  createGenerationJob: (projectId: string, body: { source_kind: string; source_id: string; strategy: string; model_key?: string; mode?: string; selection_ids?: string[]; grid_rows?: number; grid_cols?: number; image_count?: number; title?: string; summary?: string }) => request<GenerationJob>(`/projects/${projectId}/generation/jobs`, { method: "POST", body }),
  validateBoard: (projectId: string, boardId: string, body?: { note?: string }) => request<GenerationBoard>(`/projects/${projectId}/generation/boards/${boardId}/validate`, { method: "POST", body: body ?? {} }),
  updatePanel: (projectId: string, boardId: string, panelId: string, body: { status?: string; caption?: string; title?: string }) => request<GenerationPanel>(`/projects/${projectId}/generation/boards/${boardId}/panels/${panelId}`, { method: "PATCH", body }),

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
