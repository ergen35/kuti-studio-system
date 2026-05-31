import { useMutation, useQuery } from '@tanstack/react-query';
import { ImageIcon, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, ErrorState } from '~/components/ui';
import { Alert, AlertDescription } from '~/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Progress } from '~/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '~/components/ui/toggle-group';
import { useTranslation } from '~/hooks/useTranslation';
import type { ListCharactersResponse } from '~/lib/backend';
import { generateCharacterImageMutation, getGenerationJobOptions } from '~/lib/backend/@tanstack/react-query.gen';
import { apiErrorMessage } from '~/lib/errors';
import { invalidateWorkspace } from '~/lib/query';
import { GenerationPanelGrid } from './GenerationPanelGrid';

interface CharacterImageGeneratorProps {
  character: ListCharactersResponse[number];
  projectId: string;
}

type Strategy = 'portrait' | 'full_body' | 'concept';
type Style = 'realistic' | 'anime' | 'illustration' | 'watercolor';

const STRATEGIES: Strategy[] = ['portrait', 'full_body', 'concept'];
const STYLES: Style[] = ['realistic', 'anime', 'illustration', 'watercolor'];

type GenerationPanelType = {
  id: string;
  boardId: string;
  stepId: string | unknown;
  orderIndex: number;
  title: string;
  caption: string;
  prompt: string;
  status: 'ready' | 'generating' | 'failed' | 'pending' | 'draft' | 'selected' | 'rejected' | 'replaced';
  imagePath: string;
  imageName: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type GenerationBoardType = {
  id: string;
  panels: GenerationPanelType[];
};

type GenerationJobResponse = {
  id: string;
  status: string;
  progress: number;
  board?: GenerationBoardType;
};

export function CharacterImageGenerator({ character, projectId }: CharacterImageGeneratorProps) {
  const { t } = useTranslation('characters');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>('portrait');
  const [style, setStyle] = useState<Style>('realistic');
  const [imageCount, setImageCount] = useState(2);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Generate mutation using SDK
  const generateMutation = useMutation({
    ...generateCharacterImageMutation(),
    onSuccess: (job) => {
      if (job && typeof job === 'object' && 'id' in job) {
        setActiveJobId((job as GenerationJobResponse).id);
      }
      invalidateWorkspace(projectId);
    },
  });

  // Poll active job status using SDK
  const activeJob = useQuery({
    ...getGenerationJobOptions({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      path: { projectId, jobId: activeJobId! } as any,
    }),
    select: (data) => data as unknown as GenerationJobResponse,
    enabled: Boolean(activeJobId),
    refetchInterval: (query: { state?: { data?: { status?: string } } }) => {
      const status = query.state?.data?.status;
      if (status === 'ready' || status === 'failed') return false;
      return 30000;
    },
    staleTime: 0,
  });

  // Build preview prompt
  const previewPrompt = useMemo(() => {
    const parts: string[] = [];
    if (character.description) parts.push(character.description);
    if (character.physicalDescription) parts.push(`Physical: ${character.physicalDescription}`);
    if (character.costumeElementsJson?.length) {
      parts.push(`Wearing: ${character.costumeElementsJson.slice(0, 5).join(', ')}`);
    }
    if (character.colorPaletteJson?.length) {
      parts.push(`Colors: ${character.colorPaletteJson.slice(0, 3).join(', ')}`);
    }
    
    const strategyPrefix = {
      portrait: t('generation.strategy.portraitDesc'),
      full_body: t('generation.strategy.fullBodyDesc'),
      concept: t('generation.strategy.conceptDesc'),
    };
    
    const styleSuffix = {
      realistic: t('generation.style.realisticDesc'),
      anime: t('generation.style.animeDesc'),
      illustration: t('generation.style.illustrationDesc'),
      watercolor: t('generation.style.watercolorDesc'),
    };
    
    const base = strategyPrefix[strategy] || strategyPrefix.portrait;
    const artistic = styleSuffix[style] || styleSuffix.realistic;
    const description = parts.join(', ') || t('generation.defaultPromptSubject');
    
    return `${base}, ${description}, ${artistic}`;
  }, [character, strategy, style, t]);

  const handleGenerate = () => {
    generateMutation.mutate({
      path: { projectId, characterId: character.id },
      query: { strategy, style, imageCount },
    });
    setIsModalOpen(false);
  };

  const handleRegenerate = () => {
    setIsModalOpen(true);
    setActiveJobId(null);
  };

  const isGenerating = Boolean(activeJobId) && (
    activeJob.isFetching || 
    (activeJob.data && activeJob.data.status !== 'ready' && activeJob.data.status !== 'failed')
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Active generation progress */}
      {isGenerating && activeJob.data && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-primary" />
            <span className="text-sm font-medium text-foreground">
              {t('generation.generating')}
            </span>
            <span className="ml-auto text-sm text-muted-foreground">
              {activeJob.data.progress}%
            </span>
          </div>
          <Progress value={activeJob.data.progress} className="h-2" />
        </div>
      )}

      {/* Gallery of results */}
      {(activeJob.data?.board?.panels?.length || 0) > 0 && (
        <GenerationPanelGrid 
          panels={activeJob.data!.board!.panels}
          projectId={projectId}
          boardId={activeJob.data!.board!.id}
        />
      )}

      {/* Generate button */}
      <Button 
        variant="primary" 
        onClick={() => setIsModalOpen(true)}
        disabled={isGenerating}
        className="w-full"
      >
        {isGenerating ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {isGenerating 
          ? t('generation.generating')
          : activeJob.data?.board?.panels?.length 
            ? t('generation.regenerate')
            : t('generation.generatePortrait')
        }
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="text-primary" />
              {t('generation.modalTitle')}
            </DialogTitle>
            <DialogDescription>{t('generation.modalDescription')}</DialogDescription>
          </DialogHeader>

            <div className="flex flex-col gap-4">
              {/* Error */}
              {generateMutation.error && (
                <ErrorState message={apiErrorMessage(generateMutation.error as unknown)} />
              )}

              {/* Strategy */}
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  {t('generation.strategy.label')}
                </label>
                <ToggleGroup
                  type="single"
                  value={strategy}
                  onValueChange={(value) => value && setStrategy(value as Strategy)}
                  className="grid w-full grid-cols-3"
                >
                  {STRATEGIES.map((s) => (
                    <ToggleGroupItem
                      key={s}
                      value={s}
                      className="w-full"
                    >
                      {t(`generation.strategy.${s}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {/* Style */}
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  {t('generation.style.label')}
                </label>
                <ToggleGroup
                  type="single"
                  value={style}
                  onValueChange={(value) => value && setStyle(value as Style)}
                  className="grid w-full grid-cols-2"
                >
                  {STYLES.map((s) => (
                    <ToggleGroupItem
                      key={s}
                      value={s}
                      className="w-full"
                    >
                      {t(`generation.style.${s}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {/* Image count */}
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  {t('generation.imageCount')}
                </label>
                <ToggleGroup
                  type="single"
                  value={String(imageCount)}
                  onValueChange={(value) => value && setImageCount(Number(value))}
                  className="grid w-full grid-cols-3"
                >
                  {[1, 2, 4].map((count) => (
                    <ToggleGroupItem
                      key={count}
                      value={String(count)}
                      className="w-full"
                    >
                      <ImageIcon />
                      {count}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {/* Prompt preview */}
              <div>
                <label className="mb-2 block text-sm text-muted-foreground">
                  {t('generation.preview')}
                </label>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-secondary/35 p-3 text-xs text-muted-foreground">
                  {previewPrompt}
                </div>
              </div>

              {/* Insufficient data warning */}
              {(!character.description && !character.physicalDescription) && (
                <Alert>
                  <AlertDescription>{t('generation.insufficientData')}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                  {t('actions.cancel')}
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Wand2 size={16} />
                  )}
                  {t('generation.generate')}
                </Button>
              </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
