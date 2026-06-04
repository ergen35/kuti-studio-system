import { ChevronDown, ChevronUp } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";

type ReorderControlsProps = {
  entityLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  className?: string;
};

export function ReorderControls({
  entityLabel,
  canMoveUp,
  canMoveDown,
  disabled = false,
  onMoveUp,
  onMoveDown,
  className,
}: ReorderControlsProps) {
  const { t } = useTranslation("story");

  return (
    <div className={clsx("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled || !canMoveUp}
        onClick={(event) => {
          event.stopPropagation();
          onMoveUp();
        }}
        className="size-7 border border-border/70 bg-background/80 p-0 text-muted-foreground hover:border-primary/30 hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={t("reorder.up", { item: entityLabel })}
        title={t("reorder.up", { item: entityLabel })}
      >
        <ChevronUp size={14} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled || !canMoveDown}
        onClick={(event) => {
          event.stopPropagation();
          onMoveDown();
        }}
        className="size-7 border border-border/70 bg-background/80 p-0 text-muted-foreground hover:border-primary/30 hover:bg-primary/8 hover:text-primary disabled:cursor-not-allowed disabled:opacity-30"
        aria-label={t("reorder.down", { item: entityLabel })}
        title={t("reorder.down", { item: entityLabel })}
      >
        <ChevronDown size={14} />
      </Button>
    </div>
  );
}
