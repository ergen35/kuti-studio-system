import { CheckCircle2, RefreshCw } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader } from "~/components/ui";
import { api, apiErrorMessage } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";

export default function WarningsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['warnings', 'common']);
  const warnings = useQuery({ queryKey: keys.warnings(projectId), queryFn: () => api.warnings(projectId) });
  const scan = useMutation({ mutationFn: () => api.scanWarnings(projectId), onSuccess: () => invalidateWorkspace(projectId) });
  const resolve = useMutation({ mutationFn: (id: string) => api.updateWarning(projectId, id, { status: "resolved" }), onSuccess: () => invalidateWorkspace(projectId) });

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} actions={<Button variant="primary" onClick={() => scan.mutate()}><RefreshCw size={16} /> {t('actions.scan')}</Button>} />
      {warnings.isLoading ? <LoadingState /> : null}
      {warnings.error ? <ErrorState message={apiErrorMessage(warnings.error)} /> : null}
      {scan.error ? <ErrorState message={apiErrorMessage(scan.error)} /> : null}
      {warnings.data?.length === 0 ? <EmptyState title={t('empty.title')} description={t('empty.description')} /> : null}
      <div className="overflow-x-auto rounded-[7px] border border-line bg-surface shadow-card">
        <table className="w-full border-collapse text-left text-sm">
          <thead><tr className="border-b border-line text-xs text-muted"><th className="p-2.5 font-semibold">{t('table.warning')}</th><th className="p-2.5 font-semibold">{t('table.kind')}</th><th className="p-2.5 font-semibold">{t('table.severity')}</th><th className="p-2.5 font-semibold">{t('table.status')}</th><th className="p-2.5 font-semibold">{t('table.entity')}</th><th className="p-2.5" /></tr></thead>
          <tbody>{(warnings.data || []).map((warning) => <tr className="border-b border-line last:border-0" key={warning.id}><td className="p-2.5 align-top"><strong className="text-ink">{warning.title}</strong><div className="text-xs leading-5 text-muted">{warning.message}</div></td><td className="p-2.5 align-top text-muted">{warning.kind}</td><td className="p-2.5 align-top"><Badge tone={warning.severity}>{warning.severity}</Badge></td><td className="p-2.5 align-top"><Badge tone={warning.status}>{warning.status}</Badge></td><td className="p-2.5 align-top text-muted">{warning.entity_kind}</td><td className="p-2.5 align-top">{warning.status !== "resolved" ? <Button onClick={() => resolve.mutate(warning.id)}><CheckCircle2 size={15} /> {t('actions.resolve')}</Button> : null}</td></tr>)}</tbody>
        </table>
      </div>
    </AppShell>
  );
}
