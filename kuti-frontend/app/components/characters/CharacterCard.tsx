import { useTranslation } from '~/hooks/useTranslation';
import { CharacterAvatar } from './CharacterAvatar';
import { characterImageUrl } from '~/lib/image-urls';
import type { ListCharactersResponse, ListCharacterImagesResponse } from '~/lib/backend';

type Character = ListCharactersResponse[number];
type CharacterImage = ListCharacterImagesResponse[number];

interface CharacterCardProps {
  character: Character;
  image?: CharacterImage | null;
  onClick?: () => void;
  className?: string;
}

const statusConfig = {
  active: { bg: 'bg-emerald-500/15', text: 'text-emerald-500', border: 'border-emerald-500/30', label: 'Active' },
  draft: { bg: 'bg-amber-500/15', text: 'text-amber-500', border: 'border-amber-500/30', label: 'Draft' },
  archived: { bg: 'bg-gray-500/15', text: 'text-gray-500', border: 'border-gray-500/30', label: 'Archived' },
} as const;

export function CharacterCard({ character, image, onClick, className = '' }: CharacterCardProps) {
  const { t } = useTranslation('characters');
  const status = statusConfig[character.status] || statusConfig.draft;
  
  // Format role text - truncate if too long
  const roleText = character.narrativeRole || (character.alias as string | undefined) || t('cards.noRole');
  const displayRole = roleText.length > 35 ? roleText.slice(0, 32) + '...' : roleText;
  
  // Custom card style when image is present - more like trading cards
  const hasImage = !!image;
  
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
        ${hasImage ? 'bg-ink border-2 border-accent/50' : 'bg-surface border-2 border-line'}
        shadow-card
        transition-shadow duration-300
        ${hasImage 
          ? 'group-hover:shadow-[0_20px_60px_rgba(47,111,115,0.35)]' 
          : 'group-hover:shadow-[0_12px_40px_rgba(47,111,115,0.18)]'
        }
        ${hasImage ? 'dark:group-hover:shadow-[0_20px_60px_rgba(97,165,160,0.25)]' : ''}
      `}>
        {/* Ornamental top border accent */}
        <div className={`
          absolute top-0 left-0 right-0 h-1 
          ${hasImage 
            ? 'bg-gradient-to-r from-accent/30 via-accent to-accent/30' 
            : 'bg-gradient-to-r from-transparent via-accent to-transparent opacity-60'
          }
        `} />
        
        {hasImage ? (
          // TRADING CARD STYLE with image - larger and more dramatic
          <div className="flex flex-col h-full">
            {/* Card inner border - classic card frame */}
            <div className="m-1.5 border border-accent/30 rounded-lg overflow-hidden bg-surface-2">
              {/* Image area - takes most of the card */}
              <div className="relative aspect-[3/4] overflow-hidden">
                <img
                  src={characterImageUrl(character.projectId, character.id, image.id)}
                  alt={character.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                
                {/* Top corner ornaments for card effect */}
                <div className="absolute top-1 left-1 w-3 h-3 border-t border-l border-accent/60" aria-hidden="true" />
                <div className="absolute top-1 right-1 w-3 h-3 border-t border-r border-accent/60" aria-hidden="true" />
                
                {/* Status badge - floating on image */}
                <div className="absolute top-2 right-2">
                  <span className={`
                    inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                    ${status.bg} ${status.text} border ${status.border}
                  `}>
                    {t(`status.${character.status}`)}
                  </span>
                </div>
                
                {/* Character info overlay at bottom */}
                <div className="absolute bottom-0 inset-x-0 p-2.5 text-center bg-ink/50 backdrop-blur-sm rounded-b">
                  <h3 className="font-bold text-sm text-white leading-tight drop-shadow-md">
                    {character.name}
                  </h3>
                  <p className="text-[10px] text-white/90 mt-0.5 font-medium truncate drop-shadow">
                    {displayRole}
                  </p>
                </div>
              </div>
              
              {/* Card footer strip */}
              <div className="h-1.5 bg-gradient-to-r from-accent/40 via-accent to-accent/40" />
            </div>
            
            {/* Bottom corner ornaments */}
            <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b border-l border-accent/60" aria-hidden="true" />
            <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b border-r border-accent/60" aria-hidden="true" />
          </div>
        ) : (
          // NO IMAGE - Original character card style
          <>
            {/* Inner decorative frame */}
            <div className="m-3 p-4 rounded-lg bg-surface-2/30 border border-line/50">
              {/* Avatar container with orbital decoration */}
              <div className="relative flex justify-center py-6 h-48">
                {/* Glow effect behind avatar */}
                <div 
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  aria-hidden="true"
                >
                  <div className="w-32 h-32 rounded-full bg-accent/10 blur-2xl" />
                </div>
                
                <CharacterAvatar
                  name={character.name}
                  colorPalette={character.colorPaletteJson}
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
                <h3 className="font-semibold text-lg text-ink leading-tight tracking-tight">
                  {character.name}
                </h3>
                <p className="text-sm text-muted font-medium">
                  {displayRole}
                </p>
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
          </>
        )}
      </div>
      
      {/* Hover glow effect - stronger for image cards */}
      <div 
        className={`
          absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm
          ${hasImage ? 'bg-accent/20' : 'bg-accent/5'}
        `}
        aria-hidden="true"
      />
    </button>
  );
}
