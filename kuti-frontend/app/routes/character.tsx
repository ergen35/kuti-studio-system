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
import { api, apiErrorMessage, csv, type Character, type CharacterDetail, type CharacterImage, type CharacterRelation, type VoiceSample } from '~/lib/api';
import { invalidateWorkspace, keys, queryClient } from '~/lib/query';
import { characterSchema, relationSchema, type CharacterInput, type RelationInput } from '~/lib/schemas';

const ITEMS_PER_PAGE = 10;

const sidePanelItemClass = "flex items-center gap-3 w-full p-2.5 rounded-lg border border-line bg-surface-2/30 text-left transition-all hover:border-accent hover:bg-surface-2/60";

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
  characters: Character[];
  currentCharacterId: string;
  projectId: string;
  relations: CharacterRelation[];
  voiceSamples: VoiceSample[];
  images: CharacterImage[];
  imageLoading: boolean;
  onDeleteImage?: (image: CharacterImage) => void;
  onImageClick: (image: CharacterImage, index: number) => void;
  relationMutation: UseMutationResult<CharacterRelation, Error, RelationInput, unknown>;
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
        (c.narrative_role && c.narrative_role.toLowerCase().includes(query)) ||
        (c.alias && c.alias.toLowerCase().includes(query))
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
                  colorPalette={char.color_palette_json}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{char.name}</p>
                  <p className="text-xs text-muted truncate">{char.narrative_role || char.slug}</p>
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
                  <Badge>{rel.relation_type}</Badge>
                  <span className="text-xs text-muted">{rel.strength}%</span>
                </div>
                <p className="text-xs text-muted mt-1 truncate">→ {rel.target_character_id}</p>
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
          onSubmit={(body) => relationMutation.mutate(body)}
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
                <p className="text-xs text-muted truncate">{sample.voice_notes || sample.asset_path}</p>
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
  
  // Fetch current character detail
  const character = useQuery({
    queryKey: keys.character(projectId, characterId),
    queryFn: () => api.character(projectId, characterId),
  });
  
  // Fetch all characters for sidepanel
  const allCharacters = useQuery({
    queryKey: keys.characters(projectId),
    queryFn: () => api.characters(projectId),
  });
  
  // Mutations
  const update = useMutation({
    mutationFn: (body: Partial<Character>) => api.updateCharacter(projectId, characterId, body),
    onSuccess: () => invalidateWorkspace(projectId),
  });
  
  const archive = useMutation({
    mutationFn: () => api.archiveCharacter(projectId, characterId),
    onSuccess: () => {
      navigate(`/projects/${projectId}/characters`);
      invalidateWorkspace(projectId);
    },
  });
  
  const remove = useMutation({
    mutationFn: () => api.deleteCharacter(projectId, characterId),
    onSuccess: () => {
      navigate(`/projects/${projectId}/characters`);
      invalidateWorkspace(projectId);
    },
  });
  
  const relation = useMutation({
    mutationFn: (body: RelationInput) => 
      api.createRelation(projectId, characterId, { source_character_id: characterId, ...body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.character(projectId, characterId) });
      invalidateWorkspace(projectId);
    },
  });
  
  // Fetch character images
  const imagesQuery = useQuery({
    queryKey: keys.characterImages(projectId, characterId),
    queryFn: () => api.characterImages(projectId, characterId),
    select: (data) => data.items,
  });
  
  // Delete image mutation
  const deleteImageMutation = useMutation({
    mutationFn: (imageId: string) => api.deleteCharacterImage(projectId, characterId, imageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.characterImages(projectId, characterId) });
    },
  });
  
  // Lightbox state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const lightboxImage = selectedImageIndex !== null ? (imagesQuery.data?.[selectedImageIndex] || null) : null;
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  const handleImageClick = (image: CharacterImage, index: number) => {
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
  
  const handleDeleteImage = (image: CharacterImage) => {
    if (confirm('Supprimer cette image ?')) {
      deleteImageMutation.mutate(image.id);
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
              name={character.data.name}
              colorPalette={character.data.color_palette_json}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-ink truncate">{character.data.name}</h1>
              <p className="text-sm text-muted font-mono">{character.data.slug}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge>{character.data.status}</Badge>
                {character.data.narrative_role && (
                  <span className="text-xs text-muted">· {character.data.narrative_role}</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Image Generator */}
          <div className="mb-4">
            <CharacterImageGenerator 
              character={character.data}
              projectId={projectId}
            />
          </div>
          
          {/* Form */}
          <CharacterForm
            initialData={character.data}
            saving={update.isPending}
            onSave={(body) => update.mutate(body)}
            onArchive={() => archive.mutate()}
            onDelete={() => remove.mutate()}
            archiving={archive.isPending}
            deleting={remove.isPending}
          />
        </Panel>
        
        {/* Sidepanel with accordion */}
        <CharacterSidePanel
          characters={(allCharacters.data?.items || []) as Character[]}
          currentCharacterId={characterId}
          projectId={projectId}
          relations={character.data.relations}
          voiceSamples={character.data.voice_samples}
          images={imagesQuery.data || []}
          imageLoading={imagesQuery.isLoading}
          onDeleteImage={handleDeleteImage}
          onImageClick={handleImageClick}
          relationMutation={relation}
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
function CharacterForm({
  initialData,
  saving,
  onSave,
  onArchive,
  onDelete,
  archiving,
  deleting,
}: {
  initialData: Character;
  saving: boolean;
  onSave: (body: Partial<Character>) => void;
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
      alias: initialData.alias || '',
      narrative_role: initialData.narrative_role || '',
      description: initialData.description,
      physical_description: initialData.physical_description,
      key_traits_json: toCsv(initialData.key_traits_json),
      color_palette_json: toCsv(initialData.color_palette_json),
      costume_elements_json: toCsv(initialData.costume_elements_json),
      personality: initialData.personality,
      narrative_arc: initialData.narrative_arc,
      tags_json: toCsv(initialData.tags_json),
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
  characters: Character[]; 
  onSubmit: (body: RelationInput) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation('characters');
  const { register, handleSubmit, formState: { isSubmitting }, watch, reset } = useForm<RelationInput>({
    resolver: zodResolver(relationSchema),
    defaultValues: { target_character_id: '', relation_type: 'ally', strength: 50 },
  });
  
  const target = watch('target_character_id');
  
  const handleFormSubmit = (data: RelationInput) => {
    onSubmit(data);
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
