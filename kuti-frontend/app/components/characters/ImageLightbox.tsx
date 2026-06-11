import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { ListCharacterImagesResponse } from "~/lib/backend";
import { Button } from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useTranslation } from "~/hooks/useTranslation";
import {
  characterImageUrlFromData,
  type CharacterImageWithUrl,
} from "~/lib/image-urls";

interface ImageLightboxProps {
  image: ListCharacterImagesResponse[number] | null;
  isOpen: boolean;
  onClose: () => void;
  images?: ListCharacterImagesResponse[number][];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

export function ImageLightbox({
  image,
  isOpen,
  onClose,
  images = [],
  currentIndex = 0,
  onNavigate,
}: ImageLightboxProps) {
  const { t } = useTranslation("characters");
  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && onNavigate && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (
        e.key === "ArrowRight" &&
        onNavigate &&
        currentIndex < images.length - 1
      ) {
        onNavigate(currentIndex + 1);
      }
    },
    [isOpen, onClose, onNavigate, currentIndex, images.length],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  // Get image URL using publicUrl or fallback
  const getImageUrl = (img: CharacterImageWithUrl) =>
    characterImageUrlFromData(img);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  return (
    <Dialog
      open={isOpen && Boolean(image)}
      onOpenChange={(open) => !open && onClose()}
    >
      {image && (
        <DialogContent
          className="grid h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-none gap-0 overflow-hidden rounded-none border border-white/10 bg-zinc-950 p-0 text-white shadow-2xl sm:h-[calc(100vh-1.5rem)] sm:w-[calc(100vw-1.5rem)] sm:rounded-3xl lg:h-[calc(100vh-0.5rem)] lg:w-[calc(100vw-0.5rem)] xl:h-[calc(100vh-0.25rem)] xl:w-[calc(100vw-0.25rem)]"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{t("generation.lightbox.title")}</DialogTitle>
          </DialogHeader>

          <div className="relative flex h-full min-h-0 items-center justify-center bg-black">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_55%)]" />

            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 sm:right-4 sm:top-4"
              title={t("generation.lightbox.close")}
            >
              <X />
            </Button>

            {hasPrev && onNavigate && (
              <Button
                type="button"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(currentIndex - 1);
                }}
                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 sm:left-4"
                title={t("generation.lightbox.previous")}
              >
                <ChevronLeft />
              </Button>
            )}

            {hasNext && onNavigate && (
              <Button
                type="button"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(currentIndex + 1);
                }}
                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 sm:right-4"
                title={t("generation.lightbox.next")}
              >
                <ChevronRight />
              </Button>
            )}

            <img
              src={getImageUrl(image)}
              alt={image.fileName}
              className="relative z-10 h-full w-full max-h-full max-w-full object-contain p-1 sm:p-2 lg:p-1"
            />

            {images.length > 1 && (
              <span className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
