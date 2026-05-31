import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { ArrowLeft, BookOpen, FileText, Film, ChevronRight, Pencil, X, Check, Plus, MapPin } from 'lucide-react';
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
import { apiErrorMessage } from '~/lib/errors';
import { invalidateWorkspace } from '~/lib/query';
import { StoryBreadcrumb } from '~/components/story';
import { createSceneMutation, getStorySummaryOptions, updateChapterMutation } from '~/lib/backend/@tanstack/react-query.gen';
import type { CreateSceneData, GetStorySummaryResponse, Options, UpdateChapterData } from '~/lib/backend';

const editChapterSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

type EditChapterInput = z.infer<typeof editChapterSchema>;

// Schema for creating a new scene
const createSceneSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  location: z.string().optional(),
});

type CreateSceneInput = z.infer<typeof createSceneSchema>;

// Create Scene Modal
interface CreateSceneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSceneInput) => void;
  isLoading: boolean;
}

function CreateSceneModal({ isOpen, onClose, onSubmit, isLoading }: CreateSceneModalProps) {
  const { t } = useTranslation('story');
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateSceneInput>({
    resolver: zodResolver(createSceneSchema),
    defaultValues: { title: '', location: '' },
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
          <DialogTitle>{t('scenes.createTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <Field label={t('fields.title')}>
            <Input
              {...register('title')}
              autoFocus
              placeholder={t('placeholders.sceneTitle')}
              className="w-full"
            />
          </Field>
          {errors.title && (
            <span className="text-danger text-xs">{errors.title.message}</span>
          )}

          <Field label={t('fields.location')}>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                {...register('location')}
                placeholder={t('placeholders.sceneLocation')}
                className="w-full pl-10"
              />
            </div>
          </Field>

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={handleClose} disabled={isLoading}>
              {t('actions.cancel')}
            </Button>
            <Button variant="primary" disabled={isLoading}>
              {isLoading ? t('actions.creating') : t('actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// SDK types from GetStorySummaryResponse
type Tome = GetStorySummaryResponse['tomes'][number];
type Chapter = GetStorySummaryResponse['chapters'][number];
type Scene = GetStorySummaryResponse['scenes'][number];

// Sidepanel with chapters in this tome
function ChapterNavigationPanel({
  chapters,
  currentChapterId,
  projectId,
  tomeId,
}: {
  chapters: Chapter[];
  currentChapterId: string;
  projectId: string;
  tomeId: string;
}) {
  const { t } = useTranslation('story');
  const navigate = useNavigate();

  // Sort chapters by orderIndex
  const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Panel className="!p-3">
      <SectionTitle
        title={t('chapter.navigation.title')}
        meta={String(sortedChapters.length)}
      />

      <div className="mt-3 flex flex-col gap-2">
        {sortedChapters.map((chapter, index) => {
          const isCurrent = chapter.id === currentChapterId;
          return (
            <Button
              type="button"
              variant="ghost"
              key={chapter.id}
              onClick={() => navigate(`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`)}
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
                {t('chapter.shortNumber', { number: index + 1 })}
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx(
                  "truncate text-sm",
                  isCurrent ? "font-medium text-primary" : "text-foreground"
                )}>
                  {chapter.title}
                </p>
              </div>
              {isCurrent && (
                <span className="size-2 rounded-full bg-primary" />
              )}
              {!isCurrent && <ChevronRight size={14} className="text-muted-foreground" />}
            </Button>
          );
        })}

        {sortedChapters.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('chapter.navigation.empty')}
          </p>
        )}
      </div>
    </Panel>
  );
}

export default function ChapterRoute() {
  const { projectId = '', tomeId = '', chapterId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['story', 'common']);

  const [isEditing, setIsEditing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Fetch story data
  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  // Get current chapter
  const chapter = useMemo(() => {
    return story.data?.chapters.find(c => c.id === chapterId);
  }, [story.data, chapterId]);

  // Get tome
  const tome = useMemo(() => {
    return story.data?.tomes.find(t => t.id === tomeId);
  }, [story.data, tomeId]);

  // Get chapter data
  const chapterData = useMemo(() => {
    if (!chapter || !story.data) return null;

    const scenes = story.data.scenes
      .filter(s => s.chapterId === chapterId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const tomeChapters = story.data.chapters
      .filter(c => c.tomeId === tomeId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    return { chapter, scenes, tomeChapters };
  }, [chapter, story.data, chapterId, tomeId]);

  // Calculate chapter number
  const chapterNumber = useMemo(() => {
    if (!story.data || !chapter) return 0;
    const tomeChapters = story.data.chapters
      .filter(c => c.tomeId === tomeId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const index = tomeChapters.findIndex(c => c.id === chapterId);
    return index + 1;
  }, [story.data, chapterId, tomeId, chapter]);

  // Calculate tome number
  const tomeNumber = useMemo(() => {
    if (!story.data || !tome) return 0;
    const index = story.data.tomes.findIndex(t => t.id === tomeId);
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

  const { register, handleSubmit, formState: { errors } } = useForm<EditChapterInput>({
    resolver: zodResolver(editChapterSchema),
    defaultValues: { title: chapter?.title || '' },
  });

  const onSubmit = (data: EditChapterInput) => {
    updateChapterMut.mutate({
      path: { projectId, chapterId },
      body: { title: data.title },
    } as unknown as Options<UpdateChapterData>);
  };

  const handleCreateScene = (data: CreateSceneInput) => {
    // Calculate orderIndex based on existing scenes in this chapter
    const existingScenes = story.data?.scenes.filter(s => s.chapterId === chapterId) || [];
    const maxOrderIndex = existingScenes.reduce((max, s) => Math.max(max, s.orderIndex), 0);

    createSceneMut.mutate({
      path: { projectId },
      body: {
        tomeId,
        chapterId,
        title: data.title,
        location: data.location || undefined,
        orderIndex: maxOrderIndex + 1,
      } as CreateSceneData['body'],
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

  if (!chapterData || !chapter || !tome) {
    return (
      <AppShell>
        <EmptyState title={t('chapter.notFound')} />
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
          <ArrowLeft size={16} /> {t('chapter.backToTome')}
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
                  <span>{t('tome.number', { number: tomeNumber })}</span>
                  <span>/</span>
                  <span className="text-primary">{t('chapter.number', { number: chapterNumber })}</span>
                </div>

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
                        disabled={updateChapterMut.isPending}
                      >
                        <X size={16} />
                      </Button>
                      <Button
                        variant="primary"
                        disabled={updateChapterMut.isPending}
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
                          {t('chapter.number', { number: chapterNumber })}
                        </span>
                        <h1 className="mt-1 text-xl font-semibold text-foreground">{chapter.title}</h1>
                      </div>
                      <Button
                        variant="ghost"
                        className="size-8 p-0 hover:bg-primary/8 hover:text-primary"
                        onClick={() => setIsEditing(true)}
                        title={t('actions.edit')}
                      >
                        <Pencil size={16} />
                      </Button>
                    </div>
                    <p className="mt-0.5 font-mono text-sm text-muted-foreground">{chapter.slug}</p>
                  </>
                )}

                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Film size={14} className="text-primary" />
                    <span>{scenes.length} {t('chapter.stats.scenes', { count: scenes.length })}</span>
                  </div>
                  <Badge tone={chapter.status}>{chapter.status}</Badge>
                </div>
              </div>
            </div>

            {chapter.synopsis && (
              <div className="mb-4">
                <h3 className="mb-2 text-sm font-medium text-foreground">{t('chapter.synopsis')}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{chapter.synopsis}</p>
              </div>
            )}
          </Panel>

          {/* Scenes list */}
          <Panel>
            <SectionTitle
              title={t('chapter.scenes')}
              meta={`${scenes.length}`}
              actions={
                <Button
                  variant="primary"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="h-8 gap-1.5 px-2.5"
                  title={t('scenes.add')}
                >
                  <Plus size={18} />
                  {t('actions.addScene')}
                </Button>
              }
            />

            <div className="mt-3 flex flex-col gap-2">
              {scenes.length > 0 ? (
                scenes.map((scene, index) => (
                  <Button
                    type="button"
                    variant="ghost"
                    key={scene.id}
                    onClick={() => navigate(`/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`)}
                    className={clsx(
                      "flex h-auto min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/8 hover:text-foreground"
                    )}
                  >
                    <span className="text-xs font-semibold text-primary">
                      {t('scene.number', { number: index + 1 })}
                    </span>
                    <FileText size={14} className="text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{scene.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{scene.slug}</p>
                    </div>
                    <Badge tone={scene.status}>{scene.status}</Badge>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </Button>
                ))
              ) : (
                <EmptyState
                  title={t('chapter.empty.noScenes.title')}
                  description={t('chapter.empty.noScenes.description')}
                />
              )}
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
    </AppShell>
  );
}
