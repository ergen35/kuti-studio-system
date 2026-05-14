import { Archive, Plus, Save, Trash2, UserRoundPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { clsx } from "clsx";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, Panel, PageHeader, SectionTitle, toCsv } from "~/components/ui";
import { api, apiErrorMessage, csv, type Character } from "~/lib/api";
import { invalidateWorkspace, keys, queryClient } from "~/lib/query";

const listItemClass = "grid w-full gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5 text-left transition-colors hover:border-accent";

export default function CharactersRoute() {
  const { projectId = "" } = useParams();
  const characters = useQuery({ queryKey: keys.characters(projectId), queryFn: () => api.characters(projectId) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => characters.data?.items.find((item) => item.id === selectedId) || characters.data?.items[0] || null, [characters.data, selectedId]);
  const detail = useQuery({ queryKey: keys.character(projectId, selected?.id || null), queryFn: () => api.character(projectId, selected!.id), enabled: Boolean(selected) });

  const create = useMutation({ mutationFn: (body: { name: string }) => api.createCharacter(projectId, body), onSuccess: (character) => { setSelectedId(character.id); invalidateWorkspace(projectId); } });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<Character> }) => api.updateCharacter(projectId, id, body), onSuccess: () => invalidateWorkspace(projectId) });
  const archive = useMutation({ mutationFn: (id: string) => api.archiveCharacter(projectId, id), onSuccess: () => invalidateWorkspace(projectId) });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteCharacter(projectId, id), onSuccess: () => { setSelectedId(null); invalidateWorkspace(projectId); } });
  const relation = useMutation({
    mutationFn: (body: { target_character_id: string; relation_type: string; strength: number }) => api.createRelation(projectId, selected!.id, { source_character_id: selected!.id, ...body }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: keys.character(projectId, selected?.id || null) }); invalidateWorkspace(projectId); },
  });

  return (
    <AppShell>
      <PageHeader title="Characters" description="Profiles, relations and voice notes are persisted directly through the backend." />
      {characters.isLoading ? <LoadingState /> : null}
      {characters.error ? <ErrorState message={apiErrorMessage(characters.error)} /> : null}
      <div className="grid items-start gap-3 xl:grid-cols-[310px_minmax(0,1fr)_340px]">
        <Panel>
          <SectionTitle title="Cast" meta={`${characters.data?.items.length ?? 0} profiles`} actions={<Button variant="primary" onClick={() => create.mutate({ name: `Character ${(characters.data?.items.length || 0) + 1}` })}><Plus size={15} /></Button>} />
          {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          <div className="grid gap-2">
            {(characters.data?.items || []).map((character) => (
              <button key={character.id} className={clsx(listItemClass, selected?.id === character.id && "border-accent shadow-[inset_3px_0_0_var(--accent)]")} onClick={() => setSelectedId(character.id)}>
                <strong className="text-sm text-ink">{character.name}</strong>
                <small className="text-xs text-muted">{character.narrative_role || character.slug}</small>
                <Badge>{character.status}</Badge>
              </button>
            ))}
          </div>
          {characters.data?.items.length === 0 ? <EmptyState title="No character" description="Create the first profile to start the cast." /> : null}
        </Panel>
        <Panel>
          <SectionTitle title="Profile" meta={selected?.slug} />
          {selected ? <CharacterForm character={selected} saving={update.isPending} onSave={(body) => update.mutate({ id: selected.id, body })} /> : <EmptyState title="No selection" />}
          {update.error ? <ErrorState message={apiErrorMessage(update.error)} /> : null}
        </Panel>
        <Panel>
          <SectionTitle title="Inspector" meta={detail.data?.relationships_summary || "Relations"} />
          {detail.isLoading && selected ? <LoadingState label="Loading character" /> : null}
          {detail.error ? <ErrorState message={apiErrorMessage(detail.error)} /> : null}
          {detail.data ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => archive.mutate(detail.data.id)}><Archive size={15} /> Archive</Button>
                <Button variant="danger" onClick={() => remove.mutate(detail.data.id)}><Trash2 size={15} /> Delete</Button>
              </div>
              <RelationForm characters={characters.data?.items || []} selectedId={detail.data.id} onSubmit={(body) => relation.mutate(body)} />
              <SectionTitle title="Relations" meta={`${detail.data.relations.length}`} />
              <div className="grid gap-2">{detail.data.relations.map((item) => <div className={listItemClass} key={item.id}><strong className="text-sm text-ink">{item.relation_type} · {item.strength}</strong><small className="text-xs text-muted">{item.source_character_id} to {item.target_character_id}</small></div>)}</div>
              <SectionTitle title="Voice samples" meta={`${detail.data.voice_samples.length}`} />
              <div className="grid gap-2">{detail.data.voice_samples.map((item) => <div className={listItemClass} key={item.id}><strong className="text-sm text-ink">{item.label}</strong><small className="text-xs text-muted">{item.voice_notes || item.asset_path}</small></div>)}</div>
            </div>
          ) : null}
        </Panel>
      </div>
    </AppShell>
  );
}

