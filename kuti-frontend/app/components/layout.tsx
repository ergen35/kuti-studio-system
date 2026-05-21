import { BookOpen, Boxes, Brush, ChevronLeft, Clock3, FileArchive, FolderKanban, Menu, Moon, Settings, ShieldAlert, Sun, UsersRound, X } from "lucide-react";
import { NavLink, Outlet, useParams, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { type ReactNode, useState, useEffect, useRef } from "react";
import { getProjectOptions } from "~/lib/backend/@tanstack/react-query.gen";
import { useUiStore } from "~/stores/ui";
import { useTranslation } from "~/hooks/useTranslation";
import { Button } from "~/components/ui";
import { LanguageSwitcher } from "~/components/LanguageSwitcher";

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

export function AppShell({ children }: { children?: ReactNode }) {
  const { projectId } = useParams();
  const { t } = useTranslation('common');
  const { theme, density, toggleTheme, setDensity } = useUiStore();
  const { isOpen, setIsOpen, toggle } = useMobileSidebar();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const project = useQuery({
    ...getProjectOptions({ path: { projectId: projectId ?? '' } }),
    enabled: Boolean(projectId),
  });

  const base = projectId ? `/projects/${projectId}` : "/";

  const nav = [
    { to: "", label: t('sidebar.dashboard'), icon: FolderKanban },
    { to: "characters", label: t('sidebar.characters'), icon: UsersRound },
    { to: "story", label: t('sidebar.storyline'), icon: BookOpen },
    { to: "generation", label: t('sidebar.generation'), icon: Brush },
    { to: "assets", label: t('sidebar.assets'), icon: Boxes },
    { to: "exports", label: t('sidebar.exports'), icon: FileArchive },
    { to: "warnings", label: t('sidebar.warnings'), icon: ShieldAlert },
    { to: "versions", label: t('sidebar.versions'), icon: Clock3 },
    { to: "settings", label: t('sidebar.settings'), icon: Settings },
  ];

  const navClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      "flex min-h-9 items-center gap-2.5 rounded-[7px] border px-2.5 py-2 text-sm transition-colors",
      isActive ? "border-line bg-surface-2 text-ink" : "border-transparent text-muted hover:border-line hover:bg-surface-2 hover:text-ink",
    );

  // Handle click outside to close sidebar
  const handleOverlayClick = () => {
    setIsOpen(false);
  };

  return (
    <div className="min-h-screen flex">
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
          "fixed lg:sticky top-0 z-50 flex h-screen flex-col gap-5 border-r border-line bg-surface p-3.5 transition-transform duration-300 ease-out lg:translate-x-0 lg:w-[248px] w-[280px]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button - mobile only */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-3 right-3 p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-2 lg:hidden"
          aria-label={t('actions.close') || 'Fermer'}
        >
          <X size={20} />
        </button>

        <div className="grid gap-1 border-b border-line px-2.5 pb-3.5 pt-2">
          <b className="text-[17px] text-ink">{t('appName')}</b>
          <span className="text-xs text-muted">{t('tagline')}</span>
        </div>
        
        <nav className="grid gap-1.5 overflow-y-auto flex-1">
          <NavLink className={navClass} to="/" end>
            <ChevronLeft size={17} /> {t('sidebar.projectHub')}
          </NavLink>
          {projectId ? nav.map((item) => {
            const Icon = item.icon;
            const to = item.to ? `${base}/${item.to}` : base;
            return (
              <NavLink key={item.label} className={navClass} to={to} end={item.to === ""}>
                <Icon size={17} /> {item.label}
              </NavLink>
            );
          }) : null}
        </nav>
        
        <div className="grid gap-2 border-t border-line pt-3">
          <LanguageSwitcher />
          <Button variant="ghost" onClick={toggleTheme} className="justify-start">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} 
            <span className="ml-2">{theme === "dark" ? t('actions.light') : t('actions.dark')}</span>
          </Button>
          <Button variant="ghost" onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")} className="justify-start">
            {density === "compact" ? t('actions.comfortable') : t('actions.compact')}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar with hamburger menu */}
        <div className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger menu - mobile only */}
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-ink hover:bg-surface-2 lg:hidden"
              aria-label={t('actions.openMenu') || 'Ouvrir le menu'}
              aria-expanded={isOpen}
            >
              <Menu size={22} />
            </button>
            
            <div className="min-w-0">
              <b className="block truncate text-sm text-ink">{project.data?.name || t('sidebar.projectHub')}</b>
              <span className="block truncate text-xs text-muted">{project.data ? `${project.data.status} · ${project.data.rootPath}` : "Backend-driven workspace"}</span>
            </div>
          </div>
          
          <span className="hidden sm:block font-mono text-xs text-muted">API {import.meta.env.VITE_KUTI_API_URL || "http://127.0.0.1:8000"}</span>
        </div>
        
        {/* Page content */}
        <div className="flex-1 mx-auto w-full max-w-[1500px] p-4 sm:p-5 compact:p-3">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
