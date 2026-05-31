import { CheckCircle2, RefreshCw } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Panel } from "~/components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { apiErrorMessage } from "~/lib/errors";
import {
  listWarningsOptions,
  scanWarningsMutation,
  updateWarningMutation,
} from "~/lib/backend/@tanstack/react-query.gen";

export default function WarningsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['warnings', 'common']);
  const warnings = useQuery({ ...listWarningsOptions({ path: { projectId } }), enabled: !!projectId });
  const scan = useMutation(scanWarningsMutation());
  const resolve = useMutation(updateWarningMutation());
  const warningItems = warnings.data || [];

  const handleResolve = (warningId: string) => {
    resolve.mutate({
      path: { projectId, warningId },
      body: { status: "resolved", note: undefined }
    });
  };
  const handleScan = () => scan.mutate({ path: { projectId } });

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} actions={<Button variant="primary" onClick={handleScan}><RefreshCw size={16} /> {t('actions.scan')}</Button>} />
      {warnings.isLoading ? <LoadingState /> : null}
      {warnings.error ? <ErrorState message={apiErrorMessage(warnings.error)} /> : null}
      {scan.error ? <ErrorState message={apiErrorMessage(scan.error)} /> : null}
      {warningItems.length === 0 ? <EmptyState title={t('empty.title')} description={t('empty.description')} /> : null}
      {warningItems.length > 0 ? (
        <Panel>
          <Table>
            <TableHeader><TableRow><TableHead>{t('table.warning')}</TableHead><TableHead>{t('table.kind')}</TableHead><TableHead>{t('table.severity')}</TableHead><TableHead>{t('table.status')}</TableHead><TableHead>{t('table.entity')}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{warningItems.map((warning) => <TableRow key={warning.id}><TableCell className="align-top"><strong className="text-foreground">{warning.title}</strong><div className="text-xs leading-5 text-muted-foreground">{warning.message}</div></TableCell><TableCell className="align-top text-muted-foreground">{warning.kind}</TableCell><TableCell className="align-top"><Badge tone={warning.severity}>{warning.severity}</Badge></TableCell><TableCell className="align-top"><Badge tone={warning.status}>{warning.status}</Badge></TableCell><TableCell className="align-top text-muted-foreground">{warning.entityKind}</TableCell><TableCell className="align-top">{warning.status !== "resolved" ? <Button onClick={() => handleResolve(warning.id)}><CheckCircle2 size={15} /> {t('actions.resolve')}</Button> : null}</TableCell></TableRow>)}</TableBody>
          </Table>
        </Panel>
      ) : null}
    </AppShell>
  );
}
