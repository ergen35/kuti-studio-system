import { useTranslation } from '~/hooks/useTranslation';
import { TomeCard } from './TomeCard';
import { EmptyState, Button } from '~/components/ui';
import { Plus } from 'lucide-react';
import type { GetStorySummaryResponse } from '~/lib/backend';

type Tome = GetStorySummaryResponse['tomes'][number];

interface TomeCardGridProps {
  tomes: Array<Tome & {
    chapterCount: number;
    sceneCount: number;
    lastModified: Date;
  }>;
  onSelect: (tomeId: string) => void;
  onCreate?: () => void;
  isLoading?: boolean;
}

export function TomeCardGrid({ tomes, onSelect, onCreate, isLoading }: TomeCardGridProps) {
  const { t } = useTranslation('story');
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div 
            key={i} 
            className="aspect-[16/10] rounded-lg bg-surface-2/50 border border-line animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }
  
  if (tomes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <EmptyState 
          title={t('empty.noTome.title')} 
          description={t('empty.noTome.description')} 
        />
        {onCreate && (
          <Button variant="primary" onClick={onCreate} className="mt-6">
            <Plus size={16} /> {t('actions.addTome')}
          </Button>
        )}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {tomes.map((tome, index) => (
        <TomeCard
          key={tome.id}
          tome={tome}
          tomeNumber={index + 1}
          onClick={() => onSelect(tome.id)}
        />
      ))}
    </div>
  );
}
