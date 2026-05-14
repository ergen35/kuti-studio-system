import { BookOpen, Boxes, Brush, ChevronLeft, Clock3, FileArchive, FolderKanban, Moon, Settings, ShieldAlert, Sun, UsersRound } from "lucide-react";
import { NavLink, Outlet, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <b>Kuti Studio</b>
          <span>Local narrative production</span>
        </div>
        <nav className="nav-group">
          <NavLink className="nav-link" to="/" end><ChevronLeft size={17} /> Project Hub</NavLink>
          {projectId ? nav.map((item) => {
            const Icon = item.icon;
            const to = item.to ? `${base}/${item.to}` : base;
            return <NavLink key={item.label} className="nav-link" to={to} end={item.to === ""}><Icon size={17} /> {item.label}</NavLink>;
          }) : null}
        </nav>
        <div className="sidebar-footer">
          <Button variant="ghost" onClick={toggleTheme}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light" : "Dark"}</Button>
          <Button variant="ghost" onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}>{density === "compact" ? "Comfortable" : "Compact"}</Button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">
            <b>{project.data?.name || "Project Hub"}</b>
            <span>{project.data ? `${project.data.status} · ${project.data.root_path}` : "Backend-driven workspace"}</span>
          </div>
          <span className="kbd">API {import.meta.env.VITE_KUTI_API_URL || "http://127.0.0.1:8000"}</span>
        </div>
        <div className="content">{children ?? <Outlet />}</div>
      </main>
    </div>
  );
}
