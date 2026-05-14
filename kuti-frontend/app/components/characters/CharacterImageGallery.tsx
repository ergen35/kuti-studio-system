import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from '~/hooks/useTranslation';
import { Button } from '~/components/ui';
import type { GenerationPanel } from '~/lib/api';
import { api } from '~/lib/api';

interface CharacterImageGalleryProps {
  panels: GenerationPanel[];
  projectId: string;
  boardId: string;
}

export function CharacterImageGallery({ panels, projectId, boardId }: CharacterImageGalleryProps) {
  const { t } = useTranslation('characters');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sort panels by order
  const sortedPanels = [...panels].sort((a, b) => a.order_index - b.order_index);

  const handleDownload = (panel: GenerationPanel) => {
    const url = api.generationPanelImageUrl(projectId, boardId, panel.id);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-ink">
        {t('generation.results') || 'Résultats'} ({panels.length})
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        {sortedPanels.map((panel) => {
          const isSelected = selectedId === panel.id;
          const imageUrl = api.generationPanelImageUrl(projectId, boardId, panel.id);
          
          return (
            <div
              key={panel.id}
              className={clsx(
                "relative group rounded-lg border overflow-hidden cursor-pointer transition-all",
                isSelected 
                  ? "border-accent ring-2 ring-accent/20" 
                  : "border-line hover:border-accent/50"
              )}
              onClick={() => setSelectedId(panel.id)}
            >
              {/* Image thumbnail */}
              <div className="aspect-square bg-surface-2">
                <img
                  src={imageUrl}
                  alt={panel.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              
              {/* Overlay */}
              <div className={clsx(
                "absolute inset-0 bg-ink/50 flex flex-col items-center justify-center gap-2 transition-opacity",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                <Button 
                  variant="primary" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(panel);
                  }}
                  className="text-xs py-1.5 px-3"
                >
                  <Download size={14} />
                  {t('generation.download') || 'Télécharger'}
                </Button>
                
                {isSelected && (
                  <div className="flex items-center gap-1 text-accent text-sm">
                    <Check size={14} />
                    <span>{t('generation.selected') || 'Sélectionné'}</span>
                  </div>
                )}
              </div>
              
              {/* Variation number */}
              <div className="absolute top-2 left-2">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-ink/60 text-white">
                  #{panel.order_index + 1}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
