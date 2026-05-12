import { formatRelative } from "./format";

const rawBaseUrl = import.meta.env.VITE_KUTI_API_URL?.trim() || "http://localhost:8000";
const apiBaseUrl = normalizeApiBaseUrl(rawBaseUrl);

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export interface BackendHealth {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  dataDir: string;
}

export interface BackendConfig {
  appName: string;
  appVersion: string;
  environment: string;
  locale: string;
  dataDir: string;
  projectDataDir: string;
  exportsDir: string;
  openapiUrl: string;
}

export interface BackendStatus {
  health: BackendHealth;
  config: BackendConfig;
  models: BackendModelProvider[];
}

export interface BackendModelProvider {
  key: string;
  kind: string;
  display_name: string;
  base_url: string | null;
  enabled: boolean;
  configured: boolean;
  has_api_key: boolean;
}

interface ProjectRead {
  id: string;
  name: string;
  slug: string;
  status: string;
  root_path: string;
  settings_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
  archived_at: string | null;
}

interface ProjectListResponse {
  items: ProjectRead[];
}

interface CharacterRead {
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
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface CharacterRelationRead {
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
}

interface VoiceSampleRead {
  id: string;
  project_id: string;
  character_id: string;
  asset_path: string | null;
  label: string;
  voice_notes: string;
  created_at: string;
}

interface CharacterDetail extends CharacterRead {
  relationships_summary: string | null;
  relations: CharacterRelationRead[];
  voice_samples: VoiceSampleRead[];
}

interface CharacterListResponse {
  items: CharacterRead[];
}

interface TomeRead {
  id: string;
  project_id: string;
  title: string;
  slug: string;
  synopsis: string;
  status: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface ChapterRead {
  id: string;
  project_id: string;
  tome_id: string;
  title: string;
  slug: string;
  synopsis: string;
  status: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface SceneRead {
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
  status: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface StoryReferenceRead {
  id: string;
  project_id: string;
  scene_id: string;
  reference_kind: string;
  target_slug: string;
  raw_token: string;
  created_at: string;
}

interface StoryOrphanReferenceRead {
  reference: StoryReferenceRead;
  reason: string;
}

interface StorySummaryResponse {
  tomes: TomeRead[];
  chapters: ChapterRead[];
  scenes: SceneRead[];
  orphan_references: StoryOrphanReferenceRead[];
}

interface AssetRead {
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
  status: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface AssetLinkRead {
  id: string;
  project_id: string;
  asset_id: string;
  target_kind: string;
  target_id: string;
  note: string;
  created_at: string;
}

interface AssetDetail extends AssetRead {
  links: AssetLinkRead[];
}

interface AssetListResponse {
  items: AssetRead[];
}

interface WarningRead {
  id: string;
  project_id: string;
  fingerprint: string;
  kind: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  entity_kind: string;
  entity_id: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface VersionRead {
  id: string;
  project_id: string;
  branch_name: string;
  version_index: number;
  label: string;
  summary: string;
  created_at: string;
}

interface ExportRead {
  id: string;
  project_id: string;
  kind: string;
  format: string;
  status: string;
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
}

interface GenerationStepRead {
  id: string;
  job_id: string;
  order_index: number;
  title: string;
  status: string;
  prompt: string;
  output_text: string;
  artifact_path: string | null;
  artifact_name: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
}

interface GenerationBoardPanelRead {
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
}

interface GenerationBoardRead {
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
  panels: GenerationBoardPanelRead[];
}

interface GenerationJobRead {
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
  steps: GenerationStepRead[];
  board: GenerationBoardRead | null;
}

interface GenerationJobsResponse {
  items: GenerationJobRead[];
}

interface GenerationBoardsResponse {
  items: GenerationBoardRead[];
}

export interface ProjectStats {
  characters: number;
  scenes: number;
  assets: number;
  warnings: number;
  jobs: number;
  versions: number;
}

export interface ProjectCard {
  id: string;
  slug: string;
  name: string;
  status: "active" | "draft" | "maintenance" | "archived";
  accent: string;
  language: string;
  summary: string;
  settingsJson: Record<string, unknown>;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
  lastUpdated: string;
  lastOpenedAt: string | null;
  archivedAt: string | null;
  lastActivity: string;
  progress: number;
  stats: ProjectStats;
  activity: string[];
}

export interface CharacterCard {
  id: string;
  name: string;
  alias: string;
  role: string;
  status: "draft" | "active" | "review" | "archived";
  summary: string;
  personality: string;
  arc: string;
  tags: string[];
  voice: string;
  palette: string;
  relations: Array<{ target: string; type: string; intensity: number }>;
  scenes: string[];
  assets: string[];
}

export interface SceneCard {
  id: string;
  title: string;
  tome: string;
  chapter: string;
  status: "draft" | "active" | "review" | "archived";
  summary: string;
  intention: string;
  location: string;
  duration: string;
  tone: string;
  pace: string;
  characters: string[];
  notes: string;
  references: Array<{ kind: "chara" | "environment" | "file" | "scene"; value: string; valid: boolean }>;
}

export interface AssetCard {
  id: string;
  name: string;
  kind: string;
  status: "draft" | "active" | "review" | "archived";
  size: string;
  updatedAt: string;
  usage: string[];
  tags: string[];
}

export interface WarningCard {
  id: string;
  title: string;
  type: string;
  status: "open" | "resolved";
  severity: "low" | "medium" | "high";
  source: string;
  note: string;
}

export interface JobCard {
  id: string;
  label: string;
  kind: string;
  status: "running" | "failed" | "done";
  progress: number;
  step: string;
  model: string;
  updatedAt: string;
}

export interface ExportCard {
  id: string;
  kind: "work" | "publication";
  format: "json" | "tree" | "zip";
  status: "ready" | "running" | "failed" | "obsolete";
  label: string;
  createdAt: string;
  manifest: string;
}

export interface VersionCard {
  id: string;
  label: string;
  branch: string;
  summary: string;
  createdAt: string;
  status: "active" | "archived";
}

export interface ProjectWorkspace extends ProjectCard {
  backend: BackendStatus | null;
  story: StorySummaryResponse;
  jobs: JobCard[];
  warnings: WarningCard[];
  versions: VersionCard[];
  exports: ExportCard[];
  characters: CharacterCard[];
  scenes: SceneCard[];
  assets: AssetCard[];
}

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function hashAccent(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const hue = hash % 360;
  const saturation = 64;
  const lightness = 52;
  return hslToHex(hue, saturation, lightness);
}

function hslToHex(h: number, s: number, l: number) {
  const saturation = s / 100;
  const lightness = l / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (value: number) => {
    const channel = Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");
    return channel;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toProjectStatus(value: string): ProjectCard["status"] {
  if (value === "active" || value === "draft" || value === "maintenance" || value === "archived") {
    return value;
  }

  return "draft";
}

function toCharacterStatus(value: string): CharacterCard["status"] {
  if (value === "active" || value === "draft" || value === "review" || value === "archived") {
    return value;
  }

  return "draft";
}

function toStoryStatus(value: string): SceneCard["status"] {
  if (value === "active" || value === "draft" || value === "review" || value === "archived") {
    return value;
  }

  return "draft";
}

function toSeverity(value: string): WarningCard["severity"] {
  if (value === "critical") {
    return "high";
  }

  if (value === "warning") {
    return "medium";
  }

  return "low";
}

function toWarningStatus(value: string): WarningCard["status"] {
  return value === "resolved" ? "resolved" : "open";
}

function toJobStatus(value: string): JobCard["status"] {
  if (value === "failed") {
    return "failed";
  }

  if (value === "ready" || value === "validated" || value === "running" || value === "pending") {
    return value === "running" ? "running" : "done";
  }

  return "done";
}

function toExportStatus(value: string, isLatest: boolean): ExportCard["status"] {
  if (value === "failed") {
    return "failed";
  }

  if (value === "pending") {
    return "running";
  }

  if (!isLatest && value === "ready") {
    return "obsolete";
  }

  return value === "ready" ? "ready" : "running";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => typeof value === "string" && Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString();
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }

    throw new ApiError(`Request failed for ${path}`, response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

function unwrapItems<T>(value: T[] | { items: T[] }) {
  return Array.isArray(value) ? value : value.items;
}

function readProjectMetadata(project: ProjectRead) {
  const settings = asRecord(project.settings_json);
  const locale = asString(settings.locale, asString(settings.language, "en"));
  const summary = asString(settings.summary, asString(settings.description, `${project.name} workspace`));
  const accent = asString(settings.accent, hashAccent(project.slug));

  return { locale, summary, accent };
}

function buildProjectStats(
  characters: CharacterCard[],
  story: StorySummaryResponse,
  assets: AssetCard[],
  warnings: WarningCard[],
  jobs: JobCard[],
  versions: VersionCard[],
) {
  return {
    characters: characters.length,
    scenes: story.scenes.length,
    assets: assets.length,
    warnings: warnings.length,
    jobs: jobs.length,
    versions: versions.length,
  } satisfies ProjectStats;
}

function buildProjectProgress(stats: ProjectStats, project: ProjectRead) {
  if (project.status === "archived") {
    return 100;
  }

  const weighted = stats.characters * 3 + stats.scenes * 2 + stats.assets + stats.versions * 2 + Math.max(0, 8 - stats.warnings) + stats.jobs * 2;
  return Math.max(12, Math.min(100, weighted));
}

function buildActivity(project: ProjectRead, jobs: JobCard[], warnings: WarningCard[], versions: VersionCard[], exports: ExportCard[]) {
  const activity = [
    `Project ${project.status} · updated ${formatRelative(project.updated_at)}`,
    jobs.length > 0 ? `${jobs.filter((job) => job.status === "running").length} generation job(s) running` : "No generation jobs queued",
    warnings.length > 0 ? `${warnings.filter((warning) => warning.status === "open").length} warning(s) open` : "No active warnings",
  ];

  const latestVersion = versions[0];
  if (latestVersion) {
    activity.push(`Latest version ${latestVersion.label} on ${latestVersion.branch} · ${formatRelative(latestVersion.createdAt)}`);
  }

  const latestExport = exports[0];
  if (latestExport) {
    activity.push(`Latest export ${latestExport.label} · ${latestExport.status}`);
  }

  return activity.slice(0, 4);
}

async function loadProjectCards(project: ProjectRead, backend: BackendStatus | null): Promise<ProjectWorkspace> {
  const [charactersResponse, story, assetsResponse, warnings, versions, exportsResponse, jobsResponse] = await Promise.all([
    requestJson<CharacterListResponse | CharacterRead[]>(`/projects/${project.id}/characters`),
    requestJson<StorySummaryResponse>(`/projects/${project.id}/story`),
    requestJson<AssetListResponse | AssetRead[]>(`/projects/${project.id}/assets`),
    requestJson<WarningRead[]>(`/projects/${project.id}/warnings`),
    requestJson<VersionRead[]>(`/projects/${project.id}/versions`),
    requestJson<ExportRead[]>(`/projects/${project.id}/exports`),
    requestJson<GenerationJobsResponse>(`/projects/${project.id}/generation/jobs`),
  ]);

  const charactersBase = unwrapItems(charactersResponse);
  const tomes = story.tomes;
  const chapters = story.chapters;
  const scenes = story.scenes;

  const [characterDetails, assetDetails] = await Promise.all([
    Promise.all(charactersBase.map((character) => requestJson<CharacterDetail>(`/projects/${project.id}/characters/${character.id}`))),
    Promise.all(unwrapItems(assetsResponse).map((asset) => requestJson<AssetDetail>(`/projects/${project.id}/assets/${asset.id}`))),
  ]);

  const characterLookup = new Map(characterDetails.map((character) => [character.id, character]));
  const assetLookup = new Map(assetDetails.map((asset) => [asset.id, asset]));
  const relatedCharactersById = new Map<string, string>();
  characterDetails.forEach((character) => {
    relatedCharactersById.set(character.id, character.name);
  });

  const referenceIds = new Set(story.orphan_references.map((orphan) => orphan.reference.id));
  const referencesResponse = await requestJson<StoryReferenceRead[]>(`/projects/${project.id}/story/references`);
  const referencesByScene = new Map<string, SceneCard["references"]>();
  referencesResponse.forEach((reference) => {
    const current = referencesByScene.get(reference.scene_id) ?? [];
    current.push({
      kind: reference.reference_kind === "character" ? "chara" : reference.reference_kind === "tome" || reference.reference_kind === "chapter" ? "scene" : reference.reference_kind === "scene" ? "scene" : "file",
      value: reference.target_slug,
      valid: !referenceIds.has(reference.id),
    });
    referencesByScene.set(reference.scene_id, current);
  });

  const chapterTitleById = new Map(chapters.map((chapter) => [chapter.id, chapter.title]));
  const tomeTitleById = new Map(tomes.map((tome) => [tome.id, tome.title]));

  const characters: CharacterCard[] = characterDetails.map((character) => {
    const relatedAssetIds = assetDetails
      .filter((asset) => asset.links.some((link) => link.target_kind === "character" && link.target_id === character.id))
      .map((asset) => asset.slug);

    const sceneNames = scenes
      .filter((scene) => scene.characters_json.some((value) => value.toLowerCase() === character.slug.toLowerCase() || value.toLowerCase() === character.name.toLowerCase()))
      .map((scene) => scene.slug);

    return {
      id: character.id,
      name: character.name,
      alias: character.alias ?? character.name,
      role: character.narrative_role ?? "Character",
      status: toCharacterStatus(character.status),
      summary: character.description || character.physical_description || character.personality || character.name,
      personality: character.personality || "",
      arc: character.narrative_arc || "",
      tags: character.tags_json,
      voice: characterDetailVoice(character),
      palette: character.color_palette_json.join(", "),
      relations: character.relations.map((relation) => ({
        target: relatedCharactersById.get(relation.target_character_id) ?? relation.target_character_id,
        type: relation.relation_type,
        intensity: relation.strength,
      })),
      scenes: sceneNames,
      assets: relatedAssetIds,
    };
  });

  const assetCards: AssetCard[] = assetDetails.map((asset) => ({
    id: asset.id,
    name: asset.name,
    kind: asset.mime_type,
    status: asset.status === "archived" ? "archived" : "active",
    size: formatBytes(asset.size_bytes),
    updatedAt: asset.updated_at,
    usage: asset.links.map((link) => link.note || `${link.target_kind}:${link.target_id}`),
    tags: asset.tags_json,
  }));

  const warningsCards: WarningCard[] = warnings.map((warning) => ({
    id: warning.id,
    title: warning.title,
    type: warning.kind,
    status: toWarningStatus(warning.status),
    severity: toSeverity(warning.severity),
    source: `${warning.entity_kind}:${warning.entity_id}`,
    note: warning.metadata_json?.note ? String(warning.metadata_json.note) : warning.message,
  }));

  const versionsSorted = [...versions].sort((a, b) => b.version_index - a.version_index || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const versionCards: VersionCard[] = versionsSorted.map((version, index) => ({
    id: version.id,
    label: version.label,
    branch: version.branch_name,
    summary: version.summary,
    createdAt: version.created_at,
    status: index === 0 ? "active" : "archived",
  }));

  const exportsSorted = [...exportsResponse].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const exportCards: ExportCard[] = exportsSorted.map((item, index) => ({
    id: item.id,
    kind: item.kind as ExportCard["kind"],
    format: item.format as ExportCard["format"],
    status: toExportStatus(item.status, index === 0),
    label: item.label,
    createdAt: item.created_at,
    manifest: item.artifact_name ?? item.metadata_json.manifest_name?.toString?.() ?? item.artifact_path?.split("/").pop() ?? item.label,
  }));

  const jobsCards: JobCard[] = jobsResponse.items.map((job) => ({
    id: job.id,
    label: job.title || job.source_label,
    kind: `${job.source_kind} · ${job.strategy}`,
    status: toJobStatus(job.status),
    progress: job.progress,
    step: job.steps[0]?.title || job.summary || job.source_label,
    model: job.model_name || job.model_key || job.entrypoint,
    updatedAt: job.updated_at,
  }));

  const stats = buildProjectStats(characters, story, assetCards, warningsCards, jobsCards, versionCards);
  const activity = buildActivity(project, jobsCards, warningsCards, versionCards, exportCards);
  const lastActivity = latestTimestamp([
    project.updated_at,
    project.last_opened_at,
    ...characterDetails.map((character) => character.updated_at),
    ...story.scenes.map((scene) => scene.updated_at),
    ...assetDetails.map((asset) => asset.updated_at),
    ...warnings.map((warning) => warning.updated_at),
    ...jobsResponse.items.map((job) => job.updated_at),
    ...versions.map((version) => version.created_at),
    ...exportsResponse.map((item) => item.updated_at),
  ]);

  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    status: toProjectStatus(project.status),
    accent: readProjectMetadata(project).accent,
    language: readProjectMetadata(project).locale,
    summary: readProjectMetadata(project).summary,
    settingsJson: project.settings_json,
    rootPath: project.root_path,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    lastUpdated: project.updated_at,
    lastOpenedAt: project.last_opened_at,
    archivedAt: project.archived_at,
    lastActivity,
    progress: buildProjectProgress(stats, project),
    stats,
    activity,
    backend,
    story,
    jobs: jobsCards,
    warnings: warningsCards,
    versions: versionCards,
    exports: exportCards,
    characters,
    scenes: scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      tome: tomeTitleById.get(scene.tome_id) ?? scene.tome_id,
      chapter: chapterTitleById.get(scene.chapter_id) ?? scene.chapter_id,
      status: toStoryStatus(scene.status),
      summary: scene.summary || scene.content || scene.notes || scene.title,
      intention: scene.summary || scene.title,
      location: scene.location || "Unknown",
      duration: `${Math.max(2, Math.round(Math.max(scene.content.length, 1) / 800))}m`,
      tone: scene.scene_type || "neutral",
      pace: scene.content.length > 1200 ? "fast" : scene.content.length > 500 ? "measured" : "slow",
      characters: scene.characters_json,
      notes: scene.notes,
      references: referencesByScene.get(scene.id) ?? [],
    })),
    assets: assetCards,
  };
}

function characterDetailVoice(character: CharacterDetail) {
  const sample = character.voice_samples[0];
  if (!sample) {
    return character.alias ?? character.name;
  }

  return sample.label || sample.voice_notes || character.alias || character.name;
}

export async function getBackendStatus(): Promise<BackendStatus> {
  const [health, config, models] = await Promise.all([
    requestJson<BackendHealth>("/health"),
    requestJson<BackendConfig>("/config"),
    requestJson<BackendModelProvider[]>("/models"),
  ]);

  return { health, config, models };
}

export async function getProjects(): Promise<ProjectWorkspace[]> {
  const response = await requestJson<ProjectListResponse | ProjectRead[]>("/projects");
  const projects = unwrapItems(response);
  const backend = await getBackendStatus().catch(() => null);
  return Promise.all(projects.map((project) => loadProjectCards(project, backend)));
}

export async function getProject(projectId: string): Promise<ProjectWorkspace> {
  const project = await requestJson<ProjectRead>(`/projects/${projectId}`);
  const backend = await getBackendStatus().catch(() => null);
  return loadProjectCards(project, backend);
}

export async function getHubSummary() {
  const projects = await getProjects();
  return {
    projects: projects.length,
    activeProjects: projects.filter((project) => project.status === "active").length,
    warnings: projects.reduce((total, project) => total + project.warnings.filter((warning) => warning.status === "open").length, 0),
    runningJobs: projects.reduce((total, project) => total + project.jobs.filter((job) => job.status === "running").length, 0),
  };
}

export async function createProject(payload: { name: string; settings_json?: Record<string, unknown>; status?: ProjectCard["status"] }) {
  return requestJson<ProjectRead>("/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateProject(projectId: string, payload: { name?: string; status?: ProjectCard["status"]; settings_json?: Record<string, unknown> | null }) {
  return requestJson<ProjectRead>(`/projects/${projectId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function archiveProject(projectId: string) {
  return requestJson<ProjectRead>(`/projects/${projectId}/archive`, {
    method: "POST",
  });
}

export async function importAsset(
  projectId: string,
  payload: {
    source_path: string;
    name?: string | null;
    slug?: string | null;
    description?: string;
    tags_json?: string[];
    mime_type?: string | null;
  },
) {
  return requestJson<AssetRead>(`/projects/${projectId}/assets/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function createScene(
  projectId: string,
  payload: {
    tome_id: string;
    chapter_id: string;
    title: string;
    slug?: string | null;
    scene_type?: string;
    location?: string;
    summary?: string;
    content?: string;
    notes?: string;
    characters_json?: string[];
    tags_json?: string[];
    status?: string;
    order_index?: number;
  },
) {
  return requestJson<SceneRead>(`/projects/${projectId}/story/scenes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function createGenerationJob(
  projectId: string,
  payload: {
    source_kind: "scene" | "chapter" | "tome" | "panel";
    source_id: string;
    source_version_id?: string | null;
    strategy?: string;
    model_key?: string | null;
    mode?: string;
    selection_ids?: string[];
    grid_rows?: number | null;
    grid_cols?: number | null;
    image_count?: number | null;
    title?: string | null;
    summary?: string;
  },
) {
  return requestJson<GenerationJobRead>(`/projects/${projectId}/generation/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function createExport(
  projectId: string,
  payload: {
    kind?: "work" | "publication";
    format?: "json" | "tree" | "zip";
    label?: string | null;
    summary?: string;
  },
) {
  return requestJson<ExportRead>(`/projects/${projectId}/exports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function scanProjectWarnings(projectId: string) {
  return requestJson<unknown>(`/projects/${projectId}/warnings/scan`, {
    method: "POST",
  });
}

export async function restoreVersion(projectId: string, versionId: string) {
  return requestJson<VersionRead>(`/projects/${projectId}/versions/${versionId}/restore`, {
    method: "POST",
  });
}
