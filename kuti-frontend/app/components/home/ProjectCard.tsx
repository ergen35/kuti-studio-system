"use client";

import { clsx } from "clsx";
import {
  FolderOpen,
  Copy,
  Archive,
  Download,
  MoreHorizontal,
  BookOpen,
  FileText,
  Film,
  Users,
} from "lucide-react";
import { Button, Badge, dateLabel } from "~/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useTranslation } from "~/hooks/useTranslation";
import type { Project } from "~/lib/backend/types.gen";

interface ProjectMetrics {
  tomes: number;
  chapters: number;
  scenes: number;
  characters: number;
}

interface ProjectCardProps {
  project: Project;
  metrics: ProjectMetrics;
  onOpen: () => void;
  onQuickExport: () => void;
  onClone: () => void;
  onArchive: () => void;
  isQuickExporting?: boolean;
  viewMode: "grid" | "list";
}

export function ProjectCard({
  project,
  metrics,
  onOpen,
  onQuickExport,
  onClone,
  onArchive,
  isQuickExporting = false,
  viewMode,
}: ProjectCardProps) {
  const { t } = useTranslation("home");
  const isGrid = viewMode === "grid";
  const statusLabel =
    project.status === "active"
      ? t("projects.status.active")
      : project.status === "draft"
        ? t("projects.status.draft")
        : project.status === "archived"
          ? t("projects.status.archived")
          : t("projects.status.maintenance");

  return (
    <div
      className={clsx(
        "group relative overflow-hidden rounded-xl border border-line/50 bg-surface shadow-card transition-all duration-200",
        "hover:-translate-y-1 hover:border-accent/40 hover:shadow-elevated",
        isGrid ? "p-5" : "flex items-center gap-4 p-4",
      )}
    >
      <div
        className={clsx(
          "absolute inset-y-0 left-0 w-1 rounded-l-xl transition-all duration-200",
          project.status === "active"
            ? "bg-success group-hover:w-1.5"
            : project.status === "draft"
              ? "bg-draft"
              : "bg-muted",
        )}
      />

      <div
        className={clsx(
          isGrid ? "space-y-4" : "flex-1 flex items-center gap-6",
        )}
      >
        <div className={clsx(isGrid ? "" : "flex-1 min-w-0")}>
          <div className="flex items-start justify-between gap-2">
            <h3
              className={clsx(
                "font-semibold text-ink truncate",
                isGrid ? "text-base" : "text-sm",
              )}
            >
              {project.name}
            </h3>
            <Badge tone={project.status} className="text-[10px] uppercase">
              {statusLabel}
            </Badge>
          </div>

          <p className="text-xs text-muted mt-1 truncate">
            {isGrid ? project.rootPath : dateLabel(project.updatedAt)}
          </p>
        </div>

        <div
          className={clsx(
            "flex flex-wrap items-center gap-4 text-xs",
            isGrid ? "py-2 border-y border-line/50" : "shrink-0",
          )}
        >
          <Metric
            icon={BookOpen}
            value={metrics.tomes}
            label={t("projects.metrics.tomes")}
          />
          <Metric
            icon={FileText}
            value={metrics.chapters}
            label={t("projects.metrics.chapters")}
          />
          <Metric
            icon={Film}
            value={metrics.scenes}
            label={t("projects.metrics.scenes")}
          />
          <Metric
            icon={Users}
            value={metrics.characters}
            label={t("projects.metrics.characters")}
          />
        </div>

        <div
          className={clsx(
            isGrid
              ? "flex items-center justify-between pt-1"
              : "flex items-center gap-2 shrink-0",
          )}
        >
          {isGrid && (
            <span className="text-[10px] text-muted">
              {dateLabel(project.updatedAt)}
            </span>
          )}

          <div className="flex items-center gap-1">
            <Button
              variant="primary"
              onClick={onOpen}
              className="text-xs py-1 px-2"
            >
              <FolderOpen size={14} className="mr-1" />
              {t("projects.actions.open")}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="px-2 py-1"
                  aria-label={t("projects.actions.more")}
                >
                  <MoreHorizontal size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={onQuickExport}
                    disabled={isQuickExporting}
                  >
                    <Download size={14} />
                    {t("projects.actions.quickExport")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onClone}>
                    <Copy size={14} />
                    {t("projects.actions.clone")}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={onArchive}>
                    <Archive size={14} />
                    {t("projects.actions.archive")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof BookOpen;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-muted transition-colors duration-150 group-hover:text-ink" title={label}>
      <Icon size={12} className="text-accent/70 transition-transform duration-200 group-hover:scale-110" />
      <span className="font-medium text-ink tabular-nums">{value}</span>
      <span className="hidden sm:inline opacity-60">{label}</span>
    </div>
  );
}
