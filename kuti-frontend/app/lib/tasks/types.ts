import type { CreateGenerationJobResponse, GetGenerationJobResponse, GetGenerationBoardResponse } from "~/lib/backend";

export type TaskStatus = 'pending' | 'running' | 'ready' | 'validated' | 'failed';
export type SourceKind = 'tome' | 'chapter' | 'scene' | 'panel' | 'custom' | 'character';

// Job from API
export type GenerationJob = CreateGenerationJobResponse;

// Extended job with hierarchy info
export interface TaskWithHierarchy {
  job: GenerationJob;
  children?: TaskChild[];
  hierarchyProgress?: HierarchyProgress;
}

// Child task in hierarchy
export interface TaskChild {
  id: string;
  sourceKind: 'scene' | 'panel' | 'chapter';
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
  sourceKind: SourceKind;
  progress: number;
  createdAt: string;
  updatedAt?: string;
  sourceLabel?: string;
  sourceId?: string;
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
  tome: 'BookOpen',
  chapter: 'Book',
  scene: 'FileText',
  panel: 'PanelTop',
  custom: 'Sparkles',
  character: 'User',
};

// Get task status color
export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    case 'running':
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    case 'ready':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    case 'validated':
      return 'text-teal-500 bg-teal-500/10 border-teal-500/20';
    case 'failed':
      return 'text-red-500 bg-red-500/10 border-red-500/20';
    default:
      return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
  }
}

export function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'pending':
      return 'En attente';
    case 'running':
      return 'En cours';
    case 'ready':
      return 'Prêt';
    case 'validated':
      return 'Validé';
    case 'failed':
      return 'Échoué';
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
  errorMessage?: string | unknown;
  metadataJson?: unknown;
}): TaskItem {
  return {
    id: job.id,
    title: job.title,
    status: job.status as TaskStatus,
    sourceKind: job.sourceKind as SourceKind,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    sourceLabel: job.sourceLabel,
    sourceId: job.sourceId,
    errorMessage: typeof job.errorMessage === 'string' ? job.errorMessage : null,
  };
}
