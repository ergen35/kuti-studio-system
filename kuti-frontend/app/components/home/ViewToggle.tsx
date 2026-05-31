"use client";

import { clsx } from "clsx";
import { Grid3X3, List } from "lucide-react";
import { Button } from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";

type ViewMode = "grid" | "list";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  const { t } = useTranslation('home');
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-line bg-surface">
      <Button
        type="button"
        variant="ghost"
        onClick={() => onChange("grid")}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors",
          mode === "grid"
            ? "bg-accent text-accent-ink"
            : "text-muted hover:text-ink hover:bg-surface-2"
        )}
        title={t('view.gridTitle')}
      >
        <Grid3X3 size={16} />
        <span className="hidden sm:inline">{t('view.grid')}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => onChange("list")}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors",
          mode === "list"
            ? "bg-accent text-accent-ink"
            : "text-muted hover:text-ink hover:bg-surface-2"
        )}
        title={t('view.listTitle')}
      >
        <List size={16} />
        <span className="hidden sm:inline">{t('view.list')}</span>
      </Button>
    </div>
  );
}
