import { ImageIcon } from "lucide-react";
import { Badge, Button } from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";
import { characterImageUrlFromData } from "~/lib/image-urls";
import type {
  ListCharactersResponse,
  ListCharacterImagesResponse,
} from "~/lib/backend";

type Character = ListCharactersResponse[number];
type CharacterImage = ListCharacterImagesResponse[number];

interface CharacterCardProps {
  character: Character;
  image?: CharacterImage | null;
  narrativeRoleLabel?: string;
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

export function CharacterCard({
  character,
  image,
  narrativeRoleLabel,
  onClick,
  className = "",
}: CharacterCardProps) {
  const { t } = useTranslation("characters");
  const roleText = narrativeRoleLabel || (character.narrativeRole as string | undefined) || t("cards.noRole");

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`h-auto w-full justify-start p-0 text-left ${className}`}
      aria-label={`${character.name} - ${roleText}`}
    >
      <article className="group w-full overflow-hidden rounded-xl border border-line/50 bg-surface shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-accent/40 hover:shadow-elevated">
        <div className="aspect-[4/3] overflow-hidden border-b border-line/30 bg-surface-2">
          {image ? (
            <img
              src={imageUrl(image)}
              alt={character.name}
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted">
              <ImageIcon size={26} className="transition-transform duration-200 group-hover:scale-110" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-ink transition-colors duration-150 group-hover:text-accent">
                {character.name}
              </h3>
              <p className="mt-0.5 truncate text-xs text-muted">
                {roleText}
              </p>
            </div>
            <Badge tone={character.status} className="transition-transform duration-150 group-hover:scale-105">
              {t(`status.${character.status}`)}
            </Badge>
          </div>
          <div className="flex items-center justify-between border-t border-line/40 pt-2 text-[11px] text-muted">
            <span className="truncate font-mono">{character.slug}</span>
            <span className="transition-colors duration-150 group-hover:text-accent">{t("cards.viewProfile")}</span>
          </div>
        </div>
      </article>
    </Button>
  );
}
