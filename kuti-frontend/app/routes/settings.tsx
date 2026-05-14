import { Save } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { Button, ErrorState, Field, LoadingState, PageHeader, Panel } from "~/components/ui";
import { api, apiErrorMessage, csv, type ProjectStatus } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";

export default function SettingsRoute() {
  const { projectId = "" } = useParams();
  const project = useQuery({ queryKey: keys.project(projectId), queryFn: () => api.project(projectId) });
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("draft");
  const [locations, setLocations] = useState("");
  const update = useMutation({ mutationFn: () => api.updateProject(projectId, { name: name || project.data?.name, status, settings_json: { ...(project.data?.settings_json || {}), locations_json: csv(locations) } }), onSuccess: () => invalidateWorkspace(projectId) });
  if (project.data && !name) { setName(project.data.name); setStatus(project.data.status); const raw = project.data.settings_json.locations_json; if (Array.isArray(raw) && !locations) setLocations(raw.join(", ")); }

  return (
    <AppShell>
      <PageHeader title="Project Settings" description="Edit backend project metadata and coherence location settings." />
      {project.isLoading ? <LoadingState /> : null}
      {project.error ? <ErrorState message={apiErrorMessage(project.error)} /> : null}
      {project.data ? <Panel><form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); update.mutate(); }}><Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}><option value="draft">draft</option><option value="active">active</option><option value="archived">archived</option><option value="maintenance">maintenance</option></select></Field><Field label="Allowed locations"><input value={locations} onChange={(e) => setLocations(e.target.value)} placeholder="Moon Docks, Lower City" /></Field><Button variant="primary"><Save size={16} /> Save settings</Button>{update.error ? <ErrorState message={apiErrorMessage(update.error)} /> : null}</form></Panel> : null}
    </AppShell>
  );
}
