import { Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Button, ErrorState, LoadingState, PageHeader } from '~/components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { FormField } from '~/components/FormField';
import { CharacterCardGrid } from '~/components/characters';
import { apiErrorMessage } from '~/lib/errors';
import { listCharactersOptions, createCharacterMutation, getProjectCharacterImagesOptions, deleteCharacterImageMutation } from '~/lib/backend/@tanstack/react-query.gen';
import { queryClient } from '~/lib/query';


// Schema for creating a new character
const createCharacterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  narrativeRole: z.string().optional(),
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
    defaultValues: { name: '', narrativeRole: '' },
  });
  
  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      reset({ name: '', narrativeRole: '' });
    }
  }, [isOpen, reset]);
  
  const handleFormSubmit = (data: CreateCharacterInput) => {
    onSubmit(data);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createModal.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <FormField 
            label={t('fields.name')} 
            error={errors.name}
          >
            <Input
              {...register('name')}
              autoFocus
              className="w-full"
              placeholder={t('createModal.namePlaceholder')}
            />
          </FormField>
          
          <FormField
            label={t('fields.narrativeRole')}
            error={errors.narrativeRole}
          >
            <Input
              {...register('narrativeRole')}
              className="w-full"
              placeholder={t('createModal.rolePlaceholder')}
            />
          </FormField>
          
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={onClose}
              disabled={isLoading}
              type="button"
            >
              {t('actions.cancel')}
            </Button>
            <Button 
              variant="primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  {t('actions.creating')}
                </>
              ) : (
                t('actions.save')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CharactersRoute() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['characters', 'common']);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Fetch all characters
  const characters = useQuery(listCharactersOptions({ path: { projectId } }));
  
  // Fetch character images for all characters
  const characterImages = useQuery({
    ...getProjectCharacterImagesOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  
  // Create mutation
  const create = useMutation(createCharacterMutation());
  
  // Delete character image mutation (for grid updates)
  const deleteImageMutation = useMutation({
    ...deleteCharacterImageMutation(),
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
        path: { projectId },
        body: {
          name: data.name,
          narrativeRole: data.narrativeRole || undefined,
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
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={(
          <Button variant="primary" onClick={handleCreateClick} className="shrink-0">
            <Plus size={16} /> {t('actions.addCharacter')}
          </Button>
        )}
      />
      
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
          characters={characters.data}
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
