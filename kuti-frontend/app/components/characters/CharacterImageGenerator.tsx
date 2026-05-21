import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Sparkles, X, Loader2, Wand2, ImageIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from '~/hooks/useTranslation';
import type { ListCharactersResponse } from '~/lib/backend';
import { apiErrorMessage } from '~/lib/errors';
import { generateCharacterImageMutation, getGenerationJobOptions } from '~/lib/backend/@tanstack/react-query.gen';
import { invalidateWorkspace, keys } from '~/lib/query';
import { Button, Badge, ErrorState, Field } from '~/components/ui';
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
  const genMutationConfig = generateCharacterImageMutation();
  const generateMutation = useMutation({
    mutationFn: (body: { strategy: string; style: string; image_count: number }) =>
      genMutationConfig.mutationFn!({
        path: { projectId, characterId: character.id },
        query: {
          strategy: body.strategy,
          style: body.style,
          imageCount: body.image_count,
        },
      }),
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
      return 2000;
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
    const description = parts.join(', ') || 'A character';
    
    return `${base}, ${description}, ${artistic}`;
  }, [character, strategy, style, t]);

  const handleGenerate = () => {
    generateMutation.mutate({ strategy, style, image_count: imageCount });
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
    <div className="space-y-4">
      {/* Active generation progress */}
      {isGenerating && activeJob.data && (
        <div className="p-4 rounded-lg border border-accent/30 bg-accent/5">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 size={18} className="animate-spin text-accent" />
            <span className="text-sm font-medium text-ink">
              {t('generation.generating') || 'Génération en cours...'}
            </span>
            <span className="text-sm text-muted ml-auto">
              {activeJob.data.progress}%
            </span>
          </div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${activeJob.data.progress}%` }}
            />
          </div>
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
          ? t('generation.generating') || 'Génération...'
          : activeJob.data?.board?.panels?.length 
            ? t('generation.regenerate') || 'Regénérer'
            : t('generation.generatePortrait') || 'Générer un portrait'
        }
      </Button>

      {/* Generation config modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
        >
          <div className="w-full max-w-md rounded-xl bg-surface shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-line bg-surface-2/30">
              <div className="flex items-center gap-2">
                <Wand2 size={20} className="text-accent" />
                <h2 className="text-lg font-semibold text-ink">
                  {t('generation.modalTitle') || 'Générer une image'}
                </h2>
              </div>
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="p-1 h-auto">
                <X size={20} />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* Error */}
              {generateMutation.error && (
                <ErrorState message={apiErrorMessage(generateMutation.error as unknown)} />
              )}

              {/* Strategy */}
              <div>
                <label className="text-sm text-muted mb-2 block">
                  {t('generation.strategy.label') || 'Cadre'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {STRATEGIES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStrategy(s)}
                      className={clsx(
                        "p-2 rounded-lg border text-sm transition-colors text-center",
                        strategy === s
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line hover:border-accent/50 text-ink"
                      )}
                    >
                      {t(`generation.strategy.${s}`) || s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div>
                <label className="text-sm text-muted mb-2 block">
                  {t('generation.style.label') || 'Style'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={clsx(
                        "p-2 rounded-lg border text-sm transition-colors text-center",
                        style === s
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line hover:border-accent/50 text-ink"
                      )}
                    >
                      {t(`generation.style.${s}`) || s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image count */}
              <div>
                <label className="text-sm text-muted mb-2 block">
                  {t('generation.imageCount') || 'Nombre de variations'}
                </label>
                <div className="flex gap-2">
                  {[1, 2, 4].map((count) => (
                    <button
                      key={count}
                      onClick={() => setImageCount(count)}
                      className={clsx(
                        "flex-1 p-2 rounded-lg border text-sm transition-colors",
                        imageCount === count
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line hover:border-accent/50 text-ink"
                      )}
                    >
                      <ImageIcon size={14} className="inline mr-1" />
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt preview */}
              <div>
                <label className="text-sm text-muted mb-2 block">
                  {t('generation.preview') || 'Aperçu du prompt'}
                </label>
                <div className="max-h-32 overflow-y-auto p-3 rounded-lg bg-surface-2/30 border border-line text-xs text-muted">
                  {previewPrompt}
                </div>
              </div>

              {/* Insufficient data warning */}
              {(!character.description && !character.physicalDescription) && (
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
                  {t('generation.insufficientData') || 'Données insuffisantes. Enrichissez la fiche avec description et traits physiques.'}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-line">
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
                  {t('generation.generate') || 'Générer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
