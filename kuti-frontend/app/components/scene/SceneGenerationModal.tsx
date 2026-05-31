"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Eye, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "~/hooks/useTranslation";
import { Button, Badge, ErrorState, LoadingState } from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { CharacterImageSelector } from "./CharacterImageSelector";
import type { ListCharactersResponse, GetProjectCharacterImagesResponse, GetStorySummaryResponse, ListModelsResponse } from "~/lib/backend/types.gen";

type Character = ListCharactersResponse[number];
type Scene = GetStorySummaryResponse['scenes'][number];
import {
  listSceneConfigsOptions,
  generateSceneMangaMutation,
  listModelsOptions,
  listGenerationBoardsQueryKey,
  listGenerationJobsQueryKey,
  listSceneMangaPagesQueryKey,
  previewPromptMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import { client } from "~/lib/backend-client";

interface SceneGenerationModalProps {
  projectId: string;
  scene: Scene;
  characters: Character[];
  characterImages: GetProjectCharacterImagesResponse;
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
  const queryClient = useQueryClient();

  // State
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [selectedModelKey, setSelectedModelKey] = useState<string>("");
  const [imageCount, setImageCount] = useState(6);
  const [selectedCharacterImages, setSelectedCharacterImages] = useState<Record<string, string>>({});
  const [additionalContext, setAdditionalContext] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Fetch configs
  const configs = useQuery({
    ...listSceneConfigsOptions({ client, path: { projectId, sceneId: scene.id } }),
    enabled: isOpen,
  });

  const models = useQuery({
    ...listModelsOptions({ client }),
    enabled: isOpen,
    staleTime: 60_000,
  });

  // Set default config when loaded
  useEffect(() => {
    if (configs.data && configs.data.length > 0 && !selectedConfigId) {
      const defaultConfig = configs.data.find((c) => c.isDefault) || configs.data[0];
      setSelectedConfigId(defaultConfig.id);
      setImageCount(defaultConfig.defaultImageCount);
    }
  }, [configs.data, selectedConfigId]);

  const configItems = configs.data ?? [];
  const hasConfigs = configItems.length > 0;
  const selectedConfig = configItems.find((c) => c.id === selectedConfigId);
  const imageModels = useMemo(() => {
    const items = (models.data ?? []) as ListModelsResponse;
    return items.filter((model) => model.kind === "image" && model.enabled && model.configured);
  }, [models.data]);
  const activeModelKey = selectedModelKey || imageModels.find((model) => model.key === "gpt_images_2")?.key || imageModels[0]?.key || "";

  // Compute preview options
  const previewOptions = useMemo(() => ({
    path: { projectId, sceneId: scene.id },
    body: {
      ...(selectedConfigId ? { configId: selectedConfigId } : {}),
      characterImageRefs: selectedCharacterImages,
      panelCount: imageCount,
    },
  }), [projectId, scene.id, selectedConfigId, selectedCharacterImages, imageCount]);

  // Preview mutation config
  const previewMutationConfig = useMemo(() => {
    return previewPromptMutation();
  }, []);

  // Preview mutation
  const preview = useMutation({
    ...previewMutationConfig,
  });

  // Compute generate options
  const generateOptions = useMemo(() => ({
    path: { projectId, sceneId: scene.id },
    body: {
      ...(selectedConfigId ? { configId: selectedConfigId } : {}),
      ...(activeModelKey ? { modelKey: activeModelKey } : {}),
      imageCount,
      characterImageRefs: selectedCharacterImages,
      additionalContext,
    },
  }), [projectId, scene.id, selectedConfigId, activeModelKey, imageCount, selectedCharacterImages, additionalContext]);

  // Generate mutation config
  const generateMutationConfig = useMemo(() => {
    return generateSceneMangaMutation();
  }, []);

  // Generate mutation
  const generate = useMutation({
    ...generateMutationConfig,
    onSuccess: () => {
      invalidateWorkspace(projectId);
      void queryClient.invalidateQueries({ queryKey: listGenerationJobsQueryKey({ path: { projectId } }) });
      void queryClient.invalidateQueries({ queryKey: listGenerationBoardsQueryKey({ path: { projectId } }) });
      void queryClient.invalidateQueries({ queryKey: listSceneMangaPagesQueryKey({ path: { projectId, sceneId: scene.id } }) });
      onClose();
    },
  });

  // Handle character image selection
  const handleCharacterImageSelect = (characterId: string, imageId: string | null) => {
    setSelectedCharacterImages((prev) => {
      const next = { ...prev };
      if (imageId) {
        next[characterId] = imageId;
      } else {
        delete next[characterId];
      }
      return next;
    });
  };

  // Handle preview toggle
  const handlePreviewToggle = useCallback(() => {
    const newShowPreview = !showPreview;
    setShowPreview(newShowPreview);
    if (!showPreview) {
      preview.mutate(previewOptions);
    }
  }, [showPreview, preview, previewOptions]);

  // Handle generate
  const handleGenerate = useCallback(() => {
    generate.mutate(generateOptions);
  }, [generate, generateOptions]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-accent" />
            {t("generation.title")}
          </DialogTitle>
          <DialogDescription>{t("generation.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-1 flex flex-col gap-4">
          {configs.isLoading && <LoadingState label={t("generation.loadingConfigs")} />}
          {configs.error && (
            <ErrorState message={apiErrorMessage(configs.error)} />
          )}

          {configs.data && (
            <>
              {/* Config Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-ink">{t("generation.config")}</label>
                {hasConfigs ? (
                  <Select
                    value={selectedConfigId}
                    onValueChange={(value) => {
                      const config = configItems.find((c) => c.id === value);
                      setSelectedConfigId(value);
                      if (config) {
                        setImageCount(config.defaultImageCount);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("generation.selectConfig")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {configItems.map((config) => (
                          <SelectItem key={config.id} value={config.id}>
                            {config.name} {config.isDefault ? t("generation.defaultConfig") : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-lg border border-line bg-surface-2/30 p-3 text-sm text-muted">
                    {t("generation.implicitConfig")}
                  </div>
                )}
                {selectedConfig && (
                  <div className="flex items-center gap-2 text-xs">
                    <Badge tone={selectedConfig.colorMode === "bw" ? "default" : "info"}>
                      {selectedConfig.colorMode === "bw" ? t("generation.colorMode.bw") : t("generation.colorMode.color")}
                    </Badge>
                    <Badge tone="default">{selectedConfig.stylePreset}</Badge>
                  </div>
                )}
              </div>

              {imageModels.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-ink">{t("generation.model")}</label>
                  <Select value={activeModelKey} onValueChange={setSelectedModelKey}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("generation.selectModel")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {imageModels.map((model) => (
                          <SelectItem key={model.key} value={model.key}>
                            {model.displayName}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Image Count */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-ink">{t("generation.pageCount")}</label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setImageCount(Math.max(1, imageCount - 1))}
                    disabled={imageCount <= 1}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center font-medium">{imageCount}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setImageCount(Math.min(16, imageCount + 1))}
                    disabled={imageCount >= 16}
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Character References */}
              {characters.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-ink">{t("generation.characterRefs")}</label>
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
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-ink">{t("generation.additionalContext")}</label>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder={t("generation.additionalContextPlaceholder")}
                  className="min-h-20 resize-y"
                />
              </div>

              {/* Preview Section */}
              <div className="border border-line rounded-lg overflow-hidden">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handlePreviewToggle}
                  className="w-full justify-between p-3"
                >
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-muted" />
                    <span className="text-sm font-medium">{t("generation.promptPreview")}</span>
                  </div>
                  {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </Button>

                {showPreview && (
                  <div className="p-3 border-t border-line bg-surface-2/20">
                    {preview.isPending && <LoadingState label={t("generation.loadingPreview")} />}
                    {preview.error && (
                      <ErrorState message={apiErrorMessage(preview.error)} />
                    )}
                    {preview.data && (
                      <div className="space-y-3">
                        <div className="text-xs text-muted mb-2">
                          {t("generation.styleLabel")}: {preview.data.styleDescription}
                        </div>
                        {preview.data.prompts.map((promptItem, i) => (
                          <div key={i} className="border border-line rounded p-2">
                            <div className="text-xs font-medium text-ink">{promptItem.title}</div>
                            <div className="text-xs text-muted">{promptItem.caption}</div>
                          </div>
                        ))}
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted hover:text-ink">
                            {t("generation.viewSystemPrompt", { count: preview.data.systemPrompt.length })}
                          </summary>
                          <pre className="mt-2 p-2 bg-ink/5 rounded text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {preview.data.systemPrompt}
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

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={generate.isPending}>
            {t("actions.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={generate.isPending}
          >
            {generate.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                {t("generation.generating")}
              </>
            ) : (
              <>
                <Sparkles />
                {t(imageCount > 1 ? "generation.generateMany" : "generation.generateOne", { count: imageCount })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
