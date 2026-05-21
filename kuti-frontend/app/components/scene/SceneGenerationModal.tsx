"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { X, Sparkles, Eye, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "~/hooks/useTranslation";
import { Button, Badge, ErrorState, LoadingState } from "~/components/ui";
import { CharacterImageSelector } from "./CharacterImageSelector";
import type { Scene, SceneGenerationConfig, Character, CharacterImage } from "~/lib/backend/types.gen";
import {
  listSceneConfigsOptions,
  generateSceneMangaMutation,
  previewPromptMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import { client } from "~/lib/backend-client";

interface SceneGenerationModalProps {
  projectId: string;
  scene: Scene;
  characters: Character[];
  characterImages: Record<string, CharacterImage>;
  isOpen: boolean;
  onClose: () => void;
}

export function SceneGenerationModal({
  projectId,
  scene,
  characters,
  characterImages,
  isOpen,
  onClose,
}: SceneGenerationModalProps) {
  const { t } = useTranslation("scene");

  // State
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [imageCount, setImageCount] = useState(1);
  const [selectedCharacterImages, setSelectedCharacterImages] = useState<Record<string, string>>({});
  const [additionalContext, setAdditionalContext] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Fetch configs
  const configs = useQuery({
    ...listSceneConfigsOptions({ client, path: { projectId, sceneId: scene.id } }),
    enabled: isOpen,
  });

  // Set default config when loaded
  useEffect(() => {
    if (configs.data && configs.data.length > 0 && !selectedConfigId) {
      const defaultConfig = configs.data.find((c) => c.isDefault) || configs.data[0];
      setSelectedConfigId(defaultConfig.id);
      setImageCount(defaultConfig.defaultImageCount);
    }
  }, [configs.data, selectedConfigId]);

  const selectedConfig = configs.data?.find((c) => c.id === selectedConfigId);

  // Preview mutation
  const preview = useMutation({
    ...previewPromptMutation(),
  });

  // Generate mutation
  const generate = useMutation({
    ...generateSceneMangaMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      onClose();
    },
  });

  // Handle character image selection
  const handleCharacterImageSelect = (characterSlug: string, imageId: string | null) => {
    setSelectedCharacterImages((prev) => {
      const next = { ...prev };
      if (imageId) {
        next[characterSlug] = imageId;
      } else {
        delete next[characterSlug];
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-surface shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-surface-2/30 shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-accent" />
            <h2 className="text-lg font-semibold text-ink">{t("generation.title") || "Générer Planche Manga"}</h2>
          </div>
          <Button variant="ghost" className="p-1 h-auto" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {configs.isLoading && <LoadingState label="Chargement des configurations..." />}
          {configs.error && (
            <ErrorState message={apiErrorMessage(configs.error)} />
          )}

          {configs.data && (
            <>
              {/* Config Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">Configuration</label>
                <select
                  value={selectedConfigId}
                  onChange={(e) => {
                    const config = configs.data?.find((c) => c.id === e.target.value);
                    setSelectedConfigId(e.target.value);
                    if (config) {
                      setImageCount(config.defaultImageCount);
                    }
                  }}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                >
                  {configs.data.map((config) => (
                    <option key={config.id} value={config.id}>
                      {config.name} {config.isDefault ? "(Défaut)" : ""}
                    </option>
                  ))}
                </select>
                {selectedConfig && (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge tone={selectedConfig.colorMode === "bw" ? "default" : "info"}>
                      {selectedConfig.colorMode === "bw" ? "Noir & Blanc" : "Couleur"}
                    </Badge>
                    <Badge tone="default">{selectedConfig.stylePreset}</Badge>
                  </div>
                )}
              </div>

              {/* Image Count */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">Nombre de planches</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setImageCount(Math.max(1, imageCount - 1))}
                    className="w-8 h-8 rounded-lg border border-line hover:bg-surface-2 flex items-center justify-center"
                    disabled={imageCount <= 1}
                  >
                    -
                  </button>
                  <span className="w-8 text-center font-medium">{imageCount}</span>
                  <button
                    onClick={() => setImageCount(Math.min(5, imageCount + 1))}
                    className="w-8 h-8 rounded-lg border border-line hover:bg-surface-2 flex items-center justify-center"
                    disabled={imageCount >= 5}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Character References */}
              {characters.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-ink">Références Personnages</label>
                  <CharacterImageSelector
                    projectId={projectId}
                    characters={characters}
                    characterImages={characterImages}
                    selectedImages={selectedCharacterImages}
                    onSelect={handleCharacterImageSelect}
                  />
                </div>
              )}

              {/* Additional Context */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-ink">Contexte additionnel (optionnel)</label>
                <textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Ajoutez des précisions sur le style, les angles de caméra, l'ambiance..."
                  className="w-full min-h-[80px] rounded-lg border border-line bg-surface px-3 py-2 text-sm resize-y"
                />
              </div>

              {/* Preview Section */}
              <div className="border border-line rounded-lg overflow-hidden">
                <button
                  onClick={() => {
                    setShowPreview(!showPreview);
                    if (!showPreview) {
                      preview.mutate();
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 hover:bg-surface-2/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-muted" />
                    <span className="text-sm font-medium">Aperçu du prompt</span>
                  </div>
                  {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showPreview && (
                  <div className="p-3 border-t border-line bg-surface-2/20">
                    {preview.isPending && <LoadingState label="Génération de l'aperçu..." />}
                    {preview.error && (
                      <ErrorState message={apiErrorMessage(preview.error)} />
                    )}
                    {preview.data && (
                      <div className="space-y-3">
                        {preview.data.warnings.length > 0 && (
                          <div className="space-y-1">
                            {preview.data.warnings.map((warning, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-warning">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <span>{warning}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted hover:text-ink">
                            Voir le prompt complet ({preview.data.full_prompt.length} caractères)
                          </summary>
                          <pre className="mt-2 p-2 bg-ink/5 rounded text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {preview.data.full_prompt}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 p-4 border-t border-line bg-surface-2/30 shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={generate.isPending}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={() => generate.mutate()}
            disabled={!selectedConfigId || generate.isPending}
          >
            {generate.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Génération...
              </>
            ) : (
              <>
                <Sparkles size={16} className="mr-2" />
                Générer {imageCount > 1 ? `${imageCount} planches` : "la planche"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
