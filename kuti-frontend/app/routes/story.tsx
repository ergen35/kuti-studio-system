import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { clsx } from "clsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, LoadingState, Panel, PageHeader, SectionTitle, toCsv } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { api, apiErrorMessage, csv, type Scene } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";
import { sceneSchema, type SceneInput } from "~/lib/schemas";

const listItemClass = "grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5 text-left transition-colors hover:border-accent";

export default function StoryRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['story', 'common']);
  const story = useQuery({ queryKey: keys.story(projectId), queryFn: () => api.story(projectId) });
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const selectedScene = useMemo(() => story.data?.scenes.find((scene) => scene.id === selectedSceneId) || story.data?.scenes[0] || null, [story.data, selectedSceneId]);

  const createTome = useMutation({ mutationFn: () => api.createTome(projectId, { title: `${t('sources.tome')} ${(story.data?.tomes.length || 0) + 1}`, order_index: story.data?.tomes.length || 0 }), onSuccess: () => invalidateWorkspace(projectId) });
  const createChapter = useMutation({ mutationFn: (tome_id: string) => api.createChapter(projectId, { tome_id, title: `${t('sources.chapter')} ${(story.data?.chapters.length || 0) + 1}`, order_index: story.data?.chapters.length || 0 }), onSuccess: () => invalidateWorkspace(projectId) });
  const createScene = useMutation({ mutationFn: ({ tome_id, chapter_id }: { tome_id: string; chapter_id: string }) => api.createScene(projectId, { tome_id, chapter_id, title: `${t('sources.scene')} ${(story.data?.scenes.length || 0) + 1}`, order_index: story.data?.scenes.length || 0 }), onSuccess: (scene) => { setSelectedSceneId(scene.id); invalidateWorkspace(projectId); } });
  const updateScene = useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<Scene> }) => api.updateScene(projectId, id, body), onSuccess: () => invalidateWorkspace(projectId) });
  const deleteScene = useMutation({ mutationFn: (id: string) => api.deleteScene(projectId, id), onSuccess: () => { setSelectedSceneId(null); invalidateWorkspace(projectId); } });

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} />
      {story.isLoading ? <LoadingState /> : null}
      {story.error ? <ErrorState message={apiErrorMessage(story.error)} /> : null}
      <div className="grid items-start gap-3 xl:grid-cols-[310px_minmax(0,1fr)_340px]">
        <Panel>
          <SectionTitle title={t('panels.outline.title')} meta={`${story.data?.tomes.length ?? 0} ${t('panels.outline.count', { count: story.data?.tomes.length ?? 0 })}`} actions={<Button variant="primary" onClick={() => createTome.mutate()}><Plus size={15} /></Button>} />
          <div className="grid gap-2">
            {(story.data?.tomes || []).map((tome) => {
              const chapters = story.data?.chapters.filter((chapter) => chapter.tome_id === tome.id) || [];
              return <div className={listItemClass} key={tome.id}>
                <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{tome.title}</strong><Button onClick={() => createChapter.mutate(tome.id)}><Plus size={14} /></Button></div>
                {chapters.map((chapter) => {
                  const scenes = story.data?.scenes.filter((scene) => scene.chapter_id === chapter.id) || [];
                  return <div key={chapter.id} className="mt-2 grid gap-1.5">
                    <div className="flex items-center justify-between gap-2"><small className="text-xs text-muted">{chapter.title}</small><Button onClick={() => createScene.mutate({ tome_id: tome.id, chapter_id: chapter.id })}><Plus size={14} /></Button></div>
                    {scenes.map((scene) => <button key={scene.id} className={clsx(listItemClass, "w-full", selectedScene?.id === scene.id && "border-accent shadow-[inset_3px_0_0_var(--accent)]")} onClick={() => setSelectedSceneId(scene.id)}><strong className="text-sm text-ink">{scene.title}</strong><small className="text-xs text-muted">{scene.slug}</small></button>)}
                  </div>;
                })}
              </div>;
            })}
          </div>
          {story.data?.tomes.length === 0 ? <EmptyState title={t('empty.noTome.title')} description={t('empty.noTome.description')} /> : null}
        </Panel>
        <Panel>
          <SectionTitle title={t('panels.sceneEditor.title')} meta={selectedScene?.slug} actions={selectedScene ? <Button variant="danger" onClick={() => deleteScene.mutate(selectedScene.id)}><Trash2 size={15} /></Button> : null} />
          {selectedScene ? <SceneForm scene={selectedScene} saving={updateScene.isPending} onSave={(body) => updateScene.mutate({ id: selectedScene.id, body })} /> : <EmptyState title={t('empty.noSceneSelected')} />}
          {updateScene.error ? <ErrorState message={apiErrorMessage(updateScene.error)} /> : null}
        </Panel>
        <Panel>
          <SectionTitle title={t('panels.references.title')} meta={`${story.data?.orphan_references.length ?? 0} ${t('panels.references.count', { count: story.data?.orphan_references.length ?? 0 })}`} />
          <div className="grid gap-2">{(story.data?.orphan_references || []).map((orphan) => <div className={listItemClass} key={orphan.reference.id}><strong className="text-sm text-ink">{orphan.reference.raw_token}</strong><small className="text-xs text-muted">{orphan.reason}</small></div>)}</div>
          {(story.data?.orphan_references.length || 0) === 0 ? <EmptyState title={t('panels.references.empty.title')} description={t('panels.references.empty.description')} /> : null}
          {selectedScene ? <><SectionTitle title={t('panels.metadata.title')} /><div className={listItemClass}><Badge>{selectedScene.status}</Badge><small className="text-xs text-muted">{selectedScene.location || t('meta.noLocation')}</small><small className="text-xs text-muted">{toCsv(selectedScene.characters_json) || t('meta.noCharacters')}</small></div></> : null}
        </Panel>
      </div>
    </AppShell>
  );
}

