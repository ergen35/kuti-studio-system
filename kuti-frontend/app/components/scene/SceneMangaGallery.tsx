"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { toast } from "sonner";
import {
  ImageIcon,
  Download,
  Check,
  X,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Maximize2,
} from "lucide-react";
import {
  Button,
  Badge,
  EmptyState,
  LoadingState,
  ErrorState,
} from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useTranslation } from "~/hooks/useTranslation";
import type { UpdateSceneMangaPageData } from "~/lib/backend";
import type { ListSceneMangaPagesResponse } from "~/lib/backend/types.gen";

import {
  listSceneMangaPagesQueryKey,
  listSceneMangaPagesOptions,
  updateSceneMangaPageMutation,
  deleteSceneMangaPageMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { apiErrorMessage, backendUrl } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import { client } from "~/lib/backend-client";

type SceneMangaPage = ListSceneMangaPagesResponse[number];
type SceneMangaPageUpdateBody = UpdateSceneMangaPageData["body"];

function pageId(page: SceneMangaPage | undefined) {
  return typeof page?.id === "string" ? page.id : "";
}

function readyForExport(page: SceneMangaPage | undefined) {
  return page?.metadataJson?.readyForExport === true;
}

interface SceneMangaGalleryProps {
  projectId: string;
  sceneId: string;
}

export function SceneMangaGallery({
  projectId,
  sceneId,
}: SceneMangaGalleryProps) {
  const { t } = useTranslation("scene");
  const queryClient = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Fetch pages using SDK
  const pagesQuery = useQuery({
    ...listSceneMangaPagesOptions({
      client,
      path: { projectId, sceneId },
    }),
    refetchInterval: 10_000,
  });

  // Update page mutation using SDK
  const updatePage = useMutation({
    ...updateSceneMangaPageMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      void queryClient.invalidateQueries({
        queryKey: listSceneMangaPagesQueryKey({ path: { projectId, sceneId } }),
      });
      toast.success(t("common:toast.saved"));
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  // Delete page mutation using SDK
  const deletePage = useMutation({
    ...deleteSceneMangaPageMutation(),
    onSuccess: (_data, variables) => {
      const deletedPageId = variables.path.pageId;
      if (selectedPageId === deletedPageId) {
        setSelectedPageId(null);
        setLightboxOpen(false);
      }

      invalidateWorkspace(projectId);
      void queryClient.invalidateQueries({
        queryKey: listSceneMangaPagesQueryKey({ path: { projectId, sceneId } }),
      });
      toast.success(t("common:toast.deleted"));
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const pages = (pagesQuery.data ?? []) as SceneMangaPage[];
  const pageIndexById = useMemo(
    () => new Map(pages.map((page, index) => [page.id, index])),
    [pages],
  );
  const selectedPage = pages.find((p) => p.id === selectedPageId);
  const selectedPageReadyForExport = readyForExport(selectedPage);
  const isSelectedPageDeleting = selectedPage
    ? deletePage.isPending &&
      deletePage.variables?.path.pageId === selectedPage.id
    : false;

  useEffect(() => {
    setSelectedPageId(null);
    setLightboxOpen(false);
  }, [sceneId]);

  const openPage = (page: SceneMangaPage) => {
    setSelectedPageId(page.id);
    setLightboxOpen(true);
  };

  // Lightbox navigation
  const currentIndex = pages.findIndex((p) => p.id === selectedPageId);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < pages.length - 1;

  const goToPrevious = () => {
    if (canGoPrevious) {
      const nextIndex = currentIndex - 1;
      setSelectedPageId(pageId(pages[nextIndex]));
    }
  };

  const goToNext = () => {
    if (canGoNext) {
      const nextIndex = currentIndex + 1;
      setSelectedPageId(pageId(pages[nextIndex]));
    }
  };

  const deleteMangaPage = (pageId: string) => {
    deletePage.mutate({
      path: { projectId, sceneId, pageId },
    });
  };

  if (pagesQuery.isLoading) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <LoadingState label={t("mangaGallery.loading")} />
      </div>
    );
  }

  if (pagesQuery.error) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <ErrorState message={apiErrorMessage(pagesQuery.error)} />
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6">
        <EmptyState
          title={t("mangaGallery.empty.title")}
          description={t("mangaGallery.empty.description")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">
          {t("mangaGallery.generated")}
          <span className="ml-2 text-xs text-muted">({pages.length})</span>
        </h3>
      </div>

      {/* Pages Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
        {pages.map((page, index) => {
          const globalPageIndex = pageIndexById.get(page.id) ?? index;
          const canMoveUp = globalPageIndex > 0;
          const canMoveDown = globalPageIndex < pages.length - 1;

          return (
            <PageThumbnail
              key={page.id}
              page={page}
              index={index}
              onSelect={() => {
                openPage(page);
              }}
              onUpdate={(data) =>
                updatePage.mutate({
                  path: { projectId, sceneId, pageId: page.id },
                  body: data,
                })
              }
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onMoveUp={
                canMoveUp
                  ? () =>
                      updatePage.mutate({
                        path: { projectId, sceneId, pageId: page.id },
                        body: { pageNumber: page.pageNumber - 1 },
                      })
                  : undefined
              }
              onMoveDown={
                canMoveDown
                  ? () =>
                      updatePage.mutate({
                        path: { projectId, sceneId, pageId: page.id },
                        body: { pageNumber: page.pageNumber + 1 },
                      })
                  : undefined
              }
              onDelete={() =>
                deletePage.mutate({
                  path: { projectId, sceneId, pageId: page.id },
                })
              }
              isUpdating={updatePage.isPending}
              isDeleting={
                deletePage.isPending &&
                deletePage.variables?.path.pageId === page.id
              }
            />
          );
        })}
      </div>

      <Dialog
        open={lightboxOpen && Boolean(selectedPage)}
        onOpenChange={setLightboxOpen}
      >
        {selectedPage && (
          <DialogContent
            className="h-[92vh] max-w-[min(98vw,1600px)] overflow-hidden bg-ink text-white lg:max-w-[min(98vw,1760px)]"
            showCloseButton={false}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{t("mangaGallery.lightboxTitle")}</DialogTitle>
              <DialogDescription>
                {t("mangaGallery.lightboxDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <span className="text-white text-sm font-medium">
                  {t("mangaGallery.pageCounter", {
                    current: currentIndex + 1,
                    total: pages.length,
                  })}
                </span>
                <Badge
                  tone={
                    selectedPage.status === "selected"
                      ? "success"
                      : selectedPage.status === "rejected"
                        ? "danger"
                        : "default"
                  }
                >
                  {selectedPage.status}
                </Badge>
                {selectedPageReadyForExport ? (
                  <Badge tone="ready">{t("mangaGallery.readyForExport")}</Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = backendUrl(selectedPage.imageUrl);
                    link.download = `t${selectedPage.tomeId}-c${selectedPage.chapterId}-s${selectedPage.sceneId}-${selectedPage.pageNumber}.png`;
                    link.click();
                  }}
                  title={t("mangaGallery.download")}
                >
                  <Download />
                </Button>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => setLightboxOpen(false)}
                  title={t("actions.close")}
                >
                  <X />
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
              {canGoPrevious && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goToPrevious}
                  className="absolute left-4 text-white hover:bg-white/10"
                  title={t("mangaGallery.previous")}
                >
                  <ChevronLeft />
                </Button>
              )}
              {canGoNext && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goToNext}
                  className="absolute right-4 text-white hover:bg-white/10"
                  title={t("mangaGallery.next")}
                >
                  <ChevronRight />
                </Button>
              )}

              {backendUrl(selectedPage.imageUrl) && (
                <img
                  src={backendUrl(selectedPage.imageUrl)}
                  alt={t("mangaGallery.pageAlt", {
                    number: selectedPage.pageNumber,
                  })}
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              )}
            </div>

            <div className="flex items-center justify-center gap-2 border-t border-white/10 pt-3">
              <Button
                variant={selectedPageReadyForExport ? "primary" : "ghost"}
                className={
                  selectedPageReadyForExport
                    ? ""
                    : "text-white hover:bg-white/10"
                }
                onClick={() =>
                  updatePage.mutate({
                    path: { projectId, sceneId, pageId: selectedPage.id },
                    body: {
                      metadataJson: {
                        readyForExport: !selectedPageReadyForExport,
                      },
                    },
                  })
                }
                disabled={updatePage.isPending || deletePage.isPending}
              >
                <Check />
                {selectedPageReadyForExport
                  ? t("mangaGallery.unmarkReadyForExport")
                  : t("mangaGallery.markReadyForExport")}
              </Button>
              <Button
                variant={
                  selectedPage.status === "selected" ? "primary" : "ghost"
                }
                className={
                  selectedPage.status === "selected"
                    ? ""
                    : "text-white hover:bg-white/10"
                }
                onClick={() =>
                  updatePage.mutate({
                    path: { projectId, sceneId, pageId: selectedPage.id },
                    body: { status: "selected" },
                  })
                }
                disabled={updatePage.isPending || deletePage.isPending}
              >
                <Check />
                {t("mangaGallery.approve")}
              </Button>
              <Button
                variant={
                  selectedPage.status === "rejected" ? "primary" : "ghost"
                }
                className={
                  selectedPage.status === "rejected"
                    ? ""
                    : "text-white hover:bg-white/10"
                }
                onClick={() => deleteMangaPage(selectedPage.id)}
                disabled={updatePage.isPending || deletePage.isPending}
              >
                {isSelectedPageDeleting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <X />
                )}
                {t("mangaGallery.reject")}
              </Button>
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => deleteMangaPage(selectedPage.id)}
                disabled={updatePage.isPending || deletePage.isPending}
              >
                {isSelectedPageDeleting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Trash2 />
                )}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// Thumbnail Component
interface PageThumbnailProps {
  page: SceneMangaPage;
  index: number;
  onSelect: () => void;
  onUpdate: (data: SceneMangaPageUpdateBody) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

function PageThumbnail({
  page,
  onSelect,
  onUpdate,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDelete,
  isUpdating,
  isDeleting,
}: PageThumbnailProps) {
  const { t } = useTranslation("scene");
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group relative aspect-[3/4] min-w-[200px] w-[200px] md:min-w-[260px] md:w-[260px] flex-shrink-0 snap-start rounded-lg border border-line bg-surface overflow-hidden cursor-pointer"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Image */}
      {backendUrl(page.imageUrl) ? (
        <img
          src={backendUrl(page.imageUrl)}
          alt={t("mangaGallery.pageAlt", { number: page.pageNumber })}
          className="w-full h-full object-cover"
          onClick={onSelect}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-2">
          <ImageIcon size={32} className="text-muted" />
        </div>
      )}

      {/* Status Badge */}
      <div className="absolute top-2 left-2 flex flex-col gap-1">
        <Badge
          tone={
            page.status === "selected"
              ? "success"
              : page.status === "rejected"
                ? "danger"
                : "default"
          }
          className="text-[10px]"
        >
          {page.status}
        </Badge>
        {readyForExport(page) ? (
          <Badge tone="ready" className="text-[10px]">
            {t("mangaGallery.readyForExport")}
          </Badge>
        ) : null}
      </div>

      {/* Page Number */}
      <div className="absolute top-2 right-2">
        <span className="text-xs font-medium text-white bg-ink/50 px-1.5 py-0.5 rounded">
          P.{page.pageNumber}
        </span>
      </div>

      {/* Hover Overlay */}
      <div
        className={clsx(
          "absolute inset-0 flex flex-col justify-end transition-opacity duration-150",
          showActions ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      >
        {/* Dark overlay for contrast */}
        <div className="absolute inset-0 bg-black/40" />

        {/* View button - centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            variant="ghost"
            className="border-2 border-white bg-black/70 text-white shadow-xl hover:bg-black/90"
            onClick={onSelect}
          >
            <Maximize2 size={16} className="mr-1.5" />
            {t("mangaGallery.view")}
          </Button>
        </div>

        {/* Action buttons - bottom bar */}
        <div className="relative flex items-center justify-center gap-2 p-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onMoveUp}
            disabled={!canMoveUp || isUpdating}
            title={t("mangaGallery.moveUp")}
            aria-label={t("mangaGallery.moveUp")}
            className="size-9 p-0 rounded-md border-2 border-white bg-black/70 text-white shadow-xl hover:bg-black/90 disabled:opacity-40"
          >
            <ChevronUp size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onMoveDown}
            disabled={!canMoveDown || isUpdating}
            title={t("mangaGallery.moveDown")}
            aria-label={t("mangaGallery.moveDown")}
            className="size-9 p-0 rounded-md border-2 border-white bg-black/70 text-white shadow-xl hover:bg-black/90 disabled:opacity-40"
          >
            <ChevronDown size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onUpdate({ status: "selected" })}
            disabled={isUpdating}
            className={clsx(
              "size-9 p-0 rounded-md border-2 shadow-xl",
              page.status === "selected"
                ? "border-success bg-success text-white hover:bg-success/90"
                : "border-white bg-black/70 text-white hover:border-success hover:bg-success",
            )}
          >
            <Check size={18} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onDelete}
            disabled={isUpdating || isDeleting}
            className="size-9 p-0 rounded-md border-2 border-white bg-black/70 text-white shadow-xl hover:border-danger hover:bg-danger"
          >
            {isDeleting ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Trash2 size={18} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
