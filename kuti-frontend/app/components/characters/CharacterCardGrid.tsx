import { useTranslation } from '~/hooks/useTranslation';
import { CharacterCard } from './CharacterCard';
import { EmptyState, Button } from '~/components/ui';
import { Plus } from 'lucide-react';
import type { Character } from '~/lib/api';

interface CharacterCardGridProps {
  characters: Character[];
  onSelect: (character: Character) => void;
  onCreate?: () => void;
  isLoading?: boolean;
}

export function CharacterCardGrid({ characters, onSelect, onCreate, isLoading }: CharacterCardGridProps) {
  const { t } = useTranslation('characters');
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i} 
            className="aspect-[3/4] rounded-xl bg-surface-2/50 border border-line animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }
  
  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <EmptyState 
          title={t('empty.noCharacter.title')} 
          description={t('empty.noCharacter.description')} 
        />
        {onCreate && (
          <Button variant="primary" onClick={onCreate} className="mt-6">
            <Plus size={16} /> {t('actions.addCharacter')}
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          onClick={() => onSelect(character)}
        />
      ))}
    </div>
  );
}
