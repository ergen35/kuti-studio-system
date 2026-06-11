"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  X,
  BookOpen,
} from "lucide-react";
import { Button, Badge, EmptyState, LoadingState } from "~/components/ui";
import {
  Dialog,
  DialogContent,
} from "~/components/ui/dialog";
import { useTranslation } from "~/hooks/useTranslation";
import { listChapterMangaPagesOptions } from "~/lib/backend/@tanstack/react-query.gen";
import type { ListChapterMangaPagesResponse } from "~/lib/backend/types.gen";
import { backendUrl } from "~/lib/errors";

type ChapterMangaPage = ListChapterMangaPagesResponse[number];

interface ChapterMangaPreviewProps {
  projectId: string;
  chapterId: string;
}

export function ChapterMangaPreview({
  projectId,
  chapterId,
}: ChapterMangaPreviewProps) {
  const { t } = useTranslation("story");
  const [selectedPage, setSelectedPage] = useState<ChapterMangaPage | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const pagesQuery = useQuery({
    ...listChapterMangaPagesOptions({
      path: { projectId, chapterId },
    }),
    enabled: !!projectId && !!chapterId,
  });

  const pages = pagesQuery.data ?? [];

  const groupedByScene = pages.reduce(
    (acc, page) => {
      const key = page.sceneId;
      if (!acc[key]) {
        acc[key] = {
          sceneId: page.sceneId,
          sceneTitle: page.sceneTitle,
          sceneOrderIndex: page.sceneOrderIndex,
          pages: [],
        };
      }
      acc[key].pages.push(page);
      return acc;
    },
    {} as Record<
      string,
      {
        sceneId: string;
        sceneTitle: string;
        sceneOrderIndex: number;
        pages: ChapterMangaPage[];
      }
    >
  );

  const sceneGroups = Object.values(groupedByScene).sort(
    (a, b) => a.sceneOrderIndex - b.sceneOrderIndex
  );

  const handlePageClick = (page: ChapterMangaPage) => {
    const index = pages.findIndex((p) => p.id === page.id);
    setSelectedPage(page);
    setSelectedIndex(index);
  };

  const handleClose = () => {
    setSelectedPage(null);
  };

  const handleNavigate = (direction: "prev" | "next") => {
    const newIndex =
      direction === "prev"
        ? Math.max(0, selectedIndex - 1)
        : Math.min(pages.length - 1, selectedIndex + 1);
    setSelectedIndex(newIndex);
    setSelectedPage(pages[newIndex]);
  };

  const getImageUrl = (page: ChapterMangaPage): string | null => {
    const url = page.imageUrl;
    if (!url || typeof url !== "string") return null;
    if (url.startsWith("http")) return url;
    return backendUrl(url);
  };

  if (pagesQuery.isLoading) {
    return <LoadingState />;
  }

  if (pages.length === 0) {
    return (
      <EmptyState
        title={t("chapterPreview.empty")}
        description={t("chapterPreview.emptyDescription")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t("chapterPreview.totalPages", { count: pages.length })}
          </span>
        </div>
      </div>

      {sceneGroups.map((group) => (
        <div key={group.sceneId} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone="info" className="text-xs">
              {t("chapterPreview.scene")} {group.sceneOrderIndex + 1}
            </Badge>
            <span className="text-sm font-medium">{group.sceneTitle}</span>
            <span className="text-xs text-muted-foreground">
              ({group.pages.length} {group.pages.length === 1 ? "page" : "pages"})
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {group.pages.map((page) => {
              const imageUrl = getImageUrl(page);
              return (
                <div
                  key={page.id}
                  className={clsx(
                    "relative aspect-[2/3] rounded-md overflow-hidden cursor-pointer",
                    "border border-border bg-card",
                    "transition-all duration-200 hover:border-primary hover:shadow-md hover:scale-105"
                  )}
                  onClick={() => handlePageClick(page)}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={page.label}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <ImageIcon size={16} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                    <span className="text-[10px] text-white font-medium">
                      {page.pageNumber}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Lightbox */}
      <Dialog open={!!selectedPage} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          <div className="relative flex items-center justify-center min-h-[80vh]">
            {/* Close button */}
            <Button
              variant="icon"
              className="absolute top-4 right-4 z-10 text-white hover:bg-white/10"
              onClick={handleClose}
            >
              <X size={24} />
            </Button>

            {/* Navigation */}
            {selectedIndex > 0 && (
              <Button
                variant="icon"
                className="absolute left-4 z-10 text-white hover:bg-white/10"
                onClick={() => handleNavigate("prev")}
              >
                <ChevronLeft size={32} />
              </Button>
            )}
            {selectedIndex < pages.length - 1 && (
              <Button
                variant="icon"
                className="absolute right-4 z-10 text-white hover:bg-white/10"
                onClick={() => handleNavigate("next")}
              >
                <ChevronRight size={32} />
              </Button>
            )}

            {/* Image */}
            {selectedPage && getImageUrl(selectedPage) && (
              <img
                src={getImageUrl(selectedPage)!}
                alt={selectedPage.label}
                className="max-h-[80vh] max-w-full object-contain"
              />
            )}

            {/* Page info */}
            {selectedPage && (
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <Badge className="bg-white/10 text-white border-white/20">
                  {selectedPage.sceneTitle} - Page {selectedPage.pageNumber}
                </Badge>
                <span className="ml-2 text-xs text-white/60">
                  ({selectedIndex + 1} / {pages.length})
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
