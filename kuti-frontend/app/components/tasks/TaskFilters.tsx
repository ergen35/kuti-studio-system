import { clsx } from "clsx";
import { Search, X, RotateCcw } from "lucide-react";
import { Button } from "~/components/ui";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { useTranslation } from "~/hooks/useTranslation";
import {
  useTasksStore,
  type TaskPriority,
  type TaskStatus,
  type TaskType,
  type SourceKind,
} from "~/stores/tasks";
import { getStatusColor } from "~/lib/tasks/types";

const ALL_STATUSES: TaskStatus[] = [
  "pending",
  "running",
  "ready",
  "validated",
  "failed",
];
const ALL_TASK_TYPES: TaskType[] = ["technical", "editorial"];
const ALL_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "critical"];
const ALL_SOURCE_KINDS: SourceKind[] = [
  "tome",
  "chapter",
  "scene",
  "panel",
  "custom",
  "character",
];

interface TaskFiltersProps {
  compact?: boolean;
}

export function TaskFilters({ compact = false }: TaskFiltersProps) {
  const { t } = useTranslation("tasks");
  const {
    searchQuery,
    setSearchQuery,
    selectedStatuses,
    toggleStatus,
    selectAllStatuses,
    clearStatuses,
    selectedTaskTypes,
    toggleTaskType,
    selectAllTaskTypes,
    clearTaskTypes,
    selectedPriorities,
    togglePriority,
    selectAllPriorities,
    clearPriorities,
    selectedSourceKinds,
    toggleSourceKind,
    selectAllSourceKinds,
    clearSourceKinds,
  } = useTasksStore();

  const hasFilters =
    searchQuery ||
    selectedStatuses.length !== ALL_STATUSES.length ||
    selectedTaskTypes.length !== ALL_TASK_TYPES.length ||
    selectedPriorities.length !== ALL_PRIORITIES.length ||
    selectedSourceKinds.length !== ALL_SOURCE_KINDS.length;

  const clearAll = () => {
    setSearchQuery("");
    selectAllStatuses();
    selectAllTaskTypes();
    selectAllPriorities();
    selectAllSourceKinds();
  };

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder={t("search.shortPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="text-muted-foreground" />
            </Button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-1">
          {ALL_STATUSES.map((status) => (
            <Button
              type="button"
              variant="ghost"
              key={status}
              onClick={() => toggleStatus(status)}
              className={clsx(
                "h-7 px-2 text-[10px]",
                selectedStatuses.includes(status)
                  ? getStatusColor(status)
                  : "border-border bg-secondary/50 text-muted-foreground opacity-70",
              )}
            >
              {t(`status.${status}`)}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1">
          {ALL_TASK_TYPES.map((type) => (
            <Button
              type="button"
              variant="ghost"
              key={type}
              onClick={() => toggleTaskType(type)}
              className={clsx(
                "h-7 px-2 text-[10px]",
                selectedTaskTypes.includes(type)
                  ? "border-border/20 bg-primary/8 text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground opacity-70",
              )}
            >
              {t(`taskTypes.${type}`)}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Search */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          {t("search.label")}
        </label>
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder={t("search.placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {t("statusLabel")}
          </label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              onClick={selectAllStatuses}
              className="h-6 px-1 text-[10px] text-primary"
            >
              {t("filters.all")}
            </Button>
            <span className="text-muted-foreground">·</span>
            <Button
              type="button"
              variant="ghost"
              onClick={clearStatuses}
              className="h-6 px-1 text-[10px] text-muted-foreground"
            >
              {t("filters.none")}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_STATUSES.map((status) => (
            <Button
              type="button"
              variant="ghost"
              key={status}
              onClick={() => toggleStatus(status)}
              className={clsx(
                "h-7 px-2.5 text-xs",
                selectedStatuses.includes(status)
                  ? getStatusColor(status)
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/25",
              )}
            >
              {t(`status.${status}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Task type filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {t("typesLabel")}
          </label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              onClick={selectAllTaskTypes}
              className="h-6 px-1 text-[10px] text-primary"
            >
              {t("filters.all")}
            </Button>
            <span className="text-muted-foreground">·</span>
            <Button
              type="button"
              variant="ghost"
              onClick={clearTaskTypes}
              className="h-6 px-1 text-[10px] text-muted-foreground"
            >
              {t("filters.none")}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TASK_TYPES.map((type) => (
            <Button
              type="button"
              variant="ghost"
              key={type}
              onClick={() => toggleTaskType(type)}
              className={clsx(
                "h-7 px-2.5 text-xs",
                selectedTaskTypes.includes(type)
                  ? "border-border/25 bg-primary/8 text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/25",
              )}
            >
              {t(`taskTypes.${type}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* Priority filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {t("prioritiesLabel")}
          </label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              onClick={selectAllPriorities}
              className="h-6 px-1 text-[10px] text-primary"
            >
              {t("filters.all")}
            </Button>
            <span className="text-muted-foreground">·</span>
            <Button
              type="button"
              variant="ghost"
              onClick={clearPriorities}
              className="h-6 px-1 text-[10px] text-muted-foreground"
            >
              {t("filters.none")}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_PRIORITIES.map((priority) => (
            <Button
              type="button"
              variant="ghost"
              key={priority}
              onClick={() => togglePriority(priority)}
              className={clsx(
                "h-7 px-2.5 text-xs",
                selectedPriorities.includes(priority)
                  ? "border-border/25 bg-primary/8 text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/25",
              )}
            >
              {t(`priorities.${priority}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* SourceKind filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {t("typesLabel")}
          </label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              onClick={selectAllSourceKinds}
              className="h-6 px-1 text-[10px] text-primary"
            >
              {t("filters.all")}
            </Button>
            <span className="text-muted-foreground">·</span>
            <Button
              type="button"
              variant="ghost"
              onClick={clearSourceKinds}
              className="h-6 px-1 text-[10px] text-muted-foreground"
            >
              {t("filters.none")}
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {ALL_SOURCE_KINDS.map((kind) => (
            <label
              key={kind}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-primary/8"
            >
              <Checkbox
                checked={selectedSourceKinds.includes(kind)}
                onCheckedChange={() => toggleSourceKind(kind)}
              />
              <span className="text-sm text-foreground">
                {t(`sourceKinds.${kind}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear all */}
      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          onClick={clearAll}
          className="justify-start text-muted-foreground"
        >
          <RotateCcw size={14} />
          {t("filters.reset")}
        </Button>
      )}
    </div>
  );
}
