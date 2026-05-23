import { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { ArrowLeft, FileText, Save, Clock, Trash2, Sparkles } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Panel, SectionTitle, Field, toCsv } from '~/components/ui';
import { LexicalEditor } from '~/components/editor';
import '~/components/editor/styles.css';
import type { GetStorySummaryResponse } from '~/lib/backend';
import { apiErrorMessage } from '~/lib/errors';
import { csv } from '~/lib/utils';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStorySummaryOptions, updateSceneMutation, deleteSceneMutation, listCharactersOptions } from '~/lib/backend/@tanstack/react-query.gen';
import { StoryBreadcrumb } from '~/components/story';
import { SceneGenerationModal, SceneMangaGallery } from '~/components/scene';

type Tome = GetStorySummaryResponse['tomes'][number];
type Chapter = GetStorySummaryResponse['chapters'][number];
type Scene = GetStorySummaryResponse['scenes'][number];

const sceneSchema = z.object({
  title: z.string().min(1, 'titleRequired'),
  summary: z.string().optional(),
  content: z.string().optional(),
  characters_json: z.string().optional(),
  tags_json: z.string().optional(),
  notes: z.string().optional(),
});

type SceneInput = z.infer<typeof sceneSchema>;

// Sidepanel with scenes in this chapter
function SceneNavigationPanel({ 
  scenes, 
  currentSceneId,
  projectId,
  tomeId,
  chapterId,
}: { 
  scenes: Scene[]; 
  currentSceneId: string;
  projectId: string;
  tomeId: string;
  chapterId: string;
}) {
  const { t } = useTranslation('story');
  const navigate = useNavigate();
  
  const sortedScenes = [...scenes].sort((a, b) => a.orderIndex - b.orderIndex);
  
  return (
    <Panel className="!p-3">
      <SectionTitle 
        title={t('scene.navigation.title') || 'Scènes du chapitre'} 
        meta={String(sortedScenes.length)}
      />
      
      <div className="space-y-2 mt-3">
        {sortedScenes.map((scene, index) => {
          const isCurrent = scene.id === currentSceneId;
          return (
            <button
              key={scene.id}
              onClick={() => navigate(`/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`)}
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
                {t('scene.shortNumber', { number: index + 1 })}
              </span>
              <div className="flex-1 min-w-0">
                <p className={clsx(
                  "text-sm truncate",
                  isCurrent ? "font-medium text-ink" : "text-ink"
                )}>
                  {scene.title}
                </p>
              </div>
              {isCurrent && (
                <span className="w-2 h-2 rounded-full bg-accent" />
              )}
              {!isCurrent && (
                <svg className="text-muted w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              )}
            </button>
          );
        })}
        
        {sortedScenes.length === 0 && (
          <p className="text-sm text-muted text-center py-4">
            {t('scene.navigation.empty') || 'Aucune scène'}
          </p>
        )}
      </div>
    </Panel>
  );
}

export default function SceneRoute() {
  const { projectId = '', tomeId = '', chapterId = '', sceneId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation(['story', 'common']);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false);

  // Fetch story data
  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
  });

  // Fetch characters for this project
  const characters = useQuery({
    ...listCharactersOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  // Get scene
  const scene = useMemo(() => {
    return story.data?.scenes.find(s => s.id === sceneId);
  }, [story.data, sceneId]);

  // Get chapter and tome
  const context = useMemo(() => {
    if (!story.data || !scene) return null;

    const chapter = story.data.chapters.find(c => c.id === scene.chapterId);
    const tome = story.data.tomes.find(t => t.id === scene.tomeId);
    const chapterScenes = story.data.scenes
      .filter(s => s.chapterId === scene.chapterId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    return { chapter, tome, chapterScenes };
  }, [story.data, scene]);

  // Calculate scene number
  const sceneNumber = useMemo(() => {
    if (!context?.chapterScenes || !scene) return 0;
    const index = context.chapterScenes.findIndex(s => s.id === sceneId);
    return index + 1;
  }, [context, sceneId, scene]);

  // Calculate chapter and tome numbers
  const { chapterNumber, tomeNumber } = useMemo(() => {
    if (!story.data || !context?.chapter || !context?.tome) return { chapterNumber: 0, tomeNumber: 0 };

    const tomeIndex = story.data.tomes.findIndex(t => t.id === context.tome?.id);
    const chapterIndex = story.data.chapters
      .filter(c => c.tomeId === context.tome?.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .findIndex(c => c.id === context.chapter?.id);

    return {
      tomeNumber: tomeIndex + 1,
      chapterNumber: chapterIndex + 1
    };
  }, [story.data, context]);

  // Mutations using SDK
  const updateScene = useMutation({
    ...updateSceneMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story', projectId] });
      setIsSaving(false);
    },
  });

  const deleteScene = useMutation({
    ...deleteSceneMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['story', projectId] });
      navigate(`/projects/${projectId}/story/${tomeId}/chapters/${scene?.chapterId}`);
    },
  });
  
  const { register, handleSubmit, control, watch, reset, formState: { errors, isDirty } } = useForm<SceneInput>({
    resolver: zodResolver(sceneSchema),
    defaultValues: {
      title: '',
      summary: '',
      content: '',
      characters_json: '',
      tags_json: '',
      notes: '',
    },
  });

  // Reset form when scene data loads or changes
  useEffect(() => {
    if (scene) {
      reset({
        title: scene.title ?? '',
        summary: scene.summary ?? '',
        content: scene.content ?? '',
        characters_json: toCsv(scene.charactersJson) ?? '',
        tags_json: toCsv(scene.tagsJson) ?? '',
        notes: scene.notes ?? '',
      });
    }
  }, [scene, reset]);

  // Watch for changes (kept for intentional re-render triggers)
  const watchedSceneId = watch('title');

  const onSubmit = useCallback((data: SceneInput) => {
    setIsSaving(true);
    updateScene.mutate({
      // @ts-expect-error - SDK types missing path params
      path: { projectId, sceneId },
      body: {
        title: data.title,
        summary: data.summary,
        content: data.content,
        charactersJson: csv(data.characters_json || ''),
        tagsJson: csv(data.tags_json || ''),
        notes: data.notes,
      },
    });
  }, [updateScene, projectId, sceneId]);
  
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
  
  if (!scene || !context || !context.chapter || !context.tome) {
    return (
      <AppShell>
        <EmptyState title={t('scene.notFound') || 'Scène non trouvée'} />
      </AppShell>
    );
  }
  
  const { chapter, tome, chapterScenes } = context;
  if (!chapter || !tome) return null;
  const formattedDate = new Date(scene.updatedAt).toLocaleDateString(t('locale') || 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AppShell>
      {/* Breadcrumb */}
      <StoryBreadcrumb
        projectId={projectId}
        tomes={story.data?.tomes || []}
        chapters={story.data?.chapters || []}
        scenes={story.data?.scenes || []}
        currentTomeId={tomeId}
        currentChapterId={chapter.id}
        currentSceneId={sceneId}
        tomeNumber={tomeNumber}
        chapterNumber={chapterNumber}
        sceneNumber={sceneNumber}
      />
      
      {/* Back link - mobile only */}
      <div className="mb-4 lg:hidden">
        <Link 
          to={`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft size={16} /> {t('scene.backToChapter') || 'Retour au chapitre'}
        </Link>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
          {/* Main content */}
          <div className="space-y-4">
            {/* Scene header */}
            <Panel className="overflow-hidden">
              <div className="flex items-start gap-4 p-4 -m-3.5 mb-4 bg-surface-2/20 border-b border-line">
                <div className="p-3 rounded-lg bg-accent/10 text-accent">
                  <FileText size={24} />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold tracking-widest uppercase text-accent/70">
                    {t('scene.number', { number: sceneNumber })}
                  </span>
                  
                  <Field label={t('fields.title')}>
                    <input
                      {...register('title')}
                      className="text-lg font-semibold w-full"
                    />
                  </Field>
                  {errors.title && (
                    <span className="text-danger text-xs">{errors.title.message}</span>
                  )}
                  
                  <p className="text-sm text-muted font-mono mt-1">{scene.slug}</p>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <Clock size={12} />
                      <span>{t('scene.lastModified')}: {formattedDate}</span>
                    </div>
                    <Badge tone={scene.status}>{t(`status.${scene.status}`)}</Badge>
                  </div>
                </div>
              </div>
            </Panel>
            
            {/* Scene editor */}
            <Panel>
              <SectionTitle title={t('panels.sceneEditor.title')} />
              
              <div className="space-y-4 mt-3">
                {/* Summary */}
                <Field label={t('fields.summary')}>
                  <textarea {...register('summary')} rows={3} placeholder="Résumé de la scène..." />
                </Field>
                
                {/* Content - Lexical Editor */}
                <div>
                  <label className="text-xs text-muted block mb-1.5">{t('fields.content')}</label>
                  <Controller
                    name="content"
                    control={control}
                    render={({ field }) => (
                      <LexicalEditor
                        initialValue={field.value || ''}
                        onChange={field.onChange}
                        placeholder={t('editor.placeholder')}
                        minHeight="600px"
                      />
                    )}
                  />
                </div>
                
                {/* Characters & Tags */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <Field label={t('fields.characters')}>
                    <input {...register('characters_json')} placeholder="@character:jean, @character:marie..." />
                  </Field>
                  <Field label={t('fields.tags')}>
                    <input {...register('tags_json')} placeholder="romantique, combat, révélation..." />
                  </Field>
                </div>
                
                {/* Notes */}
                <Field label={t('fields.notes')}>
                  <textarea {...register('notes')} rows={3} placeholder="Notes internes..." />
                </Field>
              </div>
            </Panel>
            
            {/* Actions */}
            <div className="flex justify-between items-center">
              <Button
                variant="danger"
                type="button"
                // @ts-expect-error - SDK types missing path params
                onClick={() => deleteScene.mutate({ path: { projectId, sceneId } })}
                disabled={deleteScene.isPending}
              >
                <Trash2 size={16} />
                {t('actions.deleteScene')}
              </Button>
              
              <div className="flex items-center gap-4">
                {isDirty && (
                  <span className="text-xs text-warning">{t('scene.unsavedChanges') || 'Modifications non enregistrées'}</span>
                )}
                <Button 
                  variant="primary" 
                  type="submit"
                  disabled={updateScene.isPending || isSaving}
                >
                  <Save size={16} />
                  {updateScene.isPending || isSaving ? t('actions.saving') || 'Enregistrement...' : t('actions.saveScene')}
                </Button>
              </div>
            </div>
          </div>
          
          {/* Side panel */}
          <div className="space-y-4">
            {/* Manga Generation Section */}
            <Panel>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-ink">Planches Manga</h3>
                <Button 
                  variant="ghost" 
                  className="p-1.5 h-auto"
                  onClick={() => setIsGenerationModalOpen(true)}
                  title="Générer une planche"
                >
                  <Sparkles size={18} className="text-accent" />
                </Button>
              </div>
              <SceneMangaGallery projectId={projectId} sceneId={sceneId} />
            </Panel>

            {chapterScenes && (
              <SceneNavigationPanel
                scenes={chapterScenes}
                currentSceneId={sceneId}
                projectId={projectId}
                tomeId={tomeId}
                chapterId={chapter.id}
              />
            )}
          </div>
        </div>
      </form>

      {/* Generation Modal */}
      <SceneGenerationModal
        projectId={projectId}
        scene={scene}
        characters={characters.data || []}
        characterImages={{}}
        isOpen={isGenerationModalOpen}
        onClose={() => setIsGenerationModalOpen(false)}
      />
    </AppShell>
  );
}
