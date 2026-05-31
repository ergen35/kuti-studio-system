import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Activity, BookOpen, Boxes, Brush, ChevronLeft, Clapperboard, Clock3, FileArchive, FolderKanban, Menu, Moon, Settings, ShieldAlert, Sun, UsersRound, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router";
import { LanguageSwitcher } from "~/components/LanguageSwitcher";
import { TaskSideSheet } from "~/components/tasks";
import { Button } from "~/components/ui";
import { useTranslation } from "~/hooks/useTranslation";
import { getProjectOptions, listGenerationJobsOptions } from "~/lib/backend/@tanstack/react-query.gen";
import { useTasksStore } from "~/stores/tasks";
import { useUiStore } from "~/stores/ui";

// Mobile sidebar state hook
function useMobileSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  
  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);
  
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  return { isOpen, setIsOpen, toggle: () => setIsOpen(v => !v) };
}

interface AppShellProps {
  children?: ReactNode;
  /** Mode réduit sidebar (icônes uniquement) pour mode Orchestra */
  reducedSidebar?: boolean;
}

export function AppShell({ children, reducedSidebar }: AppShellProps) {
  const { projectId } = useParams();
  const { t } = useTranslation('common');
  const { theme, density, toggleTheme, setDensity } = useUiStore();
  const { toggleSideSheet } = useTasksStore();
  const { isOpen, setIsOpen, toggle } = useMobileSidebar();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const project = useQuery({
    ...getProjectOptions({ path: { projectId: projectId ?? '' } }),
    enabled: Boolean(projectId),
  });

  // Query running tasks count for badge
  const { data: jobs } = useQuery({
    ...listGenerationJobsOptions({ path: { projectId: projectId ?? '' } }),
    enabled: Boolean(projectId),
    refetchInterval: 15000,
  });
  const runningTaskCount = (jobs as Array<{ status: string }> | undefined)?.filter(
    (j) => j.status === 'running'
  ).length ?? 0;

  const base = projectId ? `/projects/${projectId}` : "/";

  const nav = [
    { to: "", label: t('sidebar.dashboard'), icon: FolderKanban },
    { to: "characters", label: t('sidebar.characters'), icon: UsersRound },
    { to: "story", label: t('sidebar.storyline'), icon: BookOpen },
    { to: "generation", label: t('sidebar.generation'), icon: Brush },
    { to: "drama-videos", label: t('sidebar.dramaVideos'), icon: Clapperboard },
    { to: "tasks", label: t('sidebar.tasks'), icon: Activity },
    { to: "assets", label: t('sidebar.assets'), icon: Boxes },
    { to: "exports", label: t('sidebar.exports'), icon: FileArchive },
    { to: "warnings", label: t('sidebar.warnings'), icon: ShieldAlert },
    { to: "versions", label: t('sidebar.versions'), icon: Clock3 },
    { to: "settings", label: t('sidebar.settings'), icon: Settings },
  ];

  const navClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex min-h-9 items-center gap-2.5 rounded-md border px-2.5 py-2 text-sm font-medium transition-colors",
      isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:border-primary/25 hover:bg-primary/8 hover:text-foreground",
    );

  // Handle click outside to close sidebar
  const handleOverlayClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-bg text-foreground">
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm lg:hidden"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Desktop: fixed position, Mobile: slide drawer */}
      <aside
        ref={sidebarRef}
        className={clsx(
          "fixed top-0 z-50 flex h-screen flex-col gap-5 border-r border-border bg-card/95 p-3.5 backdrop-blur transition-all duration-300 ease-out lg:sticky lg:translate-x-0",
          reducedSidebar ? "lg:w-[56px] !p-2" : "lg:w-[248px]",
          "w-[280px]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button - mobile only */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 text-muted hover:text-ink lg:hidden"
          aria-label={t('actions.close')}
        >
          <X size={20} />
        </Button>

        <div className={clsx(
          "grid gap-1 border-b border-border pb-3.5 pt-2",
          reducedSidebar ? "px-1.5 items-center" : "px-2.5"
        )}>
          <b className={clsx(
            "text-[17px] font-semibold text-foreground",
            reducedSidebar && "hidden"
          )}>{t('appName')}</b>
          <span className={clsx(
            "text-xs text-muted-foreground",
            reducedSidebar && "hidden"
          )}>{t('tagline')}</span>
          {reducedSidebar && (
            <b className="text-primary text-lg text-center">K</b>
          )}
        </div>
        
        <nav className={clsx(
          "grid gap-1.5 overflow-y-auto flex-1",
          reducedSidebar && "justify-items-center"
        )}>
          <NavLink className={navClass} to="/" end>
            <ChevronLeft size={17} />
            <span className={clsx(reducedSidebar && "hidden")}>{t('sidebar.projectHub')}</span>
          </NavLink>
          {projectId ? nav.map((item) => {
            const Icon = item.icon;
            const to = item.to ? `${base}/${item.to}` : base;
            return (
              <NavLink
                key={item.label}
                className={({ isActive }) => clsx(
                  navClass({ isActive }),
                  reducedSidebar && "!px-2 !min-w-0 w-10 h-10 justify-center"
                )}
                to={to}
                end={item.to === ""}
                title={reducedSidebar ? item.label : undefined}
              >
                <Icon size={17} />
                <span className={clsx(reducedSidebar && "hidden")}>{item.label}</span>
              </NavLink>
            );
          }) : null}
        </nav>
        
        <div className={clsx(
          "grid gap-2 border-t border-border pt-3",
          reducedSidebar && "justify-items-center"
        )}>
          <div className={clsx(reducedSidebar && "hidden")}>
            <LanguageSwitcher />
          </div>
          <Button
            variant="ghost"
            onClick={toggleTheme}
            className={clsx(
              "justify-start text-muted-foreground hover:text-foreground",
              reducedSidebar && "!px-2 !min-w-0 w-10 h-10 justify-center"
            )}
            title={reducedSidebar ? (theme === "dark" ? t('actions.light') : t('actions.dark')) : undefined}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span className={clsx("ml-2", reducedSidebar && "hidden")}>
              {theme === "dark" ? t('actions.light') : t('actions.dark')}
            </span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            className={clsx(
              "justify-start",
              reducedSidebar && "!px-2 !min-w-0 w-10 h-10 justify-center hidden"
            )}
          >
            {density === "compact" ? t('actions.comfortable') : t('actions.compact')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar with hamburger menu */}
        <div className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-bg/92 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger menu - mobile only */}
            <Button
              type="button"
              variant="ghost"
              onClick={toggle}
              className="text-foreground lg:hidden"
              aria-label={t('actions.openMenu')}
              aria-expanded={isOpen}
            >
              <Menu size={22} />
            </Button>

            <div className="min-w-0">
              <b className="block truncate text-sm font-semibold text-foreground">{project.data?.name || t('sidebar.projectHub')}</b>
              <span className="block truncate text-xs text-muted-foreground">{project.data ? `${project.data.status} · ${project.data.rootPath}` : t('workspace.backendDriven')}</span>
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Task toggle - only in project context */}
            {projectId && (
              <Button
                type="button"
                variant="ghost"
                onClick={toggleSideSheet}
                className="relative"
                title={t('tasks.openManager')}
              >
                <Activity size={18} />
                {runningTaskCount > 0 && (
                  <>
                    <span className="absolute top-1 right-1 size-2 animate-pulse rounded-full bg-primary" />
                    <span className="hidden rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary sm:inline">
                      {runningTaskCount}
                    </span>
                  </>
                )}
                <span className="hidden sm:inline text-sm">{t('sidebar.tasks')}</span>
              </Button>
            )}
            <span className="hidden rounded-md border border-border bg-card px-2 py-1 font-mono text-xs text-muted-foreground sm:block">API {import.meta.env.VITE_KUTI_API_URL || "http://127.0.0.1:8000"}</span>
          </div>
        </div>

        {/* Page content */}
        <div className="mx-auto w-full max-w-[1500px] flex-1 p-4 sm:p-5 compact:p-3">
          {children ?? <Outlet />}
        </div>
      </main>

      {/* Task Side Sheet */}
      {projectId && <TaskSideSheet />}
    </div>
  );
}
