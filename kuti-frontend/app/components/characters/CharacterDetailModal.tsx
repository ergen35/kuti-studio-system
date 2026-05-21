import { useEffect, useRef } from 'react';
import { useTranslation } from '~/hooks/useTranslation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Save, Archive, Trash2, UserRoundPlus } from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar';
import { FormField } from '~/components/FormField';
import { Button, Panel, SectionTitle, Badge, toCsv } from '~/components/ui';
import { characterSchema, relationSchema, type CharacterInput, type RelationInput } from '~/lib/schemas';
import { csv } from '~/lib/utils';
import type { ListCharactersResponse, GetCharacterResponse } from '~/lib/backend';

type Character = ListCharactersResponse[number];
type CharacterDetail = GetCharacterResponse;

interface CharacterDetailModalProps {
  character: Character;
  detail: CharacterDetail | null;
  detailLoading: boolean;
  isOpen: boolean;
  characters: Character[]; // For relation dropdown
  onClose: () => void;
  onSave: (body: Partial<Character>) => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddRelation: (body: RelationInput) => void;
  saving?: boolean;
}

export function CharacterDetailModal({
  character,
  detail,
  detailLoading,
  isOpen,
  characters,
  onClose,
  onSave,
  onArchive,
  onDelete,
  onAddRelation,
  saving,
}: CharacterDetailModalProps) {
  const { t } = useTranslation('characters');
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CharacterInput>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: character.name,
      alias: (character.alias as string | undefined) || '',
      narrative_role: (character.narrativeRole as string | undefined) || '',
      description: character.description,
      physical_description: character.physicalDescription,
      key_traits_json: toCsv(character.keyTraitsJson),
      color_palette_json: toCsv(character.colorPaletteJson),
      costume_elements_json: toCsv(character.costumeElementsJson),
      personality: character.personality,
      narrative_arc: character.narrativeArc,
      tags_json: toCsv(character.tagsJson),
    },
  });

  // Reset form when character changes
  useEffect(() => {
    reset({
      name: character.name,
      alias: (character.alias as string | undefined) || '',
      narrative_role: (character.narrativeRole as string | undefined) || '',
      description: character.description,
      physical_description: character.physicalDescription,
      key_traits_json: toCsv(character.keyTraitsJson),
      color_palette_json: toCsv(character.colorPaletteJson),
      costume_elements_json: toCsv(character.costumeElementsJson),
      personality: character.personality,
      narrative_arc: character.narrativeArc,
      tags_json: toCsv(character.tagsJson),
    });
  }, [character, reset]);
  
  // Close on escape key
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
  
  const onSubmit = (data: CharacterInput) => {
    onSave({
      name: data.name,
      alias: data.alias,
      narrativeRole: data.narrative_role,
      description: data.description,
      physicalDescription: data.physical_description,
      keyTraitsJson: csv(data.key_traits_json),
      colorPaletteJson: csv(data.color_palette_json),
      costumeElementsJson: csv(data.costume_elements_json),
      personality: data.personality,
      narrativeArc: data.narrative_arc,
      tagsJson: csv(data.tags_json),
    });
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-2xl bg-surface shadow-2xl">
        {/* Header with avatar and close */}
        <div className="relative flex items-center gap-4 p-6 border-b border-line bg-surface-2/30">
          <CharacterAvatar
            name={character.name}
            colorPalette={character.colorPaletteJson}
            size="md"
          />
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-ink">{character.name}</h2>
            <p className="text-sm text-muted">{character.slug}</p>
          </div>
          <Button variant="ghost" onClick={onClose} className="shrink-0">
            <X size={20} />
          </Button>
        </div>
        
        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Main form */}
            <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label={t('fields.name')} error={errors.name}>
                  <input {...register('name')} className="w-full" />
                </FormField>
                <FormField label={t('fields.alias')} error={errors.alias}>
                  <input {...register('alias')} className="w-full" />
                </FormField>
              </div>
              
              <FormField label={t('fields.narrativeRole')} error={errors.narrative_role}>
                <input {...register('narrative_role')} className="w-full" />
              </FormField>

              <FormField label={t('fields.description')} error={errors.description}>
                <textarea {...register('description')} rows={3} className="w-full" />
              </FormField>

              <FormField label={t('fields.physicalDescription')} error={errors.physical_description}>
                <textarea {...register('physical_description')} rows={3} className="w-full" />
              </FormField>

              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label={t('fields.traits')} error={errors.key_traits_json}>
                  <input {...register('key_traits_json')} className="w-full" placeholder="brave, loyal, cunning..." />
                </FormField>
                <FormField label={t('fields.palette')} error={errors.color_palette_json}>
                  <input {...register('color_palette_json')} className="w-full" placeholder="#2f6f73, #61a5a0..." />
                </FormField>
              </div>

              <FormField label={t('fields.costumeElements')} error={errors.costume_elements_json}>
                <input {...register('costume_elements_json')} className="w-full" />
              </FormField>

              <FormField label={t('fields.personality')} error={errors.personality}>
                <textarea {...register('personality')} rows={3} className="w-full" />
              </FormField>

              <FormField label={t('fields.narrativeArc')} error={errors.narrative_arc}>
                <textarea {...register('narrative_arc')} rows={3} className="w-full" />
              </FormField>

              <FormField label={t('fields.tags')} error={errors.tags_json}>
                <input {...register('tags_json')} className="w-full" />
              </FormField>
              
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="primary" disabled={saving || isSubmitting}>
                  <Save size={16} /> {t('actions.saveProfile')}
                </Button>
                <Button variant="ghost" onClick={onArchive} type="button">
                  <Archive size={15} /> {t('actions.archive')}
                </Button>
                <Button variant="danger" onClick={onDelete} type="button">
                  <Trash2 size={15} /> {t('actions.delete')}
                </Button>
              </div>
            </form>
            
            {/* Sidebar: Relations & Voice samples */}
            <div className="space-y-4">
              <Panel className="!p-4">
                <SectionTitle 
                  title={t('relations.title')} 
                  meta={detail ? `${detail.relations.length} ${t('relations.count', { count: detail.relations.length })}` : ''}
                />
                
                {detailLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-16 bg-surface-2 rounded" />
                    <div className="h-16 bg-surface-2 rounded" />
                  </div>
                ) : detail && detail.relations.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {detail.relations.map((rel) => (
                      <div key={rel.id} className="p-3 rounded-lg bg-surface-2/50 border border-line/50">
                        <div className="flex items-center justify-between">
                          <Badge>{rel.relationType}</Badge>
                          <span className="text-xs text-muted">{rel.strength}%</span>
                        </div>
                        <p className="text-xs text-muted mt-1">{rel.targetCharacterId}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted py-4 text-center">{t('relations.empty') || 'No relations yet'}</p>
                )}
                
                {/* Quick add relation */}
                {detail && (
                  <RelationQuickAdd
                    characters={characters.filter(c => c.id !== character.id)}
                    onSubmit={onAddRelation}
                  />
                )}
              </Panel>
              
              <Panel className="!p-4">
                <SectionTitle 
                  title={t('voiceSamples.title')} 
                  meta={detail ? `${detail.voiceSamples.length} ${t('voiceSamples.count', { count: detail.voiceSamples.length })}` : ''}
                />
                {detail && detail.voiceSamples.length > 0 ? (
                  <div className="space-y-2 mt-3">
                    {detail.voiceSamples.map((sample) => (
                      <div key={sample.id} className="p-3 rounded-lg bg-surface-2/50 border border-line/50">
                        <p className="text-sm font-medium text-ink">{sample.label}</p>
                        <p className="text-xs text-muted">{sample.voiceNotes || sample.assetPath}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted py-4 text-center">{t('voiceSamples.empty') || 'No voice samples'}</p>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Quick relation add form
function RelationQuickAdd({ characters, onSubmit }: { characters: Character[]; onSubmit: (body: RelationInput) => void }) {
  const { t } = useTranslation('characters');
  const { register, handleSubmit, formState: { isSubmitting }, watch } = useForm<RelationInput>({
    resolver: zodResolver(relationSchema),
    defaultValues: { target_character_id: '', relation_type: 'ally', strength: 50 },
  });
  
  const target = watch('target_character_id');
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 pt-4 border-t border-line/50 space-y-3">
      <p className="text-sm font-medium text-ink">{t('relations.add.title')}</p>
      <select {...register('target_character_id')} className="w-full text-sm">
        <option value="">{t('relations.add.selectTarget')}</option>
        {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input {...register('relation_type')} className="text-sm" placeholder="Type" />
        <input 
          type="number" 
          min={0} 
          max={100} 
          {...register('strength', { valueAsNumber: true })} 
          className="text-sm" 
        />
      </div>
      <Button disabled={!target || isSubmitting} className="w-full text-sm">
        <UserRoundPlus size={14} /> {t('relations.add.title')}
      </Button>
    </form>
  );
}
