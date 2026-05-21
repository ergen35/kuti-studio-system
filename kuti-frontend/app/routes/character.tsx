import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router';
import { clsx } from 'clsx';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Save, Archive, Trash2, UserRoundPlus, ArrowLeft, ChevronRight, 
  ChevronLeft, Search, ChevronDown, Users, AudioWaveform, Link2, Image as ImageIcon
} from 'lucide-react';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Badge, Button, EmptyState, ErrorState, LoadingState, Panel, SectionTitle, toCsv } from '~/components/ui';
import { FormField } from '~/components/FormField';
import { CharacterAvatar, CharacterImageGallery, CharacterImageGenerator, ImageLightbox } from '~/components/characters';
import { apiErrorMessage } from '~/lib/errors';
import { csv } from '~/lib/utils';
import { queryClient } from '~/lib/query';
import type { GetCharacterResponse, ListCharactersResponse, ListCharacterImagesResponse, UpdateCharacterData } from '~/lib/backend';
import {
  getCharacterOptions,
  listCharactersOptions,
  listCharacterImagesOptions,
  updateCharacterMutation,
  archiveCharacterMutation,
  deleteCharacterMutation,
  createRelationMutation,
  deleteCharacterImageMutation,
} from '~/lib/backend/@tanstack/react-query.gen';
import { characterSchema, relationSchema, type CharacterInput, type RelationInput } from '~/lib/schemas';

const ITEMS_PER_PAGE = 10;

const sidePanelItemClass = "flex items-center gap-3 w-full p-2.5 rounded-lg border border-line bg-surface-2/30 text-left transition-all hover:border-accent hover:bg-surface-2/60";

// Derived types from SDK
type CharacterFromList = ListCharactersResponse[number];
type CharacterImageFromList = ListCharacterImagesResponse[number];
type CharacterRelationFromSDK = GetCharacterResponse['relations'][number];
type VoiceSampleFromSDK = GetCharacterResponse['voiceSamples'][number];

// Accordion section component
function AccordionSection({ 
  title, 
  icon: Icon, 
  meta, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  icon: React.ComponentType<{ size?: number; className?: string }>;
  meta?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-line rounded-lg overflow-hidden bg-surface">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full flex items-center justify-between p-3 transition-colors",
          isOpen ? "bg-accent/5" : "hover:bg-surface-2/30"
        )}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-accent" />
          <span className="font-medium text-sm text-ink">{title}</span>
          {meta && <span className="text-xs text-muted">({meta})</span>}
        </div>
        <ChevronDown 
          size={16} 
          className={clsx(
            "text-muted transition-transform duration-200",
            isOpen && "rotate-180"
          )} 
        />
      </button>
      {isOpen && (
        <div className="p-3 border-t border-line">
          {children}
        </div>
      )}
    </div>
  );
}

