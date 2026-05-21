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
import { apiErrorMessage } from '~/lib/errors';
import { invalidateWorkspace, keys } from '~/lib/query';
import { StoryBreadcrumb } from '~/components/story';
import { getStorySummary, updateChapter, createScene } from '~/lib/backend/sdk.gen';
import type { GetStorySummaryResponse, CreateSceneData } from '~/lib/backend';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-surface-2/30">
          <h2 className="text-lg font-semibold text-ink">
            {t('scenes.createTitle') || 'Nouvelle scène'}
          </h2>
          <Button variant="ghost" onClick={handleClose} className="p-1 h-auto">
            <X size={18} />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-4">
          <Field label={t('fields.title') || 'Titre'}>
            <input
              {...register('title')}
              autoFocus
              placeholder={t('placeholders.sceneTitle') || 'Titre de la scène'}
              className="w-full"
            />
          </Field>
          {errors.title && (
            <span className="text-danger text-xs">{errors.title.message}</span>
          )}

          <Field label={t('fields.location') || 'Lieu'}>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                {...register('location')}
                placeholder={t('placeholders.sceneLocation') || 'Lieu de la scène'}
                className="w-full pl-10"
              />
            </div>
          </Field>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={handleClose} disabled={isLoading}>
              {t('actions.cancel') || 'Annuler'}
            </Button>
            <Button variant="primary" disabled={isLoading}>
              {isLoading ? t('actions.creating') || 'Création...' : t('actions.create') || 'Créer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
        title={t('chapter.navigation.title') || 'Chapitres du tome'} 
        meta={String(sortedChapters.length)}
      />
      
      <div className="space-y-2 mt-3">
        {sortedChapters.map((chapter, index) => {
          const isCurrent = chapter.id === currentChapterId;
          return (
            <button
              key={chapter.id}
              onClick={() => navigate(`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`)}
              className={clsx(
                "w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all",
                isCurrent 
                  ? "border-accent bg-accent/10 shadow-[inset_3px_0_0_var(--accent)]"
                  : "border-line bg-surface-2/30 hover:border-accent hover:bg-surface-2/60"
              )}
            >
              <span className={clsx(
                "text-xs font-bold",
                isCurrent ? "text-accent" : "text-accent/70"
              )}>
                {t('chapter.shortNumber', { number: index + 1 })}
              </span>
              <div className="flex-1 min-w-0">
                <p className={clsx(
                  "text-sm truncate",
                  isCurrent ? "font-medium text-ink" : "text-ink"
                )}>
                  {chapter.title}
                </p>
              </div>
              {isCurrent && (
                <span className="w-2 h-2 rounded-full bg-accent" />
              )}
              {!isCurrent && <ChevronRight size={14} className="text-muted" />}
            </button>
          );
        })}
        
        {sortedChapters.length === 0 && (
          <p className="text-sm text-muted text-center py-4">
            {t('chapter.navigation.empty') || 'Aucun chapitre'}
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
    queryKey: keys.story(projectId),
    queryFn: async () => {
      const { data } = await getStorySummary({
        path: { projectId },
      });
      return data;
    },
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
    mutationFn: async (body: { title: string }) => {
      const { data } = await updateChapter({
        path: { projectId, chapterId },
        body,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () => {
      invalidateWorkspace(projectId);
      setIsEditing(false);
    },
  });

  // Create scene mutation
  const createSceneMut = useMutation({
    mutationFn: async (body: { tomeId: string; chapterId: string; title: string; location?: string; orderIndex: number }) => {
      const { data } = await createScene({
        path: { projectId },
        body: {
          tomeId: body.tomeId,
          chapterId: body.chapterId,
          title: body.title,
          location: body.location,
          orderIndex: body.orderIndex,
        } as CreateSceneData['body'],
        throwOnError: true,
      });
      return data;
    },
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
    updateChapterMut.mutate({ title: data.title });
  };
  
  const handleCreateScene = (data: CreateSceneInput) => {
    // Calculate orderIndex based on existing scenes in this chapter
    const existingScenes = story.data?.scenes.filter(s => s.chapterId === chapterId) || [];
    const maxOrderIndex = existingScenes.reduce((max, s) => Math.max(max, s.orderIndex), 0);
    
    createSceneMut.mutate({
      tomeId,
      chapterId,
      title: data.title,
      location: data.location || undefined,
      orderIndex: maxOrderIndex + 1,
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
        <EmptyState title={t('chapter.notFound') || 'Chapitre non trouvé'} />
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
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft size={16} /> {t('chapter.backToTome') || 'Retour au tome'}
        </Link>
      </div>
      
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="space-y-4">
          {/* Chapter header */}
          <Panel className="overflow-hidden">
            <div className="flex items-start gap-4 p-4 -m-3.5 mb-4 bg-surface-2/20 border-b border-line">
              <div className="p-3 rounded-lg bg-accent/10 text-accent">
                <BookOpen size={24} />
              </div>
              <div className="flex-1">
                {/* Mobile breadcrumb */}
                <div className="lg:hidden flex items-center gap-2 text-xs text-muted mb-1">
                  <span>{t('tome.number', { number: tomeNumber })}</span>
                  <span>/</span>
                  <span className="text-accent">{t('chapter.number', { number: chapterNumber })}</span>
                </div>
                
                {isEditing ? (
                  <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-2">
                    <Field label={t('fields.title')}>
                      <input
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
                        <span className="text-xs font-bold tracking-widest uppercase text-accent/70">
                          {t('chapter.number', { number: chapterNumber })}
                        </span>
                        <h1 className="text-xl font-semibold text-ink mt-1">{chapter.title}</h1>
                      </div>
                      <Button 
                        variant="ghost" 
                        className="p-1 h-auto"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil size={16} className="text-muted" />
                      </Button>
                    </div>
                    <p className="text-sm text-muted font-mono mt-0.5">{chapter.slug}</p>
                  </>
                )}
                
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Film size={14} className="text-accent/60" />
                    <span>{scenes.length} {t('chapter.stats.scenes', { count: scenes.length })}</span>
                  </div>
                  <Badge tone={chapter.status}>{chapter.status}</Badge>
                </div>
              </div>
            </div>
            
            {chapter.synopsis && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-ink mb-2">{t('chapter.synopsis') || 'Synopsis'}</h3>
                <p className="text-sm text-muted">{chapter.synopsis}</p>
              </div>
            )}
          </Panel>
          
          {/* Scenes list */}
          <Panel>
            <SectionTitle 
              title={t('chapter.scenes') || 'Scènes'} 
              meta={`${scenes.length}`}
              actions={
                <Button 
                  variant="ghost" 
                  onClick={() => setIsCreateModalOpen(true)}
                  className="p-1.5 h-auto"
                  title={t('scenes.add') || 'Ajouter une scène'}
                >
                  <Plus size={18} className="text-accent" />
                </Button>
              }
            />
            
            <div className="space-y-2 mt-3">
              {scenes.length > 0 ? (
                scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    onClick={() => navigate(`/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`)}
                    className={clsx(
                      "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all",
                      "border-line bg-surface-2/30 hover:border-accent hover:bg-surface-2/60"
                    )}
                  >
                    <span className="text-xs font-bold text-accent/70">
                      {t('scene.number', { number: index + 1 })}
                    </span>
                    <FileText size={14} className="text-muted" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{scene.title}</p>
                      <p className="text-xs text-muted truncate">{scene.slug}</p>
                    </div>
                    <Badge tone={scene.status}>{scene.status}</Badge>
                    <ChevronRight size={14} className="text-muted" />
                  </button>
                ))
              ) : (
                <EmptyState 
                  title={t('chapter.empty.noScenes.title') || 'Aucune scène'} 
                  description={t('chapter.empty.noScenes.description') || 'Ajoutez des scènes à ce chapitre.'}
                />
              )}
            </div>
          </Panel>
        </div>
        
        {/* Side panel */}
        <div className="space-y-4">
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
