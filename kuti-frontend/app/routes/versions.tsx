import { RotateCcw, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Panel, SectionTitle, dateLabel } from "~/components/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Input } from "~/components/ui/input";
import { FormField } from "~/components/FormField";
import { apiErrorMessage } from "~/lib/errors";
import {
  listVersionsOptions,
  listBranchesOptions,
  createVersionMutation,
  restoreVersionMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { versionCreateSchema, type VersionCreateInput } from "~/lib/schemas";
import type { GetVersionResponse } from "~/lib/backend/types.gen";

// Type definitions for list responses (not exported from types.gen.ts)
type Version = GetVersionResponse;
interface Branch {
  branchName: string;
  versionCount: number;
  latestCreatedAt: string;
}

export default function VersionsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['versions', 'common']);
  const queryClient = useQueryClient();
  const versions = useQuery({ ...listVersionsOptions({ path: { projectId: projectId } }), enabled: !!projectId });
  const branches = useQuery({ ...listBranchesOptions({ path: { projectId: projectId } }), enabled: !!projectId });
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<VersionCreateInput>({
    resolver: zodResolver(versionCreateSchema),
    defaultValues: { branch: 'main', label: 'Checkpoint' },
  });
  
  const create = useMutation({
    ...createVersionMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listVersions"] });
      queryClient.invalidateQueries({ queryKey: ["listBranches"] });
    },
  });
  const onSubmit = (data: VersionCreateInput) => create.mutate({
    path: { projectId: projectId },
    body: { label: data.label, branchName: data.branch, summary: '' }
  }, { onSuccess: () => reset() });
  
  const restore = useMutation(restoreVersionMutation());
  const versionItems = (versions.data as Array<Version> | undefined) ?? [];
  const branchItems = (branches.data as Array<Branch> | undefined) ?? [];

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <SectionTitle title={t('panels.create.title')} />
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <FormField label={t('panels.create.branch')} error={errors.branch}>
              <Input {...register('branch')} />
            </FormField>
            <FormField label={t('panels.create.label')} error={errors.label}>
              <Input {...register('label')} />
            </FormField>
            <Button variant="primary" disabled={isSubmitting || create.isPending}><Save size={16} /> {t('panels.create.button')}</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <SectionTitle title={t('panels.branches.title')} />
          {branchItems.length === 0 ? <EmptyState title={t('empty.title')} description={t('empty.description')} /> : null}
          <div className="grid gap-2">{branchItems.map((item) => <div className="grid gap-1 rounded-lg border border-border bg-secondary/35 p-3" key={item.branchName}><strong className="text-sm text-foreground">{item.branchName}</strong><small className="text-xs text-muted-foreground">{t('panels.branches.count', { count: item.versionCount })} · {t('panels.branches.latest')} {dateLabel(item.latestCreatedAt)}</small></div>)}</div>
        </Panel>
      </div>
      <div className="mt-3">
        {versions.isLoading ? <LoadingState /> : null}
        {versions.error ? <ErrorState message={apiErrorMessage(versions.error)} /> : null}
        {versionItems.length === 0 ? <EmptyState title={t('empty.title')} description={t('empty.description')} /> : null}
        {versionItems.length > 0 ? (
          <Panel>
            <Table>
              <TableHeader><TableRow><TableHead>{t('table.version')}</TableHead><TableHead>{t('table.branch')}</TableHead><TableHead>{t('table.created')}</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>{versionItems.map((version) => <TableRow key={version.id}><TableCell className="align-top"><strong className="text-foreground">{version.label}</strong><div className="text-xs text-muted-foreground">{version.summary || `#${version.versionIndex}`}</div></TableCell><TableCell className="align-top"><Badge>{version.branchName}</Badge></TableCell><TableCell className="align-top text-muted-foreground">{dateLabel(version.createdAt)}</TableCell><TableCell className="align-top"><Button onClick={() => restore.mutate({ path: { projectId: projectId, versionId: version.id }, body: {} })}><RotateCcw size={15} /> {t('actions.restore')}</Button></TableCell></TableRow>)}</TableBody>
            </Table>
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}
