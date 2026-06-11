import { Save, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useLocation,
  useParams,
  useNavigate,
  useBeforeUnload,
  useBlocker,
} from "react-router";
import { toast } from "sonner";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import {
  Badge,
  Button,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  SectionTitle,
} from "~/components/ui";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Checkbox } from "~/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { FormField } from "~/components/FormField";
import { apiErrorMessage } from "~/lib/errors";
import { csv } from "~/lib/utils";
import { invalidateQueriesById } from "~/lib/query";
import { normalizeReferenceSlug } from "~/lib/references";
import type { Project } from "~/lib/backend/types.gen";
import type { ListModelsResponses } from "~/lib/backend/types.gen";
import {
  getProjectOptions,
  updateProjectMutation,
  deleteProjectMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { listModelsOptions } from "~/lib/backend/@tanstack/react-query.gen";
import {
  composeProjectSettingsJson,
  getDefaultProjectSettings,
  readProjectSettings,
} from "~/lib/project-settings";
import {
  projectSettingsSchema,
  type ProjectSettingsInput,
} from "~/lib/schemas";
import {
  COHERENCE_RULE_DEFINITIONS,
  DEFAULT_COHERENCE_AUTOMATION,
  DEFAULT_COHERENCE_RULES,
  parseFactLinesText,
  parseTimelineAnchorsText,
  parseToneProfileText,
  serializeFactLinesText,
  serializeTimelineAnchorsText,
} from "~/lib/coherence-registry";

type CoherenceRuleKey = keyof ProjectSettingsInput["coherenceRules"];
type Model = ListModelsResponses["200"][number];

const COHERENCE_RULES = COHERENCE_RULE_DEFINITIONS;

// ============================================================================
// Delete Confirmation Modal
// ============================================================================

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmedName: string) => void;
  projectName: string;
  isLoading: boolean;
  error?: Error | null;
}

