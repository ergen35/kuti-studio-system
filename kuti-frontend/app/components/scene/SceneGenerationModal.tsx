"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Eye,
  Loader2,
  ChevronDown,
  ChevronUp,
  WandSparkles,
} from "lucide-react";
import { useTranslation } from "~/hooks/useTranslation";
import {
  Button,
  Badge,
  ErrorState,
  LoadingState,
  Panel,
} from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type {
  GetStorySummaryResponse,
  ListModelsResponse,
} from "~/lib/backend/types.gen";
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

type Scene = GetStorySummaryResponse["scenes"][number];

interface SceneGenerationModalProps {
  projectId: string;
  scene: Scene;
  isOpen: boolean;
  onClose: () => void;
}

export function SceneGenerationModal({
  projectId,
  scene,
  isOpen,
  onClose,
}: SceneGenerationModalProps) {
  const { t } = useTranslation("scene");
  const queryClient = useQueryClient();

  // State
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");
  const [selectedModelKey, setSelectedModelKey] = useState<string>("");
  const [imageCount, setImageCount] = useState(6);
  const [additionalContext, setAdditionalContext] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const hasSceneContent = scene.content.trim().length > 0;
  const contentRequiredMessage = t("generation.contentRequired");
  const scenePath = scene.title;

  // Fetch configs
  const configs = useQuery({
    ...listSceneConfigsOptions({
      client,
      path: { projectId, sceneId: scene.id },
    }),
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
      const defaultConfig =
        configs.data.find((c) => c.isDefault) || configs.data[0];
      setSelectedConfigId(defaultConfig.id);
      setImageCount(defaultConfig.defaultImageCount);
    }
  }, [configs.data, selectedConfigId]);

  const configItems = configs.data ?? [];
  const hasConfigs = configItems.length > 0;
  const selectedConfig = configItems.find((c) => c.id === selectedConfigId);
  const imageModels = useMemo(() => {
    const items = (models.data ?? []) as ListModelsResponse;
    return items.filter(
      (model) => model.kind === "image" && model.enabled && model.configured,
    );
  }, [models.data]);
  const activeModelKey =
    selectedModelKey ||
    imageModels.find((model) => model.key === "gpt_images_2")?.key ||
    imageModels[0]?.key ||
    "";

  // Compute preview options
  const previewOptions = useMemo(
    () => ({
      path: { projectId, sceneId: scene.id },
      body: {
        ...(selectedConfigId ? { configId: selectedConfigId } : {}),
        panelCount: imageCount,
      },
    }),
    [projectId, scene.id, selectedConfigId, imageCount],
  );

  // Preview mutation config
  const previewMutationConfig = useMemo(() => {
    return previewPromptMutation();
  }, []);

  // Preview mutation
  const preview = useMutation({
    ...previewMutationConfig,
  });

  // Compute generate options
  const generateOptions = useMemo(
    () => ({
      path: { projectId, sceneId: scene.id },
      body: {
        ...(selectedConfigId ? { configId: selectedConfigId } : {}),
        ...(activeModelKey ? { modelKey: activeModelKey } : {}),
        imageCount,
        additionalContext,
      },
    }),
    [
      projectId,
      scene.id,
      selectedConfigId,
      activeModelKey,
      imageCount,
      additionalContext,
    ],
  );

  // Generate mutation config
  const generateMutationConfig = useMemo(() => {
    return generateSceneMangaMutation();
  }, []);

  // Generate mutation
  const generate = useMutation({
    ...generateMutationConfig,
    onSuccess: () => {
      invalidateWorkspace(projectId);
      void queryClient.invalidateQueries({
        queryKey: listGenerationJobsQueryKey({ path: { projectId } }),
      });
      void queryClient.invalidateQueries({
        queryKey: listGenerationBoardsQueryKey({ path: { projectId } }),
      });
      void queryClient.invalidateQueries({
        queryKey: listSceneMangaPagesQueryKey({
          path: { projectId, sceneId: scene.id },
        }),
      });
      onClose();
    },
  });

  // Handle preview toggle
  const handlePreviewToggle = useCallback(() => {
    if (!hasSceneContent) {
      return;
    }

    const newShowPreview = !showPreview;
    setShowPreview(newShowPreview);
    if (!showPreview) {
      preview.reset();
      preview.mutate(previewOptions);
    }
  }, [hasSceneContent, showPreview, preview, previewOptions]);

  // Handle generate
  const handleGenerate = useCallback(() => {
    if (!hasSceneContent) {
      return;
    }

    generate.mutate(generateOptions);
  }, [generate, generateOptions, hasSceneContent]);

  useEffect(() => {
    if (!hasSceneContent) {
      setShowPreview(false);
    }
  }, [hasSceneContent]);

  useEffect(() => {
    if (!isOpen) {
      setShowPreview(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-4xl lg:max-w-5xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-accent" />
            {t("generation.title")}
          </DialogTitle>
          <DialogDescription>{t("generation.description")}</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <Badge tone="info">{scenePath || scene.title}</Badge>
            <Badge tone="info">
              {t("generation.autoCharacterSheetsBadge")}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-1 flex flex-col gap-4">
          {configs.isLoading && (
            <LoadingState label={t("generation.loadingConfigs")} />
          )}
          {configs.error && (
            <ErrorState message={apiErrorMessage(configs.error)} />
          )}

          {configs.data && (
            <>
              {/* Config Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-ink">
                  {t("generation.config")}
                </label>
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
                            {config.name}{" "}
                            {config.isDefault
                              ? t("generation.defaultConfig")
                              : ""}
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
                    <Badge
                      tone={
                        selectedConfig.colorMode === "bw" ? "default" : "info"
                      }
                    >
                      {selectedConfig.colorMode === "bw"
                        ? t("generation.colorMode.bw")
                        : t("generation.colorMode.color")}
                    </Badge>
                    <Badge tone="default">{selectedConfig.stylePreset}</Badge>
                  </div>
                )}
              </div>

              {imageModels.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-ink">
                    {t("generation.model")}
                  </label>
                  <Select
                    value={activeModelKey}
                    onValueChange={setSelectedModelKey}
                  >
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
                <label className="text-sm font-medium text-ink">
                  {t("generation.pageCount")}
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setImageCount(Math.max(1, imageCount - 1))}
                    disabled={imageCount <= 1}
                  >
                    -
                  </Button>
                  <span className="w-8 text-center font-medium">
                    {imageCount}
                  </span>
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

              <Panel className="border border-line/70 bg-gradient-to-br from-accent/10 via-surface/90 to-surface-2/80">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
                    <Sparkles size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-muted">
                      {t("generation.autoCharacterSheetsTitle")}
                    </p>
                    <p className="mt-1 text-sm font-medium text-ink">
                      {t("generation.autoCharacterSheetsBadge")}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {t("generation.autoCharacterSheetsDescription")}
                    </p>
                  </div>
                </div>
              </Panel>

              {/* Additional Context */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-ink">
                  {t("generation.additionalContext")}
                </label>
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
                  disabled={!hasSceneContent}
                  className="w-full justify-between p-3"
                  title={!hasSceneContent ? contentRequiredMessage : undefined}
                >
                  <div className="flex items-center gap-2">
                    <Eye size={16} className="text-muted" />
                    <span className="text-sm font-medium">
                      {t("generation.promptPreview")}
                    </span>
                  </div>
                  {showPreview ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </Button>

                {!hasSceneContent ? (
                  <div className="border-t border-line bg-surface-2/20 p-3 text-xs text-muted">
                    {contentRequiredMessage}
                  </div>
                ) : (
                  showPreview && (
                    <div className="p-3 border-t border-line bg-surface-2/20">
                      {preview.isPending && (
                        <LoadingState label={t("generation.loadingPreview")} />
                      )}
                      {preview.error && (
                        <ErrorState message={apiErrorMessage(preview.error)} />
                      )}
                      {preview.data && (
                        <div className="space-y-3">
                          <div className="text-xs text-muted mb-2">
                            {t("generation.styleLabel")}:{" "}
                            {preview.data.styleDescription}
                          </div>
                          {preview.data.prompts.map((promptItem, i) => (
                            <div
                              key={i}
                              className="border border-line rounded p-2"
                            >
                              <div className="text-xs font-medium text-ink">
                                {promptItem.title}
                              </div>
                              <div className="text-xs text-muted">
                                {promptItem.caption}
                              </div>
                            </div>
                          ))}
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted hover:text-ink">
                              {t("generation.viewSystemPrompt", {
                                count: preview.data.systemPrompt.length,
                              })}
                            </summary>
                            <pre className="mt-2 p-2 bg-ink/5 rounded text-[10px] whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {preview.data.systemPrompt}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 rounded-2xl border border-line/70 bg-gradient-to-br from-surface/95 via-surface/90 to-surface-2/85 p-4 shadow-[0_-18px_40px_-30px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-muted">
                <WandSparkles size={12} className="text-accent" />
                {t("generation.footerEyebrow")}
              </div>
              <p className="max-w-2xl text-sm leading-6 text-muted">
                {t("generation.footerNote")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="info">
                  {selectedConfig
                    ? selectedConfig.name
                    : t("generation.implicitConfig")}
                </Badge>
                <Badge tone="default">
                  {t("generation.pageCount")}: {imageCount}
                </Badge>
                <Badge tone="info">
                  {t("generation.autoCharacterSheetsBadge")}
                </Badge>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={generate.isPending}
                className="justify-center"
              >
                {t("actions.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={generate.isPending || !hasSceneContent}
                title={!hasSceneContent ? contentRequiredMessage : undefined}
                className="justify-center sm:min-w-52"
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {t("generation.generating")}
                  </>
                ) : (
                  <>
                    <Sparkles />
                    {t(
                      imageCount > 1
                        ? "generation.generateMany"
                        : "generation.generateOne",
                      { count: imageCount },
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
