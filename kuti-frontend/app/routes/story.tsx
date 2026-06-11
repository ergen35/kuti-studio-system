import { BookOpen, ChevronRight, Film, Library, Plus } from "lucide-react";
import {
  useDeferredValue,
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams, Link } from "react-router";
import { toast } from "sonner";
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
} from "~/components/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { FormField } from "~/components/FormField";
import { StorySearchPanel } from "~/components/story";
import { ReorderControls } from "~/components/story/ReorderControls";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import {
  getStorySummaryOptions,
  createTomeMutation,
  updateTomeMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { getOrderSwap } from "~/lib/story-order";
import { buildStorySearchResults } from "~/lib/story-search";
import type { GetStorySummaryResponse } from "~/lib/backend";

type Tome = GetStorySummaryResponse["tomes"][number];

const createTomeSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

type CreateTomeInput = z.infer<typeof createTomeSchema>;

function CreateTomeModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTomeInput) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation("story");
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateTomeInput>({
    resolver: zodResolver(createTomeSchema),
    defaultValues: { title: "" },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ title: "" });
    }
  }, [isOpen, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTome.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <FormField label={t("fields.title")} error={errors.title}>
            <Input
              {...register("title")}
              autoFocus
              className="w-full"
              placeholder={t("createTome.titlePlaceholder")}
            />
          </FormField>
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

function TomeRow({
  tome,
  tomeNumber,
  projectId,
  chapterCount,
  sceneCount,
  canMoveUp,
  canMoveDown,
  reorderDisabled,
  onMoveUp,
  onMoveDown,
}: {
  tome: Tome;
  tomeNumber: number;
  projectId: string;
  chapterCount: number;
  sceneCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  reorderDisabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { t } = useTranslation("story");

  return (
    <div className="group flex items-stretch gap-2">
      <Link
        to={`/projects/${projectId}/story/${tome.id}`}
        className="flex flex-1 items-center gap-4 rounded-lg border border-line bg-surface p-4 transition-all hover:border-accent/40 hover:bg-accent/5"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Library size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">T{tomeNumber}</span>
            <h3 className="truncate text-base font-semibold text-ink">{tome.title}</h3>
            <Badge tone={tome.status} className="text-[10px]">
              {t(`status.${tome.status}`)}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <BookOpen size={12} />
              {chapterCount} {t("tome.stats.chapters", { count: chapterCount })}
            </span>
            <span className="flex items-center gap-1">
              <Film size={12} />
              {sceneCount} {t("tome.stats.scenes", { count: sceneCount })}
            </span>
          </div>
        </div>
        <ChevronRight
          size={18}
          className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </Link>
      <ReorderControls
        entityLabel={tome.title}
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

export default function StoryRoute() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation(["story", "common"]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const story = useQuery(getStorySummaryOptions({ path: { projectId } }));
  const searchQuery = searchParams.get("q") ?? "";
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const createTome = useMutation({
    ...createTomeMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      toast.success(t("common:toast.created"));
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const updateTome = useMutation({
    ...updateTomeMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
    },
  });

  const reorderTome = async (tomeId: string, direction: -1 | 1) => {
    if (!story.data) return;
    const swap = getOrderSwap(story.data.tomes, tomeId, direction);
    if (!swap) return;
    await Promise.all([
      updateTome.mutateAsync({
        path: { projectId, tomeId: swap.current.id },
        body: { orderIndex: swap.target.orderIndex },
      }),
      updateTome.mutateAsync({
        path: { projectId, tomeId: swap.target.id },
        body: { orderIndex: swap.current.orderIndex },
      }),
    ]);
  };

  const handleCreateSubmit = (data: CreateTomeInput) => {
    createTome.mutate(
      {
        path: { projectId },
        body: {
          title: data.title,
          orderIndex: story.data?.tomes?.length ?? 0,
        },
      },
      { onSuccess: () => setIsModalOpen(false) },
    );
  };

  const tomeStats = useMemo(() => {
    if (!story.data) return [];
    const { tomes, chapters, scenes } = story.data;
    return tomes
      .map((tome) => ({
        tome,
        chapterCount: chapters.filter((c) => c.tomeId === tome.id).length,
        sceneCount: scenes.filter((s) => s.tomeId === tome.id).length,
      }))
      .sort((a, b) => a.tome.orderIndex - b.tome.orderIndex);
  }, [story.data]);

  const updateSearchQuery = useCallback(
    (value: string) => {
      const nextParams = new URLSearchParams(searchParams);
      const trimmed = value.trim();
      if (trimmed) {
        nextParams.set("q", value);
      } else {
        nextParams.delete("q");
      }
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const searchResults = useMemo(
    () =>
      buildStorySearchResults(
        story.data
          ? {
              projectId,
              tomes: story.data.tomes,
              chapters: story.data.chapters,
              scenes: story.data.scenes,
            }
          : undefined,
        deferredSearchQuery,
      ),
    [deferredSearchQuery, projectId, story.data],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Compact header */}
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Library size={20} />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-ink">{t("title")}</h1>
                <p className="mt-0.5 text-xs text-muted">{t("description")}</p>
                {story.data && (
                  <p className="mt-2 text-xs text-muted">
                    <span className="font-medium text-ink">{story.data.tomes.length}</span>{" "}
                    {t("panels.outline.count", { count: story.data.tomes.length })} ·{" "}
                    <span className="font-medium text-ink">{story.data.chapters.length}</span>{" "}
                    {t("tome.stats.chapters", { count: story.data.chapters.length })} ·{" "}
                    <span className="font-medium text-ink">{story.data.scenes.length}</span>{" "}
                    {t("tome.stats.scenes", { count: story.data.scenes.length })}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              className="h-8 gap-1.5 px-3 shrink-0"
            >
              <Plus size={16} /> {t("actions.addTome")}
            </Button>
          </div>
        </div>

        {/* Search */}
        {story.data && (
          <StorySearchPanel
            query={searchQuery}
            onQueryChange={updateSearchQuery}
            results={searchResults}
          />
        )}

        {/* Error states */}
        {createTome.error && (
          <ErrorState message={apiErrorMessage(createTome.error)} />
        )}

        {/* Loading state */}
        {story.isLoading && <LoadingState />}

        {/* Error state */}
        {story.error && <ErrorState message={apiErrorMessage(story.error)} />}

        {/* Tome list */}
        {story.data && (
          <div className="rounded-xl border border-line bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink">
              {t("panels.outline.title")} ({tomeStats.length})
            </h2>

            {tomeStats.length === 0 ? (
              <EmptyState
                title={t("empty.noTome.title")}
                description={t("empty.noTome.description")}
              />
            ) : (
              <div className="space-y-2">
                {tomeStats.map(({ tome, chapterCount, sceneCount }, index) => (
                  <TomeRow
                    key={tome.id}
                    tome={tome}
                    tomeNumber={index + 1}
                    projectId={projectId}
                    chapterCount={chapterCount}
                    sceneCount={sceneCount}
                    canMoveUp={index > 0}
                    canMoveDown={index < tomeStats.length - 1}
                    reorderDisabled={updateTome.isPending}
                    onMoveUp={() => reorderTome(tome.id, -1)}
                    onMoveDown={() => reorderTome(tome.id, 1)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CreateTomeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isLoading={createTome.isPending}
      />
    </AppShell>
  );
}
