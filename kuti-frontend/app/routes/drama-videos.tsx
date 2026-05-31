import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Clapperboard, Film, ImageIcon, Loader2, Play } from "lucide-react";
import { AppShell } from "~/components/layout";
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, SectionTitle, Stat } from "~/components/ui";
import { listProjectDramaVideosOptions } from "~/lib/backend/@tanstack/react-query.gen";
import type { ListProjectDramaVideosResponse } from "~/lib/backend/types.gen";
import { apiErrorMessage, backendUrl } from "~/lib/errors";
import { useTranslation } from "~/hooks/useTranslation";

type DramaVideo = ListProjectDramaVideosResponse[number];
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

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sourceValue(video: DramaVideo): DramaVideoSource | null {
  return video.source && typeof video.source === "object" ? video.source as DramaVideoSource : null;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isLocalFallback(video: DramaVideo) {
  return metadataRecord(video.metadata).localFallbackUsed === true;
}

function providerFailureMessage(video: DramaVideo) {
  return stringValue(metadataRecord(video.metadata).providerFailureMessage);
}

export default function DramaVideosRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(["drama", "common"]);

  const videosQuery = useQuery({
    ...listProjectDramaVideosOptions({ path: { projectId } }),
    enabled: !!projectId,
    refetchInterval: 15_000,
  });

  const videos = (videosQuery.data ?? []) as ListProjectDramaVideosResponse;

  const stats = useMemo(() => ({
    total: videos.length,
    ready: videos.filter((video) => video.status === "ready").length,
    running: videos.filter((video) => video.status === "running" || video.status === "queued").length,
    failed: videos.filter((video) => video.status === "failed").length,
  }), [videos]);

  return (
    <AppShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={<Badge tone="info">{t("style")}</Badge>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat value={stats.total} label={t("stats.total")} />
        <Stat value={stats.ready} label={t("stats.ready")} />
        <Stat value={stats.running} label={t("stats.running")} />
        <Stat value={stats.failed} label={t("stats.failed")} />
      </div>

      {videosQuery.isLoading ? <LoadingState label={t("common:states.loading")} /> : null}
      {videosQuery.error ? <ErrorState message={apiErrorMessage(videosQuery.error)} /> : null}

      {!videosQuery.isLoading && !videosQuery.error && videos.length === 0 ? (
        <EmptyState title={t("empty.title")} description={t("empty.description")} />
      ) : null}

      {videos.length > 0 ? (
        <section className="grid gap-3">
          <SectionTitle title={t("library")} meta={`${videos.length} ${t("common:meta.total")}`} />
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {videos.map((video) => {
              const source = sourceValue(video);
              const scenePath = source
                ? `/projects/${projectId}/story/${source.tomeId}/scenes/${source.sceneId}`
                : `/projects/${projectId}/story`;
              const videoUrl = backendUrl(video.videoUrl);
              const pageImageUrl = source ? backendUrl(source.pageImageUrl) : "";
              const localFallback = isLocalFallback(video);
              const providerFailure = providerFailureMessage(video);

              return (
                <Card key={video.id} className="overflow-hidden">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="grid size-10 place-items-center rounded-md border border-border bg-secondary text-primary">
                        <Clapperboard size={18} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-foreground">{video.title}</h2>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{video.modelKey || t("defaultModel")}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={video.status}>{video.status}</Badge>
                      {localFallback ? <Badge tone="warning">{t("localFallback")}</Badge> : null}
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {videoUrl && video.status === "ready" ? (
                      <video src={videoUrl} controls className="aspect-video w-full rounded-md bg-black" />
                    ) : pageImageUrl ? (
                      <div className="relative aspect-video overflow-hidden rounded-md bg-secondary">
                        <img src={pageImageUrl} alt="" className="h-full w-full object-cover opacity-60" />
                        <div className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                          {video.status === "running" || video.status === "queued" ? <Loader2 className="animate-spin" /> : <Play />}
                        </div>
                      </div>
                    ) : (
                      <div className="grid aspect-video place-items-center rounded-md border border-dashed border-border bg-secondary/40 text-muted-foreground">
                        <ImageIcon />
                      </div>
                    )}

                    {source ? (
                      <div className="grid gap-1 rounded-md border border-border bg-secondary/25 p-3 text-xs text-muted-foreground">
                        <strong className="font-medium text-foreground">{source.sceneTitle}</strong>
                        <span>{source.tomeTitle} / {source.chapterTitle} / {t("page", { number: source.pageNumber })}</span>
                      </div>
                    ) : null}

                    {stringValue(video.errorMessage) ? (
                      <p className="rounded-md border border-danger/30 bg-danger/10 p-2 text-xs text-danger">{stringValue(video.errorMessage)}</p>
                    ) : null}

                    {localFallback && providerFailure ? (
                      <p className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
                        {t("fallbackReason", { reason: providerFailure })}
                      </p>
                    ) : null}

                    <Link to={scenePath} className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-2.5 text-sm font-medium hover:border-primary/35 hover:bg-primary/8">
                      <Film size={14} />
                      {t("openScene")}
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
