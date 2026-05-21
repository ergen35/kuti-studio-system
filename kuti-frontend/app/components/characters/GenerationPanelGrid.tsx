import { useState } from 'react';
import { clsx } from 'clsx';
import { Loader2, Check } from 'lucide-react';
import { generationPanelImageUrl } from '~/lib/image-urls';

interface GenerationPanelGridProps {
  panels: Array<{
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
  }>;
  projectId: string;
  boardId: string;
}

export function GenerationPanelGrid({ panels, projectId, boardId }: GenerationPanelGridProps) {
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);

  const getPanelImageUrl = (panelId: string) =>
    generationPanelImageUrl(projectId, boardId, panelId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Résultats de la génération</p>
        <span className="text-xs text-muted">{panels.length} images</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className={clsx(
              "relative rounded-lg overflow-hidden border-2 transition-all",
              selectedPanelId === panel.id 
                ? "border-accent ring-2 ring-accent/20" 
                : "border-line hover:border-accent/50"
            )}
            onClick={() => setSelectedPanelId(panel.id)}
          >
            <div className="aspect-square bg-surface-2">
              {panel.status === 'ready' && panel.imagePath ? (
                <img
                  src={getPanelImageUrl(panel.id)}
                  alt={panel.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : panel.status === 'generating' || panel.status === 'pending' ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 size={24} className="text-muted animate-spin" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-surface-2">
                  <span className="text-xs text-muted">En attente</span>
                </div>
              )}
            </div>
            
            {/* Status indicator */}
            <div className="absolute top-2 right-2">
              <StatusBadge status={panel.status} />
            </div>
            
            {/* Caption */}
            {panel.caption && (
              <div className="p-2 bg-surface border-t border-line">
                <p className="text-xs text-muted line-clamp-2">{panel.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { icon?: React.ReactNode; class: string; label: string }> = {
    generating: {
      icon: <Loader2 size={10} className="animate-spin" />,
      class: "bg-warning/90 text-warning-ink",
      label: "Génération...",
    },
    ready: {
      icon: <Check size={10} />,
      class: "bg-success/90 text-success-ink",
      label: "Prêt",
    },
    failed: {
      class: "bg-danger/90 text-danger-ink",
      label: "Échec",
    },
    pending: {
      class: "bg-muted/90 text-ink",
      label: "En attente",
    },
  };

  const config = configs[status] || configs.pending;

  return (
    <span className={clsx(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
      config.class
    )}>
      {config.icon}
      {config.label}
    </span>
  );
}