function DeleteProjectModal({
  isOpen,
  onClose,
  onConfirm,
  projectName,
  isLoading,
  error,
}: DeleteProjectModalProps) {
  const { t } = useTranslation("settings");
  const [inputValue, setInputValue] = useState("");

  const isConfirmEnabled = inputValue === projectName;

  useEffect(() => {
    if (isOpen) {
      setInputValue("");
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (isConfirmEnabled) {
      onConfirm(inputValue);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !isLoading && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="flex-row items-start gap-3 text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle className="text-danger" />
          </div>
          <div>
            <DialogTitle>{t("delete.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("delete.dialogDescription")}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="mb-4 rounded-[7px] bg-surface-2 p-3">
          <span className="text-xs text-muted">{t("fields.name")}:</span>
          <p className="font-medium text-ink">{projectName}</p>
        </div>

        <div className="mb-4">
          <label
            className="mb-1.5 block text-xs text-muted"
            htmlFor="delete-project-name"
          >
            {t("delete.inputLabel")}
          </label>
          <Input
            id="delete-project-name"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={t("delete.inputPlaceholder")}
            disabled={isLoading}
            autoFocus
          />
          {inputValue && inputValue !== projectName && (
            <p className="mt-1.5 text-xs text-danger">
              {t("delete.errorNameMismatch")}
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{apiErrorMessage(error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {t("delete.cancelButton")}
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={!isConfirmEnabled || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {t("delete.confirmButton")}
              </span>
            ) : (
              <>
                <Trash2 size={16} />
                {t("delete.confirmButton")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Settings Route
// ============================================================================

export default function SettingsRoute() {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsHydrated, setIsSettingsHydrated] = useState(false);
  const highlightedLocationSlug = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("location")?.trim() || null;
  }, [location.search]);
  const highlightedLocationRef = useRef<HTMLSpanElement | null>(null);
  const hasScrolledToHighlightedLocation = useRef(false);
  const hasHydratedSettings = useRef<string | null>(null);
  const lastSubmittedValues = useRef<ProjectSettingsInput | null>(null);

  useEffect(() => {
    setIsSettingsHydrated(false);
    hasHydratedSettings.current = null;
  }, [projectId]);

  const project = useQuery({
    ...getProjectOptions({ path: { projectId: projectId } }),
    enabled: !!projectId,
  });

  const models = useQuery({
    ...listModelsOptions(),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
    control,
    watch,
    clearErrors,
    setValue,
  } = useForm<ProjectSettingsInput>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: getDefaultProjectSettings(),
  });

  const projectSettings = useMemo(() => {
    if (!project.data) {
      return null;
    }

    return readProjectSettings(project.data.settingsJson);
  }, [project.data]);

  const savedValues = useMemo(() => {
    if (!project.data || !projectSettings) return null;
    return {
      ...projectSettings,
      name: project.data.name,
      status: project.data.status as Project["status"],
    } satisfies ProjectSettingsInput;
  }, [project.data, projectSettings]);

  useEffect(() => {
    if (!savedValues || !models.data) {
      return;
    }

    if (hasHydratedSettings.current === projectId) {
      return;
    }

    hasHydratedSettings.current = projectId;
    const frame = window.requestAnimationFrame(() => {
      reset(savedValues);
      clearErrors(["generation.defaultModelKey", "generation.defaultMode"]);
      setIsSettingsHydrated(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [clearErrors, models.data, projectId, reset, savedValues]);

  const shouldWarnUnsavedChanges =
    isSettingsHydrated && isDirty && !isSubmitting;

  useBeforeUnload((event) => {
    if (!shouldWarnUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });

  const blocker = useBlocker(shouldWarnUnsavedChanges);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    const confirmNavigation = window.confirm(t("unsavedChanges.confirm"));
    if (confirmNavigation) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, t]);

  const update = useMutation({
    ...updateProjectMutation(),
    onSuccess: () => {
      if (lastSubmittedValues.current) {
        reset(lastSubmittedValues.current);
      }
      invalidateQueriesById(queryClient, ["getProject", "listProjects"]);
      toast.success(t("common:toast.saved"));
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const onSubmit = (data: ProjectSettingsInput) => {
    lastSubmittedValues.current = data;

    update.mutate({
      path: { projectId: projectId },
      body: {
        name: data.name || project.data?.name,
        status: data.status,
        settingsJson: composeProjectSettingsJson(
          project.data?.settingsJson,
          data,
        ),
      },
    });
  };

  const deleteProject = useMutation({
    ...deleteProjectMutation(),
    onSuccess: () => {
      // Invalidate projects list and redirect to home
      invalidateQueriesById(queryClient, "listProjects");
      toast.success(t("common:toast.deleted"));
      navigate("/");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const handleReset = () => {
    if (savedValues) {
      reset(savedValues);
    }
  };

  const handleDeleteConfirm = (confirmedName: string) => {
    deleteProject.mutate({
      path: { projectId: projectId },
      body: { confirmedName },
    });
  };

  const statusOptions = [
    { value: "draft", label: t("common:status.draft") },
    { value: "active", label: t("common:status.active") },
    { value: "archived", label: t("common:status.archived") },
    { value: "maintenance", label: t("common:status.maintenance") },
  ];
  const statusValue = watch("status");
  const locationValues = csv(watch("locations") || "");
  const coherenceRuleValues = watch("coherenceRules");
  const coherenceSignalValues = watch("coherenceSignals");
  const coherenceAutomationValue = watch("coherenceAutomation.autoScanOnSave");
  const signalPreview = useMemo(
    () => ({
      timelineAnchors: parseTimelineAnchorsText(
        coherenceSignalValues?.timelineAnchors || "",
      ),
      toneProfile: parseToneProfileText(
        coherenceSignalValues?.requiredToneTags || "",
        coherenceSignalValues?.forbiddenToneTags || "",
      ),
      continuityFacts: parseFactLinesText(
        coherenceSignalValues?.continuityFacts || "",
      ),
      impossibleFacts: parseFactLinesText(
        coherenceSignalValues?.impossibleFacts || "",
      ),
    }),
    [
      coherenceSignalValues?.continuityFacts,
      coherenceSignalValues?.forbiddenToneTags,
      coherenceSignalValues?.impossibleFacts,
      coherenceSignalValues?.requiredToneTags,
      coherenceSignalValues?.timelineAnchors,
    ],
  );
  const signalRegistryCount =
    signalPreview.timelineAnchors.length +
    signalPreview.toneProfile.requiredTags.length +
    signalPreview.toneProfile.forbiddenTags.length +
    signalPreview.continuityFacts.length +
    signalPreview.impossibleFacts.length;
  const activeRuleLabels = COHERENCE_RULES.filter(
    (rule) => coherenceRuleValues?.[rule.key],
  );
  const generationDefaultModelKey = watch("generation.defaultModelKey");
  const generationDefaultMode = watch("generation.defaultMode");
  const resolvedGenerationDefaultMode =
    generationDefaultMode === "separate" || generationDefaultMode === "grid"
      ? generationDefaultMode
      : (projectSettings?.generation.defaultMode ?? "separate");
  const resolvedGenerationDefaultModelKey =
    generationDefaultModelKey ||
    projectSettings?.generation.defaultModelKey ||
    "";
  const previewReadingDirection = watch("preview.readingDirection");
  const previewPanelDensity = watch("preview.panelDensity");
  const defaultExportKind = watch("exports.defaultKind");
  const defaultExportFormats = watch("exports.defaultFormats");
  const preferredLocale = watch("language.preferredLocale");
  const modelItems = (models.data as Model[] | undefined) ?? [];
  const modelsByKind = useMemo(
    () => ({
      image: modelItems.filter((model) => model.kind === "image"),
      video: modelItems.filter((model) => model.kind === "video"),
      audio: modelItems.filter((model) => model.kind === "audio"),
    }),
    [modelItems],
  );
  const generationDefaultModelLabel = useMemo(() => {
    if (!resolvedGenerationDefaultModelKey) {
      return t("sections.generation.defaultModel.none");
    }

    return (
      modelItems.find(
        (model) => model.key === resolvedGenerationDefaultModelKey,
      )?.displayName ?? resolvedGenerationDefaultModelKey
    );
  }, [resolvedGenerationDefaultModelKey, modelItems, t]);
  const exportFormatLabels = useMemo(
    () =>
      defaultExportFormats
        .map((format) => t(`sections.exports.formats.${format}.label`))
        .join(", "),
    [defaultExportFormats, t],
  );
  const exportFormatOptions = [
    "json",
    "tree",
    "zip",
    "paged_images",
    "pdf",
    "cbz",
    "epub",
  ] as const;
  const sectionLinks = [
    {
      id: "general",
      label: t("sections.general.title"),
      meta: t("sections.general.meta"),
    },
    {
      id: "generation",
      label: t("sections.generation.title"),
      meta: t("sections.generation.meta"),
    },
    {
      id: "preview",
      label: t("sections.preview.title"),
      meta: t("sections.preview.meta"),
    },
    {
      id: "coherence",
      label: t("sections.coherence.title"),
      meta: t("sections.coherence.meta"),
    },
    {
      id: "signals",
      label: t("sections.signals.title"),
      meta: t("sections.signals.meta"),
    },
    {
      id: "exports",
      label: t("sections.exports.title"),
      meta: t("sections.exports.meta"),
    },
    {
      id: "language",
      label: t("sections.language.title"),
      meta: t("sections.language.meta"),
    },
  ] as const;
  const highlightedLocation = useMemo(() => {
    if (!highlightedLocationSlug) return null;
    const normalizedSlug = normalizeReferenceSlug(highlightedLocationSlug);
    return (
      locationValues.find(
        (locationValue) =>
          normalizeReferenceSlug(locationValue) === normalizedSlug,
      ) ?? null
    );
  }, [highlightedLocationSlug, locationValues]);
  const highlightedLocationClassName =
    "rounded-full normal-case px-2.5 py-0.5 border-primary/45 bg-primary/15 text-primary ring-2 ring-primary/35 shadow-sm";

  useEffect(() => {
    hasScrolledToHighlightedLocation.current = false;
  }, [highlightedLocationSlug]);

  useEffect(() => {
    if (!highlightedLocation || hasScrolledToHighlightedLocation.current)
      return;
    highlightedLocationRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    hasScrolledToHighlightedLocation.current = true;
  }, [highlightedLocation]);

  return (
    <AppShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={isSettingsHydrated && isDirty ? "warning" : "ready"}>
              {isSettingsHydrated && isDirty
                ? t("unsavedChanges.label")
                : t("unsavedChanges.saved")}
            </Badge>
            {isSettingsHydrated && isDirty ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {t("unsavedChanges.hint")}
              </span>
            ) : null}
          </div>
        }
      />
      {project.isLoading ? <LoadingState /> : null}
      {project.error ? (
        <ErrorState message={apiErrorMessage(project.error)} />
      ) : null}
      {project.data ? (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Panel className="border-border/70 bg-background/90">
              <form className="grid gap-6" onSubmit={handleSubmit(onSubmit)}>
                <section id="general" className="grid gap-4 scroll-mt-24">
                  <SectionTitle
                    title={t("sections.general.title")}
                    meta={t("sections.general.meta")}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField label={t("fields.name")} error={errors.name}>
                      <Input {...register("name")} />
                    </FormField>
                    <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <FormField
                          label={t("fields.status")}
                          error={errors.status}
                        >
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {statusOptions.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormField>
                      )}
                    />
                  </div>
                </section>

                <section
                  id="generation"
                  className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/15 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] scroll-mt-24"
                >
                  <SectionTitle
                    title={t("sections.generation.title")}
                    meta={t("sections.generation.meta")}
                  />
                  <Alert className="border-primary/15 bg-primary/5 text-sm">
                    <AlertDescription>
                      {t("sections.generation.helper")}
                    </AlertDescription>
                  </Alert>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Controller
                      control={control}
                      name="generation.defaultModelKey"
                      render={({ field }) => (
                        <FormField
                          label={t("sections.generation.defaultModel.label")}
                          error={errors.generation?.defaultModelKey}
                        >
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t(
                                  "sections.generation.defaultModel.placeholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {!models.isLoading && modelItems.length === 0 ? (
                                <SelectItem value="__none__" disabled>
                                  {t("sections.generation.defaultModel.empty")}
                                </SelectItem>
                              ) : null}
                              {modelsByKind.image.length > 0 ? (
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("sections.generation.groups.images")}
                                  </SelectLabel>
                                  {modelsByKind.image.map((model) => (
                                    <SelectItem
                                      key={model.key}
                                      value={model.key}
                                    >
                                      {model.displayName}
                                      {!model.configured
                                        ? ` ${t("sections.generation.notConfigured")}`
                                        : ""}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ) : null}
                              {modelsByKind.video.length > 0 ? (
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("sections.generation.groups.videos")}
                                  </SelectLabel>
                                  {modelsByKind.video.map((model) => (
                                    <SelectItem
                                      key={model.key}
                                      value={model.key}
                                    >
                                      {model.displayName}
                                      {!model.configured
                                        ? ` ${t("sections.generation.notConfigured")}`
                                        : ""}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ) : null}
                              {modelsByKind.audio.length > 0 ? (
                                <SelectGroup>
                                  <SelectLabel>
                                    {t("sections.generation.groups.audio")}
                                  </SelectLabel>
                                  {modelsByKind.audio.map((model) => (
                                    <SelectItem
                                      key={model.key}
                                      value={model.key}
                                    >
                                      {model.displayName}
                                      {!model.configured
                                        ? ` ${t("sections.generation.notConfigured")}`
                                        : ""}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              ) : null}
                            </SelectContent>
                          </Select>
                          {models.isLoading ? (
                            <div className="mt-2">
                              <LoadingState
                                label={t("common:states.loading")}
                              />
                            </div>
                          ) : null}
                          {models.error ? (
                            <div className="mt-2">
                              <ErrorState
                                message={apiErrorMessage(models.error)}
                              />
                            </div>
                          ) : null}
                        </FormField>
                      )}
                    />

                    <Controller
                      control={control}
                      name="generation.defaultMode"
                      render={({ field }) => (
                        <FormField
                          label={t("sections.generation.defaultMode.label")}
                          error={errors.generation?.defaultMode}
                        >
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t(
                                  "sections.generation.defaultMode.placeholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="separate">
                                  {t(
                                    "sections.generation.defaultMode.options.separate",
                                  )}
                                </SelectItem>
                                <SelectItem value="grid">
                                  {t(
                                    "sections.generation.defaultMode.options.grid",
                                  )}
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormField>
                      )}
                    />
                  </div>
                </section>

                <section
                  id="preview"
                  className="grid gap-4 rounded-2xl border border-border/70 bg-background/85 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] scroll-mt-24"
                >
                  <SectionTitle
                    title={t("sections.preview.title")}
                    meta={t("sections.preview.meta")}
                  />
                  <Alert className="border-primary/10 bg-primary/5 text-sm">
                    <AlertDescription>
                      {t("sections.preview.helper")}
                    </AlertDescription>
                  </Alert>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Controller
                      control={control}
                      name="preview.readingDirection"
                      render={({ field }) => (
                        <FormField
                          label={t("sections.preview.readingDirection.label")}
                          error={errors.preview?.readingDirection}
                        >
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t(
                                  "sections.preview.readingDirection.placeholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="rtl">
                                  {t(
                                    "sections.preview.readingDirection.options.rtl",
                                  )}
                                </SelectItem>
                                <SelectItem value="ltr">
                                  {t(
                                    "sections.preview.readingDirection.options.ltr",
                                  )}
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormField>
                      )}
                    />

                    <Controller
                      control={control}
                      name="preview.panelDensity"
                      render={({ field }) => (
                        <FormField
                          label={t("sections.preview.panelDensity.label")}
                          error={errors.preview?.panelDensity}
                        >
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t(
                                  "sections.preview.panelDensity.placeholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="comfortable">
                                  {t(
                                    "sections.preview.panelDensity.options.comfortable",
                                  )}
                                </SelectItem>
                                <SelectItem value="compact">
                                  {t(
                                    "sections.preview.panelDensity.options.compact",
                                  )}
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormField>
                      )}
                    />
                  </div>
                </section>

                <section
                  id="coherence"
                  className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/15 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] scroll-mt-24"
                >
                  <SectionTitle
                    title={t("sections.coherence.title")}
                    meta={t("sections.coherence.meta")}
                  />
                  <Alert className="border-primary/15 bg-primary/5 text-sm">
                    <AlertDescription>
                      {t("sections.coherence.helper")}
                    </AlertDescription>
                  </Alert>
                  <FormField
                    label={t("fields.allowedLocations")}
                    error={errors.locations}
                  >
                    <Input
                      {...register("locations")}
                      placeholder={t("fields.locationsPlaceholder")}
                    />
                  </FormField>

                  <div className="grid gap-3 rounded-2xl border border-dashed border-border/70 bg-background/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {t("sections.coherence.preview.title")}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t("sections.coherence.preview.description")}
                        </p>
                      </div>
                      <Badge
                        tone={locationValues.length > 0 ? "ready" : "warning"}
                      >
                        {t("sections.coherence.preview.count", {
                          count: locationValues.length,
                        })}
                      </Badge>
                    </div>

                    {locationValues.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {locationValues.map((location) => (
                          <span
                            key={location}
                            ref={
                              highlightedLocation &&
                              normalizeReferenceSlug(location) ===
                                normalizeReferenceSlug(highlightedLocation)
                                ? highlightedLocationRef
                                : undefined
                            }
                            className="inline-flex"
                          >
                            <Badge
                              tone={
                                highlightedLocation &&
                                normalizeReferenceSlug(location) ===
                                  normalizeReferenceSlug(highlightedLocation)
                                  ? "ready"
                                  : "info"
                              }
                              className={
                                highlightedLocation &&
                                normalizeReferenceSlug(location) ===
                                  normalizeReferenceSlug(highlightedLocation)
                                  ? highlightedLocationClassName
                                  : "rounded-full normal-case px-2.5 py-0.5"
                              }
                            >
                              {location}
                            </Badge>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {t("sections.coherence.preview.empty")}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {COHERENCE_RULES.map((rule) => (
                      <Controller
                        key={rule.key}
                        control={control}
                        name={`coherenceRules.${rule.key}`}
                        render={({ field }) => (
                          <label className="flex min-h-24 cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:border-primary/35 hover:bg-background">
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={(checked) =>
                                field.onChange(Boolean(checked))
                              }
                              className="mt-1"
                            />
                            <span className="grid gap-1">
                              <span className="text-sm font-semibold text-foreground">
                                {t(rule.titleKey)}
                              </span>
                              <span className="text-xs leading-5 text-muted-foreground">
                                {t(rule.descriptionKey)}
                              </span>
                            </span>
                          </label>
                        )}
                      />
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 rounded-2xl border border-border/70 bg-background/85 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                  <SectionTitle
                    title={t("sections.signals.title")}
                    meta={t("sections.signals.meta")}
                  />
                  <Alert className="border-amber-400/20 bg-amber-400/5 text-sm">
                    <AlertDescription>
                      {t("sections.signals.helper")}
                    </AlertDescription>
                  </Alert>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <FormField
                      label={t("sections.signals.timelineAnchors.label")}
                      error={errors.coherenceSignals?.timelineAnchors}
                    >
                      <Textarea
                        {...register("coherenceSignals.timelineAnchors")}
                        rows={8}
                        className="font-mono text-sm"
                        placeholder={t(
                          "sections.signals.timelineAnchors.placeholder",
                        )}
                      />
                    </FormField>

                    <div className="grid gap-4">
                      <FormField
                        label={t("sections.signals.requiredToneTags.label")}
                        error={errors.coherenceSignals?.requiredToneTags}
                      >
                        <Textarea
                          {...register("coherenceSignals.requiredToneTags")}
                          rows={4}
                          className="font-mono text-sm"
                          placeholder={t(
                            "sections.signals.requiredToneTags.placeholder",
                          )}
                        />
                      </FormField>
                      <FormField
                        label={t("sections.signals.forbiddenToneTags.label")}
                        error={errors.coherenceSignals?.forbiddenToneTags}
                      >
                        <Textarea
                          {...register("coherenceSignals.forbiddenToneTags")}
                          rows={4}
                          className="font-mono text-sm"
                          placeholder={t(
                            "sections.signals.forbiddenToneTags.placeholder",
                          )}
                        />
                      </FormField>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <FormField
                      label={t("sections.signals.continuityFacts.label")}
                      error={errors.coherenceSignals?.continuityFacts}
                    >
                      <Textarea
                        {...register("coherenceSignals.continuityFacts")}
                        rows={6}
                        className="font-mono text-sm"
                        placeholder={t(
                          "sections.signals.continuityFacts.placeholder",
                        )}
                      />
                    </FormField>

                    <FormField
                      label={t("sections.signals.impossibleFacts.label")}
                      error={errors.coherenceSignals?.impossibleFacts}
                    >
                      <Textarea
                        {...register("coherenceSignals.impossibleFacts")}
                        rows={6}
                        className="font-mono text-sm"
                        placeholder={t(
                          "sections.signals.impossibleFacts.placeholder",
                        )}
                      />
                    </FormField>
                  </div>

                  <Controller
                    control={control}
                    name="coherenceAutomation.autoScanOnSave"
                    render={({ field }) => (
                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-secondary/20 p-4 transition-colors hover:border-primary/35 hover:bg-secondary/25">
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={(checked) =>
                            field.onChange(Boolean(checked))
                          }
                          className="mt-1"
                        />
                        <span className="grid gap-1">
                          <span className="text-sm font-semibold text-foreground">
                            {t("sections.signals.autoScan.label")}
                          </span>
                          <span className="text-xs leading-5 text-muted-foreground">
                            {t("sections.signals.autoScan.description")}
                          </span>
                        </span>
                      </label>
                    )}
                  />
                </section>

                <section
                  id="exports"
                  className="grid gap-4 rounded-2xl border border-border/70 bg-secondary/15 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] scroll-mt-24"
                >
                  <SectionTitle
                    title={t("sections.exports.title")}
                    meta={t("sections.exports.meta")}
                  />
                  <Alert className="border-emerald-400/15 bg-emerald-400/5 text-sm">
                    <AlertDescription>
                      {t("sections.exports.helper")}
                    </AlertDescription>
                  </Alert>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Controller
                      control={control}
                      name="exports.defaultKind"
                      render={({ field }) => (
                        <FormField
                          label={t("sections.exports.defaultKind.label")}
                          error={errors.exports?.defaultKind}
                        >
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue
                                placeholder={t(
                                  "sections.exports.defaultKind.placeholder",
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="work">
                                  {t(
                                    "sections.exports.defaultKind.options.work",
                                  )}
                                </SelectItem>
                                <SelectItem value="publication">
                                  {t(
                                    "sections.exports.defaultKind.options.publication",
                                  )}
                                </SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </FormField>
                      )}
                    />
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {exportFormatOptions.map((format) => {
                      const isChecked = defaultExportFormats.includes(format);
                      return (
                        <label
                          key={format}
                          className="flex min-h-24 cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:border-primary/35 hover:bg-background"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const nextFormats = checked
                                ? [...defaultExportFormats, format]
                                : defaultExportFormats.filter(
                                    (item) => item !== format,
                                  );
                              setValue(
                                "exports.defaultFormats",
                                nextFormats as ProjectSettingsInput["exports"]["defaultFormats"],
                                { shouldDirty: true, shouldValidate: true },
                              );
                            }}
                            className="mt-1"
                          />
                          <span className="grid gap-1">
                            <span className="text-sm font-semibold text-foreground">
                              {t(`sections.exports.formats.${format}.label`)}
                            </span>
                            <span className="text-xs leading-5 text-muted-foreground">
                              {t(
                                `sections.exports.formats.${format}.description`,
                              )}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {errors.exports?.defaultFormats ? (
                    <p className="text-xs text-danger">
                      {errors.exports.defaultFormats.message}
                    </p>
                  ) : null}
                </section>

                <section
                  id="language"
                  className="grid gap-4 rounded-2xl border border-border/70 bg-background/85 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] scroll-mt-24"
                >
                  <SectionTitle
                    title={t("sections.language.title")}
                    meta={t("sections.language.meta")}
                  />
                  <Alert className="border-violet-400/15 bg-violet-400/5 text-sm">
                    <AlertDescription>
                      {t("sections.language.helper")}
                    </AlertDescription>
                  </Alert>
                  <Controller
                    control={control}
                    name="language.preferredLocale"
                    render={({ field }) => (
                      <FormField
                        label={t("sections.language.preferredLocale.label")}
                        error={errors.language?.preferredLocale}
                      >
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={t(
                                "sections.language.preferredLocale.placeholder",
                              )}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="fr">
                                {t("sections.language.options.fr")}
                              </SelectItem>
                              <SelectItem value="en">
                                {t("sections.language.options.en")}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FormField>
                    )}
                  />
                </section>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={isSettingsHydrated && isDirty ? "warning" : "ready"}
                    >
                      {isSettingsHydrated && isDirty
                        ? t("unsavedChanges.label")
                        : t("unsavedChanges.saved")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {isSettingsHydrated && isDirty
                        ? t("unsavedChanges.summary")
                        : t("unsavedChanges.savedHint")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={handleReset}
                      disabled={!isDirty || isSubmitting}
                    >
                      {t("actions.reset")}
                    </Button>
                    <Button
                      variant="primary"
                      disabled={isSubmitting || update.isPending || !isDirty}
                    >
                      <Save size={16} />{" "}
                      {isSubmitting || update.isPending
                        ? t("actions.saving")
                        : t("actions.save")}
                    </Button>
                  </div>
                </div>

                {update.error ? (
                  <ErrorState message={apiErrorMessage(update.error)} />
                ) : null}
              </form>
            </Panel>

            <div className="grid gap-6 self-start">
              <Panel className="border-border/70">
                <SectionTitle
                  title={t("sections.navigation.title")}
                  meta={t("sections.navigation.meta")}
                />
                <div className="grid gap-2">
                  {sectionLinks.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className="rounded-2xl border border-border/70 bg-secondary/20 px-3 py-2 transition-colors hover:border-primary/35 hover:bg-secondary/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {section.label}
                        </span>
                        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                          {section.id}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {section.meta}
                      </p>
                    </a>
                  ))}
                </div>
              </Panel>

              <Panel className="border-border/70">
                <SectionTitle
                  title={t("sections.summary.title")}
                  meta={t("sections.summary.meta")}
                />
                <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
                  <div className="rounded-2xl border border-border/70 bg-secondary/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("sections.summary.generation.title")}
                      </span>
                      <Badge
                        tone={
                          resolvedGenerationDefaultModelKey
                            ? "ready"
                            : "warning"
                        }
                      >
                        {t(
                          `sections.generation.defaultMode.options.${resolvedGenerationDefaultMode}`,
                        )}
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                      <p>
                        {t("sections.summary.generation.model", {
                          model: generationDefaultModelLabel,
                        })}
                      </p>
                      <p>
                        {t("sections.summary.generation.mode", {
                          mode: t(
                            `sections.generation.defaultMode.options.${resolvedGenerationDefaultMode}`,
                          ),
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("sections.summary.exports.title")}
                      </span>
                      <Badge
                        tone={
                          defaultExportKind === "publication" ? "ready" : "info"
                        }
                      >
                        {t(
                          `sections.exports.defaultKind.options.${defaultExportKind}`,
                        )}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <p>
                        {exportFormatLabels ||
                          t("sections.summary.exports.empty")}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("sections.summary.language.title")}
                      </span>
                      <Badge tone="info">
                        {t(`sections.language.options.${preferredLocale}`)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {t("sections.summary.language.description")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-secondary/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("sections.summary.locations.title")}
                      </span>
                      <Badge
                        tone={locationValues.length > 0 ? "ready" : "warning"}
                      >
                        {t("sections.summary.locations.count", {
                          count: locationValues.length,
                        })}
                      </Badge>
                    </div>
                    {locationValues.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {locationValues.map((location) => (
                          <Badge
                            key={location}
                            tone={
                              highlightedLocation &&
                              normalizeReferenceSlug(location) ===
                                normalizeReferenceSlug(highlightedLocation)
                                ? "ready"
                                : "info"
                            }
                            className={
                              highlightedLocation &&
                              normalizeReferenceSlug(location) ===
                                normalizeReferenceSlug(highlightedLocation)
                                ? highlightedLocationClassName
                                : "rounded-full normal-case px-2.5 py-0.5"
                            }
                          >
                            {location}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {t("sections.summary.locations.empty")}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-secondary/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("sections.summary.rules.title")}
                      </span>
                      <Badge
                        tone={activeRuleLabels.length > 0 ? "ready" : "warning"}
                      >
                        {t("sections.summary.rules.count", {
                          count: activeRuleLabels.length,
                        })}
                      </Badge>
                    </div>
                    {activeRuleLabels.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {activeRuleLabels.map((rule) => (
                          <Badge
                            key={rule.key}
                            tone="info"
                            className="rounded-full normal-case px-2.5 py-0.5"
                          >
                            {t(rule.titleKey)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {t("sections.summary.rules.empty")}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("sections.summary.signals.title")}
                      </span>
                      <Badge
                        tone={signalRegistryCount > 0 ? "ready" : "warning"}
                      >
                        {t("sections.summary.signals.count", {
                          count: signalRegistryCount,
                        })}
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          tone={
                            signalPreview.timelineAnchors.length > 0
                              ? "info"
                              : "warning"
                          }
                          className="rounded-full normal-case px-2.5 py-0.5"
                        >
                          {t("sections.summary.signals.timeline", {
                            count: signalPreview.timelineAnchors.length,
                          })}
                        </Badge>
                        <Badge
                          tone={
                            signalPreview.toneProfile.requiredTags.length > 0
                              ? "info"
                              : "warning"
                          }
                          className="rounded-full normal-case px-2.5 py-0.5"
                        >
                          {t("sections.summary.signals.requiredTone", {
                            count:
                              signalPreview.toneProfile.requiredTags.length,
                          })}
                        </Badge>
                        <Badge
                          tone={
                            signalPreview.toneProfile.forbiddenTags.length > 0
                              ? "info"
                              : "warning"
                          }
                          className="rounded-full normal-case px-2.5 py-0.5"
                        >
                          {t("sections.summary.signals.forbiddenTone", {
                            count:
                              signalPreview.toneProfile.forbiddenTags.length,
                          })}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          tone={
                            signalPreview.continuityFacts.length > 0
                              ? "info"
                              : "warning"
                          }
                          className="rounded-full normal-case px-2.5 py-0.5"
                        >
                          {t("sections.summary.signals.continuity", {
                            count: signalPreview.continuityFacts.length,
                          })}
                        </Badge>
                        <Badge
                          tone={
                            signalPreview.impossibleFacts.length > 0
                              ? "info"
                              : "warning"
                          }
                          className="rounded-full normal-case px-2.5 py-0.5"
                        >
                          {t("sections.summary.signals.impossible", {
                            count: signalPreview.impossibleFacts.length,
                          })}
                        </Badge>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {signalRegistryCount > 0
                          ? t("sections.summary.signals.preview", {
                              value:
                                signalPreview.timelineAnchors
                                  .slice(0, 2)
                                  .map((anchor) => anchor.label)
                                  .join(" / ") ||
                                signalPreview.toneProfile.requiredTags
                                  .slice(0, 2)
                                  .join(" / ") ||
                                signalPreview.continuityFacts
                                  .slice(0, 1)
                                  .map((fact) => fact.key)
                                  .join(" / ") ||
                                signalPreview.impossibleFacts
                                  .slice(0, 1)
                                  .map((fact) => fact.key)
                                  .join(" / "),
                            })
                          : t("sections.summary.signals.empty")}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("sections.summary.automation.title")}
                      </span>
                      <Badge
                        tone={coherenceAutomationValue ? "ready" : "warning"}
                      >
                        {coherenceAutomationValue
                          ? t("sections.summary.automation.on")
                          : t("sections.summary.automation.off")}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {t("sections.summary.automation.description")}
                    </p>
                  </div>
                </div>
              </Panel>

              <Panel className="border-danger/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-danger">
                      <AlertTriangle size={16} />
                      {t("delete.sectionTitle")}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {t("delete.sectionDescription")}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    <Trash2 size={16} />
                    {t("delete.buttonLabel")}
                  </Button>
                </div>
              </Panel>
            </div>
          </div>
        </>
      ) : null}

      {/* Delete Confirmation Modal */}
      <DeleteProjectModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        projectName={project.data?.name || ""}
        isLoading={deleteProject.isPending}
        error={deleteProject.error}
      />
    </AppShell>
  );
}
