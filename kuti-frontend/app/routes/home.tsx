import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Archive, Copy, Database, FolderOpen, Plus, RefreshCw, Server } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Badge, Button, Card, dateLabel, EmptyState, ErrorState, Field, LoadingState, SectionTitle } from "~/components/ui";
import { api, apiErrorMessage } from "~/lib/api";
import { keys, queryClient } from "~/lib/query";

export default function HomeRoute() {
  const navigate = useNavigate();
  const projects = useQuery({ queryKey: keys.projects, queryFn: api.projects });
  const health = useQuery({ queryKey: keys.health, queryFn: api.health, retry: 0 });
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: () => api.createProject({ name, status: "draft", settings_json: { locations_json: [] } }),
    onSuccess: async (project) => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: keys.projects });
      navigate(`/projects/${project.id}`);
    },
  });
  const open = useMutation({ mutationFn: (projectId: string) => api.openProject(projectId), onSuccess: async (project) => { await queryClient.invalidateQueries({ queryKey: keys.projects }); navigate(`/projects/${project.id}`); } });
  const archive = useMutation({ mutationFn: (projectId: string) => api.archiveProject(projectId), onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }) });
  const clone = useMutation({ mutationFn: (projectId: string) => api.cloneProject(projectId, {}), onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }) });

  const items = projects.data?.items || [];
  const backendStatus = typeof health.data?.status === "string" ? health.data.status : "unknown";
  const backendService = typeof health.data?.service === "string" ? health.data.service : "Backend";
  const backendVersion = typeof health.data?.version === "string" ? health.data.version : "-";
  const backendTimestamp = typeof health.data?.timestamp === "string" ? health.data.timestamp : null;
  const backendDataDir = typeof health.data?.dataDir === "string" ? health.data.dataDir : "-";

  return (
    <main className="p-1.5">
      <header className="mb-6 flex items-start justify-between gap-5 py-4 max-md:grid">
        <div className="min-w-0">
          <span className="mb-2 block text-xs font-bold uppercase text-accent">Local narrative production</span>
          <h1 className="m-0 text-[clamp(36px,5vw,68px)] font-bold leading-none text-ink">Kuti Studio</h1>
        </div>
        <Button variant="ghost" onClick={() => projects.refetch()}><RefreshCw size={16} /> Refresh</Button>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Create project" meta="Stored in kuti-data/projects" />
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); if (name.trim()) create.mutate(); }}>
            <Field label="Project name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="New manga project" /></Field>
            <Button variant="primary" disabled={!name.trim() || create.isPending}><Plus size={16} /> Create and open</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Card>

        <Card className="grid content-start">
          <SectionTitle title="Backend" meta={health.isSuccess ? "Connected" : "Waiting"} />
          {health.isLoading ? <LoadingState label="Checking backend" /> : null}
          {health.error ? <ErrorState message={apiErrorMessage(health.error)} /> : null}
          {health.data ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[7px] border border-success/30 bg-success/10 p-3">
                <span className="h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_0_5px_color-mix(in_srgb,var(--success)_15%,transparent)]" />
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-ink">{backendService}</strong>
                  <span className="block text-xs text-muted">{backendStatus === "ok" ? "Operational" : backendStatus}</span>
                </div>
                <Badge tone={backendStatus === "ok" ? "active" : "warning"}>{backendStatus}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-[7px] border border-line bg-surface-2/55 p-2.5"><Server className="row-span-2 text-accent" size={17} /><span className="text-[11px] text-muted">Version</span><strong className="truncate text-sm text-ink">{backendVersion}</strong></div>
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-[7px] border border-line bg-surface-2/55 p-2.5"><Activity className="row-span-2 text-accent" size={17} /><span className="text-[11px] text-muted">Last check</span><strong className="truncate text-sm text-ink">{dateLabel(backendTimestamp)}</strong></div>
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-[7px] border border-line bg-surface-2/55 p-2.5 sm:col-span-2"><Database className="row-span-2 text-accent" size={17} /><span className="text-[11px] text-muted">Data directory</span><strong className="truncate text-sm text-ink">{backendDataDir}</strong></div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-5">
        <SectionTitle title="Projects" meta={`${items.length} project${items.length === 1 ? "" : "s"}`} />
        {projects.isLoading ? <LoadingState /> : null}
        {projects.error ? <ErrorState message={apiErrorMessage(projects.error)} /> : null}
        {!projects.isLoading && !projects.error && items.length === 0 ? <EmptyState title="No project yet" description="Create one from the form above to initialize storage through the backend." /> : null}
        <div className="grid gap-3 lg:grid-cols-3">
          {items.map((project) => (
            <Card key={project.id}>
              <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{project.name}</strong><Badge>{project.status}</Badge></div>
              <p className="mt-2 text-xs leading-5 text-muted">{project.root_path}</p>
              <p className="mt-2 text-xs leading-5 text-muted">Updated {dateLabel(project.updated_at)} · Opened {dateLabel(project.last_opened_at)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={() => open.mutate(project.id)}><FolderOpen size={16} /> Open</Button>
                <Button onClick={() => clone.mutate(project.id)}><Copy size={16} /> Clone</Button>
                <Button variant="danger" onClick={() => archive.mutate(project.id)}><Archive size={16} /> Archive</Button>
                <Link className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[7px] border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2" to={`/projects/${project.id}`}>Dashboard</Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