function CharacterForm({ character, saving, onSave }: { character: Character; saving: boolean; onSave: (body: Partial<Character>) => void }) {
  const [name, setName] = useState(character.name);
  const [alias, setAlias] = useState(character.alias || "");
  const [role, setRole] = useState(character.narrative_role || "");
  const [description, setDescription] = useState(character.description);
  const [physical, setPhysical] = useState(character.physical_description);
  const [traits, setTraits] = useState(toCsv(character.key_traits_json));
  const [palette, setPalette] = useState(toCsv(character.color_palette_json));
  const [costume, setCostume] = useState(toCsv(character.costume_elements_json));
  const [personality, setPersonality] = useState(character.personality);
  const [arc, setArc] = useState(character.narrative_arc);
  const [tags, setTags] = useState(toCsv(character.tags_json));

  return (
    <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); onSave({ name, alias, narrative_role: role, description, physical_description: physical, key_traits_json: csv(traits), color_palette_json: csv(palette), costume_elements_json: csv(costume), personality, narrative_arc: arc, tags_json: csv(tags) }); }}>
      <div className="grid gap-3 lg:grid-cols-2"><Field label="Name"><input value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Alias"><input value={alias} onChange={(event) => setAlias(event.target.value)} /></Field></div>
      <Field label="Narrative role"><input value={role} onChange={(event) => setRole(event.target.value)} /></Field>
      <Field label="Description"><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
      <Field label="Physical description"><textarea value={physical} onChange={(event) => setPhysical(event.target.value)} /></Field>
      <div className="grid gap-3 lg:grid-cols-2"><Field label="Traits"><input value={traits} onChange={(event) => setTraits(event.target.value)} /></Field><Field label="Palette"><input value={palette} onChange={(event) => setPalette(event.target.value)} /></Field></div>
      <Field label="Costume elements"><input value={costume} onChange={(event) => setCostume(event.target.value)} /></Field>
      <Field label="Personality"><textarea value={personality} onChange={(event) => setPersonality(event.target.value)} /></Field>
      <Field label="Narrative arc"><textarea value={arc} onChange={(event) => setArc(event.target.value)} /></Field>
      <Field label="Tags"><input value={tags} onChange={(event) => setTags(event.target.value)} /></Field>
      <Button variant="primary" disabled={saving}><Save size={16} /> Save profile</Button>
    </form>
  );
}

function RelationForm({ characters, selectedId, onSubmit }: { characters: Character[]; selectedId: string; onSubmit: (body: { target_character_id: string; relation_type: string; strength: number }) => void }) {
  const [target, setTarget] = useState("");
  const [type, setType] = useState("ally");
  const [strength, setStrength] = useState(50);
  const options = characters.filter((item) => item.id !== selectedId);
  return <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); if (target) onSubmit({ target_character_id: target, relation_type: type, strength }); }}>
    <SectionTitle title="Add relation" />
    <Field label="Target"><select value={target} onChange={(event) => setTarget(event.target.value)}><option value="">Select character</option>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Type"><input value={type} onChange={(event) => setType(event.target.value)} /></Field>
    <Field label="Strength"><input type="number" min={0} max={100} value={strength} onChange={(event) => setStrength(Number(event.target.value))} /></Field>
    <Button><UserRoundPlus size={15} /> Add relation</Button>
  </form>;
}
