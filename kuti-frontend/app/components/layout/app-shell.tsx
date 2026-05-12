import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useNavigation, useParams, NavLink, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Command, Home, Menu, MoonStar, PanelRightClose, PanelRightOpen, Search, Settings2, SunMedium, WandSparkles, X } from "lucide-react";
import { getHubSummary, getProjects } from "../../lib/api";
import { cn } from "../../lib/cn";
import { formatDate, formatRelative } from "../../lib/format";
import { hubCommands, projectSections } from "../../lib/navigation";
import { useUiStore } from "../../stores/ui";
import { Badge, Button, Card, SearchField } from "../ui";

function isProjectRoute(pathname: string) {
  return pathname.startsWith("/projects/");
}

function getProjectPath(projectId: string | undefined, sectionPath = "") {
  if (!projectId) {
    return "/";
  }

  return sectionPath ? `/projects/${projectId}/${sectionPath}` : `/projects/${projectId}`;
}

type MobileNavItem =
  | {
      label: string;
      href: string;
      icon: ReactNode;
    }
  | {
      label: string;
      action: () => void;
      icon: ReactNode;
    };

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const params = useParams();
  const projectId = params.projectId;
  const [commandQuery, setCommandQuery] = useState("");
  const commandDialogRef = useRef<HTMLDialogElement>(null);
  const mobileDialogRef = useRef<HTMLDialogElement>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
  });

  const { data: summary } = useQuery({
    queryKey: ["hub-summary"],
    queryFn: getHubSummary,
  });

  const activeProject = projects.find((project) => project.id === projectId) ?? projects[0];
  const {
    theme,
    density,
    commandPaletteOpen,
    mobileNavOpen,
    inspectorPinned,
    openCommandPalette,
    toggleTheme,
    toggleDensity,
    closeCommandPalette,
    closeMobileNav,
    openMobileNav,
    toggleInspectorPinned,
  } = useUiStore();

  const progressVisible = navigation.state !== "idle";
  const pathLabel = location.pathname === "/" ? "Project Hub" : projectSections.find((section) => location.pathname.includes(section.path || "dashboard"))?.label ?? "Workspace";
  const visibleCommands = hubCommands.filter((command) => command.toLowerCase().includes(commandQuery.toLowerCase()));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-density", density);
  }, [density, theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.matches("input, textarea, [contenteditable='true']");

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
      }

      if (event.key === "/" && !editable) {
        event.preventDefault();
        openCommandPalette();
      }

      if (event.key === "Escape") {
        closeCommandPalette();
        closeMobileNav();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeCommandPalette, closeMobileNav, openCommandPalette]);

  useEffect(() => {
    if (commandPaletteOpen) {
      commandDialogRef.current?.showModal();
    } else if (commandDialogRef.current?.open) {
      commandDialogRef.current.close();
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (mobileNavOpen) {
      mobileDialogRef.current?.showModal();
    } else if (mobileDialogRef.current?.open) {
      mobileDialogRef.current.close();
    }
  }, [mobileNavOpen]);

  function runCommand(command: string) {
    if (command === "Open project hub") {
      navigate("/");
    } else if (command === "Create new project") {
      navigate("/projects/moon-docks/settings");
    } else if (command === "Import project folder") {
      navigate("/");
    } else if (command === "Open characters workspace") {
      navigate(getProjectPath(activeProject?.id, "characters"));
    } else if (command === "Open story workspace") {
      navigate(getProjectPath(activeProject?.id, "story"));
    } else if (command === "Open generation studio") {
      navigate(getProjectPath(activeProject?.id, "generation"));
    } else if (command === "Open asset library") {
      navigate(getProjectPath(activeProject?.id, "assets"));
    } else if (command === "Open warnings center") {
      navigate(getProjectPath(activeProject?.id, "warnings"));
    } else if (command === "Open version history") {
      navigate(getProjectPath(activeProject?.id, "versions"));
    } else if (command === "Open project settings") {
      navigate(getProjectPath(activeProject?.id, "settings"));
    } else if (command === "Toggle theme") {
      toggleTheme();
    } else if (command === "Toggle density") {
      toggleDensity();
    }

    closeCommandPalette();
  }

  const shellSections = isProjectRoute(location.pathname)
    ? projectSections.map((section) => ({ ...section, href: getProjectPath(activeProject?.id, section.path) }))
    : projects.map((project) => ({
        label: project.name,
        href: `/projects/${project.id}`,
        description: project.summary,
        accent: project.accent,
      }));

  const inspectorProject = isProjectRoute(location.pathname) ? activeProject : projects[0];
  const mobileNavItems: MobileNavItem[] = isProjectRoute(location.pathname)
    ? [
        { label: "Hub", href: "/", icon: <Home className="h-4 w-4" /> },
        { label: "Project", href: getProjectPath(activeProject?.id), icon: <Command className="h-4 w-4" /> },
        { label: "Search", action: openCommandPalette, icon: <Search className="h-4 w-4" /> },
        { label: "Menu", action: openMobileNav, icon: <Menu className="h-4 w-4" /> },
      ]
    : [
        { label: "Hub", href: "/", icon: <Home className="h-4 w-4" /> },
        { label: "Search", action: openCommandPalette, icon: <Search className="h-4 w-4" /> },
        { label: "Menu", action: openMobileNav, icon: <Menu className="h-4 w-4" /> },
      ];

  return (
    <div className="relative min-h-screen overflow-hidden text-[rgb(var(--foreground))]">
      {progressVisible ? <div className="fixed left-0 top-0 z-50 h-0.5 w-full bg-gradient-to-r from-transparent via-[rgb(var(--primary))] to-transparent" /> : null}

      <div className="mx-auto flex min-h-screen max-w-[100rem] flex-col lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_18rem] lg:gap-4 lg:p-4">
        <aside className="kuti-panel relative hidden min-h-0 flex-col overflow-hidden rounded-none border-0 bg-[rgb(var(--kuti-sidebar))] lg:flex lg:rounded-3xl lg:border">
          <div className="border-b border-[rgb(var(--border)/0.7)] p-4">
            <Link to="/" className="group flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] text-[rgb(var(--primary))] shadow-sm transition group-hover:translate-y-[-1px]">
                <WandSparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.26em] text-[rgb(var(--muted-foreground))]">Kuti Studio</div>
                <div className="text-sm font-semibold text-[rgb(var(--foreground))]">Editorial production workspace</div>
              </div>
            </Link>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div className="space-y-2">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Navigation</div>
              <nav className="space-y-1">
                <NavLink to="/" className={({ isActive }) => cn("flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition", isActive ? "border-[rgb(var(--primary)/0.35)] bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--foreground))]" : "border-transparent bg-transparent text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--kuti-surface-1))] hover:text-[rgb(var(--foreground))]") }>
                  <span>Project Hub</span>
                  <ArrowRight className="h-4 w-4" />
                </NavLink>
                <NavLink to={getProjectPath(activeProject?.id)} className={({ isActive }) => cn("flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition", isActive ? "border-[rgb(var(--primary)/0.35)] bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--foreground))]" : "border-transparent bg-transparent text-[rgb(var(--muted-foreground))] hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--kuti-surface-1))] hover:text-[rgb(var(--foreground))]") }>
                  <span>Project dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </NavLink>
              </nav>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
              <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">{isProjectRoute(location.pathname) ? "Project sections" : "Recent projects"}</div>
              <div className="kuti-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {shellSections.map((item) => (
                  <Link key={item.href} to={item.href} className={cn("group rounded-2xl border p-3 transition", item.href === location.pathname ? "border-[rgb(var(--primary)/0.35)] bg-[rgb(var(--primary)/0.08)]" : "border-[rgb(var(--border)/0.7)] bg-[rgb(var(--kuti-surface-1))] hover:border-[rgb(var(--border))]") }>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-[rgb(var(--foreground))]">{item.label}</div>
                      {"accent" in item ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.accent }} /> : <ArrowRight className="h-4 w-4 text-[rgb(var(--muted-foreground))] transition group-hover:translate-x-0.5" />}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[rgb(var(--muted-foreground))]">{item.description}</div>
                  </Link>
                ))}
              </div>
            </div>

            <Card className="space-y-3 border-[rgb(var(--border)/0.7)] bg-[rgb(var(--kuti-surface-1)/0.9)]" padding="md">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Workspace</div>
                  <div className="mt-1 text-sm font-semibold">{activeProject?.name ?? "No project"}</div>
                </div>
                {activeProject ? <Badge tone={activeProject.status === "active" ? "active" : activeProject.status === "draft" ? "draft" : "archived"}>{activeProject.status}</Badge> : null}
              </div>
              <div className="space-y-2 text-xs text-[rgb(var(--muted-foreground))]">
                <div className="flex items-center justify-between"><span>Last update</span><span className="font-mono text-[rgb(var(--foreground))]">{activeProject ? formatRelative(activeProject.lastUpdated) : "-"}</span></div>
                <div className="flex items-center justify-between"><span>Theme</span><span className="font-mono text-[rgb(var(--foreground))]">{theme}</span></div>
                <div className="flex items-center justify-between"><span>Density</span><span className="font-mono text-[rgb(var(--foreground))]">{density}</span></div>
              </div>
            </Card>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          <header className="sticky top-0 z-30 border-b border-[rgb(var(--border)/0.72)] bg-[rgb(var(--background)/0.88)] px-4 py-3 backdrop-blur lg:top-4 lg:rounded-t-3xl lg:border lg:border-b-0 lg:bg-[rgb(var(--kuti-surface-1)/0.8)] lg:px-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 lg:hidden">
                <Button variant="ghost" size="sm" UNSAFE_className="border-[rgb(var(--border))]" onClick={openMobileNav} aria-label="Open navigation">
                  <Menu className="h-4 w-4" />
                </Button>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Kuti Studio</div>
                  <div className="text-sm font-semibold">{pathLabel}</div>
                </div>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] text-[rgb(var(--primary))]">
                  <Command className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">{isProjectRoute(location.pathname) ? "Project workspace" : "Studio hub"}</div>
                  <div className="text-base font-semibold">{isProjectRoute(location.pathname) ? activeProject?.name ?? "Project" : "Project Hub"}</div>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    openCommandPalette();
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] px-3 py-2 text-left text-sm text-[rgb(var(--muted-foreground))] transition hover:border-[rgb(var(--primary)/0.32)] hover:text-[rgb(var(--foreground))] lg:max-w-xl"
                >
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="truncate">Search projects, scenes, warnings, exports</span>
                  <kbd className="ml-auto hidden rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--muted-foreground))] lg:inline-flex">Ctrl K</kbd>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" UNSAFE_className="border-[rgb(var(--border))]" onClick={toggleTheme} aria-label="Toggle theme">
                  {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" UNSAFE_className="border-[rgb(var(--border))]" onClick={toggleDensity}>
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{density}</span>
                </Button>
                <Button variant="ghost" size="sm" UNSAFE_className="border-[rgb(var(--border))] lg:hidden" onClick={toggleInspectorPinned}>
                  {inspectorPinned ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 px-4 pb-24 pt-4 lg:px-5 lg:pb-20 lg:pt-0">
            <div className="min-h-full rounded-b-3xl border border-[rgb(var(--border)/0.72)] bg-[rgb(var(--kuti-canvas)/0.82)] p-3 shadow-[0_34px_88px_-54px_rgba(15,23,42,0.35)] lg:p-5">
              {children}
            </div>
          </main>
        </div>

        <aside className={cn("kuti-panel relative hidden min-h-0 flex-col overflow-hidden rounded-none border-0 bg-[rgb(var(--kuti-inspector))] lg:flex lg:rounded-3xl lg:border", !inspectorPinned && "lg:hidden") }>
          <div className="border-b border-[rgb(var(--border)/0.7)] p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))]">Inspector</div>
            <div className="mt-1 text-base font-semibold">Contextual detail</div>
          </div>
          <div className="kuti-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <Card padding="md" className="space-y-4 border-[rgb(var(--border)/0.7)] bg-[rgb(var(--kuti-surface-1)/0.88)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">{isProjectRoute(location.pathname) ? "Current project" : "Hub overview"}</div>
                  <div className="mt-1 text-lg font-semibold">{inspectorProject?.name ?? "No project loaded"}</div>
                </div>
                {inspectorProject ? <Badge tone={inspectorProject.status === "active" ? "active" : inspectorProject.status === "draft" ? "draft" : "archived"}>{inspectorProject.status}</Badge> : null}
              </div>
              <p className="text-sm leading-6 text-[rgb(var(--muted-foreground))]">{inspectorProject?.summary ?? "Open a project to inspect characters, scenes, generation jobs, and validation state in one place."}</p>
            </Card>

            {inspectorProject ? (
              <>
                <Card padding="md" className="space-y-4 border-[rgb(var(--border)/0.7)] bg-[rgb(var(--kuti-surface-1)/0.88)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Health</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between"><span>Progress</span><span className="font-mono">{inspectorProject.progress}%</span></div>
                    <div className="h-2 rounded-full bg-[rgb(var(--muted))]"><div className="h-2 rounded-full bg-[rgb(var(--primary))]" style={{ width: `${inspectorProject.progress}%` }} /></div>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-2"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Warnings</div><div className="mt-1 text-base font-semibold">{inspectorProject.stats.warnings}</div></div>
                      <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-2"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Jobs</div><div className="mt-1 text-base font-semibold">{inspectorProject.stats.jobs}</div></div>
                    </div>
                  </div>
                </Card>

                <Card padding="md" className="space-y-4 border-[rgb(var(--border)/0.7)] bg-[rgb(var(--kuti-surface-1)/0.88)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Activity</div>
                  <div className="space-y-2">
                    {inspectorProject.activity.slice(0, 3).map((item) => (
                      <div key={item} className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-3 text-sm leading-6 text-[rgb(var(--foreground))]">{item}</div>
                    ))}
                  </div>
                </Card>

                <Card padding="md" className="space-y-4 border-[rgb(var(--border)/0.7)] bg-[rgb(var(--kuti-surface-1)/0.88)]">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">System</div>
                  <div className="space-y-2 text-sm text-[rgb(var(--muted-foreground))]">
                    <div className="flex items-center justify-between"><span>Last saved</span><span className="font-mono text-[rgb(var(--foreground))]">{formatDate(inspectorProject.lastUpdated)}</span></div>
                    <div className="flex items-center justify-between"><span>Project ID</span><span className="font-mono text-[rgb(var(--foreground))]">{inspectorProject.id}</span></div>
                    <div className="flex items-center justify-between"><span>Language</span><span className="font-mono text-[rgb(var(--foreground))]">{inspectorProject.language}</span></div>
                  </div>
                </Card>
              </>
            ) : summary ? (
              <Card padding="md" className="space-y-4 border-[rgb(var(--border)/0.7)] bg-[rgb(var(--kuti-surface-1)/0.88)]">
                <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Hub summary</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-2"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Projects</div><div className="mt-1 text-base font-semibold">{summary.projects}</div></div>
                  <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-2"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Active</div><div className="mt-1 text-base font-semibold">{summary.activeProjects}</div></div>
                  <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-2"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Warnings</div><div className="mt-1 text-base font-semibold">{summary.warnings}</div></div>
                  <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-2))] p-2"><div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))]">Jobs</div><div className="mt-1 text-base font-semibold">{summary.runningJobs}</div></div>
                </div>
              </Card>
            ) : null}
          </div>
        </aside>
      </div>

      <footer className="hidden border-t border-[rgb(var(--border)/0.75)] bg-[rgb(var(--background)/0.94)] px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--muted-foreground))] backdrop-blur lg:fixed lg:inset-x-4 lg:bottom-0 lg:z-20 lg:block lg:rounded-b-3xl lg:border lg:border-t lg:bg-[rgb(var(--kuti-surface-1)/0.86)]">
          <div className="mx-auto flex max-w-[100rem] items-center justify-between gap-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex items-center gap-2"><Check className="h-3.5 w-3.5" /> Local workspace ready</span>
            <span className="hidden sm:inline">{navigation.state === "idle" ? "Idle" : "Synchronizing"}</span>
          </div>
          <div className="flex min-w-0 items-center gap-3 font-mono normal-case tracking-normal sm:gap-4">
            <span>{activeProject ? `${activeProject.name} · ${activeProject.stats.characters} chars` : "Hub mode"}</span>
            <button type="button" onClick={() => commandDialogRef.current?.showModal()} className="inline-flex items-center gap-2 text-[rgb(var(--foreground))] transition hover:text-[rgb(var(--primary))]">
              <Command className="h-3.5 w-3.5" /> Command palette
            </button>
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgb(var(--border)/0.8)] bg-[rgb(var(--background)/0.96)] px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {mobileNavItems.map((item) =>
            "href" in item ? (
              <Link
                key={item.label}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-[10px] font-medium uppercase tracking-[0.18em] transition",
                  item.href === location.pathname
                    ? "border-[rgb(var(--primary)/0.28)] bg-[rgb(var(--primary)/0.1)] text-[rgb(var(--foreground))]"
                    : "border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] text-[rgb(var(--muted-foreground))]",
                )}
              >
                <span className="text-[rgb(var(--foreground))]">{item.icon}</span>
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] px-2 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--muted-foreground))] transition"
              >
                <span className="text-[rgb(var(--foreground))]">{item.icon}</span>
                {item.label}
              </button>
            ),
          )}
        </div>
      </nav>

      <dialog
        ref={commandDialogRef}
        className="kuti-command-dialog w-[min(92vw,44rem)] rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--popover))] p-0 text-[rgb(var(--popover-foreground))] shadow-[0_50px_120px_-45px_rgba(15,23,42,0.62)]"
        onClose={() => closeCommandPalette()}
      >
          <div className="border-b border-[rgb(var(--border))] p-4">
            <div className="flex items-center gap-3">
              <SearchField
                label={<span className="sr-only">Search commands</span>}
                placeholder="Type a command, project, or section"
                onChange={setCommandQuery}
                UNSAFE_className="w-full"
                autoFocus
              />
              <button type="button" onClick={() => closeCommandPalette()} className="rounded-full p-1 text-[rgb(var(--muted-foreground))] transition hover:bg-[rgb(var(--muted))] hover:text-[rgb(var(--foreground))]">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        <div className="kuti-scrollbar max-h-[60vh] overflow-y-auto p-3">
          <div className="grid gap-2">
            {(visibleCommands.length > 0 ? visibleCommands : hubCommands).map((command) => (
              <button
                key={command}
                type="button"
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                  command === visibleCommands[0] ? "border-[rgb(var(--primary)/0.4)] bg-[rgb(var(--primary)/0.08)]" : "border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] hover:border-[rgb(var(--primary)/0.22)]",
                )}
                onClick={() => runCommand(command)}
              >
                <span className="text-sm font-medium text-[rgb(var(--foreground))]">{command}</span>
                <span className="text-xs text-[rgb(var(--muted-foreground))]">Enter</span>
              </button>
            ))}
          </div>
        </div>
      </dialog>

      <dialog ref={mobileDialogRef} className="kuti-mobile-dialog w-[min(90vw,24rem)] rounded-3xl border border-[rgb(var(--border))] bg-[rgb(var(--popover))] p-0 shadow-[0_50px_120px_-45px_rgba(15,23,42,0.62)] lg:hidden" onClose={() => closeMobileNav()}>
        <div className="flex items-center justify-between border-b border-[rgb(var(--border))] p-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[rgb(var(--muted-foreground))]">Navigation</div>
            <div className="text-sm font-semibold">Kuti Studio</div>
          </div>
          <Button variant="ghost" size="sm" UNSAFE_className="border-[rgb(var(--border))]" onClick={closeMobileNav}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="kuti-scrollbar max-h-[75vh] overflow-y-auto p-4">
          <nav className="space-y-2">
            <Link to="/" onClick={closeMobileNav} className="block rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] px-4 py-3 text-sm font-medium">Project Hub</Link>
            {shellSections.map((item) => (
              <Link key={item.href} to={item.href} onClick={closeMobileNav} className="block rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--kuti-surface-1))] px-4 py-3 text-sm font-medium">
                <div className="flex items-center justify-between gap-2">
                  <span>{item.label}</span>
                  <ArrowRight className="h-4 w-4 text-[rgb(var(--muted-foreground))]" />
                </div>
                <div className="mt-1 text-xs text-[rgb(var(--muted-foreground))]">{item.description}</div>
              </Link>
            ))}
          </nav>
        </div>
      </dialog>
    </div>
  );
}
