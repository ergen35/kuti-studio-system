import { ArrowLeftRight, History, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  SectionTitle,
  dateLabel,
} from "~/components/ui";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { FormField } from "~/components/FormField";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateQueriesById, invalidateWorkspace } from "~/lib/query";
import {
  listVersionsOptions,
  listBranchesOptions,
  createVersionMutation,
  compareVersionsMutation,
  restoreVersionMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { versionCreateSchema, type VersionCreateInput } from "~/lib/schemas";
import type {
  CompareVersionsResponse,
  ListBranchesResponse,
  ListVersionsResponse,
  RestoreVersionResponse,
} from "~/lib/backend/types.gen";

const RETAINED_VERSIONS_PER_BRANCH = 3;

const SNAPSHOT_COLLECTIONS = [
  { key: "characters", labelKey: "collections.characters" },
  { key: "characterRelations", labelKey: "collections.characterRelations" },
  { key: "characterImages", labelKey: "collections.characterImages" },
  { key: "voiceSamples", labelKey: "collections.voiceSamples" },
  { key: "tomes", labelKey: "collections.tomes" },
  { key: "chapters", labelKey: "collections.chapters" },
  { key: "scenes", labelKey: "collections.scenes" },
  { key: "storyReferences", labelKey: "collections.storyReferences" },
  { key: "assets", labelKey: "collections.assets" },
  { key: "assetLinks", labelKey: "collections.assetLinks" },
  {
    key: "sceneGenerationConfigs",
    labelKey: "collections.sceneGenerationConfigs",
  },
] as const;

type Version = ListVersionsResponse[number];
type Branch = ListBranchesResponse[number];
type SnapshotSummary = {
  schemaVersion: number;
  capturedAt: string;
  project: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  counts: Record<string, number>;
};

type RuntimeVersion = Omit<Version, "snapshot"> & {
  snapshot: SnapshotSummary | null;
};
type RuntimeBranch = Omit<
  Branch,
  | "latestVersionId"
  | "latestVersionLabel"
  | "latestCreatedAt"
  | "latestSnapshotCapturedAt"
> & {
  latestVersionId: string | null;
  latestVersionLabel: string | null;
  latestCreatedAt: string | null;
  latestSnapshotCapturedAt: string | null;
};
type RuntimeCompareResult = {
  left: RuntimeVersion;
  right: RuntimeVersion;
  projectChanges: string[];
  countsDelta: Record<string, number>;
};
type RuntimeRestoreResult = {
  restoredVersion: RuntimeVersion;
  backupVersion: RuntimeVersion;
};

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readCounts(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const counts: Record<string, number> = {};

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      counts[key] = raw;
    }
  }

  return counts;
}

function readSnapshot(value: unknown): SnapshotSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const project = record.project;

  if (
    typeof record.schemaVersion !== "number" ||
    typeof record.capturedAt !== "string"
  ) {
    return null;
  }

  if (!project || typeof project !== "object" || Array.isArray(project)) {
    return null;
  }

  const projectRecord = project as Record<string, unknown>;
  const counts = readCounts(record.counts);

  if (!counts) {
    return null;
  }

  return {
    schemaVersion: record.schemaVersion,
    capturedAt: record.capturedAt,
    project: {
      id: readString(projectRecord.id) ?? "",
      name: readString(projectRecord.name) ?? "",
      slug: readString(projectRecord.slug) ?? "",
      status: readString(projectRecord.status) ?? "",
    },
    counts,
  };
}

function normalizeVersion(version: Version): RuntimeVersion {
  return {
    ...version,
    snapshot: readSnapshot(version.snapshot),
  };
}

function normalizeBranch(branch: Branch): RuntimeBranch {
  return {
    ...branch,
    latestVersionId: readString(branch.latestVersionId),
    latestVersionLabel: readString(branch.latestVersionLabel),
    latestCreatedAt: readString(branch.latestCreatedAt),
    latestSnapshotCapturedAt: readString(branch.latestSnapshotCapturedAt),
    latestSnapshotAvailable: branch.latestSnapshotAvailable === true,
  };
}

function isPrimaryBranch(branchName: string) {
  return branchName === "main";
}