// Side panel with search, filters, pagination
function CharacterSidePanel({
  characters,
  currentCharacterId,
  projectId,
  relations,
  voiceSamples,
  images,
  imageLoading,
  onDeleteImage,
  onImageClick,
  relationMutation,
}: {
  characters: CharacterFromList[];
  currentCharacterId: string;
  projectId: string;
  relations: CharacterRelationFromSDK[];
  voiceSamples: VoiceSampleFromSDK[];
  images: CharacterImageFromList[];
  imageLoading: boolean;
  onDeleteImage?: (image: CharacterImageFromList) => void;
  onImageClick: (image: CharacterImageFromList, index: number) => void;
  relationMutation: UseMutationResult<unknown, Error, RelationInput, unknown>;
}) {
  const { t } = useTranslation('characters');
  const navigate = useNavigate();
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter characters
  const filteredCharacters = useMemo(() => {
    let result = characters.filter(c => c.id !== currentCharacterId);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        (c.narrativeRole && typeof c.narrativeRole === 'string' && c.narrativeRole.toLowerCase().includes(query)) ||
        (c.alias && typeof c.alias === 'string' && c.alias.toLowerCase().includes(query))
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(c => c.status === statusFilter);
    }
    
    return result;
  }, [characters, currentCharacterId, searchQuery, statusFilter]);
  
  // Pagination
  const totalPages = Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE);
  const paginatedCharacters = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCharacters.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCharacters, currentPage]);
  
  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);
  
  const handleNavigate = (charId: string) => {
    navigate(`/projects/${projectId}/characters/${charId}`);
  };

  return (
    <div className="space-y-3">
      {/* Characters list accordion */}
      <AccordionSection 
        title={t('sidepanel.otherCharacters') || 'Cast'} 
        icon={Users}
        meta={String(filteredCharacters.length)}
        defaultOpen={true}
      >
        {/* Search bar */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={t('sidepanel.searchPlaceholder') || 'Search characters...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-line bg-surface focus:border-accent focus:outline-none"
          />
        </div>
        
        {/* Status filter */}
        <div className="flex gap-2 mb-3">
          {(['all', 'active', 'draft', 'archived'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={clsx(
                "px-2 py-1 text-xs rounded-full border transition-colors",
                statusFilter === status
                  ? "bg-accent text-accent-ink border-accent"
                  : "bg-surface-2/50 text-muted border-line hover:border-accent/50"
              )}
            >
              {status === 'all' ? t('filters.all') || 'All' : t(`status.${status}`)}
            </button>
          ))}
        </div>
        
        {/* Characters list */}
        <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
          {paginatedCharacters.length > 0 ? (
            paginatedCharacters.map((char) => (
              <button
                key={char.id}
                onClick={() => handleNavigate(char.id)}
                className={sidePanelItemClass}
              >
                <CharacterAvatar
                  name={char.name}
                  colorPalette={char.colorPaletteJson}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{char.name}</p>
                  <p className="text-xs text-muted truncate">
                    {typeof char.narrativeRole === 'string' ? char.narrativeRole : char.slug}
                  </p>
                </div>
                <ChevronRight size={14} className="text-muted" />
              </button>
            ))
          ) : (
            <p className="text-sm text-muted text-center py-4">
              {t('sidepanel.noResults') || 'No characters found'}
            </p>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 text-xs text-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} /> {t('pagination.prev') || 'Prev'}
            </button>
            <span className="text-xs text-muted">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 text-xs text-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('pagination.next') || 'Next'} <ChevronRight size={14} />
            </button>
          </div>
        )}
      </AccordionSection>
      
      {/* Relations accordion */}
      <AccordionSection 
        title={t('relations.title')} 
        icon={Link2}
        meta={String(relations.length)}
      >
        {relations.length > 0 ? (
          <div className="space-y-2">
            {relations.map((rel) => (
              <div 
                key={rel.id} 
                className="p-2.5 rounded-lg bg-surface-2/50 border border-line/50"
              >
                <div className="flex items-center justify-between">
                  <Badge>{rel.relationType}</Badge>
                  <span className="text-xs text-muted">{rel.strength}%</span>
                </div>
                <p className="text-xs text-muted mt-1 truncate">→ {rel.targetCharacterId}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-4">
            {t('relations.empty') || 'No relations'}
          </p>
        )}
        
        {/* Add relation form */}
        <RelationQuickAdd
          characters={characters.filter(c => c.id !== currentCharacterId)}
          onSubmit={((relationData: { targetCharacterId: string; relationType: string; strength: number }) => {
            relationMutation.mutate({ 
              path: { projectId, characterId: currentCharacterId }, 
              body: { sourceCharacterId: currentCharacterId, ...relationData }
            } as never);
          }) as never}
          submitting={relationMutation.isPending}
        />
      </AccordionSection>
      
      {/* Voice samples accordion */}
      <AccordionSection 
        title={t('voiceSamples.title')} 
        icon={AudioWaveform}
        meta={String(voiceSamples.length)}
      >
        {voiceSamples.length > 0 ? (
          <div className="space-y-2">
            {voiceSamples.map((sample) => (
              <div 
                key={sample.id} 
                className="p-2.5 rounded-lg bg-surface-2/50 border border-line/50"
              >
                <p className="text-sm font-medium text-ink">{sample.label}</p>
                <p className="text-xs text-muted truncate">
                  {sample.voiceNotes || (typeof sample.assetPath === 'string' ? sample.assetPath : '')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted text-center py-4">
            {t('voiceSamples.empty') || 'No voice samples'}
          </p>
        )}
      </AccordionSection>
      
      {/* Character images accordion */}
      <AccordionSection 
        title={t('images.title') || 'Images générées'} 
        icon={ImageIcon}
        meta={imageLoading || !images ? '...' : String(images.length)}
      >
        {imageLoading || !images ? (
          <div className="animate-pulse space-y-2">
            <div className="h-20 bg-surface-2 rounded" />
            <div className="h-20 bg-surface-2 rounded" />
          </div>
        ) : images.length > 0 ? (
          <CharacterImageGallery 
            images={images}
            projectId={projectId}
            characterId={currentCharacterId}
            onImageClick={onImageClick}
            onDelete={onDeleteImage}
          />
        ) : (
          <p className="text-sm text-muted text-center py-4">
            {t('images.empty') || 'Aucune image générée'}
          </p>
        )}
      </AccordionSection>
    </div>
  );
}

export default function CharacterRoute() {
  const { projectId = '', characterId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['characters', 'common']);
  
  // Fetch current character detail using SDK
  const character = useQuery({
    ...getCharacterOptions({
      path: { projectId, characterId }
    }),
  });
  
  // Fetch all characters for sidepanel using SDK
  const allCharacters = useQuery({
    ...listCharactersOptions({
      path: { projectId }
    })
  });
  
  // Mutations using SDK
  const updateConfig = updateCharacterMutation();
  const update = useMutation({
    ...updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getCharacter'] });
    }
  });
  
  const archiveConfig = archiveCharacterMutation();
  const archive = useMutation({
    ...archiveConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getCharacter'] });
    }
  });
  
  const deleteConfig = deleteCharacterMutation();
  const remove = useMutation({
    ...deleteConfig,
    onSuccess: () => {
      navigate(`/projects/${projectId}/characters`);
    }
  });
  
  const relationConfig = createRelationMutation();
  const relation = useMutation({
    ...relationConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['getCharacter'] });
    }
  });
  
  // Fetch character images using SDK
  const imagesQuery = useQuery({
    ...listCharacterImagesOptions({
      path: { projectId, characterId }
    })
  });
  
  // Delete image mutation using SDK
  const deleteImageConfig = deleteCharacterImageMutation();
  const deleteImageMutation = useMutation({
    ...deleteImageConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listCharacterImages'] });
    },
  });
  
  // Lightbox state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const lightboxImage = selectedImageIndex !== null ? (imagesQuery.data?.[selectedImageIndex] || null) : null;
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  const handleImageClick = (image: CharacterImageFromList, index: number) => {
    setSelectedImageIndex(index);
    setIsLightboxOpen(true);
  };
  
  const handleLightboxNavigate = (index: number) => {
    setSelectedImageIndex(index);
  };
  
  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    setSelectedImageIndex(null);
  };
  
  const handleDeleteImage = (image: CharacterImageFromList) => {
    if (confirm('Supprimer cette image ?')) {
      deleteImageMutation.mutate({
        path: { projectId, characterId, imageId: image.id }
      });
    }
  };
  
  if (character.isLoading || allCharacters.isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }
  
  if (character.error) {
    return (
      <AppShell>
        <ErrorState message={apiErrorMessage(character.error)} />
      </AppShell>
    );
  }
  
  if (!character.data) {
    return (
      <AppShell>
        <EmptyState title={t('empty.noSelection')} />
      </AppShell>
    );
  }

  const characterData = character.data;

  return (
    <AppShell>
      {/* Back link */}
      <div className="mb-4">
        <Link 
          to={`/projects/${projectId}/characters`}
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors"
        >
          <ArrowLeft size={16} /> {t('actions.backToGrid')}
        </Link>
      </div>
      
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main content - Character form */}
        <Panel className="overflow-hidden">
          {/* Header with avatar */}
          <div className="flex items-start gap-4 p-4 border-b border-line bg-surface-2/20 -m-3.5 mb-4">
            <CharacterAvatar
              name={characterData.name}
              colorPalette={characterData.colorPaletteJson}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-ink truncate">{characterData.name}</h1>
              <p className="text-sm text-muted font-mono">{characterData.slug}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge>{characterData.status}</Badge>
                {typeof characterData.narrativeRole === 'string' && characterData.narrativeRole && (
                  <span className="text-xs text-muted">· {characterData.narrativeRole}</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Image Generator */}
          <div className="mb-4">
            <CharacterImageGenerator 
              character={characterData as unknown as CharacterFromList}
              projectId={projectId}
            />
          </div>
          
          {/* Form */}
          <CharacterForm
            initialData={characterData}
            saving={update.isPending}
            onSave={(body) => update.mutate({ path: { projectId, characterId }, body })}
            onArchive={() => archive.mutate({ path: { projectId, characterId } })}
            onDelete={() => remove.mutate({ path: { projectId, characterId } })}
            archiving={archive.isPending}
            deleting={remove.isPending}
          />
        </Panel>
        
        {/* Sidepanel with accordion */}
        <CharacterSidePanel
          characters={allCharacters.data || []}
          currentCharacterId={characterId}
          projectId={projectId}
          relations={characterData.relations || []}
          voiceSamples={characterData.voiceSamples || []}
          images={imagesQuery.data || []}
          imageLoading={imagesQuery.isLoading}
          onDeleteImage={handleDeleteImage}
          onImageClick={handleImageClick}
          relationMutation={relation as unknown as UseMutationResult<unknown, Error, RelationInput, unknown>}
        />
        
        {/* Lightbox */}
        <ImageLightbox
          image={lightboxImage}
          isOpen={isLightboxOpen}
          onClose={handleCloseLightbox}
          images={imagesQuery.data || []}
          currentIndex={selectedImageIndex ?? 0}
          onNavigate={handleLightboxNavigate}
          projectId={projectId}
          characterId={characterId}
        />
      </div>
    </AppShell>
  );
}

