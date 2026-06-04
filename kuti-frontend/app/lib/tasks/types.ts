import type {
  CreateGenerationJobResponse,
  GetGenerationJobResponse,
  GetGenerationBoardResponse,
  ListWarningsResponse,
} from "~/lib/backend";

export type TaskStatus =
  | "pending"
  | "running"
  | "ready"
  | "validated"
  | "failed";
export type SourceKind =
  | "tome"
  | "chapter"
  | "scene"
  | "panel"
  | "custom"
  | "character";
export type TaskType = "technical" | "editorial";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface TaskSourceEntity {
  kind: SourceKind;
  id: string;
  label?: string;
  href?: string | null;
}

// Job from API
export type GenerationJob = CreateGenerationJobResponse;
export type WarningRecord = ListWarningsResponse[number];

// Extended job with hierarchy info
export interface TaskWithHierarchy {
  job: GenerationJob;
  children?: TaskChild[];
  hierarchyProgress?: HierarchyProgress;
}

// Child task in hierarchy
export interface TaskChild {
  id: string;
  sourceKind: "scene" | "panel" | "chapter";
  title: string;
  status: TaskStatus;
  progress: number;
  boardId?: string;
  createdAt: string;
  updatedAt?: string;
  errorMessage?: string | null;
}

// Progress info for hierarchical tasks
export interface HierarchyProgress {
  completed: number;
  total: number;
  percentage: number;
  label: string; // e.g., "2/8 scènes générées"
}

// Filter state
export interface TaskFilters {
  searchQuery: string;
  statuses: TaskStatus[];
  sourceKinds: SourceKind[];
}

// Board with panels (for scene-level generation)
export type GenerationBoard = GetGenerationBoardResponse;

// Extended task item for UI
export interface TaskItem {
  id: string;
  title: string;
  status: TaskStatus;
  taskType: TaskType;
  priority: TaskPriority;
  sourceKind: SourceKind;
  progress: number;
  createdAt: string;
  updatedAt?: string;
  sourceLabel?: string;
  sourceId?: string;
  sourceEntity?: TaskSourceEntity;
  description?: string;
  errorMessage?: string | null;
  children?: TaskItem[];
  hierarchyProgress?: HierarchyProgress;
}

// Extended task with step/timing info
export interface TaskDetail extends TaskItem {
  currentStep?: string;
  stepNumber?: number;
  totalSteps?: number;
  startedAt?: string;
  elapsedTime?: string; // formatted: "2m 34s"
  estimatedRemaining?: string;
  logs?: string[];
  canStop: boolean;
  canRelaunch: boolean;
}

export function getTaskTypeLabel(type: TaskType): string {
  switch (type) {
    case "technical":
      return "Technique";
    case "editorial":
      return "Éditorial";
    default:
      return type;
  }
}

export function getTaskPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case "low":
      return "Faible";
    case "medium":
      return "Moyenne";
    case "high":
      return "Élevée";
    case "critical":
      return "Critique";
    default:
      return priority;
  }
}

export function getTaskTypeTone(type: TaskType): string {
  return type === "editorial" ? "storyline" : "generation";
}

export function getTaskPriorityTone(priority: TaskPriority): string {
  switch (priority) {
    case "low":
      return "info";
    case "medium":
      return "warning";
    case "high":
      return "warning";
    case "critical":
      return "critical";
    default:
      return "info";
  }
}

export function mapWarningSeverityToTaskStatus(
  severity: "info" | "warning" | "critical",
): TaskStatus {
  switch (severity) {
    case "critical":
      return "failed";
    case "warning":
      return "pending";
    case "info":
      return "ready";
    default:
      return "pending";
  }
}

export function mapWarningSeverityToTaskPriority(
  severity: "info" | "warning" | "critical",
): TaskPriority {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "high";
    case "info":
      return "medium";
    default:
      return "medium";
  }
}

function readMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function resolveWarningSourceLabel(warning: WarningRecord): string {
  const metadata = warning.metadataJson as Record<string, unknown>;

  if (warning.entityKind === "character") {
    return readMetadataString(metadata, "characterName") ?? warning.title;
  }

  if (warning.entityKind === "scene") {
    return readMetadataString(metadata, "sceneTitle") ?? warning.title;
  }

  return warning.title;
}

function resolveWarningSourceEntity(warning: WarningRecord): TaskSourceEntity {
  return {
    kind: warning.entityKind as SourceKind,
    id: warning.entityId,
    label: resolveWarningSourceLabel(warning),
  };
}

export function warningToTaskItem(warning: WarningRecord): TaskItem {
  const sourceLabel = resolveWarningSourceLabel(warning);

  return {
    id: `warning-${warning.id}`,
    title: warning.title,
    status: mapWarningSeverityToTaskStatus(warning.severity),
    taskType: "editorial",
    priority: mapWarningSeverityToTaskPriority(warning.severity),
    sourceKind: warning.entityKind as SourceKind,
    progress: warning.status === "open" ? 0 : 100,
    createdAt: warning.createdAt,
    updatedAt: warning.updatedAt,
    sourceLabel,
    sourceId: warning.entityId,
    sourceEntity: resolveWarningSourceEntity(warning),
    description: warning.message,
    errorMessage: null,
  };
}

// API types for stop/relaunch
export interface StopTaskRequest {
  projectId: string;
  jobId: string;
}

export interface RelaunchTaskRequest {
  projectId: string;
  jobId: string;
}

export interface TaskActionResponse {
  success: boolean;
  message: string;
  jobId: string;
}

// Calculate elapsed time
export function formatElapsedTime(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diff = now - start;

  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds}s`;
}

// Map sourceKind to icon name
export const SOURCE_KIND_ICONS: Record<SourceKind, string> = {
  tome: "BookOpen",
  chapter: "Book",
  scene: "FileText",
  panel: "PanelTop",
  custom: "Sparkles",
  character: "User",
};

// Get task status color
export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case "pending":
      return "border-warning/25 bg-warning/10 text-warning";
    case "running":
      return "border-primary/25 bg-primary/10 text-primary";
    case "ready":
      return "border-success/25 bg-success/10 text-success";
    case "validated":
      return "border-success/25 bg-success/10 text-success";
    case "failed":
      return "border-destructive/25 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-secondary text-muted-foreground";
  }
}

export function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case "pending":
      return "En attente";
    case "running":
      return "En cours";
    case "ready":
      return "Prêt";
    case "validated":
      return "Validé";
    case "failed":
      return "Échoué";
    default:
      return status;
  }
}

// Convert API job to TaskItem
export function jobToTaskItem(job: {
  id: string;
  title: string;
  status: string;
  sourceKind: string;
  sourceLabel: string;
  sourceId: string;
  progress: number;
  createdAt: string;
  updatedAt?: string;
  summary?: string;
  prompt?: string;
  errorMessage?: string | unknown;
  metadataJson?: unknown;
}): TaskItem {
  const description =
    typeof job.summary === "string" && job.summary.trim().length > 0
      ? job.summary
      : typeof job.prompt === "string" && job.prompt.trim().length > 0
        ? job.prompt
        : undefined;

  return {
    id: job.id,
    title: job.title,
    status: job.status as TaskStatus,
    taskType: "technical",
    priority:
      job.status === "failed"
        ? "critical"
        : job.status === "running" || job.status === "pending"
          ? "high"
          : "medium",
    sourceKind: job.sourceKind as SourceKind,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    sourceLabel: job.sourceLabel,
    sourceId: job.sourceId,
    sourceEntity: {
      kind: job.sourceKind as SourceKind,
      id: job.sourceId,
      label: job.sourceLabel,
    },
    description,
    errorMessage:
      typeof job.errorMessage === "string" ? job.errorMessage : null,
  };
}
