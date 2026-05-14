import { Check, ImagePlus, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LinkButton, LoadingState, PageHeader, Panel, dateLabel } from "~/components/ui";
import { api, apiErrorMessage, type Chapter, type Scene, type Tome } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";

export default function GenerationRoute() {
  const { projectId = "" } = useParams();
  const story = useQuery({ queryKey: keys.story(projectId), queryFn: () => api.story(projectId) });
  const models = useQuery({ queryKey: keys.models, queryFn: api.models });
  const jobs = useQuery({ queryKey: keys.generationJobs(projectId), queryFn: () => api.generationJobs(projectId) });
  const boards = useQuery({ queryKey: keys.generationBoards(projectId), queryFn: () => api.generationBoards(projectId) });
  const [sourceKind, setSourceKind] = useState("scene");
  const [sourceId, setSourceId] = useState("");
  const [modelKey, setModelKey] = useState("");
  const [mode, setMode] = useState("separate");
  const sources = useMemo<Array<Tome | Chapter | Scene>>(() => sourceKind === "tome" ? story.data?.tomes || [] : sourceKind === "chapter" ? story.data?.chapters || [] : story.data?.scenes || [], [sourceKind, story.data]);
  const create = useMutation({ mutationFn: () => api.createGenerationJob(projectId, { source_kind: sourceKind, source_id: sourceId, strategy: "direct", model_key: modelKey || undefined, mode, grid_rows: mode === "grid" ? 2 : undefined, grid_cols: mode === "grid" ? 2 : undefined }), onSuccess: () => invalidateWorkspace(projectId) });
  const validate = useMutation({ mutationFn: (boardId: string) => api.validateBoard(projectId, boardId), onSuccess: () => invalidateWorkspace(projectId) });

  return (
    <AppShell>
      <PageHeader title="Generation Studio" description="Launch generation jobs from real story sources and configured backend providers." actions={<Button onClick={() => { jobs.refetch(); boards.refetch(); }}><RefreshCw size={16} /> Refresh</Button>} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Field label="Source kind"><select value={sourceKind} onChange={(e) => { setSourceKind(e.target.value); setSourceId(""); }}><option value="scene">scene</option><option value="chapter">chapter</option><option value="tome">tome</option></select></Field>
            <Field label="Source"><select value={sourceId} onChange={(e) => setSourceId(e.target.value)}><option value="">Select source</option>{sources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>
            <Field label="Model"><select value={modelKey} onChange={(e) => setModelKey(e.target.value)}><option value="">Backend default</option>{(models.data || []).map((model) => <option key={model.key} value={model.key}>{model.display_name} · {model.kind} {model.configured ? "" : "(not configured)"}</option>)}</select></Field>
            <Field label="Mode"><select value={mode} onChange={(e) => setMode(e.target.value)}><option value="separate">separate</option><option value="grid">grid</option></select></Field>
            <Button variant="primary" disabled={!sourceId || create.isPending}><ImagePlus size={16} /> Launch job</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Jobs</h2>
          {jobs.isLoading ? <LoadingState /> : null}
          {jobs.error ? <ErrorState message={apiErrorMessage(jobs.error)} /> : null}
          {jobs.data?.length === 0 ? <EmptyState title="No generation job" /> : null}
          <div className="grid gap-2">{(jobs.data || []).map((job) => <div className="grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5" key={job.id}><div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{job.title}</strong><Badge tone={job.status}>{job.status}</Badge></div><small className="text-xs text-muted">{job.source_kind} · {job.source_label} · {job.progress}%</small><small className="text-xs text-muted">{job.model_name || job.entrypoint}</small></div>)}</div>
        </Panel>
      </div>
      <Panel className="mt-3">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">Boards</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {(boards.data || []).map((board) => (
            <Card key={board.id}>
              <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{board.title}</strong><Badge tone={board.status}>{board.status}</Badge></div>
              <p className="mt-2 text-xs text-muted">{board.source_kind} · {dateLabel(board.created_at)}</p>
              {board.panels[0] ? <img className="mt-3 aspect-[4/5] w-full rounded-[7px] border border-line bg-surface-2 object-cover" src={api.fileUrl(`/projects/${projectId}/generation/boards/${board.id}/panels/${board.panels[0].id}/image`)} alt={board.panels[0].title} /> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2"><LinkButton href={api.fileUrl(`/projects/${projectId}/generation/boards/${board.id}/download`)}>Manifest</LinkButton><Button onClick={() => validate.mutate(board.id)}><Check size={15} /> Validate</Button></div>
            </Card>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
