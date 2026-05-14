import { Archive, Link2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { Badge, Button, Card, EmptyState, ErrorState, Field, LinkButton, LoadingState, PageHeader, Panel, SectionTitle, dateLabel } from "~/components/ui";
import { api, apiErrorMessage, csv } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";

export default function AssetsRoute() {
  const { projectId = "" } = useParams();
  const assets = useQuery({ queryKey: keys.assets(projectId), queryFn: () => api.assets(projectId) });
  const [sourcePath, setSourcePath] = useState("");
  const [name, setName] = useState("");
  const [tags, setTags] = useState("");
  const importAsset = useMutation({ mutationFn: () => api.importAsset(projectId, { source_path: sourcePath, name: name || undefined, tags_json: csv(tags) }), onSuccess: () => { setSourcePath(""); setName(""); setTags(""); invalidateWorkspace(projectId); } });
  const archive = useMutation({ mutationFn: (id: string) => api.archiveAsset(projectId, id), onSuccess: () => invalidateWorkspace(projectId) });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteAsset(projectId, id), onSuccess: () => invalidateWorkspace(projectId) });

  return (
    <AppShell>
      <PageHeader title="Assets Library" description="Import local files through the backend and link them to project entities." />
      <div className="grid items-start gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel>
          <SectionTitle title="Import" />
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); importAsset.mutate(); }}>
            <Field label="Source path"><input value={sourcePath} onChange={(e) => setSourcePath(e.target.value)} placeholder="/home/user/reference.png" /></Field>
            <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Tags"><input value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
            <Button variant="primary" disabled={!sourcePath || importAsset.isPending}><Plus size={16} /> Import asset</Button>
            {importAsset.error ? <ErrorState message={apiErrorMessage(importAsset.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <SectionTitle title="Assets" meta={`${assets.data?.items.length ?? 0}`} />
          {assets.isLoading ? <LoadingState /> : null}
          {assets.error ? <ErrorState message={apiErrorMessage(assets.error)} /> : null}
          {assets.data?.items.length === 0 ? <EmptyState title="No asset" description="Import a local file path to copy it into the project assets directory." /> : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {(assets.data?.items || []).map((asset) => (
              <Card key={asset.id}>
                <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{asset.name}</strong><Badge>{asset.status}</Badge></div>
                <p className="mt-2 text-xs leading-5 text-muted">{asset.original_filename} · {asset.mime_type}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{asset.size_bytes} bytes · {dateLabel(asset.updated_at)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <LinkButton href={api.fileUrl(`/projects/${projectId}/assets/${asset.id}/file`)} target="_blank" rel="noreferrer"><Link2 size={15} /> Open</LinkButton>
                  <Button onClick={() => archive.mutate(asset.id)}><Archive size={15} /> Archive</Button>
                  <Button variant="danger" onClick={() => remove.mutate(asset.id)}><Trash2 size={15} /></Button>
                </div>
              </Card>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
