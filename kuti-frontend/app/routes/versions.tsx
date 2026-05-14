import { RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, PageHeader, Panel, dateLabel } from "~/components/ui";
import { api, apiErrorMessage } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";

export default function VersionsRoute() {
  const { projectId = "" } = useParams();
  const versions = useQuery({ queryKey: keys.versions(projectId), queryFn: () => api.versions(projectId) });
  const branches = useQuery({ queryKey: keys.branches(projectId), queryFn: () => api.branches(projectId) });
  const [label, setLabel] = useState("Checkpoint");
  const [branch, setBranch] = useState("main");
  const create = useMutation({ mutationFn: () => api.createVersion(projectId, { label, branch_name: branch }), onSuccess: () => invalidateWorkspace(projectId) });
  const restore = useMutation({ mutationFn: (id: string) => api.restoreVersion(projectId, id), onSuccess: () => invalidateWorkspace(projectId) });

  return (
    <AppShell>
      <PageHeader title="Version History" description="Create snapshots, inspect retained branches and restore previous project states." />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Field label="Branch"><input value={branch} onChange={(e) => setBranch(e.target.value)} /></Field>
            <Field label="Label"><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
            <Button variant="primary"><Save size={16} /> Create version</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Branches</h2>
          <div className="grid gap-2">{(branches.data || []).map((item) => <div className="grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5" key={item.branch_name}><strong className="text-sm text-ink">{item.branch_name}</strong><small className="text-xs text-muted">{item.version_count} retained · latest {dateLabel(item.latest_created_at)}</small></div>)}</div>
        </Panel>
      </div>
      <div className="mt-3">
        {versions.isLoading ? <LoadingState /> : null}
        {versions.error ? <ErrorState message={apiErrorMessage(versions.error)} /> : null}
        {versions.data?.length === 0 ? <EmptyState title="No version" description="Create a checkpoint from the form above." /> : null}
        <div className="overflow-x-auto rounded-[7px] border border-line bg-surface shadow-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr className="border-b border-line text-xs text-muted"><th className="p-2.5 font-semibold">Version</th><th className="p-2.5 font-semibold">Branch</th><th className="p-2.5 font-semibold">Created</th><th className="p-2.5" /></tr></thead>
            <tbody>{(versions.data || []).map((version) => <tr className="border-b border-line last:border-0" key={version.id}><td className="p-2.5 align-top"><strong className="text-ink">{version.label}</strong><div className="text-xs text-muted">{version.summary || `#${version.version_index}`}</div></td><td className="p-2.5 align-top"><Badge>{version.branch_name}</Badge></td><td className="p-2.5 align-top text-muted">{dateLabel(version.created_at)}</td><td className="p-2.5 align-top"><Button onClick={() => restore.mutate(version.id)}><RotateCcw size={15} /> Restore</Button></td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
