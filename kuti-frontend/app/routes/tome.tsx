import { useMemo, useState, useEffect, useRef } from 'react';
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
import type { Tome, Chapter, Scene } from '~/lib/api';
import { api, apiErrorMessage } from '~/lib/api';
import { invalidateWorkspace, keys } from '~/lib/query';
import { StoryBreadcrumb } from '~/components/story';

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
  
  const overlayRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);
  
  useEffect(() => {
    if (isOpen) {
      reset({ title: `${t('sources.chapter')} ${tomeNumber}` });
    }
  }, [isOpen, reset, t, tomeNumber]);
  
  const handleFormSubmit = (data: { title: string }) => {
    onSubmit(data);
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-line bg-surface-2/30">
          <h2 className="text-lg font-semibold text-ink">
            {t('createChapter.title') || 'Nouveau chapitre'}
          </h2>
          <Button variant="ghost" onClick={onClose} className="p-1 h-auto">
            <X size={20} />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-4">
          <Field label={t('fields.title')}>
            <input
              {...register('title')}
              autoFocus
              className="w-full"
            />
          </Field>
          {errors.title && (
            <span className="text-danger text-xs">{errors.title.message}</span>
          )}
          
          <div className="flex justify-end gap-3 pt-2">
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
          </div>
        </form>
      </div>
    </div>
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
  
  const chapterScenes = scenes.filter(s => s.chapter_id === chapter.id);
  
  return (
    <button
      onClick={() => navigate(`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`)}
      className="w-full flex items-center justify-between p-4 rounded-lg border border-line bg-surface hover:border-accent hover:bg-surface-2/30 transition-all text-left"
    >
      <div className="flex items-center gap-3">
        <BookOpen size={18} className="text-accent" />
        <div>
          <span className="text-xs font-bold text-accent/70 block">
            {t('chapter.number', { number: chapterNumber })}
          </span>
          <span className="font-medium text-ink">{chapter.title}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge>
          {chapterScenes.length} {t('tome.scenesCount', { count: chapterScenes.length })}
        </Badge>
        <ChevronRight size={16} className="text-muted" />
      </div>
    </button>
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
  
  const sortedTomes = [...tomes].sort((a, b) => a.order_index - b.order_index);
  
  return (
    <Panel className="!p-3">
      <SectionTitle 
        title={t('tome.navigation.title') || 'Tomes'} 
        meta={String(sortedTomes.length)}
      />
      
      <div className="space-y-2 mt-3">
        {sortedTomes.map((tome, index) => {
          const isCurrent = tome.id === currentTomeId;
          return (
            <button
              key={tome.id}
              onClick={() => navigate(`/projects/${projectId}/story/${tome.id}`)}
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
                {t('tome.shortNumber', { number: index + 1 })}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tome.title}</p>
              </div>
              {isCurrent && (
                <span className="w-2 h-2 rounded-full bg-accent" />
              )}
              {!isCurrent && <ChevronRight size={14} className="text-muted" />}
            </button>
          );
        })}
        
        {sortedTomes.length === 0 && (
          <p className="text-sm text-muted text-center py-4">
            {t('tome.navigation.empty') || 'Aucun tome'}
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
    mutationFn: (body: { title: string }) => api.updateTome(projectId, tomeId, body),
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
    updateTome.mutate({ title: data.title });
  };
  
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start gap-4 p-4 -m-3.5 mb-4 bg-surface-2/20 border-b border-line">
        <div className="p-3 rounded-lg bg-accent/10 text-accent">
          <BookOpen size={24} />
        </div>
        <div className="flex-1">
          <span className="text-xs font-bold tracking-widest uppercase text-accent/70">
            {t('tome.number', { number: tomeNumber })}
          </span>
          
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
                <h1 className="text-xl font-semibold text-ink mt-1">{tome.title}</h1>
                <Button 
                  variant="ghost" 
                  className="p-1 h-auto"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil size={16} className="text-muted" />
                </Button>
              </div>
              <p className="text-sm text-muted font-mono mt-0.5">{tome.slug}</p>
            </>
          )}
          
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <div className="flex items-center gap-2 text-sm text-muted">
              <BookOpen size={14} className="text-accent/60" />
              <span>{chapters.length} {t('tome.stats.chapters', { count: chapters.length })}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Film size={14} className="text-accent/60" />
              <span>{scenes.length} {t('tome.stats.scenes', { count: scenes.length })}</span>
            </div>
            <Badge tone={tome.status}>{tome.status}</Badge>
          </div>
        </div>
      </div>
      
      {tome.synopsis && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-ink mb-2">{t('tome.synopsis') || 'Synopsis'}</h3>
          <p className="text-sm text-muted">{tome.synopsis}</p>
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
    queryKey: keys.story(projectId), 
    queryFn: () => api.story(projectId) 
  });
  
  // Get current tome
  const tome = useMemo(() => {
    return story.data?.tomes.find(t => t.id === tomeId);
  }, [story.data, tomeId]);
  
  // Get tome data
  const tomeData = useMemo(() => {
    if (!tome || !story.data) return null;
    
    const chapters = story.data.chapters
      .filter(c => c.tome_id === tomeId)
      .sort((a, b) => a.order_index - b.order_index);
    
    const scenes = story.data.scenes.filter(s => s.tome_id === tomeId);
    
    return { tome, chapters, scenes };
  }, [tome, story.data, tomeId]);
  
  // Calculate tome number
  const tomeNumber = useMemo(() => {
    if (!story.data || !tome) return 0;
    const index = story.data.tomes.findIndex(t => t.id === tomeId);
    return index + 1;
  }, [story.data, tomeId, tome]);
  
  // Create chapter mutation
  const createChapter = useMutation({
    mutationFn: (body: { title: string }) => api.createChapter(projectId, {
      tome_id: tomeId,
      title: body.title,
      order_index: tomeData?.chapters.length || 0,
    }),
    onSuccess: (chapter) => {
      invalidateWorkspace(projectId);
      setIsChapterModalOpen(false);
      // Navigate to the new chapter
      navigate(`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`);
    },
  });
  
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
        <EmptyState title={t('tome.notFound') || 'Tome non trouvé'} />
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
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft size={16} /> {t('tome.backToStory') || 'Retour aux tomes'}
        </Link>
      </div>
      
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="space-y-4">
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
            <div className="flex items-center justify-between mb-3">
              <SectionTitle 
                title={t('tome.chapters') || 'Chapitres'} 
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
            
            <div className="space-y-3">
              {chapters.map((chapter, index) => (
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
                  title={t('empty.noChapter.title') || 'Aucun chapitre'} 
                  description={t('empty.noChapter.description') || 'Ajoutez des chapitres à ce tome.'}
                />
              )}
            </div>
          </Panel>
        </div>
        
        {/* Side panel */}
        <div className="space-y-4">
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
        onSubmit={(data) => createChapter.mutate(data)}
        isLoading={createChapter.isPending}
        tomeNumber={chapters.length + 1}
      />
    </AppShell>
  );
}
