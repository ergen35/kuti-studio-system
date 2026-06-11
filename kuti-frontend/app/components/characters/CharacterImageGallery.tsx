import { useState } from "react";
import { clsx } from "clsx";
import { Image, Trash2, Star } from "lucide-react";
import {
  characterImageUrlFromData,
  type CharacterImageWithUrl,
} from "~/lib/image-urls";
import type { ListCharacterImagesResponse } from "~/lib/backend";
import { Button } from "~/components/ui";
import { Badge } from "~/components/ui/badge";
import { useTranslation } from "~/hooks/useTranslation";

type CharacterImage = ListCharacterImagesResponse[number];

interface CharacterImageGalleryProps {
  images: CharacterImage[];
  projectId: string;
  characterId: string;
  onImageClick: (image: CharacterImage, index: number) => void;
  onDelete?: (image: CharacterImage) => void;
  onSetActive?: (image: CharacterImage) => void;
}

export function CharacterImageGallery({
  images = [],
  projectId,
  characterId,
  onImageClick,
  onDelete,
  onSetActive,
}: CharacterImageGalleryProps) {
  const { t } = useTranslation("characters");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Build image URL from API response using publicUrl or fallback
  const getImageUrl = (image: CharacterImageWithUrl) =>
    characterImageUrlFromData(image);

  // Get readable strategy name
  const getStrategyLabel = (strategy: string | null) => {
    if (!strategy) return "";
    const labels: Record<string, string> = {
      portrait: t("generation.strategy.portrait"),
      full_body: t("generation.strategy.full_body"),
      concept: t("generation.strategy.concept"),
    };
    return labels[strategy] || strategy;
  };

  const getKindLabel = (kind: string) => {
    const labels: Record<string, string> = {
      character_sheet: t("generation.kind.character_sheet"),
      free_image: t("generation.kind.free_image"),
    };

    return labels[kind] || kind;
  };

  // Get readable style name
  const getStyleLabel = (style: string | null) => {
    if (!style) return "";
    const labels: Record<string, string> = {
      realistic: t("generation.style.realistic"),
      anime: t("generation.style.anime"),
      illustration: t("generation.style.illustration"),
      watercolor: t("generation.style.watercolor"),
    };
    return labels[style] || style;
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-6">
        <Image size={32} className="mx-auto text-muted/50 mb-2" />
        <p className="text-sm text-muted">{t("images.empty")}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {images.map((image, index) => (
        <div
          key={image.id}
          className={clsx(
            "relative aspect-square rounded-lg overflow-hidden cursor-pointer",
            "border border-line bg-surface-2",
            "transition-all duration-200 hover:border-accent hover:shadow-sm",
          )}
          onMouseEnter={() => setHoveredId(image.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onImageClick(image, index)}
        >
          <img
            src={getImageUrl(image)}
            alt={image.fileName}
            className="w-full h-full object-cover"
            loading="lazy"
          />

          {/* Active badge for character sheets - always visible */}
          {image.kind === "character_sheet" && image.isActive && (
            <Badge
              variant="default"
              className="absolute top-2 left-2 bg-emerald-500 text-white text-xs"
            >
              {t("status.active")}
            </Badge>
          )}

          {/* Hover overlay with metadata */}
          {hoveredId === image.id && (
            <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm flex flex-col justify-end p-2">
              <div className="flex items-center gap-1 flex-wrap">
                {typeof image.kind === "string" && (
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    {getKindLabel(image.kind)}
                  </Badge>
                )}
                {typeof image.strategy === "string" && (
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    {getStrategyLabel(image.strategy)}
                  </Badge>
                )}
                {typeof image.style === "string" && (
                  <Badge variant="secondary" className="bg-white/10 text-white">
                    {getStyleLabel(image.style)}
                  </Badge>
                )}
              </div>
              <div className="absolute top-2 right-2 flex gap-1">
                {/* Set as active button - only for non-active character sheets */}
                {onSetActive && image.kind === "character_sheet" && !image.isActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetActive(image);
                    }}
                    className="bg-surface/90 text-amber-500 hover:bg-amber-500 hover:text-white"
                    aria-label={t("actions.setActive")}
                    title={t("actions.setActive")}
                  >
                    <Star size={12} />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(image);
                    }}
                    className="bg-surface/90 text-danger hover:bg-danger hover:text-white"
                    aria-label={t("actions.delete")}
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
