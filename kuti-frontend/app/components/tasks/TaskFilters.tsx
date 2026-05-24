import { clsx } from "clsx";
import { Search, X, RotateCcw } from "lucide-react";
import { useTasksStore, type TaskStatus, type SourceKind } from "~/stores/tasks";
import { getStatusColor, getStatusLabel } from "~/lib/tasks/types";

const ALL_STATUSES: TaskStatus[] = ["pending", "running", "ready", "validated", "failed"];
const ALL_SOURCE_KINDS: SourceKind[] = ["tome", "chapter", "scene", "panel", "custom", "character"];

const SOURCE_KIND_LABELS: Record<SourceKind, string> = {
  tome: "Tome",
  chapter: "Chapitre",
  scene: "Scène",
  panel: "Panel",
  custom: "Personnalisé",
  character: "Personnage",
};

interface TaskFiltersProps {
  compact?: boolean;
}

export function TaskFilters({ compact = false }: TaskFiltersProps) {
  const {
    searchQuery,
    setSearchQuery,
    selectedStatuses,
    toggleStatus,
    selectAllStatuses,
    clearStatuses,
    selectedSourceKinds,
    toggleSourceKind,
    selectAllSourceKinds,
    clearSourceKinds,
  } = useTasksStore();

  const hasFilters =
    searchQuery ||
    selectedStatuses.length !== ALL_STATUSES.length ||
    selectedSourceKinds.length !== ALL_SOURCE_KINDS.length;

  const clearAll = () => {
    setSearchQuery("");
    selectAllStatuses();
    selectAllSourceKinds();
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-surface border border-line rounded-lg focus:outline-none focus:border-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-2"
            >
              <X size={12} className="text-muted" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-1">
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={clsx(
                "px-2 py-1 text-[10px] font-medium rounded-full border transition-colors",
                selectedStatuses.includes(status)
                  ? getStatusColor(status)
                  : "text-muted bg-surface-2 border-transparent opacity-50"
              )}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink">Recherche</label>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            placeholder="Rechercher par titre, type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-surface border border-line rounded-lg focus:outline-none focus:border-accent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-surface-2"
            >
              <X size={14} className="text-muted" />
            </button>
          )}
        </div>
      </div>

      {/* Status filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-ink">Statuts</label>
          <div className="flex items-center gap-1">
            <button
              onClick={selectAllStatuses}
              className="text-[10px] text-accent hover:underline"
            >
              Tous
            </button>
            <span className="text-muted">·</span>
            <button
              onClick={clearStatuses}
              className="text-[10px] text-muted hover:underline"
            >
              Aucun
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={clsx(
                "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
                selectedStatuses.includes(status)
                  ? getStatusColor(status)
                  : "text-muted bg-surface-2 border-line/50 hover:border-line"
              )}
            >
              {getStatusLabel(status)}
            </button>
          ))}
        </div>
      </div>

      {/* SourceKind filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-ink">Types</label>
          <div className="flex items-center gap-1">
            <button
              onClick={selectAllSourceKinds}
              className="text-[10px] text-accent hover:underline"
            >
              Tous
            </button>
            <span className="text-muted">·</span>
            <button
              onClick={clearSourceKinds}
              className="text-[10px] text-muted hover:underline"
            >
              Aucun
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          {ALL_SOURCE_KINDS.map((kind) => (
            <label
              key={kind}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedSourceKinds.includes(kind)}
                onChange={() => toggleSourceKind(kind)}
                className="rounded border-line text-accent focus:ring-accent"
              />
              <span className="text-sm text-ink">{SOURCE_KIND_LABELS[kind]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear all */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-2 text-sm text-muted hover:text-ink transition-colors"
        >
          <RotateCcw size={14} />
          Réinitialiser les filtres
        </button>
      )}
    </div>
  );
}
