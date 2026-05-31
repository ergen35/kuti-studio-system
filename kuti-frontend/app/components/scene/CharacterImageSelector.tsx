"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Check, ImageIcon, X } from "lucide-react";
import { Button } from "~/components/ui";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { useTranslation } from "~/hooks/useTranslation";
import type { ListCharactersResponse, GetProjectCharacterImagesResponse } from "~/lib/backend";
import { characterImageUrlFromData, type CharacterImageWithUrl } from "~/lib/image-urls";

type Character = ListCharactersResponse[number];
type CharacterImage = GetProjectCharacterImagesResponse[string][number];

interface CharacterImageSelectorProps {
  projectId: string;
  characters: Character[];
  characterImages: Record<string, CharacterImage>;
  selectedImages: Record<string, string>;
  onSelect: (characterSlug: string, imageId: string | null) => void;
}

// Helper to convert CharacterImage to CharacterImageWithUrl
function getImageUrl(image: CharacterImage | undefined, projectId: string, characterId: string): string {
  if (!image) return '';
  return characterImageUrlFromData({
    id: image.id,
    projectId: image.projectId || projectId,
    characterId: image.characterId || characterId,
    fileName: image.fileName,
    publicUrl: (image as unknown as CharacterImageWithUrl).publicUrl,
  });
}

export function CharacterImageSelector({
  projectId,
  characters,
  characterImages,
  selectedImages,
  onSelect,
}: CharacterImageSelectorProps) {
  const { t } = useTranslation("scene");
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);

  if (characters.length === 0) {
    return (
      <Alert>
        <AlertDescription>{t("characterSelector.empty")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2">
      {characters.map((character) => {
        const hasImage = character.slug in characterImages;
        const selectedImageId = selectedImages[character.slug];
        const isExpanded = expandedCharacter === character.slug;

        return (
          <div
            key={character.slug}
            className="border border-line rounded-lg bg-surface overflow-hidden"
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => setExpandedCharacter(isExpanded ? null : character.slug)}
              className="w-full justify-between p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    hasImage ? "bg-accent/10" : "bg-muted/20"
                  )}
                >
                  {selectedImageId && characterImages[character.slug] ? (
                    <img
                      src={getImageUrl(characterImages[character.slug], projectId, character.id)}
                      alt={character.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : hasImage ? (
                    <ImageIcon size={18} className="text-accent" />
                  ) : (
                    <span className="text-lg">👤</span>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-ink">{character.name}</p>
                  <p className="text-xs text-muted">
                    {selectedImageId
                      ? t("characterSelector.referenceSelected")
                      : hasImage
                      ? t("characterSelector.imageAvailable")
                      : t("characterSelector.noImage")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedImageId && (
                  <Badge variant="secondary">{t("characterSelector.selected")}</Badge>
                )}
                <span className="text-xs text-muted">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </Button>

            {isExpanded && hasImage && (
              <div className="p-3 border-t border-line bg-surface-2/20">
                <div className="grid grid-cols-4 gap-2">
                  {/* Option: aucune image */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelect(character.slug, null)}
                    className={clsx(
                      "aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all",
                      !selectedImageId
                        ? "border-accent bg-accent/10"
                        : "border-line hover:border-accent/50"
                    )}
                  >
                    <X size={20} className="text-muted" />
                    <span className="text-[10px] text-muted">Auto</span>
                  </Button>

                  {/* Image actuelle du personnage */}
                  {characterImages[character.slug] && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        onSelect(character.slug, characterImages[character.slug].id)
                      }
                      className={clsx(
                        "aspect-square rounded-lg border-2 overflow-hidden transition-all",
                        selectedImageId === characterImages[character.slug].id
                          ? "border-accent ring-2 ring-accent/20"
                          : "border-line hover:border-accent/50"
                      )}
                    >
                      <img
                        src={getImageUrl(characterImages[character.slug], projectId, character.id)}
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedImageId === characterImages[character.slug].id && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                          <Check size={12} className="text-accent-ink" />
                        </div>
                      )}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted mt-2">
                  {t("characterSelector.help")}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
