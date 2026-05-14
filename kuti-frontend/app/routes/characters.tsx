import { Archive, Plus, Save, Trash2, UserRoundPlus } from "lucide-react";
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
import { api, apiErrorMessage, csv, type Character } from "~/lib/api";
import { invalidateWorkspace, keys, queryClient } from "~/lib/query";
import { characterSchema, relationSchema, type CharacterInput, type RelationInput } from "~/lib/schemas";

const listItemClass = "grid w-full gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5 text-left transition-colors hover:border-accent";

export default function CharactersRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['characters', 'common']);
  const characters = useQuery({ queryKey: keys.characters(projectId), queryFn: () => api.characters(projectId) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => characters.data?.items.find((item) => item.id === selectedId) || characters.data?.items[0] || null, [characters.data, selectedId]);
  const detail = useQuery({ queryKey: keys.character(projectId, selected?.id || null), queryFn: () => api.character(projectId, selected!.id), enabled: Boolean(selected) });

  const create = useMutation({ mutationFn: (body: { name: string }) => api.createCharacter(projectId, body), onSuccess: (character) => { setSelectedId(character.id); invalidateWorkspace(projectId); } });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<Character> }) => api.updateCharacter(projectId, id, body), onSuccess: () => invalidateWorkspace(projectId) });
  const archive = useMutation({ mutationFn: (id: string) => api.archiveCharacter(projectId, id), onSuccess: () => invalidateWorkspace(projectId) });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteCharacter(projectId, id), onSuccess: () => { setSelectedId(null); invalidateWorkspace(projectId); } });
  const relation = useMutation({
    mutationFn: (body: RelationInput) => api.createRelation(projectId, selected!.id, { source_character_id: selected!.id, ...body }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: keys.character(projectId, selected?.id || null) }); invalidateWorkspace(projectId); },
  });

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} />
      {characters.isLoading ? <LoadingState /> : null}
      {characters.error ? <ErrorState message={apiErrorMessage(characters.error)} /> : null}
      <div className="grid items-start gap-3 xl:grid-cols-[310px_minmax(0,1fr)_340px]">
        <Panel>
          <SectionTitle title={t('panels.cast.title')} meta={`${characters.data?.items.length ?? 0} ${t('panels.cast.count', { count: characters.data?.items.length ?? 0 })}`} actions={<Button variant="primary" onClick={() => create.mutate({ name: `${t('common:fields.name')} ${(characters.data?.items.length || 0) + 1}` })}><Plus size={15} /></Button>} />
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
          {characters.data?.items.length === 0 ? <EmptyState title={t('empty.noCharacter.title')} description={t('empty.noCharacter.description')} /> : null}
        </Panel>
        <Panel>
          <SectionTitle title={t('panels.profile.title')} meta={selected?.slug} />
          {selected ? <CharacterForm character={selected} saving={update.isPending} onSave={(body) => update.mutate({ id: selected.id, body })} /> : <EmptyState title={t('empty.noSelection')} />}
          {update.error ? <ErrorState message={apiErrorMessage(update.error)} /> : null}
        </Panel>
        <Panel>
          <SectionTitle title={t('panels.inspector.title')} meta={detail.data?.relationships_summary || t('panels.inspector.meta')} />
          {detail.isLoading && selected ? <LoadingState label={t('states.loading')} /> : null}
          {detail.error ? <ErrorState message={apiErrorMessage(detail.error)} /> : null}
          {detail.data ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => archive.mutate(detail.data.id)}><Archive size={15} /> {t('actions.archive')}</Button>
                <Button variant="danger" onClick={() => remove.mutate(detail.data.id)}><Trash2 size={15} /> {t('actions.delete')}</Button>
              </div>
              <RelationForm characters={characters.data?.items || []} selectedId={detail.data.id} onSubmit={(body) => relation.mutate(body)} />
              <SectionTitle title={t('relations.title')} meta={`${detail.data.relations.length} ${t('relations.count', { count: detail.data.relations.length })}`} />
              <div className="grid gap-2">{detail.data.relations.map((item) => <div className={listItemClass} key={item.id}><strong className="text-sm text-ink">{item.relation_type} · {item.strength}</strong><small className="text-xs text-muted">{item.source_character_id} to {item.target_character_id}</small></div>)}</div>
              <SectionTitle title={t('voiceSamples.title')} meta={`${detail.data.voice_samples.length} ${t('voiceSamples.count', { count: detail.data.voice_samples.length })}`} />
              <div className="grid gap-2">{detail.data.voice_samples.map((item) => <div className={listItemClass} key={item.id}><strong className="text-sm text-ink">{item.label}</strong><small className="text-xs text-muted">{item.voice_notes || item.asset_path}</small></div>)}</div>
            </div>
          ) : null}
        </Panel>
      </div>
    </AppShell>
  );
}