function SceneForm({ scene, saving, onSave }: { scene: Scene; saving: boolean; onSave: (body: Partial<Scene>) => void }) {
  const { t } = useTranslation('story');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SceneInput>({
    resolver: zodResolver(sceneSchema),
    defaultValues: {
      title: scene.title,
      scene_type: scene.scene_type,
      location: scene.location,
      summary: scene.summary,
      content: scene.content,
      characters_json: toCsv(scene.characters_json),
      tags_json: toCsv(scene.tags_json),
      notes: scene.notes,
    },
  });

  const onSubmit = (data: SceneInput) => onSave({
    title: data.title,
    scene_type: data.scene_type,
    location: data.location,
    summary: data.summary,
    content: data.content,
    characters_json: csv(data.characters_json),
    tags_json: csv(data.tags_json),
    notes: data.notes,
  });

  return (
    <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
      <FormField label={t('fields.title')} error={errors.title}>
        <input {...register('title')} />
      </FormField>
      <div className="grid gap-3 lg:grid-cols-2">
        <FormField label={t('fields.type')} error={errors.scene_type}>
          <input {...register('scene_type')} />
        </FormField>
        <FormField label={t('fields.location')} error={errors.location}>
          <input {...register('location')} />
        </FormField>
      </div>
      <FormField label={t('fields.summary')} error={errors.summary}>
        <textarea {...register('summary')} />
      </FormField>
      <FormField label={t('fields.content')} error={errors.content}>
        <textarea className="!min-h-[420px] font-mono text-sm" {...register('content')} placeholder={t('editor.placeholder')} />
      </FormField>
      <div className="grid gap-3 lg:grid-cols-2">
        <FormField label={t('fields.characters')} error={errors.characters_json}>
          <input {...register('characters_json')} />
        </FormField>
        <FormField label={t('fields.tags')} error={errors.tags_json}>
          <input {...register('tags_json')} />
        </FormField>
      </div>
      <FormField label={t('fields.notes')} error={errors.notes}>
        <textarea {...register('notes')} />
      </FormField>
      <Button variant="primary" disabled={saving || isSubmitting}><Save size={16} /> {t('actions.saveScene')}</Button>
    </form>
  );
}
