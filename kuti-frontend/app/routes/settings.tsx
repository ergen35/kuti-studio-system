import { Save } from "lucide-react";
import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Button, ErrorState, LoadingState, PageHeader, Panel } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { api, apiErrorMessage, csv, type ProjectStatus } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";
import { projectSettingsSchema, type ProjectSettingsInput } from "~/lib/schemas";

export default function SettingsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['settings', 'common']);
  const project = useQuery({ queryKey: keys.project(projectId), queryFn: () => api.project(projectId) });
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProjectSettingsInput>({
    resolver: zodResolver(projectSettingsSchema),
    defaultValues: { name: '', status: 'draft', locations: '' },
  });

  useEffect(() => {
    if (project.data) {
      const raw = project.data.settings_json.locations_json;
      reset({
        name: project.data.name,
        status: project.data.status,
        locations: Array.isArray(raw) ? raw.join(", ") : '',
      });
    }
  }, [project.data, reset]);

  const update = useMutation({ 
    mutationFn: (data: ProjectSettingsInput) => api.updateProject(projectId, { 
      name: data.name || project.data?.name, 
      status: data.status, 
      settings_json: { ...(project.data?.settings_json || {}), locations_json: csv(data.locations || '') } 
    }), 
    onSuccess: () => invalidateWorkspace(projectId) 
  });
  const onSubmit = (data: ProjectSettingsInput) => update.mutate(data);

  const statusOptions = [
    { value: "draft", label: t('common:status.draft') },
    { value: "active", label: t('common:status.active') },
    { value: "archived", label: t('common:status.archived') },
    { value: "maintenance", label: t('common:status.maintenance') },
  ];

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} />
      {project.isLoading ? <LoadingState /> : null}
      {project.error ? <ErrorState message={apiErrorMessage(project.error)} /> : null}
      {project.data ? <Panel>
        <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
          <FormField label={t('fields.name')} error={errors.name}>
            <input {...register('name')} />
          </FormField>
          <FormField label={t('fields.status')} error={errors.status}>
            <select {...register('status')}>
              {statusOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </FormField>
          <FormField label={t('fields.allowedLocations')} error={errors.locations}>
            <input {...register('locations')} placeholder={t('fields.locationsPlaceholder')} />
          </FormField>
          <Button variant="primary" disabled={isSubmitting || update.isPending}><Save size={16} /> {t('actions.save')}</Button>
          {update.error ? <ErrorState message={apiErrorMessage(update.error)} /> : null}
        </form>
      </Panel> : null}
    </AppShell>
  );
}
