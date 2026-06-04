export type SourceUnitKind = "scene" | "chapter" | "tome" | "panel" | "custom";

export type SourceUnit = {
  kind: SourceUnitKind;
  sourceId: string;
  title: string;
  sourceLabel: string;
  summary: string;
  content: string;
  notes: string;
  orderIndex: number;
  context: Record<string, unknown>;
};

export type TaskChildState = {
  id: string;
  title: string;
  sourceKind: SourceUnitKind;
  sourceLabel: string;
  sourceId: string;
  status: "pending" | "running" | "ready" | "validated" | "failed";
  progress: number;
  createdAt: string;
  updatedAt: string;
  errorMessage: string | null;
};

export type GeneratedPanel = {
  stepId: string;
  panelId: string;
  title: string;
  caption: string;
  prompt: string;
  imagePath: string | null;
  imageName: string | null;
  status: "ready" | "failed";
  errorMessage: string | null;
};

export function progressForIndex(index: number, total: number, base: number, range: number): number {
  if (total <= 0) return 100;
  return base + Math.round(((index + 1) / total) * range);
}

export function buildChildState(
  item: { unit: SourceUnit; stepId: string; panelId: string },
  status: TaskChildState["status"],
  progress: number,
  errorMessage: string | null,
): TaskChildState {
  const now = new Date().toISOString();
  return {
    id: item.stepId,
    title: item.unit.title,
    sourceKind: item.unit.kind,
    sourceLabel: item.unit.sourceLabel,
    sourceId: item.unit.sourceId,
    status,
    progress,
    createdAt: now,
    updatedAt: now,
    errorMessage,
  };
}

export function buildChildrenFromResults(
  seeded: Array<{ unit: SourceUnit; stepId: string; panelId: string }>,
  results: GeneratedPanel[],
  total: number,
): TaskChildState[] {
  return seeded.map((item, index) => {
    const result = results[index];
    const status = result?.status === "ready" ? "ready" : result?.status === "failed" ? "failed" : "pending";
    return {
      id: item.stepId,
      title: item.unit.title,
      sourceKind: item.unit.kind,
      sourceLabel: item.unit.sourceLabel,
      sourceId: item.unit.sourceId,
      status,
      progress: status === "ready" ? 100 : status === "failed" ? 0 : Math.round(((index + 1) / Math.max(total, 1)) * 100),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      errorMessage: result?.errorMessage ?? null,
    };
  });
}
