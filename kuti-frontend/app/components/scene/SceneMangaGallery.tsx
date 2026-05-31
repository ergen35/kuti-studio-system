"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  ImageIcon,
  Download,
  Check,
  X,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import { Button, Badge, EmptyState, LoadingState, ErrorState } from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useTranslation } from "~/hooks/useTranslation";
import type { ListSceneMangaPagesResponse } from "~/lib/backend/types.gen";

type SceneMangaPage = ListSceneMangaPagesResponse[number];

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function pageId(page: SceneMangaPage | undefined) {
  return typeof page?.id === "string" ? page.id : "";
}
import {
  listSceneMangaPagesOptions,
  updateSceneMangaPageMutation,
  deleteSceneMangaPageMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import { client } from "~/lib/backend-client";

interface SceneMangaGalleryProps {
  projectId: string;
  sceneId: string;
}

export function SceneMangaGallery({ projectId, sceneId }: SceneMangaGalleryProps) {
  const { t } = useTranslation("scene");
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Fetch pages using SDK
  const pagesQuery = useQuery({
    ...listSceneMangaPagesOptions({
      client,
      path: { projectId, sceneId },
    }),
  });

  // Update page mutation using SDK
  const updatePage = useMutation({
    ...updateSceneMangaPageMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
    },
  });

  // Delete page mutation using SDK
  const deletePage = useMutation({
    ...deleteSceneMangaPageMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
    },
  });

  const pages = pagesQuery.data ?? [];
  const selectedPage = pages.find((p) => p.id === selectedPageId);

  // Lightbox navigation
  const currentIndex = pages.findIndex((p) => p.id === selectedPageId);
  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < pages.length - 1;

  const goToPrevious = () => {
    if (canGoPrevious) {
      setSelectedPageId(pageId(pages[currentIndex - 1]));
    }
  };

  const goToNext = () => {
    if (canGoNext) {
      setSelectedPageId(pageId(pages[currentIndex + 1]));
    }
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink">
          {t("mangaGallery.generated")}
          <span className="ml-2 text-xs text-muted">({pages.length})</span>
        </h3>
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {pages.map((page, index) => (
          <PageThumbnail
            key={page.id}
            page={page}
            index={index}
            onSelect={() => {
              setSelectedPageId(page.id);
              setLightboxOpen(true);
            }}
            onUpdate={(data) => updatePage.mutate({
              path: { projectId, sceneId, pageId: page.id },
              body: data,
            })}
            onDelete={() => deletePage.mutate({
              path: { projectId, sceneId, pageId: page.id },
            })}
            isUpdating={updatePage.isPending}
            isDeleting={deletePage.isPending && deletePage.variables?.path.pageId === page.id}
          />
        ))}
      </div>

      <Dialog open={lightboxOpen && Boolean(selectedPage)} onOpenChange={setLightboxOpen}>
        {selectedPage && (
          <DialogContent className="h-[92vh] max-w-[min(96vw,1200px)] overflow-hidden bg-ink text-white" showCloseButton={false}>
            <DialogHeader className="sr-only">
              <DialogTitle>{t("mangaGallery.lightboxTitle")}</DialogTitle>
              <DialogDescription>{t("mangaGallery.lightboxDescription")}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-medium">
                {t("mangaGallery.pageCounter", { current: currentIndex + 1, total: pages.length })}
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
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10"
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = stringValue(selectedPage.imageUrl);
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

            {stringValue(selectedPage.imageUrl) && (
              <img
                src={stringValue(selectedPage.imageUrl)}
                alt={t("mangaGallery.pageAlt", { number: selectedPage.pageNumber })}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            )}
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-white/10 pt-3">
            <Button
              variant={selectedPage.status === "selected" ? "primary" : "ghost"}
              className={selectedPage.status === "selected" ? "" : "text-white hover:bg-white/10"}
              onClick={() =>
                updatePage.mutate({
                  path: { projectId, sceneId, pageId: selectedPage.id },
                  body: { status: "selected" },
                })
              }
              disabled={updatePage.isPending}
            >
              <Check />
              {t("mangaGallery.approve")}
            </Button>
            <Button
              variant={selectedPage.status === "rejected" ? "primary" : "ghost"}
              className={selectedPage.status === "rejected" ? "" : "text-white hover:bg-white/10"}
              onClick={() =>
                updatePage.mutate({
                  path: { projectId, sceneId, pageId: selectedPage.id },
                  body: { status: "rejected" },
                })
              }
              disabled={updatePage.isPending}
            >
              <X />
              {t("mangaGallery.reject")}
            </Button>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => deletePage.mutate({
                path: { projectId, sceneId, pageId: selectedPage.id },
              })}
              disabled={deletePage.isPending}
            >
              {deletePage.isPending ? (
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
  onUpdate: (data: { status: "draft" | "selected" | "rejected" }) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

function PageThumbnail({
  page,
  index,
  onSelect,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: PageThumbnailProps) {
  const { t } = useTranslation("scene");
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group relative aspect-[3/4] rounded-lg border border-line bg-surface overflow-hidden cursor-pointer"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Image */}
      {stringValue(page.imageUrl) ? (
        <img
          src={stringValue(page.imageUrl)}
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
      <div className="absolute top-2 left-2">
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
      </div>

      {/* Page Number */}
      <div className="absolute top-2 right-2">
        <span className="text-xs font-medium text-white bg-ink/50 px-1.5 py-0.5 rounded">
          P.{page.pageNumber}
        </span>
      </div>

      {/* Hover Actions */}
      {showActions && (
        <div className="absolute inset-0 bg-ink/60 flex flex-col items-center justify-center gap-2">
          <Button variant="ghost" className="text-white" onClick={onSelect}>
            <Maximize2 size={16} className="mr-1" />
            {t("mangaGallery.view")}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onUpdate({ status: "selected" })}
              disabled={isUpdating}
              className={clsx(
                "text-white",
                page.status === "selected"
                  ? "bg-success text-success-ink"
                  : "bg-white/20 text-white hover:bg-success/80"
              )}
            >
              <Check size={14} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onUpdate({ status: "rejected" })}
              disabled={isUpdating}
              className={clsx(
                "text-white",
                page.status === "rejected"
                  ? "bg-danger text-danger-ink"
                  : "bg-white/20 text-white hover:bg-danger/80"
              )}
            >
              <X size={14} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={isDeleting}
              className="bg-white/20 text-white hover:bg-danger/80"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
