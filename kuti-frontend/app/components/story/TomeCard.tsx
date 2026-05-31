import { BookOpen, Clock, Film, Library } from 'lucide-react';
import { Badge, Button } from '~/components/ui';
import { useTranslation } from '~/hooks/useTranslation';
import type { GetStorySummaryResponse } from '~/lib/backend';

type Tome = GetStorySummaryResponse['tomes'][number];

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

export function TomeCard({ tome, tomeNumber, onClick, className = '' }: TomeCardProps) {
  const { t } = useTranslation('story');
  const formattedDate = tome.lastModified.toLocaleDateString(t('locale'), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`h-auto w-full justify-start p-0 text-left ${className}`}
      aria-label={`${t('tome.number', { number: tomeNumber })}: ${tome.title}`}
    >
      <article className="group w-full overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50 hover:bg-secondary/35">
        <div className="flex items-start gap-3 border-b border-border p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-secondary text-primary">
            <Library size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase text-primary">
                {t('tome.number', { number: tomeNumber })}
              </span>
              <Badge tone={tome.status}>{t(`status.${tome.status}`)}</Badge>
            </div>
            <h3 className="truncate text-base font-semibold text-foreground">{tome.title}</h3>
          </div>
        </div>

        <div className="grid gap-2 p-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-primary" />
            <span>{t('tome.stats.chapters', { count: tome.chapterCount })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Film size={14} className="text-primary" />
            <span>{t('tome.stats.scenes', { count: tome.sceneCount })}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 border-t border-border pt-2 text-xs">
            <Clock size={13} />
            <span>{t('tome.lastModified')}: {formattedDate}</span>
          </div>
        </div>
      </article>
    </Button>
  );
}
