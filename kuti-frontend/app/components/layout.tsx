import { BookOpen, Boxes, Brush, ChevronLeft, Clock3, FileArchive, FolderKanban, Moon, Settings, ShieldAlert, Sun, UsersRound } from "lucide-react";
import { NavLink, Outlet, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { api } from "~/lib/api";
import { keys } from "~/lib/query";
import { useUiStore } from "~/stores/ui";
import { Button } from "~/components/ui";

const nav = [
  { to: "", label: "Dashboard", icon: FolderKanban },
  { to: "characters", label: "Characters", icon: UsersRound },
  { to: "story", label: "Storyline", icon: BookOpen },
  { to: "generation", label: "Generation", icon: Brush },
  { to: "assets", label: "Assets", icon: Boxes },
  { to: "exports", label: "Exports", icon: FileArchive },
  { to: "warnings", label: "Warnings", icon: ShieldAlert },
  { to: "versions", label: "Versions", icon: Clock3 },
  { to: "settings", label: "Settings", icon: Settings },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    "flex min-h-9 items-center gap-2.5 rounded-[7px] border px-2.5 py-2 text-sm transition-colors",
    isActive ? "border-line bg-surface-2 text-ink" : "border-transparent text-muted hover:border-line hover:bg-surface-2 hover:text-ink",
  );

export function AppShell({ children }: { children?: ReactNode }) {
  const { projectId } = useParams();
  const { theme, density, toggleTheme, setDensity } = useUiStore();
  const project = useQuery({
    queryKey: projectId ? keys.project(projectId) : ["no-project"],
    queryFn: () => api.project(projectId!),
    enabled: Boolean(projectId),
  });

  const base = projectId ? `/projects/${projectId}` : "/";

  return (
    <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] max-lg:grid-cols-1">
      <aside className="sticky top-0 flex h-screen flex-col gap-5 border-r border-line bg-surface/90 p-3.5 max-lg:relative max-lg:h-auto max-lg:border-b max-lg:border-r-0">
        <div className="grid gap-1 border-b border-line px-2.5 pb-3.5 pt-2">
          <b className="text-[17px] text-ink">Kuti Studio</b>
          <span className="text-xs text-muted">Local narrative production</span>
        </div>
        <nav className="grid gap-1.5 max-lg:grid-cols-2">
          <NavLink className={navClass} to="/" end><ChevronLeft size={17} /> Project Hub</NavLink>
          {projectId ? nav.map((item) => {
            const Icon = item.icon;
            const to = item.to ? `${base}/${item.to}` : base;
            return <NavLink key={item.label} className={navClass} to={to} end={item.to === ""}><Icon size={17} /> {item.label}</NavLink>;
          }) : null}
        </nav>
        <div className="mt-auto grid gap-2">
          <Button variant="ghost" onClick={toggleTheme}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light" : "Dark"}</Button>
          <Button variant="ghost" onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}>{density === "compact" ? "Comfortable" : "Compact"}</Button>
        </div>
      </aside>
      <main className="min-w-0">
        <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-line bg-bg/90 px-5 py-2.5 backdrop-blur max-sm:grid">
          <div className="min-w-0">
            <b className="block truncate text-sm text-ink">{project.data?.name || "Project Hub"}</b>
            <span className="block truncate text-xs text-muted">{project.data ? `${project.data.status} · ${project.data.root_path}` : "Backend-driven workspace"}</span>
          </div>
          <span className="font-mono text-xs text-muted">API {import.meta.env.VITE_KUTI_API_URL || "http://127.0.0.1:8000"}</span>
        </div>
        <div className="mx-auto max-w-[1500px] p-5 compact:p-4">{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
