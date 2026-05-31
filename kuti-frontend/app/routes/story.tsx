import { Plus } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from '~/hooks/useTranslation';
import { AppShell } from '~/components/layout';
import { Button, ErrorState, LoadingState, PageHeader, Stat } from '~/components/ui';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
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
  
  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      reset({ title: '' });
    }
  }, [isOpen, reset]);
  
  const handleFormSubmit = (data: CreateTomeInput) => {
    onSubmit(data);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createTome.title')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <FormField 
            label={t('fields.title')} 
            error={errors.title}
          >
            <Input
              {...register('title')}
              autoFocus
              className="w-full"
              placeholder={t('createTome.titlePlaceholder')}
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
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={(
          <Button variant="primary" onClick={handleCreateClick} className="shrink-0">
            <Plus size={16} /> {t('actions.addTome')}
          </Button>
        )}
      />
      
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
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat value={story.data.tomes.length} label={t('panels.outline.count', { count: story.data.tomes.length })} />
            <Stat value={story.data.chapters.length} label={t('tome.stats.chapters', { count: story.data.chapters.length })} />
            <Stat value={story.data.scenes.length} label={t('tome.stats.scenes', { count: story.data.scenes.length })} />
          </div>
          <TomeCardGrid
            tomes={tomeStats}
            onSelect={handleSelectTome}
            onCreate={handleCreateClick}
            isLoading={story.isLoading}
          />
        </div>
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
