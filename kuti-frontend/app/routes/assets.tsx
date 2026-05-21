import { Archive, Link2, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader, Panel, SectionTitle, dateLabel } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { apiErrorMessage, API_BASE_URL } from "~/lib/errors";
import { csv } from "~/lib/utils";
import {
  listAssetsOptions,
  importAssetMutation,
  archiveAssetMutation,
  deleteAssetMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { assetImportSchema, type AssetImportInput } from "~/lib/schemas";

export default function AssetsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['assets', 'common']);
  const queryClient = useQueryClient();
  const assets = useQuery({ ...listAssetsOptions({ path: { projectId: projectId } }), enabled: !!projectId });
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<AssetImportInput>({
    resolver: zodResolver(assetImportSchema),
    defaultValues: { source_path: '', name: '', tags: '' },
  });
  
  const importAsset = useMutation({
    ...importAssetMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listAssets"] });
    },
  });
  const onSubmit = (data: AssetImportInput) => importAsset.mutate({
    path: { projectId: projectId },
    body: { sourcePath: data.source_path, name: data.name || undefined, tags: data.tags ? csv(data.tags) : undefined }
  }, { onSuccess: () => reset() });
  
  const archive = useMutation({
    ...archiveAssetMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listAssets"] });
    },
  });
  const remove = useMutation({
    ...deleteAssetMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listAssets"] });
    },
  });

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
          {/* @ts-expect-error - SDK types differ from use-api wrapper */}
          <SectionTitle title={t('panels.assets.title')} meta={`${assets.data?.items?.length ?? 0} ${t('panels.assets.count', { count: assets.data?.items?.length ?? 0 })}`} />
          {assets.isLoading ? <LoadingState /> : null}
          {assets.error ? <ErrorState message={apiErrorMessage(assets.error)} /> : null}
          {/* @ts-expect-error - SDK types differ from use-api wrapper */}
          {assets.data?.items?.length === 0 ? <EmptyState title={t('empty.title')} description={t('empty.description')} /> : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {/* @ts-expect-error - SDK types differ from use-api wrapper */}
            {(assets.data?.items || []).map((asset) => (
              <Card key={asset.id}>
                <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{asset.name}</strong><Badge>{asset.status}</Badge></div>
                <p className="mt-2 text-xs leading-5 text-muted">{asset.originalFilename} · {asset.mimeType}</p>
                <p className="mt-1 text-xs leading-5 text-muted">{asset.sizeBytes} {t('meta.size')} · {dateLabel(asset.updatedAt)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <LinkButton href={`${API_BASE_URL}/api/projects/${projectId}/assets/${asset.id}/file`} target="_blank" rel="noreferrer"><Link2 size={15} /> {t('actions.open')}</LinkButton>
                  <Button onClick={() => archive.mutate({ path: { projectId: projectId, assetId: asset.id } })}><Archive size={15} /> {t('actions.archive')}</Button>
                  <Button variant="danger" onClick={() => remove.mutate({ path: { projectId: projectId, assetId: asset.id } })}><Trash2 size={15} /></Button>
                </div>
              </Card>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
