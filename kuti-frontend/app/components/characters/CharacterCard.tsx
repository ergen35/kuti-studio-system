import { ImageIcon } from 'lucide-react';
import { Badge, Button } from '~/components/ui';
import { useTranslation } from '~/hooks/useTranslation';
import { characterImageUrlFromData } from '~/lib/image-urls';
import type { ListCharactersResponse, ListCharacterImagesResponse } from '~/lib/backend';

type Character = ListCharactersResponse[number];
type CharacterImage = ListCharacterImagesResponse[number];

interface CharacterCardProps {
  character: Character;
  image?: CharacterImage | null;
  onClick?: () => void;
  className?: string;
}

function imageUrl(image: CharacterImage) {
  return characterImageUrlFromData({
    publicUrl: (image as unknown as { publicUrl?: string }).publicUrl,
    fileName: image.fileName,
    projectId: image.projectId,
    characterId: image.characterId,
    id: image.id,
  });
}

export function CharacterCard({ character, image, onClick, className = '' }: CharacterCardProps) {
  const { t } = useTranslation('characters');
  const roleText = (character.narrativeRole as string | undefined) || (character.alias as string | undefined) || t('cards.noRole');

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`h-auto w-full justify-start p-0 text-left ${className}`}
      aria-label={`${character.name} - ${roleText}`}
    >
      <article className="group w-full overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50 hover:bg-secondary/40">
        <div className="aspect-[4/3] overflow-hidden border-b border-border bg-secondary">
          {image ? (
            <img
              src={imageUrl(image)}
              alt={character.name}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <ImageIcon size={26} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground">{character.name}</h3>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{roleText}</p>
            </div>
            <Badge tone={character.status}>{t(`status.${character.status}`)}</Badge>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
            <span className="truncate font-mono">{character.slug}</span>
            <span>{t('cards.viewProfile')}</span>
          </div>
        </div>
      </article>
    </Button>
  );
}
