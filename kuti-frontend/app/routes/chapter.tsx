import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "~/components/layout";
import { ChapterMangaPreview, StoryBreadcrumb, StoryCompletionButton } from "~/components/story";
import { ReorderControls } from "~/components/story/ReorderControls";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
} from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { useTranslation } from "~/hooks/useTranslation";
import type {
  AutoGenerateChapterScenesData,
  CreateSceneData,
  GetStorySummaryResponse,
  Options,
  UpdateChapterData,
  UpdateSceneData,
} from "~/lib/backend";
import {
  autoGenerateChapterScenesMutation,
  createSceneMutation,
  getStorySummaryOptions,
  updateChapterMutation,
  updateSceneMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import { getOrderSwap } from "~/lib/story-order";

const editChapterSchema = z.object({
  title: z.string().min(1, "Title is required"),
  synopsis: z.string().optional(),
});

type EditChapterInput = z.infer<typeof editChapterSchema>;

const createSceneSchema = z.object({
  title: z.string().min(1, "Title is required"),
  location: z.string().optional(),
});

type CreateSceneInput = z.infer<typeof createSceneSchema>;

type AutoGenerateChapterInput = {
  chapterSummary: string;
  sceneCount: number;
};

type Scene = GetStorySummaryResponse["scenes"][number];

function CreateSceneModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSceneInput) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation("story");
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateSceneInput>({
    resolver: zodResolver(createSceneSchema),
    defaultValues: { title: "", location: "" },
  });

  const handleFormSubmit = (data: CreateSceneInput) => {
    onSubmit(data);
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("scenes.createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <Field label={t("fields.title")}>
            <Input
              {...register("title")}
              autoFocus
              placeholder={t("placeholders.sceneTitle")}
              className="w-full"
            />
          </Field>
          {errors.title && (
            <span className="text-danger text-xs">{errors.title.message}</span>
          )}
          <Field label={t("fields.location")}>
            <div className="relative">
              <MapPin
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                {...register("location")}
                placeholder={t("placeholders.sceneLocation")}
                className="w-full pl-10"
              />
            </div>
          </Field>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={handleClose} disabled={isLoading}>
              {t("actions.cancel")}
            </Button>
            <Button variant="primary" disabled={isLoading}>
              {isLoading ? t("actions.creating") : t("actions.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AutoGenerateChapterModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  errorMessage,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AutoGenerateChapterInput) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}) {
  const { t } = useTranslation("story");
  const schema = useMemo(
    () =>
      z.object({
        chapterSummary: z.string().trim().min(1000, t("chapter.autoGenerate.errors.summary")),
        sceneCount: z
          .number()
          .int(t("chapter.autoGenerate.errors.sceneCount"))
          .min(1, t("chapter.autoGenerate.errors.sceneCount"))
          .max(8, t("chapter.autoGenerate.errors.sceneCount")),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<AutoGenerateChapterInput>({
    resolver: zodResolver(schema),
    defaultValues: { chapterSummary: "", sceneCount: 4 },
  });

  const chapterSummary = watch("chapterSummary") || "";
  const sceneCount = watch("sceneCount");
  const summaryLength = chapterSummary.trim().length;
  const canSubmit =
    summaryLength >= 1000 &&
    Number.isInteger(sceneCount) &&
    sceneCount >= 1 &&
    sceneCount <= 8 &&
    !isLoading;

  const handleFormSubmit = (data: AutoGenerateChapterInput) => {
    onSubmit(data);
    reset({ chapterSummary: "", sceneCount: 4 });
  };

  const handleClose = () => {
    reset({ chapterSummary: "", sceneCount: 4 });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="w-full overflow-hidden p-0">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border bg-secondary/20 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl">{t("chapter.autoGenerate.title")}</DialogTitle>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {t("chapter.autoGenerate.description")}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-4">
              <Field label={t("chapter.autoGenerate.summaryLabel")}>
                <Textarea
                  {...register("chapterSummary")}
                  autoFocus
                  rows={18}
                  placeholder={t("chapter.autoGenerate.summaryPlaceholder")}
                  disabled={isLoading}
                  className="min-h-80 resize-y leading-6"
                />
              </Field>
              {errors.chapterSummary ? (
                <span className="text-xs text-danger">{errors.chapterSummary.message}</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("chapter.autoGenerate.summaryHint")}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1">
                  {t("chapter.autoGenerate.summaryCount", { count: summaryLength })}
                </span>
                <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1">
                  {t("chapter.autoGenerate.referencesHint")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 text-warning" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("chapter.autoGenerate.warningTitle")}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {t("chapter.autoGenerate.warning")}
                    </p>
                  </div>
                </div>
              </div>

              <Field label={t("chapter.autoGenerate.sceneCountLabel")}>
                <Input
                  {...register("sceneCount", { valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  disabled={isLoading}
                  className="w-28"
                />
              </Field>
              {errors.sceneCount ? (
                <span className="text-xs text-danger">{errors.sceneCount.message}</span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("chapter.autoGenerate.sceneCountHint")}
                </span>
              )}

              <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("chapter.autoGenerate.referencesTitle")}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("chapter.autoGenerate.referencesBody")}
                </p>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <li>@chara:slug</li>
                  <li>@file:slug</li>
                  <li>@scene:slug</li>
                  <li>@chapter:slug</li>
                  <li>@tome:slug</li>
                </ul>
              </div>
            </div>
          </div>

          {errorMessage ? (
            <div className="mx-6 mb-4 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive">
              {errorMessage}
            </div>
          ) : null}

          <div className="border-t border-border bg-muted/35 px-6 py-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 text-warning" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t("chapter.autoGenerate.footerTitle")}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t("chapter.autoGenerate.footerDescription")}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="ghost" type="button" onClick={handleClose} disabled={isLoading}>
                  {t("chapter.autoGenerate.footerCancel")}
                </Button>
                <Button variant="primary" type="submit" disabled={!canSubmit} className="gap-2">
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {isLoading
                    ? t("chapter.autoGenerate.footerSubmitting")
                    : t("chapter.autoGenerate.footerSubmit")}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SceneRow({
  scene,
  sceneNumber,
  projectId,
  tomeId,
  canMoveUp,
  canMoveDown,
  reorderDisabled,
  onMoveUp,
  onMoveDown,
}: {
  scene: Scene;
  sceneNumber: number;
  projectId: string;
  tomeId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reorderDisabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="group flex items-stretch gap-2">
      <Link
        to={`/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`}
        className="flex min-h-12 flex-1 items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-all hover:border-accent/40 hover:bg-accent/5"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileText size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">S{sceneNumber}</span>
            <span className="truncate font-medium text-ink">{scene.title}</span>
          </div>
          {scene.location && (
            <p className="mt-0.5 truncate text-xs text-muted">{scene.location}</p>
          )}
        </div>
        <Badge tone={scene.status} className="text-[10px]">
          {scene.status}
        </Badge>
        <ChevronRight
          size={16}
          className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </Link>
      <ReorderControls
        entityLabel={scene.title}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        disabled={reorderDisabled}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        className="self-center opacity-100 md:opacity-0 md:transition-opacity md:duration-150 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
      />
    </div>
  );
}

export default function ChapterRoute() {
  const { projectId = "", tomeId = "", chapterId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(["story", "common"]);

  const [isEditing, setIsEditing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAutoGenerateModalOpen, setIsAutoGenerateModalOpen] = useState(false);

  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  const chapter = useMemo(() => {
    return story.data?.chapters.find((c) => c.id === chapterId);
  }, [story.data, chapterId]);

  const tome = useMemo(() => {
    return story.data?.tomes.find((t) => t.id === tomeId);
  }, [story.data, tomeId]);

  const scenes = useMemo(() => {
    if (!chapter || !story.data) return [];
    return story.data.scenes
      .filter((s) => s.chapterId === chapterId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [chapter, story.data, chapterId]);

  const chapterNumber = useMemo(() => {
    if (!story.data || !chapter) return 0;
    const tomeChapters = story.data.chapters
      .filter((c) => c.tomeId === tomeId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return tomeChapters.findIndex((c) => c.id === chapterId) + 1;
  }, [story.data, chapterId, tomeId, chapter]);

  const tomeNumber = useMemo(() => {
    if (!story.data || !tome) return 0;
    return story.data.tomes.findIndex((t) => t.id === tomeId) + 1;
  }, [story.data, tomeId, tome]);

  const updateChapterMut = useMutation({
    ...updateChapterMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      setIsEditing(false);
      toast.success(t("common:toast.saved"));
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const reorderSceneMut = useMutation({
    ...updateSceneMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const createSceneMut = useMutation({
    ...createSceneMutation(),
    onSuccess: (scene) => {
      invalidateWorkspace(projectId);
      setIsCreateModalOpen(false);
      toast.success(t("common:toast.created"));
      navigate(`/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const autoGenerateChapterMut = useMutation({
    ...autoGenerateChapterScenesMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      handleCloseAutoGenerateModal();
      toast.success(t("common:toast.generated"));
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const moveScene = async (movingSceneId: string, direction: -1 | 1) => {
    const swap = getOrderSwap(scenes, movingSceneId, direction);
    if (!swap) return;
    await Promise.all([
      reorderSceneMut.mutateAsync({
        path: { projectId, sceneId: swap.current.id },
        body: { orderIndex: swap.target.orderIndex },
      } as unknown as Options<UpdateSceneData>),
      reorderSceneMut.mutateAsync({
        path: { projectId, sceneId: swap.target.id },
        body: { orderIndex: swap.current.orderIndex },
      } as unknown as Options<UpdateSceneData>),
    ]);
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EditChapterInput>({
    resolver: zodResolver(editChapterSchema),
    defaultValues: { title: "", synopsis: "" },
  });

  useEffect(() => {
    if (chapter) {
      reset({ title: chapter.title, synopsis: chapter.synopsis ?? "" });
    }
  }, [chapter, reset]);

  const onSubmit = (data: EditChapterInput) => {
    updateChapterMut.mutate({
      path: { projectId, chapterId },
      body: { title: data.title, synopsis: data.synopsis },
    } as unknown as Options<UpdateChapterData>);
  };

  const handleCreateScene = (data: CreateSceneInput) => {
    const existingScenes = story.data?.scenes.filter((s) => s.chapterId === chapterId) || [];
    const maxOrderIndex = existingScenes.reduce((max, s) => Math.max(max, s.orderIndex), 0);
    createSceneMut.mutate({
      path: { projectId },
      body: {
        tomeId,
        chapterId,
        title: data.title,
        location: data.location || undefined,
        orderIndex: maxOrderIndex + 1,
      } as CreateSceneData["body"],
    });
  };

  const handleAutoGenerateChapter = (data: AutoGenerateChapterInput) => {
    autoGenerateChapterMut.mutate({
      path: { projectId, chapterId },
      body: { chapterSummary: data.chapterSummary, sceneCount: data.sceneCount },
    } as unknown as Options<AutoGenerateChapterScenesData>);
  };

  const handleCloseAutoGenerateModal = () => {
    autoGenerateChapterMut.reset();
    setIsAutoGenerateModalOpen(false);
  };

  if (story.isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (story.error) {
    return (
      <AppShell>
        <ErrorState message={apiErrorMessage(story.error)} />
      </AppShell>
    );
  }

  if (!chapter || !tome) {
    return (
      <AppShell>
        <EmptyState title={t("chapter.notFound")} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <StoryBreadcrumb
        projectId={projectId}
        tomes={story.data?.tomes || []}
        chapters={story.data?.chapters || []}
        currentTomeId={tomeId}
        currentChapterId={chapterId}
        tomeNumber={tomeNumber}
        chapterNumber={chapterNumber}
      />

      <div className="mx-auto max-w-4xl space-y-4">
        {/* Compact Header */}
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen size={20} />
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 flex-1 space-y-3">
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{t("fields.title")}</span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="chapter"
                      targetId={chapterId}
                      field="title"
                      currentValue={watch("title")}
                      onComplete={(text) => setValue("title", text, { shouldDirty: true })}
                    />
                  </div>
                  <Input {...register("title")} autoFocus className="text-lg font-semibold" />
                  {errors.title && (
                    <span className="text-danger text-xs">{errors.title.message}</span>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{t("chapter.synopsis")}</span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="chapter"
                      targetId={chapterId}
                      field="synopsis"
                      currentValue={watch("synopsis")}
                      onComplete={(text) => setValue("synopsis", text, { shouldDirty: true })}
                    />
                  </div>
                  <Textarea {...register("synopsis")} rows={3} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={updateChapterMut.isPending}
                    className="h-8 px-3"
                  >
                    <X size={14} /> {t("actions.cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={updateChapterMut.isPending}
                    className="h-8 px-3"
                  >
                    <Check size={14} /> {t("actions.save")}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">C{chapterNumber}</span>
                  <h1 className="truncate text-lg font-semibold text-ink">{chapter.title}</h1>
                  <Badge tone={chapter.status}>{chapter.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {scenes.length} {t("chapter.stats.scenes", { count: scenes.length })} · T
                  {tomeNumber}
                </p>
                {chapter.synopsis && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{chapter.synopsis}</p>
                )}
              </div>
            )}

            {!isEditing && (
              <Button
                variant="ghost"
                className="size-8 shrink-0 p-0"
                onClick={() => setIsEditing(true)}
                title={t("actions.edit")}
              >
                <Pencil size={16} />
              </Button>
            )}
          </div>
        </div>

        {/* Action chips */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            className="h-8 gap-1.5 px-3"
          >
            <Plus size={16} /> {t("actions.addScene")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setIsAutoGenerateModalOpen(true)}
            className="h-8 gap-1.5 px-3"
          >
            <Sparkles size={16} /> {t("chapter.autoGenerate.button")}
          </Button>
        </div>

        {/* Scenes list */}
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            {t("chapter.scenes")} ({scenes.length})
          </h2>

          {scenes.length === 0 ? (
            <EmptyState
              title={t("chapter.empty.noScenes.title")}
              description={t("chapter.empty.noScenes.description")}
            />
          ) : (
            <div className="space-y-2">
              {scenes.map((scene, index) => (
                <SceneRow
                  key={scene.id}
                  scene={scene}
                  sceneNumber={index + 1}
                  projectId={projectId}
                  tomeId={tomeId}
                  canMoveUp={index > 0}
                  canMoveDown={index < scenes.length - 1}
                  reorderDisabled={reorderSceneMut.isPending}
                  onMoveUp={() => moveScene(scene.id, -1)}
                  onMoveDown={() => moveScene(scene.id, 1)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Manga Preview - collapsible */}
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer items-center justify-between p-4 text-sm font-semibold text-ink">
            {t("chapterPreview.title")}
            <ChevronDown
              size={16}
              className="text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-4 pb-4">
            <ChapterMangaPreview projectId={projectId} chapterId={chapterId} />
          </div>
        </details>
      </div>

      <CreateSceneModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateScene}
        isLoading={createSceneMut.isPending}
      />

      <AutoGenerateChapterModal
        isOpen={isAutoGenerateModalOpen}
        onClose={handleCloseAutoGenerateModal}
        onSubmit={handleAutoGenerateChapter}
        isLoading={autoGenerateChapterMut.isPending}
        errorMessage={
          autoGenerateChapterMut.error ? apiErrorMessage(autoGenerateChapterMut.error) : null
        }
      />
    </AppShell>
  );
}
