import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
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
  Panel,
  SectionTitle,
} from "~/components/ui";
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

// Schema for creating a new scene
const createSceneSchema = z.object({
  title: z.string().min(1, "Title is required"),
  location: z.string().optional(),
});

type CreateSceneInput = z.infer<typeof createSceneSchema>;

type AutoGenerateChapterInput = {
  chapterSummary: string;
  sceneCount: number;
};

// Create Scene Modal
interface CreateSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSceneInput) => void;
  isLoading: boolean;
}

function CreateSceneModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateSceneModalProps) {
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
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex flex-col gap-4"
        >
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
            <Button
              variant="ghost"
              type="button"
              onClick={handleClose}
              disabled={isLoading}
            >
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

interface AutoGenerateChapterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AutoGenerateChapterInput) => void;
  isLoading: boolean;
  errorMessage?: string | null;
}

function AutoGenerateChapterModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  errorMessage,
}: AutoGenerateChapterModalProps) {
  const { t } = useTranslation("story");
  const schema = useMemo(
    () =>
      z.object({
        chapterSummary: z
          .string()
          .trim()
          .min(1000, t("chapter.autoGenerate.errors.summary")),
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
    defaultValues: {
      chapterSummary: "",
      sceneCount: 4,
    },
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
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex max-h-[92vh] flex-col"
        >
          <DialogHeader className="border-b border-border bg-secondary/20 px-6 py-5">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl">
                  {t("chapter.autoGenerate.title")}
                </DialogTitle>
                <DialogDescription className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {t("chapter.autoGenerate.description")}
                </DialogDescription>
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
                <span className="text-xs text-danger">
                  {errors.chapterSummary.message}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("chapter.autoGenerate.summaryHint")}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1">
                  {t("chapter.autoGenerate.summaryCount", {
                    count: summaryLength,
                  })}
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
                <span className="text-xs text-danger">
                  {errors.sceneCount.message}
                </span>
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
                <Button
                  variant="ghost"
                  type="button"
                  onClick={handleClose}
                  disabled={isLoading}
                >
                  {t("chapter.autoGenerate.footerCancel")}
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={!canSubmit}
                  className="gap-2"
                >
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

// SDK types from GetStorySummaryResponse
type Tome = GetStorySummaryResponse["tomes"][number];
type Chapter = GetStorySummaryResponse["chapters"][number];
type Scene = GetStorySummaryResponse["scenes"][number];

// Sidepanel with chapters in this tome
function ChapterNavigationPanel({
  chapters,
  currentChapterId,
  projectId,
  tomeId,
  onMoveChapter,
  reorderDisabled = false,
}: {
  chapters: Chapter[];
  currentChapterId: string;
  projectId: string;
  tomeId: string;
  onMoveChapter?: (chapterId: string, direction: -1 | 1) => void;
  reorderDisabled?: boolean;
}) {
  const { t } = useTranslation("story");
  const navigate = useNavigate();

  // Sort chapters by orderIndex
  const sortedChapters = [...chapters].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  return (
    <Panel className="!p-3">
      <SectionTitle
        title={t("chapter.navigation.title")}
        meta={String(sortedChapters.length)}
      />

      <div className="mt-3 flex flex-col gap-2">
        {sortedChapters.map((chapter, index) => {
          const isCurrent = chapter.id === currentChapterId;
          return (
            <div key={chapter.id} className="group flex items-stretch gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  navigate(
                    `/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`,
                  )
                }
                className={clsx(
                  "flex h-auto flex-1 items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:text-foreground",
                  isCurrent
                    ? "border-primary/40 bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)]"
                    : "border-border bg-secondary/25 hover:border-primary/35 hover:bg-primary/8",
                )}
              >
                <span
                  className={clsx(
                    "text-xs font-semibold",
                    isCurrent ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {t("chapter.shortNumber", { number: index + 1 })}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      "truncate text-sm",
                      isCurrent
                        ? "font-medium text-primary"
                        : "text-foreground",
                    )}
                  >
                    {chapter.title}
                  </p>
                </div>
                {isCurrent && (
                  <span className="size-2 rounded-full bg-primary" />
                )}
                {!isCurrent && (
                  <ChevronRight size={14} className="text-muted-foreground" />
                )}
              </Button>
              {onMoveChapter ? (
                <ReorderControls
                  entityLabel={chapter.title}
                  canMoveUp={index > 0}
                  canMoveDown={index < sortedChapters.length - 1}
                  disabled={reorderDisabled}
                  onMoveUp={() => onMoveChapter(chapter.id, -1)}
                  onMoveDown={() => onMoveChapter(chapter.id, 1)}
                  className="self-center opacity-100 md:opacity-0 md:transition-opacity md:duration-150 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                />
              ) : null}
            </div>
          );
        })}

        {sortedChapters.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("chapter.navigation.empty")}
          </p>
        )}
      </div>
    </Panel>
  );
}

