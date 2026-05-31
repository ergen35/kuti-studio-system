"use client";

import { clsx } from "clsx";
import { FolderOpen, Copy, Archive, MoreHorizontal, BookOpen, Film, Users } from "lucide-react";
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
  onClone: () => void;
  onArchive: () => void;
  viewMode: "grid" | "list";
}

export function ProjectCard({
  project,
  metrics,
  onOpen,
  onClone,
  onArchive,
  viewMode,
}: ProjectCardProps) {
  const { t } = useTranslation('home');
  const isGrid = viewMode === "grid";

  return (
    <div
      className={clsx(
        "group relative overflow-hidden rounded-lg border border-border bg-card transition-colors",
        "hover:border-primary/50 hover:shadow-card",
        isGrid ? "p-4" : "flex items-center gap-4 p-3"
      )}
    >
      <div className={clsx(
        "absolute inset-y-0 left-0 w-1",
        project.status === "active" ? "bg-success" :
        project.status === "draft" ? "bg-draft" : "bg-muted"
      )} />

      <div className={clsx(isGrid ? "space-y-4" : "flex-1 flex items-center gap-6")}>
        <div className={clsx(isGrid ? "" : "flex-1 min-w-0")}>
          <div className="flex items-start justify-between gap-2">
            <h3 className={clsx(
              "font-semibold text-ink truncate",
              isGrid ? "text-base" : "text-sm"
            )}>
              {project.name}
            </h3>
            <Badge tone={project.status} className="text-[10px] uppercase">
              {project.status}
            </Badge>
          </div>
          
          <p className="text-xs text-muted mt-1 truncate">
            {isGrid ? project.rootPath : dateLabel(project.updatedAt)}
          </p>
        </div>

        <div className={clsx(
          "flex items-center gap-4 text-xs",
          isGrid ? "py-2 border-y border-line/50" : "shrink-0"
        )}>
          <Metric icon={BookOpen} value={metrics.tomes} label="Tomes" />
          <Metric icon={Film} value={metrics.scenes} label="Scènes" />
          <Metric icon={Users} value={metrics.characters} label="Persos" />
        </div>

        <div className={clsx(
          isGrid
            ? "flex items-center justify-between pt-1"
            : "flex items-center gap-2 shrink-0"
        )}>
            {isGrid && (
              <span className="text-[10px] text-muted">
                {dateLabel(project.updatedAt)}
              </span>
            )}
          
          <div className="flex items-center gap-1">
            <Button variant="primary" onClick={onOpen} className="text-xs py-1 px-2">
              <FolderOpen size={14} className="mr-1" />
              {t('projects.actions.open')}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="px-2 py-1" aria-label={t('projects.actions.more')}>
                <MoreHorizontal size={14} />
              </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuGroup>
                <DropdownMenuItem onSelect={onClone}>
                  <Copy size={14} />
                  {t('projects.actions.clone')}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onArchive}>
                  <Archive size={14} />
                  {t('projects.actions.archive')}
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

function Metric({ icon: Icon, value, label }: { icon: typeof BookOpen; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted" title={label}>
      <Icon size={12} className="text-primary/70" />
      <span className="font-medium text-ink">{value}</span>
      <span className="hidden sm:inline opacity-60">{label}</span>
    </div>
  );
}