function isOrphanBranch(branch: RuntimeBranch) {
  return !isPrimaryBranch(branch.branchName) && branch.versionCount <= 1;
}

function getBranchStatusTone(branch: RuntimeBranch): string {
  if (isPrimaryBranch(branch.branchName)) return "ready";
  if (isOrphanBranch(branch)) return "warning";
  return "info";
}

function getBranchStatusLabel(
  branch: RuntimeBranch,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  if (isPrimaryBranch(branch.branchName))
    return t("panels.branches.status.primary");
  if (isOrphanBranch(branch)) return t("panels.branches.status.orphan");
  return t("panels.branches.status.detached");
}

function normalizeCompareResult(
  result: CompareVersionsResponse,
): RuntimeCompareResult {
  return {
    left: normalizeVersion(result.left as Version),
    right: normalizeVersion(result.right as Version),
    projectChanges: result.projectChanges,
    countsDelta: result.countsDelta,
  };
}

function normalizeRestoreResult(
  result: RestoreVersionResponse,
): RuntimeRestoreResult {
  return {
    restoredVersion: normalizeVersion(result.restoredVersion as Version),
    backupVersion: normalizeVersion(result.backupVersion as Version),
  };
}

function versionSelectLabel(version: RuntimeVersion) {
  return `#${version.versionIndex} ${version.label} · ${version.branchName}`;
}

function snapshotTotal(snapshot: SnapshotSummary | null | undefined) {
  if (!snapshot) {
    return 0;
  }

  return Object.values(snapshot.counts).reduce(
    (total, value) => total + value,
    0,
  );
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return "0";
}

function deltaTone(delta: number) {
  if (delta > 0) return "ready";
  if (delta < 0) return "warning";
  return "info";
}

