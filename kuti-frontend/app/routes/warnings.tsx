import { CheckCircle2, RefreshCw } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader } from "~/components/ui";
import { api, apiErrorMessage } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";

export default function WarningsRoute() {
  const { projectId = "" } = useParams();
  const warnings = useQuery({ queryKey: keys.warnings(projectId), queryFn: () => api.warnings(projectId) });
  const scan = useMutation({ mutationFn: () => api.scanWarnings(projectId), onSuccess: () => invalidateWorkspace(projectId) });
  const resolve = useMutation({ mutationFn: (id: string) => api.updateWarning(projectId, id, { status: "resolved" }), onSuccess: () => invalidateWorkspace(projectId) });
  return <AppShell><PageHeader title="Warnings Center" description="Run backend coherence checks and manage non-blocking continuity warnings." actions={<Button variant="primary" onClick={() => scan.mutate()}><RefreshCw size={16} /> Scan</Button>} />{warnings.isLoading ? <LoadingState /> : null}{warnings.error ? <ErrorState message={apiErrorMessage(warnings.error)} /> : null}{scan.error ? <ErrorState message={apiErrorMessage(scan.error)} /> : null}{warnings.data?.length === 0 ? <EmptyState title="No warnings" description="The backend has no active warning records for this project." /> : null}<table className="table"><thead><tr><th>Warning</th><th>Kind</th><th>Severity</th><th>Status</th><th>Entity</th><th /></tr></thead><tbody>{(warnings.data || []).map((warning) => <tr key={warning.id}><td><strong>{warning.title}</strong><div className="meta">{warning.message}</div></td><td>{warning.kind}</td><td><Badge tone={warning.severity}>{warning.severity}</Badge></td><td><Badge tone={warning.status}>{warning.status}</Badge></td><td>{warning.entity_kind}</td><td>{warning.status !== "resolved" ? <Button onClick={() => resolve.mutate(warning.id)}><CheckCircle2 size={15} /> Resolve</Button> : null}</td></tr>)}</tbody></table></AppShell>;
}
