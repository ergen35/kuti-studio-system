import { RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, PageHeader, dateLabel } from "~/components/ui";
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
  return <AppShell><PageHeader title="Version History" description="Create snapshots, inspect retained branches and restore previous project states." /><div className="grid two"><section className="panel"><form className="form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><Field label="Branch"><input value={branch} onChange={(e) => setBranch(e.target.value)} /></Field><Field label="Label"><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field><Button variant="primary"><Save size={16} /> Create version</Button>{create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}</form></section><section className="panel"><h2>Branches</h2><div className="list">{(branches.data || []).map((item) => <div className="list-item" key={item.branch_name}><strong>{item.branch_name}</strong><small>{item.version_count} retained · latest {dateLabel(item.latest_created_at)}</small></div>)}</div></section></div><div style={{ height: 14 }} />{versions.isLoading ? <LoadingState /> : null}{versions.error ? <ErrorState message={apiErrorMessage(versions.error)} /> : null}{versions.data?.length === 0 ? <EmptyState title="No version" description="Create a checkpoint from the form above." /> : null}<table className="table"><thead><tr><th>Version</th><th>Branch</th><th>Created</th><th /></tr></thead><tbody>{(versions.data || []).map((version) => <tr key={version.id}><td><strong>{version.label}</strong><div className="meta">{version.summary || `#${version.version_index}`}</div></td><td><Badge>{version.branch_name}</Badge></td><td>{dateLabel(version.created_at)}</td><td><Button onClick={() => restore.mutate(version.id)}><RotateCcw size={15} /> Restore</Button></td></tr>)}</tbody></table></AppShell>;
}
