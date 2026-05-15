"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Check, ImageIcon, X } from "lucide-react";
import { Button } from "~/components/ui";
import type { Character, CharacterImage } from "~/lib/api";
import { api } from "~/lib/api";

interface CharacterImageSelectorProps {
  projectId: string;
  characters: Character[];
  characterImages: Record<string, CharacterImage>;
  selectedImages: Record<string, string>;
  onSelect: (characterSlug: string, imageId: string | null) => void;
}

export function CharacterImageSelector({
  projectId,
  characters,
  characterImages,
  selectedImages,
  onSelect,
}: CharacterImageSelectorProps) {
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);

  if (characters.length === 0) {
    return (
      <div className="text-sm text-muted p-3 bg-surface-2/30 rounded-lg">
        Aucun personnage dans cette scène.
      </div>
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
            <button
              onClick={() => setExpandedCharacter(isExpanded ? null : character.slug)}
              className="w-full flex items-center justify-between p-3 hover:bg-surface-2/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    hasImage ? "bg-accent/10" : "bg-muted/20"
                  )}
                >
                  {selectedImageId ? (
                    <img
                      src={api.characterImageUrl(projectId, character.id, selectedImageId)}
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
                      ? "Image de référence sélectionnée"
                      : hasImage
                      ? "Image disponible"
                      : "Pas d'image générée"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedImageId && (
                  <span className="text-xs px-2 py-0.5 rounded bg-success/20 text-success">
                    Sélectionné
                  </span>
                )}
                <span className="text-xs text-muted">{isExpanded ? "▲" : "▼"}</span>
              </div>
            </button>

            {isExpanded && hasImage && (
              <div className="p-3 border-t border-line bg-surface-2/20">
                <div className="grid grid-cols-4 gap-2">
                  {/* Option: aucune image */}
                  <button
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
                  </button>

                  {/* Image actuelle du personnage */}
                  {characterImages[character.slug] && (
                    <button
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
                        src={api.characterImageUrl(
                          projectId,
                          character.id,
                          characterImages[character.slug].id
                        )}
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                      {selectedImageId === characterImages[character.slug].id && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                          <Check size={12} className="text-accent-ink" />
                        </div>
                      )}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted mt-2">
                  Sélectionnez l'image à utiliser comme référence visuelle pour ce personnage.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
