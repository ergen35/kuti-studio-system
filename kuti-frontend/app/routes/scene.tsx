import { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { ArrowLeft, FileText, Save, Clock, Trash2, Sparkles, Layout, Monitor, ChevronRight } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Panel, SectionTitle, Field, toCsv } from '~/components/ui';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { LexicalEditor } from '~/components/editor';
import '~/components/editor/styles.css';
import type { DeleteSceneData, GetStorySummaryResponse, Options, UpdateSceneData } from '~/lib/backend';
import { apiErrorMessage } from '~/lib/errors';
import { csv } from '~/lib/utils';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProjectCharacterImagesOptions, getStorySummaryOptions, updateSceneMutation, deleteSceneMutation, listCharactersOptions } from '~/lib/backend/@tanstack/react-query.gen';
import { StoryBreadcrumb, StoryCompletionButton } from '~/components/story';
import { SceneGenerationModal, SceneMangaGallery } from '~/components/scene';

// Orchestra Mode imports
import { useOrchestraStore } from '~/stores/orchestra';
import { PixiOrchestra } from '~/components/orchestra-pixi';
import { StoryTreeNavigator } from '~/components/navigation/StoryTreeNavigator';

type Tome = GetStorySummaryResponse['tomes'][number];
type Chapter = GetStorySummaryResponse['chapters'][number];
type Scene = GetStorySummaryResponse['scenes'][number];

