"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { FolderOpen, Copy, Archive, MoreHorizontal, BookOpen, Film, Users } from "lucide-react";
import { Button, Badge, dateLabel } from "~/components/ui";
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
  const [showActions, setShowActions] = useState(false);

  const isGrid = viewMode === "grid";

  return (
    <div
      className={clsx(
        "group relative rounded-xl border bg-surface/90 backdrop-blur-sm transition-all duration-200",
        "hover:border-accent/60 hover:shadow-lg hover:-translate-y-0.5",
        isGrid ? "p-5" : "p-4 flex items-center gap-4"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Status indicator */}
      <div className={clsx(
        "absolute top-0 left-0 w-1 h-full rounded-l-xl",
        project.status === "active" ? "bg-success" : 
        project.status === "draft" ? "bg-draft" : "bg-muted"
      )} />

      <div className={clsx(isGrid ? "space-y-4" : "flex-1 flex items-center gap-6")}>
        {/* Header */}
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

        {/* Metrics */}
        <div className={clsx(
          "flex items-center gap-4 text-xs",
          isGrid ? "py-2 border-y border-line/50" : "shrink-0"
        )}>
          <Metric icon={BookOpen} value={metrics.tomes} label="Tomes" />
          <Metric icon={Film} value={metrics.scenes} label="Scènes" />
          <Metric icon={Users} value={metrics.characters} label="Persos" />
        </div>

        {/* Footer / Actions */}
        <div className={clsx(
          isGrid 
            ? "flex items-center justify-between pt-2" 
            : "flex items-center gap-2 shrink-0"
        )}>
            {isGrid && (
              <span className="text-[10px] text-muted">
                {dateLabel(project.updatedAt)}
              </span>
            )}
          
          <div className={clsx(
            "flex items-center gap-1 transition-opacity",
            isGrid && !showActions ? "opacity-0 group-hover:opacity-100" : ""
          )}>
            <Button variant="primary" onClick={onOpen} className="text-xs py-1 px-2">
              <FolderOpen size={14} className="mr-1" />
              Ouvrir
            </Button>
            
            <div className="relative group/menu">
              <Button variant="ghost" className="px-2 py-1">
                <MoreHorizontal size={14} />
              </Button>
              
              <div className="absolute right-0 bottom-full mb-1 w-36 py-1 rounded-lg border border-line bg-surface shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10">
                <button
                  onClick={onClone}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-surface-2"
                >
                  <Copy size={14} />
                  Dupliquer
                </button>
                <button
                  onClick={onArchive}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10"
                >
                  <Archive size={14} />
                  Archiver
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, value, label }: { icon: typeof BookOpen; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-muted" title={label}>
      <Icon size={12} className="text-accent/70" />
      <span className="font-medium text-ink">{value}</span>
      <span className="hidden sm:inline opacity-60">{label}</span>
    </div>
  );
}
