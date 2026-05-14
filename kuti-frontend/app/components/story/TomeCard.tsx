import { BookOpen, Film, Clock } from 'lucide-react';
import { useTranslation } from '~/hooks/useTranslation';
import type { Tome } from '~/lib/api';

interface TomeCardProps {
  tome: Tome & {
    chapterCount: number;
    sceneCount: number;
    lastModified: Date;
  };
  tomeNumber: number;
  onClick?: () => void;
  className?: string;
}

const statusConfig = {
  draft: { 
    bg: 'bg-warning/15', 
    text: 'text-warning', 
    border: 'border-warning/30', 
    label: 'status.draft' 
  },
  active: { 
    bg: 'bg-success/15', 
    text: 'text-success', 
    border: 'border-success/30', 
    label: 'status.active' 
  },
  archived: { 
    bg: 'bg-muted/15', 
    text: 'text-muted', 
    border: 'border-muted/30', 
    label: 'status.archived' 
  },
} as const;

export function TomeCard({ tome, tomeNumber, onClick, className = '' }: TomeCardProps) {
  const { t } = useTranslation('story');
  const status = statusConfig[tome.status] || statusConfig.draft;
  
  // Format date
  const formattedDate = tome.lastModified.toLocaleDateString(t('locale') || 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  
  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full text-left
        transition-all duration-300 ease-out
        hover:-translate-y-1
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${className}
      `}
      aria-label={`${t('tome.number', { number: tomeNumber })}: ${tome.title}`}
    >
      {/* Card frame - style book/spine */}
      <div className={`
        relative overflow-hidden rounded-lg
        bg-surface border-2 border-line
        shadow-card
        transition-shadow duration-300
        group-hover:shadow-[0_8px_30px_rgba(47,111,115,0.12)]
        dark:group-hover:shadow-[0_8px_30px_rgba(97,165,160,0.10)]
      `}>
        {/* Book spine decoration left */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-surface-3 to-surface-2/50" 
          aria-hidden="true" 
        />
        
        {/* Content */}
        <div className="p-5 pl-6">
          {/* Tome number badge */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest uppercase text-accent/70">
              {t('tome.number', { number: tomeNumber })}
            </span>
          </div>
          
          {/* Decorative line */}
          <div className="flex items-center gap-2 mb-4" aria-hidden="true">
            <div className="w-8 h-0.5 bg-accent/40 rounded-full" />
            <div className="flex-1 h-px bg-line" />
          </div>
          
          {/* Title */}
          <h3 className="text-lg font-semibold text-ink mb-4 leading-tight line-clamp-2">
            {tome.title}
          </h3>
          
          {/* Stats */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-muted">
              <BookOpen size={14} className="text-accent/60" />
              <span>
                {t('tome.stats.chapters', { count: tome.chapterCount })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Film size={14} className="text-accent/60" />
              <span>
                {t('tome.stats.scenes', { count: tome.sceneCount })}
              </span>
            </div>
          </div>
          
          {/* Last modified */}
          <div className="flex items-center gap-2 text-xs text-muted/70 mb-4">
            <Clock size={12} />
            <span>
              {t('tome.lastModified')}: {formattedDate}
            </span>
          </div>
          
          {/* Status badge */}
          <div className="pt-3 border-t border-line/50">
            <span className={`
              inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium
              ${status.bg} ${status.text} border ${status.border}
            `}>
              {t(status.label)}
            </span>
          </div>
        </div>
        
        {/* Hover accent line */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent/0 group-hover:bg-accent/30 transition-colors duration-300"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
