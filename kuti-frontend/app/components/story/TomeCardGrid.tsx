import { useTranslation } from '~/hooks/useTranslation';
import { TomeCard } from './TomeCard';
import { EmptyState, Button } from '~/components/ui';
import { Skeleton } from '~/components/ui/skeleton';
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
