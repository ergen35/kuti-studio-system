import { useTranslation } from '~/hooks/useTranslation';
import { CharacterAvatar } from './CharacterAvatar';
import type { Character } from '~/lib/api';

interface CharacterCardProps {
  character: Character;
  onClick?: () => void;
  className?: string;
}

const statusConfig = {
  active: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/30', label: 'Active' },
  draft: { bg: 'bg-draft/15', text: 'text-draft', border: 'border-draft/30', label: 'Draft' },
  archived: { bg: 'bg-muted/15', text: 'text-muted', border: 'border-muted/30', label: 'Archived' },
} as const;

export function CharacterCard({ character, onClick, className = '' }: CharacterCardProps) {
  const { t } = useTranslation('characters');
  const status = statusConfig[character.status] || statusConfig.draft;
  
  // Format role text - truncate if too long
  const roleText = character.narrative_role || character.alias || t('cards.noRole');
  const displayRole = roleText.length > 35 ? roleText.slice(0, 32) + '...' : roleText;
  
  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full text-left
        transition-all duration-300 ease-out
        hover:-translate-y-2
        focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
        ${className}
      `}
      aria-label={`${character.name} - ${displayRole}`}
    >
      {/* Card frame with decorative border */}
      <div className={`
        relative overflow-hidden rounded-xl
        bg-surface border-2 border-line
        shadow-card
        transition-shadow duration-300
        group-hover:shadow-[0_12px_40px_rgba(47,111,115,0.18)]
        dark:group-hover:shadow-[0_12px_40px_rgba(97,165,160,0.15)]
      `}>
        {/* Ornamental top border accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-60" />
        
        {/* Inner decorative frame */}
        <div className="m-3 p-4 rounded-lg bg-surface-2/30 border border-line/50">
          {/* Avatar container with orbital decoration */}
          <div className="relative flex justify-center py-6">
            {/* Glow effect behind avatar */}
            <div 
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              aria-hidden="true"
            >
              <div className="w-32 h-32 rounded-full bg-accent/10 blur-2xl" />
            </div>
            
            {/* Avatar */}
            <CharacterAvatar
              name={character.name}
              colorPalette={character.color_palette_json}
              size="lg"
              className="group-hover:scale-105 transition-transform duration-300"
            />
            
            {/* Corner ornaments */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent/40 rounded-tl-md" aria-hidden="true" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent/40 rounded-tr-md" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent/40 rounded-bl-md" aria-hidden="true" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent/40 rounded-br-md" aria-hidden="true" />
          </div>
          
          {/* Decorative divider */}
          <div className="flex items-center gap-2 my-4" aria-hidden="true">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-line to-accent/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-accent/50" />
            <div className="flex-1 h-px bg-gradient-to-r from-accent/30 via-line to-transparent" />
          </div>
          
          {/* Character info */}
          <div className="text-center space-y-2">
            {/* Name - styled like card title */}
            <h3 className="font-semibold text-lg text-ink leading-tight tracking-tight">
              {character.name}
            </h3>
            
            {/* Role/Archetype */}
            <p className="text-sm text-muted font-medium">
              {displayRole}
            </p>
            
            {/* Status badge */}
            <div className="pt-2">
              <span className={`
                inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                ${status.bg} ${status.text} border ${status.border}
              `}>
                {t(`status.${character.status}`)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Bottom decorative element */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      </div>
      
      {/* Hover glow effect */}
      <div 
        className="absolute -inset-1 rounded-2xl bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm"
        aria-hidden="true"
      />
    </button>
  );
}
