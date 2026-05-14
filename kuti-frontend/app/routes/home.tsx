import { Archive, Copy, FolderOpen, Plus, RefreshCw } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { api, apiErrorMessage } from "~/lib/api";
import { keys, queryClient } from "~/lib/query";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, SectionTitle, dateLabel } from "~/components/ui";
import { useState } from "react";

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

  const open = useMutation({
    mutationFn: (projectId: string) => api.openProject(projectId),
    onSuccess: async (project) => {
      await queryClient.invalidateQueries({ queryKey: keys.projects });
      navigate(`/projects/${project.id}`);
    },
  });

  const archive = useMutation({
    mutationFn: (projectId: string) => api.archiveProject(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }),
  });

  const clone = useMutation({
    mutationFn: (projectId: string) => api.cloneProject(projectId, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }),
  });

  const items = projects.data?.items || [];

  return (
    <main className="home-page">
      <PageHeader
        title="Project Hub"
        description="Open, create, clone and archive local Kuti projects. All cards are loaded from the FastAPI backend."
        actions={<Button variant="ghost" onClick={() => projects.refetch()}><RefreshCw size={16} /> Refresh</Button>}
      />
      <div className="grid two">
        <Card>
          <SectionTitle title="Create project" meta="Stored in kuti-data/projects" />
          <form className="form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) create.mutate(); }}>
            <Field label="Project name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="New manga project" /></Field>
            <Button variant="primary" disabled={!name.trim() || create.isPending}><Plus size={16} /> Create and open</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Card>
        <Card>
          <SectionTitle title="Backend" meta={health.isSuccess ? "Connected" : "Waiting"} />
          {health.isLoading ? <LoadingState label="Checking backend" /> : null}
          {health.error ? <ErrorState message={apiErrorMessage(health.error)} /> : null}
          {health.data ? <pre className="kbd">{JSON.stringify(health.data, null, 2)}</pre> : null}
        </Card>
      </div>
      <div style={{ height: 18 }} />
      <SectionTitle title="Projects" meta={`${items.length} project${items.length === 1 ? "" : "s"}`} />
      {projects.isLoading ? <LoadingState /> : null}
      {projects.error ? <ErrorState message={apiErrorMessage(projects.error)} /> : null}
      {!projects.isLoading && !projects.error && items.length === 0 ? <EmptyState title="No project yet" description="Create one from the form above to initialize storage through the backend." /> : null}
      <div className="grid three">
        {items.map((project) => (
          <Card key={project.id}>
            <div className="split-actions">
              <strong>{project.name}</strong>
              <Badge>{project.status}</Badge>
            </div>
            <p className="meta">{project.root_path}</p>
            <p className="meta">Updated {dateLabel(project.updated_at)} · Opened {dateLabel(project.last_opened_at)}</p>
            <div className="toolbar">
              <Button variant="primary" onClick={() => open.mutate(project.id)}><FolderOpen size={16} /> Open</Button>
              <Button onClick={() => clone.mutate(project.id)}><Copy size={16} /> Clone</Button>
              <Button variant="danger" onClick={() => archive.mutate(project.id)}><Archive size={16} /> Archive</Button>
              <Link className="button" to={`/projects/${project.id}`}>Dashboard</Link>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
