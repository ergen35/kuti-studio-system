import { Archive, Link2, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader, Panel, SectionTitle, dateLabel } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { api, apiErrorMessage, csv } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";
import { assetImportSchema, type AssetImportInput } from "~/lib/schemas";

export default function AssetsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['assets', 'common']);
  const assets = useQuery({ queryKey: keys.assets(projectId), queryFn: () => api.assets(projectId) });
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<AssetImportInput>({
    resolver: zodResolver(assetImportSchema),
    defaultValues: { source_path: '', name: '', tags: '' },
  });
  
  const importAsset = useMutation({ 
    mutationFn: (data: AssetImportInput) => api.importAsset(projectId, { source_path: data.source_path, name: data.name || undefined, tags_json: csv(data.tags || '') }), 
    onSuccess: () => { reset(); invalidateWorkspace(projectId); } 
  });
  const onSubmit = (data: AssetImportInput) => importAsset.mutate(data);
  
  const archive = useMutation({ mutationFn: (id: string) => api.archiveAsset(projectId, id), onSuccess: () => invalidateWorkspace(projectId) });
  const remove = useMutation({ mutationFn: (id: string) => api.deleteAsset(projectId, id), onSuccess: () => invalidateWorkspace(projectId) });

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="grid items-start gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel>
          <SectionTitle title={t('panels.import.title')} />
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <FormField label={t('panels.import.sourcePath')} error={errors.source_path}>
              <input {...register('source_path')} placeholder={t('panels.import.placeholder')} />
            </FormField>
            <FormField label={t('panels.import.name')} error={errors.name}>
              <input {...register('name')} />
            </FormField>
            <FormField label={t('panels.import.tags')} error={errors.tags}>
              <input {...register('tags')} />
            </FormField>
            <Button variant="primary" disabled={isSubmitting || importAsset.isPending}><Plus size={16} /> {t('panels.import.button')}</Button>
            {importAsset.error ? <ErrorState message={apiErrorMessage(importAsset.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <SectionTitle title={t('panels.assets.title')} meta={`${assets.data?.items.length ?? 0} ${t('panels.assets.count', { count: assets.data?.items.length ?? 0 })}`} />
          {assets.isLoading ? <LoadingState /> : null}
          {assets.error ? <ErrorState message={apiErrorMessage(assets.error)} /> : null}
          {assets.data?.items.length === 0 ? <EmptyState title={t('empty.title')} description={t('empty.description')} /> : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {(assets.data?.items || []).map((asset) => (
              <Card key={asset.id}>
                <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{asset.name}</strong><Badge>{asset.status}</Badge></div>
                <p className="mt-2 text-xs leading-5 text-muted">{asset.original_filename} · {asset.mime_type}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{asset.size_bytes} {t('meta.size')} · {dateLabel(asset.updated_at)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <LinkButton href={api.fileUrl(`/projects/${projectId}/assets/${asset.id}/file`)} target="_blank" rel="noreferrer"><Link2 size={15} /> {t('actions.open')}</LinkButton>
                  <Button onClick={() => archive.mutate(asset.id)}><Archive size={15} /> {t('actions.archive')}</Button>
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
