import { Plus, Library, X } from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Button, ErrorState, LoadingState } from '~/components/ui';
import { FormField } from '~/components/FormField';
import { TomeCardGrid } from '~/components/story';
import { apiErrorMessage } from '~/lib/errors';
import { getStorySummaryOptions, createTomeMutation } from '~/lib/backend/@tanstack/react-query.gen';
import { queryClient } from '~/lib/query';

// Schema for creating a new tome
const createTomeSchema = z.object({
  title: z.string().min(1, 'Title is required'),
});

type CreateTomeInput = z.infer<typeof createTomeSchema>;

// Create Tome Modal
function CreateTomeModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTomeInput) => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation('story');
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateTomeInput>({
    resolver: zodResolver(createTomeSchema),
    defaultValues: { title: '' },
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
      reset({ title: '' });
    }
  }, [isOpen, reset]);
  
  const handleFormSubmit = (data: CreateTomeInput) => {
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
            {t('createTome.title') || 'Nouveau tome'}
          </h2>
          <Button variant="ghost" onClick={onClose} className="p-1 h-auto">
            <X size={20} />
          </Button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4 space-y-4">
          <FormField 
            label={t('fields.title')} 
            error={errors.title}
          >
            <input
              {...register('title')}
              autoFocus
              className="w-full"
              placeholder={t('createTome.titlePlaceholder') || 'Ex: La Prophétie Oubliée'}
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

export default function StoryRoute() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(['story', 'common']);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Fetch story data
  const story = useQuery(getStorySummaryOptions({ path: { projectId } }));

  // Create tome mutation
  const createTome = useMutation(createTomeMutation());
  
  const handleCreateSubmit = (data: CreateTomeInput) => {
    createTome.mutate(
      {
        path: { projectId },
        body: {
          title: data.title,
          orderIndex: (story.data?.tomes?.length ?? 0)
        }
      },
      {
        onSuccess: () => {
          setIsModalOpen(false);
        }
      }
    );
  };
  
  // Calculate tome stats
  const tomeStats = useMemo(() => {
    if (!story.data) return [];
    
    const { tomes, chapters, scenes } = story.data;
    
    return tomes
      .map((tome) => {
        const tomeChapters = chapters.filter(c => c.tomeId === tome.id);
        const tomeScenes = scenes.filter(s => s.tomeId === tome.id);

        // Calculate last modified date
        const lastSceneUpdate = tomeScenes.length > 0
          ? Math.max(...tomeScenes.map(s => new Date(s.updatedAt).getTime()))
          : new Date(tome.updatedAt).getTime();
        
        return {
          ...tome,
          chapterCount: tomeChapters.length,
          sceneCount: tomeScenes.length,
          lastModified: new Date(lastSceneUpdate),
        };
      })
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [story.data]);
  
  const handleSelectTome = (tomeId: string) => {
    navigate(`/projects/${projectId}/story/${tomeId}`);
  };
  
  const handleCreateClick = () => {
    setIsModalOpen(true);
  };
  


  return (
    <AppShell>
      {/* Header with decorative element */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Library size={20} />
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
          <Plus size={16} /> {t('actions.addTome')}
        </Button>
      </div>
      
      {/* Error states */}
      {createTome.error && (
        <div className="mb-4">
          <ErrorState message={apiErrorMessage(createTome.error)} />
        </div>
      )}
      
      {/* Loading state */}
      {story.isLoading && <LoadingState />}
      
      {/* Error state */}
      {story.error && (
        <ErrorState message={apiErrorMessage(story.error)} />
      )}
      
      {/* Tome card grid */}
      {story.data && (
        <TomeCardGrid
          tomes={tomeStats}
          onSelect={handleSelectTome}
          onCreate={handleCreateClick}
          isLoading={story.isLoading}
        />
      )}
      
      {/* Create Tome Modal */}
      <CreateTomeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isLoading={createTome.isPending}
      />
    </AppShell>
  );
}
