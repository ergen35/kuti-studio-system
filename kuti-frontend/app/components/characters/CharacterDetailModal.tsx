import { useEffect } from 'react';
import { useTranslation } from '~/hooks/useTranslation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Archive, Trash2, UserRoundPlus } from 'lucide-react';
import { CharacterAvatar } from './CharacterAvatar';
import { FormField } from '~/components/FormField';
import { Button, Panel, SectionTitle, Badge, toCsv } from '~/components/ui';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { Textarea } from '~/components/ui/textarea';
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

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CharacterInput>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: character.name,
      alias: (character.alias as string | undefined) || '',
      narrativeRole: (character.narrativeRole as string | undefined) || '',
      description: character.description,
      physicalDescription: character.physicalDescription,
      keyTraitsJson: toCsv(character.keyTraitsJson),
      colorPaletteJson: toCsv(character.colorPaletteJson),
      costumeElementsJson: toCsv(character.costumeElementsJson),
      personality: character.personality,
      narrativeArc: character.narrativeArc,
      tagsJson: toCsv(character.tagsJson),
    },
  });

  // Reset form when character changes
  useEffect(() => {
    reset({
      name: character.name,
      alias: (character.alias as string | undefined) || '',
      narrativeRole: (character.narrativeRole as string | undefined) || '',
      description: character.description,
      physicalDescription: character.physicalDescription,
      keyTraitsJson: toCsv(character.keyTraitsJson),
      colorPaletteJson: toCsv(character.colorPaletteJson),
      costumeElementsJson: toCsv(character.costumeElementsJson),
      personality: character.personality,
      narrativeArc: character.narrativeArc,
      tagsJson: toCsv(character.tagsJson),
    });
  }, [character, reset]);

  const onSubmit = (data: CharacterInput) => {
    onSave({
      name: data.name,
      alias: data.alias,
      narrativeRole: data.narrativeRole,
      description: data.description,
      physicalDescription: data.physicalDescription,
      keyTraitsJson: csv(data.keyTraitsJson),
      colorPaletteJson: csv(data.colorPaletteJson),
      costumeElementsJson: csv(data.costumeElementsJson),
      personality: data.personality,
      narrativeArc: data.narrativeArc,
      tagsJson: csv(data.tagsJson),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-5xl">
        <DialogHeader className="flex-row items-center gap-4 text-left">
          <CharacterAvatar
            name={character.name}
            colorPalette={character.colorPaletteJson}
            size="md"
          />
          <div className="flex-1">
            <DialogTitle className="text-xl">{character.name}</DialogTitle>
            <DialogDescription>{character.slug}</DialogDescription>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Main form */}
            <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label={t('fields.name')} error={errors.name}>
                  <Input {...register('name')} />
                </FormField>
                <FormField label={t('fields.alias')} error={errors.alias}>
                  <Input {...register('alias')} />
                </FormField>
              </div>

              <FormField label={t('fields.narrativeRole')} error={errors.narrativeRole}>
                <Input {...register('narrativeRole')} />
              </FormField>

              <FormField label={t('fields.description')} error={errors.description}>
                <Textarea {...register('description')} rows={3} />
              </FormField>

              <FormField label={t('fields.physicalDescription')} error={errors.physicalDescription}>
                <Textarea {...register('physicalDescription')} rows={3} />
              </FormField>

              <div className="grid gap-4 lg:grid-cols-2">
                <FormField label={t('fields.traits')} error={errors.keyTraitsJson}>
                  <Input {...register('keyTraitsJson')} placeholder={t('placeholders.traits')} />
                </FormField>
                <FormField label={t('fields.palette')} error={errors.colorPaletteJson}>
                  <Input {...register('colorPaletteJson')} placeholder={t('placeholders.palette')} />
                </FormField>
              </div>

              <FormField label={t('fields.costumeElements')} error={errors.costumeElementsJson}>
                <Input {...register('costumeElementsJson')} />
              </FormField>

              <FormField label={t('fields.personality')} error={errors.personality}>
                <Textarea {...register('personality')} rows={3} />
              </FormField>

              <FormField label={t('fields.narrativeArc')} error={errors.narrativeArc}>
                <Textarea {...register('narrativeArc')} rows={3} />
              </FormField>

              <FormField label={t('fields.tags')} error={errors.tagsJson}>
                <Input {...register('tagsJson')} />
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
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
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
                  <p className="text-sm text-muted py-4 text-center">{t('relations.empty')}</p>
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
                        <p className="text-xs text-muted">{String(sample.voiceNotes || sample.assetPath || '')}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted py-4 text-center">{t('voiceSamples.empty')}</p>
                )}
              </Panel>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Quick relation add form
function RelationQuickAdd({ characters, onSubmit }: { characters: Character[]; onSubmit: (body: RelationInput) => void }) {
  const { t } = useTranslation('characters');
  const { register, handleSubmit, formState: { isSubmitting }, watch, setValue } = useForm<RelationInput>({
    resolver: zodResolver(relationSchema),
    defaultValues: { targetCharacterId: '', relationType: 'ally', strength: 50 },
  });

  const target = watch('targetCharacterId');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 pt-4 border-t border-line/50 space-y-3">
      <p className="text-sm font-medium text-ink">{t('relations.add.title')}</p>
      <Select value={target} onValueChange={(value) => setValue('targetCharacterId', value, { shouldDirty: true, shouldValidate: true })}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('relations.add.selectTarget')} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {characters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input {...register('relationType')} className="text-sm" placeholder={t('relations.add.type')} />
        <Input
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