const sceneSchema = z.object({
  title: z.string().min(1, 'titleRequired'),
  sceneType: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  charactersJson: z.string().optional(),
  tagsJson: z.string().optional(),
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
        title={t('scene.navigation.title')}
        meta={String(sortedScenes.length)}
      />

      <div className="mt-3 flex flex-col gap-2">
        {sortedScenes.map((scene, index) => {
          const isCurrent = scene.id === currentSceneId;
          return (
            <Button
              type="button"
              variant="ghost"
              key={scene.id}
              onClick={() => navigate(`/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`)}
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
                {t('scene.shortNumber', { number: index + 1 })}
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx(
                  "truncate text-sm",
                  isCurrent ? "font-medium text-primary" : "text-foreground"
                )}>
                  {scene.title}
                </p>
              </div>
              {isCurrent && (
                <span className="size-2 rounded-full bg-primary" />
              )}
              {!isCurrent && (
                <ChevronRight size={14} className="text-muted-foreground" />
              )}
            </Button>
          );
        })}

        {sortedScenes.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('scene.navigation.empty')}
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
  const [editorVersion, setEditorVersion] = useState(0);

  // Fetch story data
  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
  });

  // Fetch characters for this project
  const characters = useQuery({
    ...listCharactersOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  const characterImages = useQuery({
    ...getProjectCharacterImagesOptions({ path: { projectId } }),
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

  const { register, handleSubmit, control, watch, reset, setValue, formState: { errors, isDirty } } = useForm<SceneInput>({
    resolver: zodResolver(sceneSchema),
    defaultValues: {
      title: '',
      sceneType: '',
      location: '',
      summary: '',
      content: '',
      charactersJson: '',
      tagsJson: '',
      notes: '',
    },
  });

  // Reset form when scene data loads or changes
  useEffect(() => {
    if (scene) {
      reset({
        title: scene.title ?? '',
        sceneType: scene.sceneType ?? '',
        location: scene.location ?? '',
        summary: scene.summary ?? '',
        content: scene.content ?? '',
        charactersJson: toCsv(scene.charactersJson) ?? '',
        tagsJson: toCsv(scene.tagsJson) ?? '',
        notes: scene.notes ?? '',
      });
    }
  }, [scene, reset]);

  // Watch for changes (kept for intentional re-render triggers)
  const watchedSceneId = watch('title');

  // Orchestra mode state
  const { isActive: orchestraMode, toggle: toggleOrchestra, selectScene } = useOrchestraStore();

  // Select current scene in orchestra store
  useEffect(() => {
    if (sceneId) {
      selectScene(sceneId);
    }
  }, [sceneId, selectScene]);

  const onSubmit = useCallback((data: SceneInput) => {
    setIsSaving(true);
    updateScene.mutate({
      path: { projectId, sceneId },
      body: {
        title: data.title,
        sceneType: data.sceneType,
        location: data.location,
        summary: data.summary,
        content: data.content,
        charactersJson: csv(data.charactersJson || ''),
        tagsJson: csv(data.tagsJson || ''),
        notes: data.notes,
      },
    } as unknown as Options<UpdateSceneData>);
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
        <EmptyState title={t('scene.notFound')} />
      </AppShell>
    );
  }

  const { chapter, tome, chapterScenes } = context;
  if (!chapter || !tome) return null;
  const formattedDate = new Date(scene.updatedAt).toLocaleDateString(t('locale'), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Orchestra Mode View
  if (orchestraMode) {
    return (
      <AppShell reducedSidebar>
        {/* Full width override - sort du flux max-w-[1500px] du AppShell */}
        <div className="fixed inset-0 top-14 left-0 lg:left-[56px] right-0 bottom-0 z-10">
          <div className="grid h-full w-full grid-cols-[1fr_280px]">
            {/* Canvas 2D PixiJS */}
            <div className="relative w-full h-full">
              <PixiOrchestra
                tomes={story.data?.tomes || []}
                chapters={story.data?.chapters || []}
                scenes={story.data?.scenes || []}
                currentSceneId={sceneId}
                onNavigateToScene={(selectedSceneId, selectedChapterId, selectedTomeId) => {
                  navigate(`/projects/${projectId}/story/${selectedTomeId}/scenes/${selectedSceneId}`, {
                    replace: true,
                  });
                }}
              />

              {/* Overlay: Button to switch back to classic mode */}
              <Button
                type="button"
                variant="ghost"
                onClick={toggleOrchestra}
                className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-border bg-card/90 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur transition-colors hover:bg-primary/8 hover:text-primary"
                title={t('scene.orchestra.backToClassic')}
              >
                <Layout size={16} />
                <span>{t('scene.orchestra.classicMode')}</span>
              </Button>

              {/* Overlay: Title */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="rounded-lg border border-border bg-card/90 px-4 py-2 shadow-lg backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('scene.orchestra.mode')}</p>
                </div>
              </div>
            </div>

            {/* Tree Navigator */}
            <StoryTreeNavigator
              projectId={projectId}
              tomes={story.data?.tomes || []}
              chapters={story.data?.chapters || []}
              scenes={story.data?.scenes || []}
              currentSceneId={sceneId}
              onSelectScene={(selectedSceneId, selectedChapterId, selectedTomeId) => {
                navigate(`/projects/${projectId}/story/${selectedTomeId}/scenes/${selectedSceneId}`, {
                  replace: true,
                });
              }}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  // Classic Mode View
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
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t('scene.backToChapter')}
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
          {/* Main content */}
          <div className="flex flex-col gap-4">
            {/* Scene header */}
            <Panel className="overflow-hidden">
              <div className="-m-4 mb-0 flex items-start gap-4 border-b border-border bg-secondary/20 p-5 compact:-m-3 compact:p-4">
                <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {t('scene.number', { number: sceneNumber })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={toggleOrchestra}
                      className="h-8 gap-2 border border-primary/25 bg-primary/10 px-2.5 text-primary hover:bg-primary/15"
                      title={t('scene.orchestra.switchToOrchestra')}
                    >
                      <Monitor size={16} />
                      <span>{t('scene.orchestra.mode')}</span>
                    </Button>
                  </div>

                  <Field label={t('fields.title')}>
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-end">
                        <StoryCompletionButton
                          projectId={projectId}
                          targetKind="scene"
                          targetId={sceneId}
                          field="title"
                          currentValue={watch('title')}
                          onComplete={(text) => setValue('title', text, { shouldDirty: true, shouldValidate: true })}
                        />
                      </div>
                      <Input
                        {...register('title')}
                        className="text-lg font-semibold w-full"
                      />
                    </div>
                  </Field>
                  {errors.title && (
                    <span className="text-danger text-xs">{errors.title.message}</span>
                  )}

                  <p className="mt-1 font-mono text-sm text-muted-foreground">{scene.slug}</p>

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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

              <div className="mt-3 flex flex-col gap-4">
                {/* Summary */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>{t('fields.type')}</span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="sceneType"
                        currentValue={watch('sceneType')}
                        instruction="Return only a concise scene type such as dialogue, action, reveal, transition, confrontation, flashback, or quiet beat."
                        onComplete={(text) => setValue('sceneType', text, { shouldDirty: true })}
                      />
                    </div>
                    <Input {...register('sceneType')} placeholder={t('scene.placeholders.type')} />
                  </div>
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>{t('fields.location')}</span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="location"
                        currentValue={watch('location')}
                        instruction="Return only a concise production-ready location name for this scene."
                        onComplete={(text) => setValue('location', text, { shouldDirty: true })}
                      />
                    </div>
                    <Input {...register('location')} placeholder={t('scene.placeholders.location')} />
                  </div>
                </div>

                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span>{t('fields.summary')}</span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="scene"
                      targetId={sceneId}
                      field="summary"
                      currentValue={watch('summary')}
                      onComplete={(text) => setValue('summary', text, { shouldDirty: true })}
                    />
                  </div>
                  <Textarea {...register('summary')} rows={3} placeholder={t('scene.placeholders.summary')} />
                </div>

                {/* Content - Lexical Editor */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{t('fields.content')}</span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="scene"
                      targetId={sceneId}
                      field="content"
                      currentValue={watch('content')}
                      onComplete={(text) => {
                        setValue('content', text, { shouldDirty: true });
                        setEditorVersion((value) => value + 1);
                      }}
                    />
                  </div>
                  <Controller
                    name="content"
                    control={control}
                    render={({ field }) => (
                      <LexicalEditor
                        key={`${sceneId}-${editorVersion}`}
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
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>{t('fields.characters')}</span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="charactersJson"
                        currentValue={watch('charactersJson')}
                        instruction="Return only a comma-separated list of relevant character names or slugs for this scene."
                        onComplete={(text) => setValue('charactersJson', text, { shouldDirty: true })}
                      />
                    </div>
                    <Input {...register('charactersJson')} placeholder={t('scene.placeholders.characters')} />
                  </div>
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span>{t('fields.tags')}</span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="tagsJson"
                        currentValue={watch('tagsJson')}
                        instruction="Return only a short comma-separated list of production and narrative tags for this scene."
                        onComplete={(text) => setValue('tagsJson', text, { shouldDirty: true })}
                      />
                    </div>
                    <Input {...register('tagsJson')} placeholder={t('scene.placeholders.tags')} />
                  </div>
                </div>

                {/* Notes */}
                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span>{t('fields.notes')}</span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="scene"
                      targetId={sceneId}
                      field="notes"
                      currentValue={watch('notes')}
                      onComplete={(text) => setValue('notes', text, { shouldDirty: true })}
                    />
                  </div>
                  <Textarea {...register('notes')} rows={3} placeholder={t('scene.placeholders.notes')} />
                </div>
              </div>
            </Panel>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <Button
                variant="danger"
                type="button"
                onClick={() => deleteScene.mutate({ path: { projectId, sceneId } } as unknown as Options<DeleteSceneData>)}
                disabled={deleteScene.isPending}
              >
                <Trash2 size={16} />
                {t('actions.deleteScene')}
              </Button>

              <div className="flex items-center gap-4">
                {isDirty && (
                  <span className="text-xs text-warning">{t('scene.unsavedChanges')}</span>
                )}
                <Button
                  variant="primary"
                  type="submit"
                  disabled={updateScene.isPending || isSaving}
                >
                  <Save size={16} />
                  {updateScene.isPending || isSaving ? t('actions.saving') : t('actions.saveScene')}
                </Button>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-4">
            {/* Manga Generation Section */}
            <Panel>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-foreground">{t('scene.mangaBoards')}</h3>
                <Button
                  variant="ghost"
                  className="size-8 border border-primary/25 bg-primary/10 p-0 text-primary hover:bg-primary/15"
                  onClick={() => setIsGenerationModalOpen(true)}
                  title={t('scene.generateBoard')}
                >
                  <Sparkles size={18} />
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
        characterImages={characterImages.data || {}}
        isOpen={isGenerationModalOpen}
        onClose={() => setIsGenerationModalOpen(false)}
      />
    </AppShell>
  );
}