function compareSnapshotNames(version: RuntimeVersion) {
  const snapshot = version.snapshot;

  if (!snapshot) {
    return [];
  }

  return SNAPSHOT_COLLECTIONS.map((collection) => ({
    ...collection,
    value: snapshot.counts[collection.key] ?? 0,
  }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 4);
}

function VersionSnapshotPills({
  version,
  t,
}: {
  version: RuntimeVersion;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const items = compareSnapshotNames(version);

  if (!version.snapshot) {
    return (
      <Alert className="border-warning/30 bg-warning/5">
        <AlertTitle>{t("snapshot.missing.title")}</AlertTitle>
        <AlertDescription>{t("snapshot.missing.description")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone="ready">{t("snapshot.ready")}</Badge>
          <span className="text-xs text-muted-foreground">
            {t("snapshot.capturedAt", {
              date: dateLabel(version.snapshot.capturedAt),
            })}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("snapshot.total", { count: snapshotTotal(version.snapshot) })}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <Badge key={item.key} tone="info">
              {t(item.labelKey, { count: item.value })}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">
            {t("snapshot.empty")}
          </span>
        )}
      </div>
    </div>
  );
}

function ComparisonPanel({
  comparison,
  t,
}: {
  comparison: RuntimeCompareResult | null;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  if (!comparison) {
    return (
      <EmptyState
        title={t("compare.empty.title")}
        description={t("compare.empty.description")}
      />
    );
  }

  const countEntries = Object.entries(comparison.countsDelta)
    .filter(([, delta]) => delta !== 0)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));

  const missingSnapshots = [
    comparison.left.snapshot ? null : comparison.left.label,
    comparison.right.snapshot ? null : comparison.right.label,
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {t("compare.result.title")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("compare.result.subtitle", {
              left: versionSelectLabel(comparison.left),
              right: versionSelectLabel(comparison.right),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{comparison.left.branchName}</Badge>
          <Badge tone="info">{comparison.right.branchName}</Badge>
        </div>
      </div>

      {missingSnapshots.length > 0 ? (
        <Alert className="border-warning/30 bg-warning/5">
          <AlertTitle>{t("compare.result.snapshotMissingTitle")}</AlertTitle>
          <AlertDescription>
            {t("compare.result.snapshotMissingDescription", {
              versions: missingSnapshots.join(", "),
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      {countEntries.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {countEntries.map(([key, delta]) => {
            const collection = SNAPSHOT_COLLECTIONS.find(
              (item) => item.key === key,
            );
            const labelKey = collection?.labelKey ?? key;

            return (
              <Badge key={key} tone={deltaTone(delta)}>
                {t(labelKey, { count: Math.abs(delta) })} {formatDelta(delta)}
              </Badge>
            );
          })}
        </div>
      ) : (
        <Alert>
          <AlertTitle>{t("compare.result.noCountsTitle")}</AlertTitle>
          <AlertDescription>
            {t("compare.result.noCountsDescription")}
          </AlertDescription>
        </Alert>
      )}

      {comparison.projectChanges.length > 0 ? (
        <div className="grid gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {t("compare.result.changesTitle")}
          </span>
          <ul className="grid gap-2">
            {comparison.projectChanges.map((change) => (
              <li
                key={change}
                className="rounded-lg border border-border/70 bg-secondary/40 px-3 py-2 text-sm text-foreground"
              >
                {change}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Alert>
          <AlertTitle>{t("compare.result.noChangesTitle")}</AlertTitle>
          <AlertDescription>
            {t("compare.result.noChangesDescription")}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function VersionCard({
  version,
  isLeft,
  isRight,
  onSelectLeft,
  onSelectRight,
  onRestore,
  t,
}: {
  version: RuntimeVersion;
  isLeft: boolean;
  isRight: boolean;
  onSelectLeft: (versionId: string) => void;
  onSelectRight: (versionId: string) => void;
  onRestore: (version: RuntimeVersion) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const snapshot = version.snapshot;
  const selectedTone = isLeft ? "ready" : isRight ? "warning" : undefined;

  return (
    <article className="rounded-xl border border-border/70 bg-background/70 p-4 shadow-[0_1px_2px_rgb(19_22_30/0.04)] transition-colors hover:border-primary/25 hover:bg-background">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-foreground">
              {version.label}
            </h3>
            {selectedTone ? (
              <Badge tone={selectedTone}>
                {isLeft
                  ? t("compare.selectedLeft")
                  : t("compare.selectedRight")}
              </Badge>
            ) : null}
            <Badge tone={version.branchName}>{version.branchName}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("history.meta", {
              index: version.versionIndex,
              createdAt: dateLabel(version.createdAt),
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone={snapshot ? "ready" : "warning"}>
            {snapshot ? t("snapshot.ready") : t("snapshot.missing.short")}
          </Badge>
        </div>
      </div>

      {version.summary ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {version.summary}
        </p>
      ) : null}

      <div className="mt-3">
        <VersionSnapshotPills version={version} t={t} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          type="button"
          onClick={() => onSelectLeft(version.id)}
        >
          {t("actions.useLeft")}
        </Button>
        <Button
          variant="ghost"
          type="button"
          onClick={() => onSelectRight(version.id)}
        >
          {t("actions.useRight")}
        </Button>
        <Button
          variant="primary"
          type="button"
          onClick={() => onRestore(version)}
          disabled={!version.snapshot}
        >
          <RotateCcw size={15} />
          {t("actions.restore")}
        </Button>
      </div>
    </article>
  );
}

function RestoreDialog({
  version,
  result,
  onClose,
  onConfirm,
  isPending,
  t,
}: {
  version: RuntimeVersion | null;
  result: RuntimeRestoreResult | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Dialog
      open={Boolean(version)}
      onOpenChange={(open) => !open && !isPending && onClose()}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("restore.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("restore.dialog.description")}
          </DialogDescription>
        </DialogHeader>

        {version ? (
          <div className="grid gap-3 rounded-xl border border-border/70 bg-secondary/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={version.branchName}>{version.branchName}</Badge>
              <Badge tone={version.snapshot ? "ready" : "warning"}>
                {version.snapshot
                  ? t("snapshot.ready")
                  : t("snapshot.missing.short")}
              </Badge>
            </div>
            <strong className="text-sm text-foreground">{version.label}</strong>
            <p className="text-xs text-muted-foreground">
              {t("history.meta", {
                index: version.versionIndex,
                createdAt: dateLabel(version.createdAt),
              })}
            </p>
            <Alert className="border-warning/30 bg-warning/5">
              <AlertTitle>{t("restore.dialog.backupTitle")}</AlertTitle>
              <AlertDescription>
                {t("restore.dialog.backupDescription")}
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertTitle>{t("restore.dialog.retentionTitle")}</AlertTitle>
              <AlertDescription>
                {t("restore.dialog.retentionDescription", {
                  count: RETAINED_VERSIONS_PER_BRANCH,
                })}
              </AlertDescription>
            </Alert>
          </div>
        ) : null}

        {result ? (
          <Alert className="border-success/30 bg-success/5">
            <AlertTitle>{t("restore.success.title")}</AlertTitle>
            <AlertDescription>
              {t("restore.success.description", {
                restored: result.restoredVersion.label,
                backup: result.backupVersion.label,
              })}
            </AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            type="button"
            onClick={onClose}
            disabled={isPending}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={onConfirm}
            disabled={!version || isPending}
          >
            {isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <RotateCcw size={15} />
            )}
            {t("actions.restore")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function VersionsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(["versions", "common"]);
  const queryClient = useQueryClient();
  const [comparison, setComparison] = useState<RuntimeCompareResult | null>(
    null,
  );
  const [restoreTarget, setRestoreTarget] = useState<RuntimeVersion | null>(
    null,
  );
  const [restoreResult, setRestoreResult] =
    useState<RuntimeRestoreResult | null>(null);
  const [leftVersionId, setLeftVersionId] = useState("");
  const [rightVersionId, setRightVersionId] = useState("");

  const versions = useQuery({
    ...listVersionsOptions({ path: { projectId } }),
    enabled: Boolean(projectId),
  });
  const branches = useQuery({
    ...listBranchesOptions({ path: { projectId } }),
    enabled: Boolean(projectId),
  });

  const versionItems = useMemo<RuntimeVersion[]>(
    () =>
      (versions.data ?? []).map((version) =>
        normalizeVersion(version as Version),
      ),
    [versions.data],
  );
  const branchItems = useMemo<RuntimeBranch[]>(
    () =>
      (branches.data ?? [])
        .map((branch) => normalizeBranch(branch as Branch))
        .sort((left, right) => {
          if (left.branchName === "main") return -1;
          if (right.branchName === "main") return 1;
          return left.branchName.localeCompare(right.branchName);
        }),
    [branches.data],
  );

  const versionById = useMemo(
    () => new Map(versionItems.map((version) => [version.id, version])),
    [versionItems],
  );
  const formatDate = (value: string | null | undefined) =>
    value ? dateLabel(value) : t("common:meta.never");

  useEffect(() => {
    if (versionItems.length === 0) {
      return;
    }

    setLeftVersionId((current) =>
      versionById.has(current) ? current : versionItems[0].id,
    );
    setRightVersionId((current) => {
      if (versionById.has(current)) {
        return current;
      }

      return versionItems[1]?.id || versionItems[0].id;
    });
  }, [versionById, versionItems]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<VersionCreateInput>({
    resolver: zodResolver(versionCreateSchema),
    defaultValues: { branchName: "main", label: "Checkpoint", summary: "" },
  });

  const create = useMutation({
    ...createVersionMutation(),
    onSuccess: () => {
      invalidateQueriesById(queryClient, ["listVersions", "listBranches"]);
      setRestoreResult(null);
    },
  });

  const compare = useMutation({
    ...compareVersionsMutation(),
    onSuccess: (result) => {
      setComparison(normalizeCompareResult(result));
    },
  });

  const restore = useMutation({
    ...restoreVersionMutation(),
    onSuccess: (result) => {
      setRestoreResult(normalizeRestoreResult(result));
      setRestoreTarget(null);
      invalidateWorkspace(projectId);
      invalidateQueriesById(queryClient, ["listVersions", "listBranches"]);
    },
  });

  const compareDisabled =
    !leftVersionId || !rightVersionId || leftVersionId === rightVersionId;
  const totalVersions = versionItems.length;
  const totalBranches = branchItems.length;
  const snapshotReadyCount = versionItems.filter((version) =>
    Boolean(version.snapshot),
  ).length;
  const branchReadyCount = branchItems.filter(
    (branch) => branch.latestSnapshotAvailable,
  ).length;
  const detachedBranchCount = branchItems.filter(
    (branch) => !isPrimaryBranch(branch.branchName),
  ).length;
  const orphanBranchCount = branchItems.filter((branch) =>
    isOrphanBranch(branch),
  ).length;

  const onSubmit = (data: VersionCreateInput) =>
    create.mutate(
      {
        path: { projectId },
        body: {
          branchName: data.branchName,
          label: data.label,
          summary: data.summary,
        },
      },
      {
        onSuccess: () => reset(),
      },
    );

  const handleCompare = () => {
    if (compareDisabled) return;

    setRestoreResult(null);
    compare.mutate({
      path: { projectId },
      body: { leftVersionId, rightVersionId },
    });
  };

  const handleRestoreConfirm = () => {
    if (!restoreTarget) {
      return;
    }

    restore.mutate({
      path: { projectId, versionId: restoreTarget.id },
      body: {},
    });
  };

  const groupedVersions = useMemo(() => {
    const groups = new Map<string, RuntimeVersion[]>();

    for (const version of versionItems) {
      const list = groups.get(version.branchName) || [];
      list.push(version);
      groups.set(version.branchName, list);
    }

    return Array.from(groups.entries())
      .map(([branchName, versions]) => ({ branchName, versions }))
      .sort((left, right) => {
        if (left.branchName === "main") return -1;
        if (right.branchName === "main") return 1;
        return left.branchName.localeCompare(right.branchName);
      });
  }, [versionItems]);

  return (
    <AppShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="versions">{t("hero.badge")}</Badge>
            <Badge tone="ready">
              {t("summary.snapshotReady", { count: snapshotReadyCount })}
            </Badge>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-[24px] border border-border/70 bg-[linear-gradient(135deg,rgba(20,115,230,0.12),rgba(255,255,255,0.6))] p-5 shadow-[0_10px_34px_rgba(19,22,30,0.06)] dark:bg-[linear-gradient(135deg,rgba(138,180,248,0.12),rgba(25,27,34,0.82))]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,115,230,0.16),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.08),transparent_35%)]" />
        <div className="relative grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
              <History size={14} />
              <span>{t("hero.kicker")}</span>
            </div>
            <div className="grid gap-3">
              <h2 className="max-w-2xl text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
                {t("hero.title")}
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {t("hero.description")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{t("hero.snapshotsStored")}</Badge>
              <Badge tone="ready">
                {t("hero.retention", { count: RETAINED_VERSIONS_PER_BRANCH })}
              </Badge>
              <Badge tone="warning">{t("hero.restoreBackup")}</Badge>
            </div>
            <Alert className="border-border/70 bg-background/60 backdrop-blur">
              <Sparkles size={16} />
              <div>
                <AlertTitle>{t("hero.calloutTitle")}</AlertTitle>
                <AlertDescription>
                  {t("hero.calloutDescription")}
                </AlertDescription>
              </div>
            </Alert>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-[0_1px_2px_rgb(19_22_30/0.04)]">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t("summary.totalVersions")}
              </span>
              <strong className="mt-3 block text-3xl text-foreground">
                {totalVersions}
              </strong>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("summary.totalVersionsHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-[0_1px_2px_rgb(19_22_30/0.04)]">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t("summary.branches")}
              </span>
              <strong className="mt-3 block text-3xl text-foreground">
                {totalBranches}
              </strong>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("summary.branchesHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-[0_1px_2px_rgb(19_22_30/0.04)]">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t("summary.branchSnapshots")}
              </span>
              <strong className="mt-3 block text-3xl text-foreground">
                {branchReadyCount}
              </strong>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("summary.branchSnapshotsHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-[0_1px_2px_rgb(19_22_30/0.04)]">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t("summary.detachedBranches")}
              </span>
              <strong className="mt-3 block text-3xl text-foreground">
                {detachedBranchCount}
              </strong>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("summary.detachedBranchesHint")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-[0_1px_2px_rgb(19_22_30/0.04)]">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {t("summary.retention")}
              </span>
              <strong className="mt-3 block text-3xl text-foreground">
                {RETAINED_VERSIONS_PER_BRANCH}
              </strong>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("summary.retentionHint")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {restoreResult ? (
        <Alert className="mt-4 border-success/30 bg-success/5">
          <AlertTitle>{t("restore.success.title")}</AlertTitle>
          <AlertDescription>
            {t("restore.success.description", {
              restored: restoreResult.restoredVersion.label,
              backup: restoreResult.backupVersion.label,
            })}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
        <div className="grid gap-4">
          <Panel>
            <SectionTitle
              title={t("panels.create.title")}
              meta={t("panels.create.description")}
            />
            <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
              <FormField
                label={t("panels.create.branch")}
                error={errors.branchName}
              >
                <Input {...register("branchName")} placeholder="main" />
              </FormField>
              <FormField label={t("panels.create.label")} error={errors.label}>
                <Input {...register("label")} />
              </FormField>
              <FormField
                label={t("panels.create.summary")}
                error={errors.summary}
              >
                <Textarea
                  {...register("summary")}
                  placeholder={t("panels.create.summaryPlaceholder")}
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  disabled={isSubmitting || create.isPending}
                >
                  <History size={16} />
                  {create.isPending
                    ? t("panels.create.creating")
                    : t("panels.create.button")}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {t("panels.create.note")}
                </span>
              </div>
              {create.error ? (
                <ErrorState message={apiErrorMessage(create.error)} />
              ) : null}
            </form>
          </Panel>

          <Panel>
            <SectionTitle
              title={t("panels.compare.title")}
              meta={t("panels.compare.description")}
            />
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
              <FormField label={t("panels.compare.left")}>
                <Select
                  value={leftVersionId}
                  onValueChange={(value) => {
                    setLeftVersionId(value);
                    setComparison(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t("panels.compare.placeholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {versionItems.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          {versionSelectLabel(version)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>

              <div className="flex items-center justify-center pb-1 lg:pb-0">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    const previousLeft = leftVersionId;
                    setLeftVersionId(rightVersionId);
                    setRightVersionId(previousLeft);
                    setComparison(null);
                  }}
                  disabled={compareDisabled}
                  className="whitespace-nowrap"
                >
                  <ArrowLeftRight size={16} />
                  {t("panels.compare.swap")}
                </Button>
              </div>

              <FormField label={t("panels.compare.right")}>
                <Select
                  value={rightVersionId}
                  onValueChange={(value) => {
                    setRightVersionId(value);
                    setComparison(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={t("panels.compare.placeholder")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {versionItems.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          {versionSelectLabel(version)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                type="button"
                onClick={handleCompare}
                disabled={compareDisabled || compare.isPending}
              >
                {compare.isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <ArrowLeftRight size={16} />
                )}
                {t("panels.compare.button")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("panels.compare.helper")}
              </span>
            </div>

            {compare.error ? (
              <ErrorState message={apiErrorMessage(compare.error)} />
            ) : null}
            {compare.isPending ? (
              <LoadingState label={t("panels.compare.loading")} />
            ) : null}
            {!compare.isPending && comparison ? (
              <div className="mt-3">
                <ComparisonPanel comparison={comparison} t={t} />
              </div>
            ) : null}
            {!compare.isPending && !comparison ? (
              <Alert className="mt-3 border-border/70 bg-secondary/25">
                <AlertTitle>{t("panels.compare.emptyTitle")}</AlertTitle>
                <AlertDescription>
                  {t("panels.compare.emptyDescription")}
                </AlertDescription>
              </Alert>
            ) : null}
          </Panel>
        </div>

        <div className="grid gap-4">
          <Panel>
            <SectionTitle
              title={t("panels.branches.title")}
              meta={t("panels.branches.description")}
            />
            {branches.isLoading ? <LoadingState /> : null}
            {branches.error ? (
              <ErrorState message={apiErrorMessage(branches.error)} />
            ) : null}
            {orphanBranchCount > 0 ? (
              <Alert className="mb-3 border-warning/30 bg-warning/5">
                <AlertTitle>
                  {t("panels.branches.orphanAlertTitle", {
                    count: orphanBranchCount,
                  })}
                </AlertTitle>
                <AlertDescription>
                  {t("panels.branches.orphanAlertDescription")}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-3">
              {!branches.isLoading &&
              !branches.error &&
              branchItems.length > 0 ? (
                branchItems.map((branch) => (
                  <div
                    key={branch.branchName}
                    className="grid gap-2 rounded-xl border border-border/70 bg-secondary/25 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="text-sm text-foreground">
                            {branch.branchName}
                          </strong>
                          <Badge tone={getBranchStatusTone(branch)}>
                            {getBranchStatusLabel(branch, t)}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t("panels.branches.count", {
                            count: branch.versionCount,
                          })}
                        </span>
                      </div>
                      <Badge
                        tone={
                          branch.latestSnapshotAvailable ? "ready" : "warning"
                        }
                      >
                        {branch.latestSnapshotAvailable
                          ? t("snapshot.ready")
                          : t("snapshot.missing.short")}
                      </Badge>
                    </div>

                    <div className="grid gap-1 text-xs text-muted-foreground">
                      <span>
                        {t("panels.branches.latest", {
                          label:
                            branch.latestVersionLabel ??
                            t("panels.branches.none"),
                        })}
                      </span>
                      <span>
                        {t("panels.branches.latestCreatedAt", {
                          date: formatDate(branch.latestCreatedAt),
                        })}
                      </span>
                      <span>
                        {t("panels.branches.latestSnapshot", {
                          date: formatDate(branch.latestSnapshotCapturedAt),
                        })}
                      </span>
                    </div>
                  </div>
                ))
              ) : !branches.isLoading && !branches.error ? (
                <EmptyState
                  title={t("empty.title")}
                  description={t("empty.description")}
                />
              ) : null}
            </div>
          </Panel>

          <Panel>
            <SectionTitle
              title={t("panels.retention.title")}
              meta={t("panels.retention.description")}
            />
            <Alert>
              <AlertTitle>{t("panels.retention.alertTitle")}</AlertTitle>
              <AlertDescription>
                {t("panels.retention.alertDescription", {
                  count: RETAINED_VERSIONS_PER_BRANCH,
                })}
              </AlertDescription>
            </Alert>
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <Panel>
          <SectionTitle
            title={t("panels.history.title")}
            meta={t("panels.history.description")}
          />
          {versions.isLoading ? <LoadingState /> : null}
          {versions.error ? (
            <ErrorState message={apiErrorMessage(versions.error)} />
          ) : null}
          {!versions.isLoading && versionItems.length === 0 ? (
            <EmptyState
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : null}
          <div className="grid gap-4">
            {groupedVersions.map(({ branchName, versions: branchVersions }) => {
              const branchStatus = {
                branchName,
                versionCount: branchVersions.length,
              } as RuntimeBranch;

              return (
                <section key={branchName} className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {branchName}
                        </h3>
                        <Badge tone={getBranchStatusTone(branchStatus)}>
                          {getBranchStatusLabel(branchStatus, t)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("panels.history.branchMeta", {
                          count: branchVersions.length,
                        })}
                      </p>
                    </div>
                    <Badge tone="info">
                      {t("panels.history.branchBadge", {
                        count: branchVersions.length,
                      })}
                    </Badge>
                  </div>

                  <div className="grid gap-3">
                    {branchVersions.map((version) => (
                      <VersionCard
                        key={version.id}
                        version={version}
                        isLeft={version.id === leftVersionId}
                        isRight={version.id === rightVersionId}
                        onSelectLeft={(versionId) => {
                          setLeftVersionId(versionId);
                          setComparison(null);
                        }}
                        onSelectRight={(versionId) => {
                          setRightVersionId(versionId);
                          setComparison(null);
                        }}
                        onRestore={(version) => {
                          setRestoreResult(null);
                          setRestoreTarget(version);
                        }}
                        t={t}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </Panel>
      </div>

      <RestoreDialog
        version={restoreTarget}
        result={restoreResult}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreConfirm}
        isPending={restore.isPending}
        t={t}
      />

      {restore.error ? (
        <ErrorState message={apiErrorMessage(restore.error)} />
      ) : null}
    </AppShell>
  );
}
