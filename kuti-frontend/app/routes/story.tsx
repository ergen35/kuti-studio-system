import { Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { clsx } from "clsx";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, Panel, PageHeader, SectionTitle, toCsv } from "~/components/ui";
import { api, apiErrorMessage, csv, type Scene } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";

const listItemClass = "grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5 text-left transition-colors hover:border-accent";

export default function StoryRoute() {
  const { projectId = "" } = useParams();
  const story = useQuery({ queryKey: keys.story(projectId), queryFn: () => api.story(projectId) });
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const selectedScene = useMemo(() => story.data?.scenes.find((scene) => scene.id === selectedSceneId) || story.data?.scenes[0] || null, [story.data, selectedSceneId]);

  const createTome = useMutation({ mutationFn: () => api.createTome(projectId, { title: `Tome ${(story.data?.tomes.length || 0) + 1}`, order_index: story.data?.tomes.length || 0 }), onSuccess: () => invalidateWorkspace(projectId) });
  const createChapter = useMutation({ mutationFn: (tome_id: string) => api.createChapter(projectId, { tome_id, title: `Chapter ${(story.data?.chapters.length || 0) + 1}`, order_index: story.data?.chapters.length || 0 }), onSuccess: () => invalidateWorkspace(projectId) });
  const createScene = useMutation({ mutationFn: ({ tome_id, chapter_id }: { tome_id: string; chapter_id: string }) => api.createScene(projectId, { tome_id, chapter_id, title: `Scene ${(story.data?.scenes.length || 0) + 1}`, order_index: story.data?.scenes.length || 0 }), onSuccess: (scene) => { setSelectedSceneId(scene.id); invalidateWorkspace(projectId); } });
  const updateScene = useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<Scene> }) => api.updateScene(projectId, id, body), onSuccess: () => invalidateWorkspace(projectId) });
  const deleteScene = useMutation({ mutationFn: (id: string) => api.deleteScene(projectId, id), onSuccess: () => { setSelectedSceneId(null); invalidateWorkspace(projectId); } });

  return (
    <AppShell>
      <PageHeader title="Storyline" description="Build tomes, chapters and scenes. Typed references like @character:slug are indexed by the backend." />
      {story.isLoading ? <LoadingState /> : null}
      {story.error ? <ErrorState message={apiErrorMessage(story.error)} /> : null}
      <div className="grid items-start gap-3 xl:grid-cols-[310px_minmax(0,1fr)_340px]">
        <Panel>
          <SectionTitle title="Outline" meta={`${story.data?.tomes.length ?? 0} tomes`} actions={<Button variant="primary" onClick={() => createTome.mutate()}><Plus size={15} /></Button>} />
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
          {story.data?.tomes.length === 0 ? <EmptyState title="No tome" description="Create a tome, then add chapters and scenes." /> : null}
        </Panel>
        <Panel>
          <SectionTitle title="Scene editor" meta={selectedScene?.slug} actions={selectedScene ? <Button variant="danger" onClick={() => deleteScene.mutate(selectedScene.id)}><Trash2 size={15} /></Button> : null} />
          {selectedScene ? <SceneForm scene={selectedScene} saving={updateScene.isPending} onSave={(body) => updateScene.mutate({ id: selectedScene.id, body })} /> : <EmptyState title="No scene selected" />}
          {updateScene.error ? <ErrorState message={apiErrorMessage(updateScene.error)} /> : null}
        </Panel>
        <Panel>
          <SectionTitle title="References and coherence" meta={`${story.data?.orphan_references.length ?? 0} orphan references`} />
          <div className="grid gap-2">{(story.data?.orphan_references || []).map((orphan) => <div className={listItemClass} key={orphan.reference.id}><strong className="text-sm text-ink">{orphan.reference.raw_token}</strong><small className="text-xs text-muted">{orphan.reason}</small></div>)}</div>
          {(story.data?.orphan_references.length || 0) === 0 ? <EmptyState title="No orphan reference" description="References indexed from scene content are currently resolvable." /> : null}
          {selectedScene ? <><SectionTitle title="Metadata" /><div className={listItemClass}><Badge>{selectedScene.status}</Badge><small className="text-xs text-muted">{selectedScene.location || "No location"}</small><small className="text-xs text-muted">{toCsv(selectedScene.characters_json) || "No characters"}</small></div></> : null}
        </Panel>
      </div>
    </AppShell>
  );
}

function SceneForm({ scene, saving, onSave }: { scene: Scene; saving: boolean; onSave: (body: Partial<Scene>) => void }) {
  const [title, setTitle] = useState(scene.title);
  const [summary, setSummary] = useState(scene.summary);
  const [content, setContent] = useState(scene.content);
  const [location, setLocation] = useState(scene.location);
  const [sceneType, setSceneType] = useState(scene.scene_type);
  const [characters, setCharacters] = useState(toCsv(scene.characters_json));
  const [tags, setTags] = useState(toCsv(scene.tags_json));
  const [notes, setNotes] = useState(scene.notes);
  return <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); onSave({ title, summary, content, location, scene_type: sceneType, characters_json: csv(characters), tags_json: csv(tags), notes }); }}>
    <Field label="Title"><input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
    <div className="grid gap-3 lg:grid-cols-2"><Field label="Type"><input value={sceneType} onChange={(event) => setSceneType(event.target.value)} /></Field><Field label="Location"><input value={location} onChange={(event) => setLocation(event.target.value)} /></Field></div>
    <Field label="Summary"><textarea value={summary} onChange={(event) => setSummary(event.target.value)} /></Field>
    <Field label="Content"><textarea className="!min-h-[420px] font-mono text-sm" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write scene content with @character:slug references" /></Field>
    <div className="grid gap-3 lg:grid-cols-2"><Field label="Characters"><input value={characters} onChange={(event) => setCharacters(event.target.value)} /></Field><Field label="Tags"><input value={tags} onChange={(event) => setTags(event.target.value)} /></Field></div>
    <Field label="Notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
    <Button variant="primary" disabled={saving}><Save size={16} /> Save scene</Button>
  </form>;
}
