import { RotateCcw, Save } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Panel, dateLabel } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { api, apiErrorMessage } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";
import { versionCreateSchema, type VersionCreateInput } from "~/lib/schemas";

export default function VersionsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['versions', 'common']);
  const versions = useQuery({ queryKey: keys.versions(projectId), queryFn: () => api.versions(projectId) });
  const branches = useQuery({ queryKey: keys.branches(projectId), queryFn: () => api.branches(projectId) });
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<VersionCreateInput>({
    resolver: zodResolver(versionCreateSchema),
    defaultValues: { branch: 'main', label: 'Checkpoint' },
  });
  
  const create = useMutation({ 
    mutationFn: (data: VersionCreateInput) => api.createVersion(projectId, { label: data.label, branch_name: data.branch }), 
    onSuccess: () => { reset(); invalidateWorkspace(projectId); } 
  });
  const onSubmit = (data: VersionCreateInput) => create.mutate(data);
  
  const restore = useMutation({ mutationFn: (id: string) => api.restoreVersion(projectId, id), onSuccess: () => invalidateWorkspace(projectId) });

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <FormField label={t('panels.create.branch')} error={errors.branch}>
              <input {...register('branch')} />
            </FormField>
            <FormField label={t('panels.create.label')} error={errors.label}>
              <input {...register('label')} />
            </FormField>
            <Button variant="primary" disabled={isSubmitting || create.isPending}><Save size={16} /> {t('panels.create.button')}</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t('panels.branches.title')}</h2>
          <div className="grid gap-2">{(branches.data || []).map((item) => <div className="grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5" key={item.branch_name}><strong className="text-sm text-ink">{item.branch_name}</strong><small className="text-xs text-muted">{item.version_count} {t('panels.branches.count', { count: item.version_count })} · {t('panels.branches.latest')} {dateLabel(item.latest_created_at)}</small></div>)}</div>
        </Panel>
      </div>
      <div className="mt-3">
        {versions.isLoading ? <LoadingState /> : null}
        {versions.error ? <ErrorState message={apiErrorMessage(versions.error)} /> : null}
        {versions.data?.length === 0 ? <EmptyState title={t('empty.title')} description={t('empty.description')} /> : null}
        <div className="overflow-x-auto rounded-[7px] border border-line bg-surface shadow-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr className="border-b border-line text-xs text-muted"><th className="p-2.5 font-semibold">{t('table.version')}</th><th className="p-2.5 font-semibold">{t('table.branch')}</th><th className="p-2.5 font-semibold">{t('table.created')}</th><th className="p-2.5" /></tr></thead>
            <tbody>{(versions.data || []).map((version) => <tr className="border-b border-line last:border-0" key={version.id}><td className="p-2.5 align-top"><strong className="text-ink">{version.label}</strong><div className="text-xs text-muted">{version.summary || `#${version.version_index}`}</div></td><td className="p-2.5 align-top"><Badge>{version.branch_name}</Badge></td><td className="p-2.5 align-top text-muted">{dateLabel(version.created_at)}</td><td className="p-2.5 align-top"><Button onClick={() => restore.mutate(version.id)}><RotateCcw size={15} /> {t('actions.restore')}</Button></td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
