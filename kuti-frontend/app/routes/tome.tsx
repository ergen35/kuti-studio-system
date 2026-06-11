import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, Link, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  BookOpen,
  Film,
  ChevronRight,
  Pencil,
  X,
  Check,
  Plus,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Field,
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
import type {
  GetStorySummaryResponse,
  UpdateTomeData,
} from "~/lib/backend/types.gen";
import type { Options } from "~/lib/backend";
import {
  getStorySummaryOptions,
  updateTomeMutation,
  createChapterMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import { StoryBreadcrumb, StoryCompletionButton } from "~/components/story";

type StoryData = GetStorySummaryResponse;
type Tome = StoryData["tomes"][number];
type Chapter = StoryData["chapters"][number];
type Scene = StoryData["scenes"][number];

// Create Chapter Modal
function CreateChapterModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  nextChapterNumber,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string }) => void;
  isLoading: boolean;
  nextChapterNumber: number;
}) {
  const { t } = useTranslation("story");
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<{ title: string }>({
    resolver: zodResolver(
      z.object({ title: z.string().min(1, "Title is required") }),
    ),
    defaultValues: { title: "" },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ title: `${t("sources.chapter")} ${nextChapterNumber}` });
    }
  }, [isOpen, reset, t, nextChapterNumber]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createChapter.title")}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <Field label={t("fields.title")}>
            <Input {...register("title")} autoFocus className="w-full" />
          </Field>
          {errors.title && (
            <span className="text-danger text-xs">{errors.title.message}</span>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={isLoading} type="button">
              {t("actions.cancel")}
            </Button>
            <Button variant="primary" disabled={isLoading}>
              {isLoading ? t("actions.creating") : t("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Compact chapter row
function ChapterRow({
  chapter,
  sceneCount,
  projectId,
  tomeId,
  chapterNumber,
}: {
  chapter: Chapter;
  sceneCount: number;
  projectId: string;
  tomeId: string;
  chapterNumber: number;
}) {
  const { t } = useTranslation("story");

  return (
    <Link
      to={`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`}
      className="group flex items-center gap-3 rounded-lg border border-line bg-surface p-3 transition-all hover:border-accent/40 hover:bg-accent/5"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <BookOpen size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-primary">
            C{chapterNumber}
          </span>
          <span className="truncate font-medium text-ink">{chapter.title}</span>
        </div>
      </div>
      <Badge tone="info" className="text-[10px]">
        {sceneCount} {t("tome.scenesCount", { count: sceneCount })}
      </Badge>
      <ChevronRight
        size={16}
        className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
      />
    </Link>
  );
}

const editTomeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  synopsis: z.string().optional(),
});

type EditTomeInput = z.infer<typeof editTomeSchema>;

export default function TomeRoute() {
  const { projectId = "", tomeId = "" } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(["story", "common"]);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
  });

  const tome = useMemo(() => {
    return story.data?.tomes.find((t: Tome) => t.id === tomeId);
  }, [story.data, tomeId]);

  const tomeData = useMemo(() => {
    if (!tome || !story.data) return null;
    const chapters = story.data.chapters
      .filter((c: Chapter) => c.tomeId === tomeId)
      .sort((a: Chapter, b: Chapter) => a.orderIndex - b.orderIndex);
    const scenes = story.data.scenes.filter((s: Scene) => s.tomeId === tomeId);
    return { tome, chapters, scenes };
  }, [tome, story.data, tomeId]);

  const tomeNumber = useMemo(() => {
    if (!story.data || !tome) return 0;
    const index = story.data.tomes.findIndex((t: Tome) => t.id === tomeId);
    return index + 1;
  }, [story.data, tomeId, tome]);

  const updateTome = useMutation({
    ...updateTomeMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      setIsEditing(false);
      toast.success(t("common:toast.saved"));
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const createChapter = useMutation({
    ...createChapterMutation(),
    onSuccess: (chapter) => {
      invalidateWorkspace(projectId);
      setIsChapterModalOpen(false);
      toast.success(t("common:toast.created"));
      navigate(`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EditTomeInput>({
    resolver: zodResolver(editTomeSchema),
    defaultValues: { title: "", synopsis: "" },
  });

  useEffect(() => {
    if (tome) {
      reset({ title: tome.title, synopsis: tome.synopsis ?? "" });
    }
  }, [tome, reset]);

  const onSubmit = (data: EditTomeInput) => {
    updateTome.mutate({
      path: { projectId, tomeId },
      body: { title: data.title, synopsis: data.synopsis },
    } as unknown as Options<UpdateTomeData>);
  };

  const handleCreateChapter = (body: { title: string }) => {
    createChapter.mutate({
      path: { projectId },
      body: {
        tomeId: tomeId,
        title: body.title,
        orderIndex: tomeData?.chapters.length ?? 0,
      },
    });
  };

  if (story.isLoading) {
    return <AppShell><LoadingState /></AppShell>;
  }

  if (story.error) {
    return <AppShell><ErrorState message={apiErrorMessage(story.error)} /></AppShell>;
  }

  if (!tomeData) {
    return <AppShell><EmptyState title={t("tome.notFound")} /></AppShell>;
  }

  const { tome: currentTome, chapters, scenes } = tomeData;

  return (
    <AppShell>
      {/* Breadcrumb */}
      <StoryBreadcrumb
        projectId={projectId}
        tomes={story.data?.tomes || []}
        chapters={story.data?.chapters || []}
        currentTomeId={tomeId}
        tomeNumber={tomeNumber}
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
                      targetKind="tome"
                      targetId={tomeId}
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
                    <span>{t("tome.synopsis")}</span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="tome"
                      targetId={tomeId}
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
                    disabled={updateTome.isPending}
                    className="h-8 px-3"
                  >
                    <X size={14} /> {t("actions.cancel")}
                  </Button>
                  <Button variant="primary" disabled={updateTome.isPending} className="h-8 px-3">
                    <Check size={14} /> {t("actions.save")}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">T{tomeNumber}</span>
                  <h1 className="truncate text-lg font-semibold text-ink">{currentTome.title}</h1>
                  <Badge tone={currentTome.status}>{currentTome.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {chapters.length} {t("tome.stats.chapters", { count: chapters.length })} · {scenes.length} {t("tome.stats.scenes", { count: scenes.length })}
                </p>
                {currentTome.synopsis && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{currentTome.synopsis}</p>
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
            onClick={() => setIsChapterModalOpen(true)}
            className="h-8 gap-1.5 px-3"
          >
            <Plus size={16} /> {t("actions.addChapter")}
          </Button>
        </div>

        {/* Chapters list */}
        <div className="rounded-xl border border-line bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">
            {t("tome.chapters")} ({chapters.length})
          </h2>

          {chapters.length === 0 ? (
            <EmptyState
              title={t("empty.noChapter.title")}
              description={t("empty.noChapter.description")}
            />
          ) : (
            <div className="space-y-2">
              {chapters.map((chapter: Chapter, index: number) => (
                <ChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  sceneCount={scenes.filter((s: Scene) => s.chapterId === chapter.id).length}
                  projectId={projectId}
                  tomeId={tomeId}
                  chapterNumber={index + 1}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateChapterModal
        isOpen={isChapterModalOpen}
        onClose={() => setIsChapterModalOpen(false)}
        onSubmit={handleCreateChapter}
        isLoading={createChapter.isPending}
        nextChapterNumber={chapters.length + 1}
      />
    </AppShell>
  );
}
