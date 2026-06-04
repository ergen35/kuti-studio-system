import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import {
  Archive,
  Clapperboard,
  Film,
  ImageIcon,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { AppShell } from "~/components/layout";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  SectionTitle,
  Stat,
  dateLabel,
} from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  archiveDramaVideoMutation,
  listDramaVideosQueryKey,
  listProjectDramaVideosOptions,
  listProjectDramaVideosQueryKey,
} from "~/lib/backend/@tanstack/react-query.gen";
import type { ListProjectDramaVideosResponse } from "~/lib/backend/types.gen";
import { apiErrorMessage, backendUrl } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import { useTranslation } from "~/hooks/useTranslation";

type DramaVideo = ListProjectDramaVideosResponse[number];
type DramaStatus = DramaVideo["status"];
type DramaVideoSource = {
  sceneId: string;
  sceneTitle: string;
  tomeId: string;
  tomeTitle: string;
  chapterId: string;
  chapterTitle: string;
  pageNumber: number;
  pageLabel: string;
  pageImageUrl: string | unknown;
};

const STATUS_OPTIONS: DramaStatus[] = [
  "draft",
  "queued",
  "running",
  "ready",
  "failed",
  "archived",
];

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sourceValue(video: { source?: unknown }): DramaVideoSource | null {
  return video.source && typeof video.source === "object"
    ? (video.source as DramaVideoSource)
    : null;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isLocalFallback(video: DramaVideo) {
  return metadataRecord(video.metadata).localFallbackUsed === true;
}

function providerFailureMessage(video: DramaVideo) {
  return stringValue(metadataRecord(video.metadata).providerFailureMessage);
}

function durationLabel(seconds: unknown) {
  const value = numberValue(seconds);
  if (value === null) return null;

  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSeconds = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function resolutionLabel(metadata: Record<string, unknown>) {
  const directValue =
    stringValue(metadata.resolution) ||
    stringValue(metadata.outputResolution) ||
    stringValue(metadata.videoResolution);
  if (directValue) return directValue;

  const width = numberValue(metadata.width) ?? numberValue(metadata.videoWidth);
  const height =
    numberValue(metadata.height) ?? numberValue(metadata.videoHeight);
  if (width !== null && height !== null) {
    return `${width}x${height}`;
  }

  return null;
}

function promptPreview(prompt: string) {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= 260) return normalized;
  return `${normalized.slice(0, 260).trim()}…`;
}

export default function DramaVideosRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(["drama", "common"]);
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<DramaStatus | "all">(
    "all",
  );
  const [selectedModelKey, setSelectedModelKey] = useState("all");
  const [selectedSceneId, setSelectedSceneId] = useState("all");
  const [archiveTarget, setArchiveTarget] = useState<DramaVideo | null>(null);

  const videosQuery = useQuery({
    ...listProjectDramaVideosOptions({ path: { projectId } }),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });

  const videos = (videosQuery.data ?? []) as ListProjectDramaVideosResponse;

  const archive = useMutation({
    ...archiveDramaVideoMutation(),
    onSuccess: async (archivedVideo) => {
      const archivedSource = sourceValue(archivedVideo);
      invalidateWorkspace(projectId);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: listProjectDramaVideosQueryKey({ path: { projectId } }),
        }),
        archivedSource?.sceneId
          ? queryClient.invalidateQueries({
              queryKey: listDramaVideosQueryKey({
                path: { projectId, sceneId: archivedSource.sceneId },
              }),
            })
          : Promise.resolve(),
      ]);
      await videosQuery.refetch();
      setArchiveTarget(null);
    },
  });

  const sceneOptions = useMemo(() => {
    const seen = new Map<
      string,
      { value: string; label: string; meta: string }
    >();

    for (const video of videos) {
      const source = sourceValue(video);
      if (!source || seen.has(source.sceneId)) continue;

      seen.set(source.sceneId, {
        value: source.sceneId,
        label: source.sceneTitle,
        meta: `${source.tomeTitle} / ${source.chapterTitle}`,
      });
    }

    return [...seen.values()];
  }, [videos]);

  const modelOptions = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ value: string; label: string }> = [];

    for (const video of videos) {
      if (!video.modelKey || seen.has(video.modelKey)) continue;
      seen.add(video.modelKey);
      items.push({ value: video.modelKey, label: video.modelKey });
    }

    return items;
  }, [videos]);

  const filteredVideos = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return videos.filter((video) => {
      const source = sourceValue(video);

      if (selectedStatus !== "all" && video.status !== selectedStatus) {
        return false;
      }

      if (selectedModelKey !== "all" && video.modelKey !== selectedModelKey) {
        return false;
      }

      if (selectedSceneId !== "all" && source?.sceneId !== selectedSceneId) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        video.title,
        video.prompt,
        video.modelKey,
        video.stylePreset,
        video.status,
        source?.sceneTitle,
        source?.chapterTitle,
        source?.tomeTitle,
        source?.pageLabel,
        stringValue(video.errorMessage),
        providerFailureMessage(video),
        isLocalFallback(video) ? "fallback" : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [videos, searchQuery, selectedStatus, selectedModelKey, selectedSceneId]);

  const stats = useMemo(
    () => ({
      total: videos.length,
      ready: videos.filter((video) => video.status === "ready").length,
      running: videos.filter(
        (video) => video.status === "running" || video.status === "queued",
      ).length,
      failed: videos.filter((video) => video.status === "failed").length,
      fallback: videos.filter((video) => isLocalFallback(video)).length,
    }),
    [videos],
  );

  const hasFilters =
    Boolean(searchQuery.trim()) ||
    selectedStatus !== "all" ||
    selectedModelKey !== "all" ||
    selectedSceneId !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSelectedModelKey("all");
    setSelectedSceneId("all");
  };

  const activeCountLabel = t("filters.summary", {
    count: filteredVideos.length,
    total: videos.length,
  });

  return (
    <AppShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="info">{t("style")}</Badge>
            <Button
              onClick={() => void videosQuery.refetch()}
              variant="secondary"
            >
              <RefreshCw
                size={16}
                className={videosQuery.isFetching ? "animate-spin" : ""}
              />
              {t("common:nav.refresh")}
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat value={stats.total} label={t("stats.total")} />
        <Stat value={stats.ready} label={t("stats.ready")} />
        <Stat value={stats.running} label={t("stats.running")} />
        <Stat value={stats.failed} label={t("stats.failed")} />
        <Stat value={stats.fallback} label={t("localFallback")} />
      </div>

      <Panel className="mb-5">
        <SectionTitle
          title={t("filters.title")}
          meta={activeCountLabel}
          actions={
            hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <RotateCcw size={14} />
                {t("filters.reset")}
              </Button>
            ) : undefined
          }
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("filters.search.label")}
            </span>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("filters.search.placeholder")}
                className="pl-9 pr-9"
              />
              {searchQuery ? (
                <Button
                  type="button"
                  variant="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  title={t("filters.clearSearch")}
                  onClick={() => setSearchQuery("")}
                >
                  <X size={14} />
                </Button>
              ) : null}
            </div>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("filters.status.label")}
            </span>
            <Select
              value={selectedStatus}
              onValueChange={(value) =>
                setSelectedStatus(value as DramaStatus | "all")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.status.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.all")}</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`common:status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("filters.model.label")}
            </span>
            <Select
              value={selectedModelKey}
              onValueChange={setSelectedModelKey}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.model.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.all")}</SelectItem>
                {modelOptions.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("filters.scene.label")}
            </span>
            <Select value={selectedSceneId} onValueChange={setSelectedSceneId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.scene.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.all")}</SelectItem>
                {sceneOptions.map((scene) => (
                  <SelectItem key={scene.value} value={scene.value}>
                    {scene.label} · {scene.meta}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </Panel>

      {videosQuery.isLoading ? (
        <LoadingState label={t("common:states.loading")} />
      ) : null}
      {videosQuery.error ? (
        <ErrorState message={apiErrorMessage(videosQuery.error)} />
      ) : null}

      {!videosQuery.isLoading && !videosQuery.error && videos.length === 0 ? (
        <EmptyState
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : null}

      {!videosQuery.isLoading &&
      !videosQuery.error &&
      videos.length > 0 &&
      filteredVideos.length === 0 ? (
        <EmptyState
          title={t("empty.filteredTitle")}
          description={t("empty.filteredDescription")}
        />
      ) : null}

      {filteredVideos.length > 0 ? (
        <section className="grid gap-3">
          <SectionTitle title={t("library")} meta={activeCountLabel} />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filteredVideos.map((video) => {
              const source = sourceValue(video);
              const scenePath = source
                ? `/projects/${projectId}/story/${source.tomeId}/scenes/${source.sceneId}`
                : `/projects/${projectId}/story`;
              const videoUrl = backendUrl(video.videoUrl);
              const pageImageUrl = source
                ? backendUrl(source.pageImageUrl)
                : "";
              const localFallback = isLocalFallback(video);
              const providerFailure = providerFailureMessage(video);
              const metadata = metadataRecord(video.metadata);
              const duration = durationLabel(video.durationSeconds);
              const resolution = resolutionLabel(metadata);
              const styleLabel = t(`stylePresets.${video.stylePreset}`, {
                defaultValue: video.stylePreset,
              });
              const prompt = promptPreview(video.prompt);
              const statusLabel = t(`common:status.${video.status}`);

              return (
                <Card key={video.id} className="overflow-hidden">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid size-10 place-items-center rounded-xl border border-border bg-secondary text-primary shadow-sm">
                        <Clapperboard size={18} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-foreground">
                          {video.title}
                        </h2>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {video.modelKey}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={video.status}>{statusLabel}</Badge>
                      {localFallback ? (
                        <Badge tone="warning">{t("localFallback")}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {videoUrl && video.status === "ready" ? (
                      <video
                        src={videoUrl}
                        controls
                        className="aspect-video w-full rounded-xl bg-black"
                      />
                    ) : pageImageUrl ? (
                      <div className="relative aspect-video overflow-hidden rounded-xl bg-secondary">
                        <img
                          src={pageImageUrl}
                          alt=""
                          className="h-full w-full object-cover opacity-60"
                        />
                        <div className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                          {video.status === "running" ||
                          video.status === "queued" ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Play />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-border bg-secondary/40 text-muted-foreground">
                        <ImageIcon />
                      </div>
                    )}

                    <div className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info">
                          {t("metadata.model")}: {video.modelKey}
                        </Badge>
                        <Badge tone="info">
                          {t("metadata.style")}: {styleLabel}
                        </Badge>
                        <Badge tone="info">
                          {t("metadata.duration")}:{" "}
                          {duration ?? t("metadata.unknown")}
                        </Badge>
                        <Badge tone="info">
                          {t("metadata.resolution")}:{" "}
                          {resolution ?? t("metadata.unknown")}
                        </Badge>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {t("metadata.prompt")}
                        </span>
                        <p
                          className="text-xs leading-5 text-muted-foreground"
                          title={video.prompt}
                        >
                          {prompt}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span>
                          {t("metadata.createdAt", {
                            date: dateLabel(video.createdAt),
                          })}
                        </span>
                        <span>
                          {t("metadata.updatedAt", {
                            date: dateLabel(video.updatedAt),
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-1 rounded-xl border border-border bg-secondary/25 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {t("source.title")}
                        </span>
                        {source ? (
                          <Badge tone="info">
                            {t("source.page", { number: source.pageNumber })}
                          </Badge>
                        ) : (
                          <Badge tone="warning">{t("source.unknown")}</Badge>
                        )}
                      </div>
                      {source ? (
                        <>
                          <strong className="truncate text-sm text-foreground">
                            {source.sceneTitle}
                          </strong>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {source.tomeTitle} / {source.chapterTitle} ·{" "}
                            {source.pageLabel}
                          </p>
                        </>
                      ) : null}
                    </div>

                    {stringValue(video.errorMessage) ? (
                      <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                        {stringValue(video.errorMessage)}
                      </p>
                    ) : null}

                    {localFallback && providerFailure ? (
                      <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                        {t("fallbackReason", { reason: providerFailure })}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={scenePath}
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm font-medium hover:border-primary/35 hover:bg-primary/8"
                      >
                        <Film size={14} />
                        {t("openScene")}
                      </Link>
                      {video.status !== "archived" ? (
                        <Button
                          type="button"
                          variant="danger"
                          className="h-8 px-2.5"
                          onClick={() => setArchiveTarget(video)}
                        >
                          <Archive size={14} />
                          {t("common:actions.archive")}
                        </Button>
                      ) : (
                        <Badge tone="warning" className="h-8 px-2.5">
                          {t("common:status.archived")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      <Dialog
        open={archiveTarget !== null}
        onOpenChange={(open) =>
          !open && !archive.isPending && setArchiveTarget(null)
        }
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex-row items-start gap-3 text-left">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
              <Archive className="text-warning" size={18} />
            </div>
            <div>
              <DialogTitle>{t("archiveDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("archiveDialog.description")}
              </DialogDescription>
            </div>
          </DialogHeader>

          {archiveTarget ? (
            <div className="grid gap-2 rounded-xl border border-border bg-secondary/25 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {t("archiveDialog.video")}
                </span>
                <Badge tone={archiveTarget.status}>
                  {t(`common:status.${archiveTarget.status}`)}
                </Badge>
              </div>
              <p className="font-medium text-foreground">
                {archiveTarget.title}
              </p>
              <div className="grid gap-1 text-xs text-muted-foreground">
                <p>
                  {t("archiveDialog.model")}: {archiveTarget.modelKey}
                </p>
                {sourceValue(archiveTarget) ? (
                  <p>
                    {t("archiveDialog.sourceScene")}:{" "}
                    {sourceValue(archiveTarget)?.sceneTitle}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {archive.error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {apiErrorMessage(archive.error)}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setArchiveTarget(null)}
              disabled={archive.isPending}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              variant="danger"
              type="button"
              disabled={!archiveTarget || archive.isPending}
              onClick={() => {
                if (!archiveTarget) return;
                archive.mutate({
                  path: { projectId, dramaVideoId: archiveTarget.id },
                });
              }}
            >
              {archive.isPending
                ? t("archiveDialog.confirming")
                : t("common:actions.archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