// Character form component
type UpdateCharacterBody = UpdateCharacterData['body'];

function CharacterForm({
  initialData,
  saving,
  onSave,
  onArchive,
  onDelete,
  archiving,
  deleting,
}: {
  initialData: GetCharacterResponse;
  saving: boolean;
  onSave: (body: UpdateCharacterBody) => void;
  onArchive: () => void;
  onDelete: () => void;
  archiving: boolean;
  deleting: boolean;
}) {
  const { t } = useTranslation('characters');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CharacterInput>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: initialData.name,
      alias: typeof initialData.alias === 'string' ? initialData.alias : '',
      narrative_role: typeof initialData.narrativeRole === 'string' ? initialData.narrativeRole : '',
      description: initialData.description,
      physical_description: initialData.physicalDescription,
      key_traits_json: toCsv(initialData.keyTraitsJson),
      color_palette_json: toCsv(initialData.colorPaletteJson),
      costume_elements_json: toCsv(initialData.costumeElementsJson),
      personality: initialData.personality,
      narrative_arc: initialData.narrativeArc,
      tags_json: toCsv(initialData.tagsJson),
    },
  });

  const onSubmit = (data: CharacterInput) => onSave({
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

  return (
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
        <Button variant="ghost" onClick={onArchive} disabled={archiving} type="button">
          <Archive size={15} /> {t('actions.archive')}
        </Button>
        <Button variant="danger" onClick={onDelete} disabled={deleting} type="button">
          <Trash2 size={15} /> {t('actions.delete')}
        </Button>
      </div>
    </form>
  );
}

// Quick relation add form
function RelationQuickAdd({ 
  characters, 
  onSubmit, 
  submitting
}: { 
  characters: CharacterFromList[]; 
  onSubmit: (data: { targetCharacterId: string; relationType: string; strength: number }) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation('characters');
  const { register, handleSubmit, formState: { isSubmitting }, watch, reset } = useForm<RelationInput>({
    resolver: zodResolver(relationSchema),
    defaultValues: { target_character_id: '', relation_type: 'ally', strength: 50 },
  });
  
  const target = watch('target_character_id');
  
  const handleFormSubmit = (data: RelationInput) => {
    onSubmit({
      targetCharacterId: data.target_character_id,
      relationType: data.relation_type,
      strength: data.strength
    });
    reset({ target_character_id: '', relation_type: 'ally', strength: 50 });
  };
  
  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-3 pt-3 border-t border-line/50 space-y-2">
      <p className="text-xs font-medium text-muted">{t('relations.add.title')}</p>
      <select {...register('target_character_id')} className="w-full text-xs py-1.5">
        <option value="">{t('relations.add.selectTarget')}</option>
        {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input {...register('relation_type')} className="text-xs py-1.5" placeholder="Type" />
        <input 
          type="number" 
          min={0} 
          max={100} 
          {...register('strength', { valueAsNumber: true })} 
          className="text-xs py-1.5" 
        />
      </div>
      <Button disabled={!target || isSubmitting || submitting} className="w-full text-xs py-1.5">
        <UserRoundPlus size={12} /> {t('relations.add.title')}
      </Button>
    </form>
  );
}
