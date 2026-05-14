import { Download, PackagePlus } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, Field, LoadingState, PageHeader, dateLabel } from "~/components/ui";
import { api, apiErrorMessage, type ExportFormat, type ExportKind } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";

export default function ExportsRoute() {
  const { projectId = "" } = useParams();
  const exports = useQuery({ queryKey: keys.exports(projectId), queryFn: () => api.exports(projectId) });
  const [kind, setKind] = useState<ExportKind>("work");
  const [format, setFormat] = useState<ExportFormat>("json");
  const [label, setLabel] = useState("Work export");
  const create = useMutation({ mutationFn: () => api.createExport(projectId, { kind, format, label }), onSuccess: () => invalidateWorkspace(projectId) });
  return <AppShell><PageHeader title="Exports" description="Generate backend work exports in JSON, tree or ZIP format." /><div className="grid two"><section className="panel"><form className="form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}><Field label="Kind"><select value={kind} onChange={(e) => setKind(e.target.value as ExportKind)}><option value="work">work</option><option value="publication">publication</option></select></Field><Field label="Format"><select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}><option value="json">json</option><option value="tree">tree</option><option value="zip">zip</option></select></Field><Field label="Label"><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field><Button variant="primary"><PackagePlus size={16} /> Create export</Button>{create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}</form></section><section className="panel"><h2>Artifacts</h2>{exports.isLoading ? <LoadingState /> : null}{exports.error ? <ErrorState message={apiErrorMessage(exports.error)} /> : null}{exports.data?.length === 0 ? <EmptyState title="No export" /> : null}<div className="list">{(exports.data || []).map((item) => <div className="list-item" key={item.id}><div className="split-actions"><strong>{item.label}</strong><Badge tone={item.status}>{item.status}</Badge></div><small>{item.kind} · {item.format} · {dateLabel(item.created_at)}</small>{item.artifact_path ? <a className="button" href={api.fileUrl(`/projects/${projectId}/exports/${item.id}/download`)}><Download size={15} /> Download</a> : null}</div>)}</div></section></div></AppShell>;
}
