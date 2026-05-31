import { Download, PackagePlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, dateLabel, EmptyState, ErrorState, LinkButton, LoadingState, PageHeader, Panel } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { apiErrorMessage, API_BASE_URL } from "~/lib/errors";
import {
  listExportsOptions,
  createExportMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { exportCreateSchema, type ExportCreateInput } from "~/lib/schemas";

export default function ExportsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['exports', 'common']);
  const queryClient = useQueryClient();
  const exports = useQuery({ ...listExportsOptions({ path: { projectId: projectId } }), enabled: !!projectId });
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, watch, setValue } = useForm<ExportCreateInput>({
    resolver: zodResolver(exportCreateSchema),
    defaultValues: { kind: 'work', format: 'json', label: 'Work export', summary: '' },
  });
  
  const create = useMutation({
    ...createExportMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listExports"] });
    },
  });
  const onSubmit = (data: ExportCreateInput) => create.mutate({
    path: { projectId: projectId },
    body: { kind: data.kind as "work" | "publication", format: data.format as "json" | "tree" | "zip", label: data.label, summary: data.summary }
  }, { onSuccess: () => reset() });

  const kindOptions = [
    { value: "work", label: t('panels.create.kinds.work') },
    { value: "publication", label: t('panels.create.kinds.publication') },
  ];

  const formatOptions = [
    { value: "json", label: t('panels.create.formats.json') },
    { value: "tree", label: t('panels.create.formats.tree') },
    { value: "zip", label: t('panels.create.formats.zip') },
  ];
  const kindValue = watch('kind');
  const formatValue = watch('format');

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <FormField label={t('panels.create.kind')} error={errors.kind}>
              <Select value={kindValue} onValueChange={(value) => setValue('kind', value as ExportCreateInput['kind'], { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{kindOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </FormField>
            <FormField label={t('panels.create.format')} error={errors.format}>
              <Select value={formatValue} onValueChange={(value) => setValue('format', value as ExportCreateInput['format'], { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{formatOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </FormField>
            <FormField label={t('panels.create.label')} error={errors.label}>
              <Input {...register('label')} />
            </FormField>
            <Button variant="primary" disabled={isSubmitting || create.isPending}><PackagePlus size={16} /> {t('panels.create.button')}</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t('panels.artifacts.title')}</h2>
          {exports.isLoading ? <LoadingState /> : null}
          {exports.error ? <ErrorState message={apiErrorMessage(exports.error)} /> : null}
          {exports.data?.length === 0 ? <EmptyState title={t('empty.title')} /> : null}
          <div className="grid gap-2">
            {(exports.data || []).map((item) => (
              <div className="grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5" key={item.id}>
                <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{item.label}</strong><Badge tone={item.status}>{item.status}</Badge></div>
                <small className="text-xs text-muted">{item.kind} · {item.format} · {dateLabel(item.createdAt)}</small>
                {item.artifactPath ? <LinkButton href={`${API_BASE_URL}/api/projects/${projectId}/exports/${item.id}/download`}><Download size={15} /> {t('common:actions.download')}</LinkButton> : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
