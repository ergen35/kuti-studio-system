"use client";

import { clsx } from "clsx";
import { Grid3X3, List } from "lucide-react";

type ViewMode = "grid" | "list";

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ mode, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-line bg-surface">
      <button
        onClick={() => onChange("grid")}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors",
          mode === "grid"
            ? "bg-accent text-accent-ink"
            : "text-muted hover:text-ink hover:bg-surface-2"
        )}
        title="Vue grille"
      >
        <Grid3X3 size={16} />
        <span className="hidden sm:inline">Grille</span>
      </button>
      <button
        onClick={() => onChange("list")}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium transition-colors",
          mode === "list"
            ? "bg-accent text-accent-ink"
            : "text-muted hover:text-ink hover:bg-surface-2"
        )}
        title="Vue liste"
      >
        <List size={16} />
        <span className="hidden sm:inline">Liste</span>
      </button>
    </div>
  );
}