export default function ChapterRoute() {
  const { projectId = "", tomeId = "", chapterId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(["story", "common"]);

  const [isEditing, setIsEditing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAutoGenerateModalOpen, setIsAutoGenerateModalOpen] = useState(false);

  // Fetch story data
  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  // Get current chapter
  const chapter = useMemo(() => {
    return story.data?.chapters.find((c) => c.id === chapterId);
  }, [story.data, chapterId]);

  // Get tome
  const tome = useMemo(() => {
    return story.data?.tomes.find((t) => t.id === tomeId);
  }, [story.data, tomeId]);

  // Get chapter data
  const chapterData = useMemo(() => {
    if (!chapter || !story.data) return null;

    const scenes = story.data.scenes
      .filter((s) => s.chapterId === chapterId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const tomeChapters = story.data.chapters
      .filter((c) => c.tomeId === tomeId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    return { chapter, scenes, tomeChapters };
  }, [chapter, story.data, chapterId, tomeId]);

  // Calculate chapter number
  const chapterNumber = useMemo(() => {
    if (!story.data || !chapter) return 0;
    const tomeChapters = story.data.chapters
      .filter((c) => c.tomeId === tomeId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const index = tomeChapters.findIndex((c) => c.id === chapterId);
    return index + 1;
  }, [story.data, chapterId, tomeId, chapter]);

  // Calculate tome number
  const tomeNumber = useMemo(() => {
    if (!story.data || !tome) return 0;
    const index = story.data.tomes.findIndex((t) => t.id === tomeId);
    return index + 1;
  }, [story.data, tomeId, tome]);

  // Update chapter mutation
  const updateChapterMut = useMutation({
    ...updateChapterMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      setIsEditing(false);
    },
  });

  const reorderChapterMut = useMutation({
    ...updateChapterMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
    },
  });

  const reorderSceneMut = useMutation({
    ...updateSceneMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
    },
  });

  // Create scene mutation
  const createSceneMut = useMutation({
    ...createSceneMutation(),
    onSuccess: (scene) => {
      invalidateWorkspace(projectId);
      setIsCreateModalOpen(false);
      // Navigate to scene editor
      navigate(`/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`);
    },
  });

  const autoGenerateChapterMut = useMutation({
    ...autoGenerateChapterScenesMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      handleCloseAutoGenerateModal();
    },
  });

  const moveChapter = async (movingChapterId: string, direction: -1 | 1) => {
    if (!chapterData) {
      return;
    }

    const swap = getOrderSwap(
      chapterData.tomeChapters,
      movingChapterId,
      direction,
    );
    if (!swap) {
      return;
    }

    await Promise.all([
      reorderChapterMut.mutateAsync({
        path: { projectId, chapterId: swap.current.id },
        body: { orderIndex: swap.target.orderIndex },
      } as unknown as Options<UpdateChapterData>),
      reorderChapterMut.mutateAsync({
        path: { projectId, chapterId: swap.target.id },
        body: { orderIndex: swap.current.orderIndex },
      } as unknown as Options<UpdateChapterData>),
    ]);
  };

  const moveScene = async (movingSceneId: string, direction: -1 | 1) => {
    if (!chapterData) {
      return;
    }

    const swap = getOrderSwap(chapterData.scenes, movingSceneId, direction);
    if (!swap) {
      return;
    }

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
    formState: { errors },
  } = useForm<EditChapterInput>({
    resolver: zodResolver(editChapterSchema),
    defaultValues: {
      title: chapter?.title || "",
      synopsis: chapter?.synopsis || "",
    },
  });

  const onSubmit = (data: EditChapterInput) => {
    updateChapterMut.mutate({
      path: { projectId, chapterId },
      body: { title: data.title, synopsis: data.synopsis },
    } as unknown as Options<UpdateChapterData>);
  };

  const handleCreateScene = (data: CreateSceneInput) => {
    // Calculate orderIndex based on existing scenes in this chapter
    const existingScenes =
      story.data?.scenes.filter((s) => s.chapterId === chapterId) || [];
    const maxOrderIndex = existingScenes.reduce(
      (max, s) => Math.max(max, s.orderIndex),
      0,
    );

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
      body: {
        chapterSummary: data.chapterSummary,
        sceneCount: data.sceneCount,
      },
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

  if (!chapterData || !chapter || !tome) {
    return (
      <AppShell>
        <EmptyState title={t("chapter.notFound")} />
      </AppShell>
    );
  }

  const { scenes, tomeChapters } = chapterData;

  return (
    <AppShell>
      {/* Breadcrumb */}
      <StoryBreadcrumb
        projectId={projectId}
        tomes={story.data?.tomes || []}
        chapters={story.data?.chapters || []}
        currentTomeId={tomeId}
        currentChapterId={chapterId}
        tomeNumber={tomeNumber}
        chapterNumber={chapterNumber}
      />

      {/* Back link - mobile only */}
      <div className="mb-4 lg:hidden">
        <Link
          to={`/projects/${projectId}/story/${tomeId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t("chapter.backToTome")}
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="flex flex-col gap-4">
          {/* Chapter header */}
          <Panel className="overflow-hidden">
            <div className="-m-4 mb-4 flex items-start gap-4 border-b border-border bg-secondary/20 p-5 compact:-m-3 compact:mb-4 compact:p-4">
              <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
                <BookOpen size={24} />
              </div>
              <div className="min-w-0 flex-1">
                {/* Mobile breadcrumb */}
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground lg:hidden">
                  <span>{t("tome.number", { number: tomeNumber })}</span>
                  <span>/</span>
                  <span className="text-primary">
                    {t("chapter.number", { number: chapterNumber })}
                  </span>
                </div>

                {isEditing ? (
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="mt-2 flex flex-col gap-2"
                  >
                    <div className="grid gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>{t("fields.title")}</span>
                        <StoryCompletionButton
                          projectId={projectId}
                          targetKind="chapter"
                          targetId={chapterId}
                          field="title"
                          currentValue={watch("title")}
                          onComplete={(text) =>
                            setValue("title", text, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                      </div>
                      <Input
                        {...register("title")}
                        autoFocus
                        className="w-full text-lg font-semibold"
                      />
                    </div>
                    {errors.title && (
                      <span className="text-danger text-xs">
                        {errors.title.message}
                      </span>
                    )}
                    <div className="grid gap-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center justify-between gap-2">
                        <span>{t("chapter.synopsis")}</span>
                        <StoryCompletionButton
                          projectId={projectId}
                          targetKind="chapter"
                          targetId={chapterId}
                          field="synopsis"
                          currentValue={watch("synopsis")}
                          onComplete={(text) =>
                            setValue("synopsis", text, { shouldDirty: true })
                          }
                        />
                      </div>
                      <Textarea
                        {...register("synopsis")}
                        rows={4}
                        className="w-full"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setIsEditing(false)}
                        disabled={updateChapterMut.isPending}
                        aria-label={t("actions.cancel")}
                        title={t("actions.cancel")}
                      >
                        <X size={16} />
                      </Button>
                      <Button
                        variant="primary"
                        disabled={updateChapterMut.isPending}
                        aria-label={t("actions.save")}
                        title={t("actions.save")}
                      >
                        <Check size={16} />
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {t("chapter.number", { number: chapterNumber })}
                        </span>
                        <h1 className="mt-1 text-xl font-semibold text-foreground">
                          {chapter.title}
                        </h1>
                      </div>
                      <Button
                        variant="ghost"
                        className="size-8 p-0 hover:bg-primary/8 hover:text-primary"
                        onClick={() => setIsEditing(true)}
                        aria-label={t("actions.edit")}
                        title={t("actions.edit")}
                      >
                        <Pencil size={16} />
                      </Button>
                    </div>
                    <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                      {chapter.slug}
                    </p>
                  </>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Film size={14} className="text-primary" />
                    <span>
                      {scenes.length}{" "}
                      {t("chapter.stats.scenes", { count: scenes.length })}
                    </span>
                  </div>
                  <Badge tone={chapter.status}>{chapter.status}</Badge>
                </div>
              </div>
            </div>

            {chapter.synopsis && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-foreground">
                  {t("chapter.synopsis")}
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  {chapter.synopsis}
                </p>
              </div>
            )}
          </Panel>

          {/* Scenes list */}
          <Panel>
            <SectionTitle
              title={t("chapter.scenes")}
              meta={`${scenes.length}`}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setIsAutoGenerateModalOpen(true)}
                    className="h-8 gap-1.5 px-2.5"
                    title={t("chapter.autoGenerate.button")}
                  >
                    <Sparkles size={16} />
                    {t("chapter.autoGenerate.button")}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="h-8 gap-1.5 px-2.5"
                    title={t("scenes.add")}
                  >
                    <Plus size={18} />
                    {t("actions.addScene")}
                  </Button>
                </div>
              }
            />

            <div className="mt-3 flex flex-col gap-2">
              {scenes.length > 0 ? (
                scenes.map((scene, index) => (
                  <div
                    key={scene.id}
                    className="group flex items-stretch gap-2"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        navigate(
                          `/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`,
                        )
                      }
                      className={clsx(
                        "flex h-auto min-h-14 w-full flex-1 items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/8 hover:text-foreground",
                      )}
                    >
                      <span className="text-xs font-semibold text-primary">
                        {t("scene.number", { number: index + 1 })}
                      </span>
                      <FileText size={14} className="text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {scene.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {scene.slug}
                        </p>
                      </div>
                      <Badge tone={scene.status}>{scene.status}</Badge>
                      <ChevronRight
                        size={14}
                        className="text-muted-foreground"
                      />
                    </Button>
                    <ReorderControls
                      entityLabel={scene.title}
                      canMoveUp={index > 0}
                      canMoveDown={index < scenes.length - 1}
                      disabled={reorderSceneMut.isPending}
                      onMoveUp={() => moveScene(scene.id, -1)}
                      onMoveDown={() => moveScene(scene.id, 1)}
                      className="self-center opacity-100 md:opacity-0 md:transition-opacity md:duration-150 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    />
                  </div>
                ))
              ) : (
                <EmptyState
                  title={t("chapter.empty.noScenes.title")}
                  description={t("chapter.empty.noScenes.description")}
                />
              )}
            </div>
          </Panel>

          {/* Manga Preview */}
          <Panel>
            <SectionTitle title={t("chapterPreview.title")} />
            <div className="mt-3">
              <ChapterMangaPreview projectId={projectId} chapterId={chapterId} />
            </div>
          </Panel>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          {tomeChapters && (
            <ChapterNavigationPanel
              chapters={tomeChapters}
              currentChapterId={chapterId}
              projectId={projectId}
              tomeId={tomeId}
              onMoveChapter={moveChapter}
              reorderDisabled={
                updateChapterMut.isPending || reorderChapterMut.isPending
              }
            />
          )}
        </div>
      </div>

      {/* Create Scene Modal */}
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
          autoGenerateChapterMut.error
            ? apiErrorMessage(autoGenerateChapterMut.error)
            : null
        }
      />
    </AppShell>
  );
}
