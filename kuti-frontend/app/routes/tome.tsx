import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { ArrowLeft, BookOpen, Film, ChevronRight, Pencil, X, Check, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Panel, SectionTitle, Field } from '~/components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import type { GetStorySummaryResponse, UpdateTomeData } from '~/lib/backend/types.gen';
import type { Options } from '~/lib/backend';
import { getStorySummaryOptions, updateTomeMutation, createChapterMutation } from '~/lib/backend/@tanstack/react-query.gen';
import { apiErrorMessage } from '~/lib/errors';
import { invalidateWorkspace } from '~/lib/query';
import { StoryBreadcrumb } from '~/components/story';

// Derive types from GetStorySummaryResponse
type StoryData = GetStorySummaryResponse;
type Tome = StoryData['tomes'][number];
type Chapter = StoryData['chapters'][number];
type Scene = StoryData['scenes'][number];

// Create Chapter Modal
function CreateChapterModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  tomeNumber,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string }) => void;
  isLoading: boolean;
  tomeNumber: number;
}) {
  const { t } = useTranslation('story');
  const { register, handleSubmit, formState: { errors }, reset } = useForm<{ title: string }>({
    resolver: zodResolver(z.object({ title: z.string().min(1, 'Title is required') })),
    defaultValues: { title: '' },
  });

  useEffect(() => {
    if (isOpen) {
      reset({ title: `${t('sources.chapter')} ${tomeNumber}` });
    }
  }, [isOpen, reset, t, tomeNumber]);

  const handleFormSubmit = (data: { title: string }) => {
    onSubmit(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createChapter.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <Field label={t('fields.title')}>
            <Input
              {...register('title')}
              autoFocus
              className="w-full"
            />
          </Field>
          {errors.title && (
            <span className="text-danger text-xs">{errors.title.message}</span>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
              type="button"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  {t('actions.creating')}
                </>
              ) : (
                t('actions.save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Simple chapter row component
function ChapterRow({
  chapter,
  scenes,
  projectId,
  tomeId,
  chapterNumber,
}: {
  chapter: Chapter;
  scenes: Scene[];
  projectId: string;
  tomeId: string;
  chapterNumber: number;
}) {
  const { t } = useTranslation('story');
  const navigate = useNavigate();

  const chapterScenes = scenes.filter((s: Scene) => s.chapterId === chapter.id);

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => navigate(`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`)}
      className="flex h-auto min-h-16 w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/35 hover:bg-primary/8 hover:text-foreground"
    >
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
          <BookOpen size={18} />
        </div>
        <div>
          <span className="block text-xs font-semibold text-primary">
            {t('chapter.number', { number: chapterNumber })}
          </span>
          <span className="font-medium text-foreground">{chapter.title}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge tone="info">
          {chapterScenes.length} {t('tome.scenesCount', { count: chapterScenes.length })}
        </Badge>
        <ChevronRight size={16} className="text-muted-foreground" />
      </div>
    </Button>
  );
}

// Sidepanel with all tomes
function TomeNavigationPanel({
  tomes,
  currentTomeId,
  projectId,
}: {
  tomes: Tome[];
  currentTomeId: string;
  projectId: string;
}) {
  const { t } = useTranslation('story');
  const navigate = useNavigate();

  const sortedTomes = [...tomes].sort((a: Tome, b: Tome) => a.orderIndex - b.orderIndex);

  return (
    <Panel className="!p-3">
      <SectionTitle
        title={t('tome.navigation.title')}
        meta={String(sortedTomes.length)}
      />

      <div className="mt-3 flex flex-col gap-2">
        {sortedTomes.map((tome: Tome, index: number) => {
          const isCurrent = tome.id === currentTomeId;
          return (
            <Button
              type="button"
              variant="ghost"
              key={tome.id}
              onClick={() => navigate(`/projects/${projectId}/story/${tome.id}`)}
              className={clsx(
                "flex h-auto w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:text-foreground",
                isCurrent
                  ? "border-primary/40 bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)]"
                  : "border-border bg-secondary/25 hover:border-primary/35 hover:bg-primary/8"
              )}
            >
              <span className={clsx(
                "text-xs font-semibold",
                isCurrent ? "text-primary" : "text-muted-foreground"
              )}>
                {t('tome.shortNumber', { number: index + 1 })}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{tome.title}</p>
              </div>
              {isCurrent && (
                <span className="size-2 rounded-full bg-primary" />
              )}
              {!isCurrent && <ChevronRight size={14} className="text-muted-foreground" />}
            </Button>
          );
        })}

        {sortedTomes.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('tome.navigation.empty')}
          </p>
        )}
      </div>
    </Panel>
  );
}

// Schema for editing tome
const editTomeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

type EditTomeInput = z.infer<typeof editTomeSchema>;

// Tome header with edit mode
function TomeHeader({
  tome,
  tomeNumber,
  chapters,
  scenes,
  projectId,
  tomeId,
}: {
  tome: Tome;
  tomeNumber: number;
  chapters: Chapter[];
  scenes: Scene[];
  projectId: string;
  tomeId: string;
}) {
  const { t } = useTranslation('story');
  const [isEditing, setIsEditing] = useState(false);

  const updateTome = useMutation({
    ...updateTomeMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      setIsEditing(false);
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<EditTomeInput>({
    resolver: zodResolver(editTomeSchema),
    defaultValues: { title: tome.title },
  });

  const onSubmit = (data: EditTomeInput) => {
    updateTome.mutate({
      path: { projectId, tomeId },
      body: { title: data.title }
    } as unknown as Options<UpdateTomeData>);
  };

  return (
    <Panel className="overflow-hidden">
      <div className="-m-4 mb-4 flex items-start gap-4 border-b border-border bg-secondary/20 p-5 compact:-m-3 compact:mb-4 compact:p-4">
        <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
          <BookOpen size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t('tome.number', { number: tomeNumber })}
          </span>

          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-2 flex flex-col gap-2">
              <Field label={t('fields.title')}>
                <Input
                  {...register('title')}
                  autoFocus
                  className="w-full text-lg font-semibold"
                />
              </Field>
              {errors.title && (
                <span className="text-danger text-xs">{errors.title.message}</span>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={updateTome.isPending}
                >
                  <X size={16} />
                </Button>
                <Button
                  variant="primary"
                  disabled={updateTome.isPending}
                >
                  <Check size={16} />
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h1 className="mt-1 text-xl font-semibold text-foreground">{tome.title}</h1>
                <Button
                  variant="ghost"
                  className="size-8 p-0 hover:bg-primary/8 hover:text-primary"
                  onClick={() => setIsEditing(true)}
                  title={t('actions.edit')}
                >
                  <Pencil size={16} />
                </Button>
              </div>
              <p className="mt-0.5 font-mono text-sm text-muted-foreground">{tome.slug}</p>
            </>
          )}

          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen size={14} className="text-primary" />
              <span>{chapters.length} {t('tome.stats.chapters', { count: chapters.length })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Film size={14} className="text-primary" />
              <span>{scenes.length} {t('tome.stats.scenes', { count: scenes.length })}</span>
            </div>
            <Badge tone={tome.status}>{tome.status}</Badge>
          </div>
        </div>
      </div>

      {tome.synopsis && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-medium text-foreground">{t('tome.synopsis')}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{tome.synopsis}</p>
        </div>
      )}
    </Panel>
  );
}

export default function TomeRoute() {
  const { projectId = '', tomeId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['story', 'common']);

  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);

  // Fetch story data
  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } })
  });

  // Get current tome
  const tome = useMemo(() => {
    return story.data?.tomes.find((t: Tome) => t.id === tomeId);
  }, [story.data, tomeId]);

  // Get tome data
  const tomeData = useMemo(() => {
    if (!tome || !story.data) return null;

    const chapters = story.data.chapters
      .filter((c: Chapter) => c.tomeId === tomeId)
      .sort((a: Chapter, b: Chapter) => a.orderIndex - b.orderIndex);

    const scenes = story.data.scenes.filter((s: Scene) => s.tomeId === tomeId);

    return { tome, chapters, scenes };
  }, [tome, story.data, tomeId]);

  // Calculate tome number
  const tomeNumber = useMemo(() => {
    if (!story.data || !tome) return 0;
    const index = story.data.tomes.findIndex((t: Tome) => t.id === tomeId);
    return index + 1;
  }, [story.data, tomeId, tome]);

  // Create chapter mutation
  const createChapter = useMutation({
    ...createChapterMutation(),
    onSuccess: (chapter) => {
      invalidateWorkspace(projectId);
      setIsChapterModalOpen(false);
      // Navigate to the new chapter
      navigate(`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`);
    },
  });

  const handleCreateChapter = (body: { title: string }) => {
    createChapter.mutate({
      path: { projectId },
      body: {
        tomeId: tomeId,
        title: body.title,
        orderIndex: tomeData?.chapters.length ?? 0,
      }
    });
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

  if (!tomeData) {
    return (
      <AppShell>
        <EmptyState title={t('tome.notFound')} />
      </AppShell>
    );
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

      {/* Back link - mobile only */}
      <div className="mb-4 lg:hidden">
        <Link
          to={`/projects/${projectId}/story`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t('tome.backToStory')}
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="flex flex-col gap-4">
          {/* Tome header with edit mode */}
          <TomeHeader
            tome={currentTome}
            tomeNumber={tomeNumber}
            chapters={chapters}
            scenes={scenes}
            projectId={projectId}
            tomeId={tomeId}
          />

          {/* Chapters list */}
          <Panel>
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionTitle
                title={t('tome.chapters')}
                meta={`${chapters.length}`}
              />
              <Button
                variant="primary"
                onClick={() => setIsChapterModalOpen(true)}
                className="text-sm"
              >
                <Plus size={14} /> {t('actions.addChapter')}
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              {chapters.map((chapter: Chapter, index: number) => (
                <ChapterRow
                  key={chapter.id}
                  chapter={chapter}
                  scenes={scenes}
                  projectId={projectId}
                  tomeId={tomeId}
                  chapterNumber={index + 1}
                />
              ))}

              {chapters.length === 0 && (
                <EmptyState
                  title={t('empty.noChapter.title')}
                  description={t('empty.noChapter.description')}
                />
              )}
            </div>
          </Panel>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          {story.data && (
            <TomeNavigationPanel
              tomes={story.data.tomes}
              currentTomeId={tomeId}
              projectId={projectId}
            />
          )}
        </div>
      </div>

      {/* Create Chapter Modal */}
      <CreateChapterModal
        isOpen={isChapterModalOpen}
        onClose={() => setIsChapterModalOpen(false)}
        onSubmit={handleCreateChapter}
        isLoading={createChapter.isPending}
        tomeNumber={chapters.length + 1}
      />
    </AppShell>
  );
}