function CharacterForm({ character, saving, onSave }: { character: Character; saving: boolean; onSave: (body: Partial<Character>) => void }) {
  const { t } = useTranslation('characters');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CharacterInput>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: character.name,
      alias: character.alias || '',
      narrative_role: character.narrative_role || '',
      description: character.description,
      physical_description: character.physical_description,
      key_traits_json: toCsv(character.key_traits_json),
      color_palette_json: toCsv(character.color_palette_json),
      costume_elements_json: toCsv(character.costume_elements_json),
      personality: character.personality,
      narrative_arc: character.narrative_arc,
      tags_json: toCsv(character.tags_json),
    },
  });

  const onSubmit = (data: CharacterInput) => onSave({
    name: data.name,
    alias: data.alias,
    narrative_role: data.narrative_role,
    description: data.description,
    physical_description: data.physical_description,
    key_traits_json: csv(data.key_traits_json),
    color_palette_json: csv(data.color_palette_json),
    costume_elements_json: csv(data.costume_elements_json),
    personality: data.personality,
    narrative_arc: data.narrative_arc,
    tags_json: csv(data.tags_json),
  });

  return (
    <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-3 lg:grid-cols-2">
        <FormField label={t('fields.name')} error={errors.name}>
          <input {...register('name')} />
        </FormField>
        <FormField label={t('fields.alias')} error={errors.alias}>
          <input {...register('alias')} />
        </FormField>
      </div>
      <FormField label={t('fields.narrativeRole')} error={errors.narrative_role}>
        <input {...register('narrative_role')} />
      </FormField>
      <FormField label={t('fields.description')} error={errors.description}>
        <textarea {...register('description')} />
      </FormField>
      <FormField label={t('fields.physicalDescription')} error={errors.physical_description}>
        <textarea {...register('physical_description')} />
      </FormField>
      <div className="grid gap-3 lg:grid-cols-2">
        <FormField label={t('fields.traits')} error={errors.key_traits_json}>
          <input {...register('key_traits_json')} />
        </FormField>
        <FormField label={t('fields.palette')} error={errors.color_palette_json}>
          <input {...register('color_palette_json')} />
        </FormField>
      </div>
      <FormField label={t('fields.costumeElements')} error={errors.costume_elements_json}>
        <input {...register('costume_elements_json')} />
      </FormField>
      <FormField label={t('fields.personality')} error={errors.personality}>
        <textarea {...register('personality')} />
      </FormField>
      <FormField label={t('fields.narrativeArc')} error={errors.narrative_arc}>
        <textarea {...register('narrative_arc')} />
      </FormField>
      <FormField label={t('fields.tags')} error={errors.tags_json}>
        <input {...register('tags_json')} />
      </FormField>
      <Button variant="primary" disabled={saving || isSubmitting}><Save size={16} /> {t('actions.saveProfile')}</Button>
    </form>
  );
}

function RelationForm({ characters, selectedId, onSubmit }: { characters: Character[]; selectedId: string; onSubmit: (body: RelationInput) => void }) {
  const { t } = useTranslation('characters');
  const options = characters.filter((item) => item.id !== selectedId);
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm<RelationInput>({
    resolver: zodResolver(relationSchema),
    defaultValues: { target_character_id: '', relation_type: 'ally', strength: 50 },
  });
  
  const target = watch('target_character_id');

  return (
    <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
      <SectionTitle title={t('relations.add.title')} />
      <FormField label={t('relations.add.target')} error={errors.target_character_id}>
        <select {...register('target_character_id')}>
          <option value="">{t('relations.add.selectTarget')}</option>
          {options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </FormField>
      <FormField label={t('relations.add.type')} error={errors.relation_type}>
        <input {...register('relation_type')} />
      </FormField>
      <FormField label={t('relations.add.strength')} error={errors.strength}>
        <input type="number" min={0} max={100} {...register('strength', { valueAsNumber: true })} />
      </FormField>
      <Button disabled={!target || isSubmitting}><UserRoundPlus size={15} /> {t('relations.add.title')}</Button>
    </form>
  );
}
