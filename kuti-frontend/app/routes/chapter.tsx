import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { ArrowLeft, BookOpen, FileText, Film, ChevronRight, Pencil, X, Check } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Panel, SectionTitle, Field } from '~/components/ui';
import type { Tome, Chapter, Scene } from '~/lib/api';
import { api, apiErrorMessage } from '~/lib/api';
import { invalidateWorkspace, keys } from '~/lib/query';
import { StoryBreadcrumb } from '~/components/story';

const editChapterSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

type EditChapterInput = z.infer<typeof editChapterSchema>;

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
  
  // Sort chapters by order_index
  const sortedChapters = [...chapters].sort((a, b) => a.order_index - b.order_index);
  
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
  
  // Fetch story data
  const story = useQuery({ 
    queryKey: keys.story(projectId), 
    queryFn: () => api.story(projectId) 
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
      .filter(s => s.chapter_id === chapterId)
      .sort((a, b) => a.order_index - b.order_index);
    
    const tomeChapters = story.data.chapters
      .filter(c => c.tome_id === tomeId)
      .sort((a, b) => a.order_index - b.order_index);
    
    return { chapter, scenes, tomeChapters };
  }, [chapter, story.data, chapterId, tomeId]);
  
  // Calculate chapter number
  const chapterNumber = useMemo(() => {
    if (!story.data || !chapter) return 0;
    const tomeChapters = story.data.chapters
      .filter(c => c.tome_id === tomeId)
      .sort((a, b) => a.order_index - b.order_index);
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
  const updateChapter = useMutation({
    mutationFn: (body: { title: string }) => api.updateChapter(projectId, chapterId, body),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      setIsEditing(false);
    },
  });
  
  const { register, handleSubmit, formState: { errors } } = useForm<EditChapterInput>({
    resolver: zodResolver(editChapterSchema),
    defaultValues: { title: chapter?.title || '' },
  });
  
  const onSubmit = (data: EditChapterInput) => {
    updateChapter.mutate({ title: data.title });
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
                        disabled={updateChapter.isPending}
                      >
                        <X size={16} />
                      </Button>
                      <Button 
                        variant="primary"
                        disabled={updateChapter.isPending}
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
    </AppShell>
  );
}
