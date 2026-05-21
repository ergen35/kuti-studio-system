import { Plus, Sparkles, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Button, ErrorState, LoadingState } from '~/components/ui';
import { FormField } from '~/components/FormField';
import { CharacterCardGrid } from '~/components/characters';
import { apiErrorMessage, API_BASE_URL } from '~/lib/api';
import { useCharacters, useCreateCharacter } from '~/hooks/use-api';
import { queryClient } from '~/lib/query';


// Schema for creating a new character
const createCharacterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  narrative_role: z.string().optional(),
});

type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

// Create Character Modal
function CreateCharacterModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCharacterInput) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('characters');
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateCharacterInput>({
    resolver: zodResolver(createCharacterSchema),
    defaultValues: { name: '', narrative_role: '' },
  });
  
  const overlayRef = useRef<HTMLDivElement>(null);
  
  // Close on escape
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
  
  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      reset({ name: '', narrative_role: '' });
    }
  }, [isOpen, reset]);
  
  const handleFormSubmit = (data: CreateCharacterInput) => {
    onSubmit(data);
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-xl bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-line bg-surface-2/30">
          <h2 className="text-lg font-semibold text-ink">
            {t('createModal.title') || 'Nouveau personnage'}
          </h2>
          <Button variant="ghost" onClick={onClose} className="p-1 h-auto">
            <X size={20} />
          </Button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-4">
          <FormField 
            label={t('fields.name')} 
            error={errors.name}
          >
            <input
              {...register('name')}
              autoFocus
              className="w-full"
              placeholder={t('createModal.namePlaceholder') || 'Ex: Jean Valjean'}
            />
          </FormField>
          
          <FormField 
            label={t('fields.narrativeRole')} 
            error={errors.narrative_role}
          >
            <input
              {...register('narrative_role')}
              className="w-full"
              placeholder={t('createModal.rolePlaceholder') || 'Ex: Protagoniste'}
            />
          </FormField>
          
          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              variant="ghost" 
              onClick={onClose}
              disabled={isLoading}
              type="button"
            >
              {t('actions.cancel') || 'Annuler'}
            </Button>
            <Button 
              variant="primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  {t('actions.creating') || 'Création...'}
                </>
              ) : (
                t('actions.save') || 'Enregistrer'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CharactersRoute() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['characters', 'common']);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Fetch all characters
  const characters = useCharacters(projectId);
  
  // Fetch character images for all characters
  const characterImages = useQuery({
    queryKey: ['characterImages', projectId, 'all'],
    queryFn: async () => {
      const { readProjectCharacterImagesApiProjectsProjectIdCharactersImagesGet } = await import('~/lib/backend');
      const { data } = await readProjectCharacterImagesApiProjectsProjectIdCharactersImagesGet({
        path: { project_id: projectId }
      });
      return data ?? {};
    },
    enabled: !!projectId,
  });
  
  // Create mutation
  const create = useCreateCharacter();
  
  // Delete character image mutation (for grid updates)
  const deleteImageMutation = useMutation({
    mutationFn: async ({ characterId, imageId }: { characterId: string; imageId: string }) => {
      const { deleteCharacterImageRouteApiProjectsProjectIdCharactersCharacterIdImagesImageIdDelete } = await import('~/lib/backend');
      await deleteCharacterImageRouteApiProjectsProjectIdCharactersCharacterIdImagesImageIdDelete({
        path: { project_id: projectId, character_id: characterId, image_id: imageId }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characterImages', projectId, 'all'] });
    },
  });
  
  const handleCreateClick = () => {
    setIsModalOpen(true);
  };
  
  const handleCreateSubmit = (data: CreateCharacterInput) => {
    create.mutate(
      {
        path: { project_id: projectId },
        body: {
          name: data.name,
          narrative_role: data.narrative_role || null,
          description: '',
        }
      },
      {
        onSuccess: (result: unknown) => {
          const character = result as { id: string };
          setIsModalOpen(false);
          // Navigate to the new character's detail page
          navigate(`/projects/${projectId}/characters/${character.id}`);
        },
      }
    );
  };
  
  const handleSelect = (characterId: string) => {
    navigate(`/projects/${projectId}/characters/${characterId}`);
  };

  return (
    <AppShell>
      {/* Header with decorative element */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Sparkles size={20} />
            </div>
            <h1 className="text-2xl font-semibold text-ink">{t('title')}</h1>
          </div>
          <p className="text-muted max-w-xl">{t('description')}</p>
        </div>
        <Button 
          variant="primary" 
          onClick={handleCreateClick}
          className="shrink-0"
        >
          <Plus size={16} /> {t('actions.addCharacter')}
        </Button>
      </div>
      
      {/* Error states */}
      {create.error && (
        <div className="mb-4">
          <ErrorState message={apiErrorMessage(create.error)} />
        </div>
      )}
      
      {/* Loading state */}
      {characters.isLoading && <LoadingState />}
      
      {/* Error state */}
      {characters.error && (
        <ErrorState message={apiErrorMessage(characters.error)} />
      )}
      
      {/* Character card grid */}
      {characters.data && (
        <CharacterCardGrid
          characters={characters.data.items as unknown as import('~/lib/api').Character[]}
          imagesByCharacter={characterImages.data || {}}
          onSelect={(char) => handleSelect(char.id)}
          onCreate={handleCreateClick}
          isLoading={characters.isLoading}
        />
      )}
      
      {/* Create Character Modal */}
      <CreateCharacterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isLoading={create.isPending}
      />
    </AppShell>
  );
}
