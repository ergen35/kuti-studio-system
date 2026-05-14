import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Archive, Copy, Database, FolderOpen, Plus, RefreshCw, Server } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "~/hooks/useTranslation";
import {
  Badge,
  Button,
  Card,
  dateLabel,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionTitle,
} from "~/components/ui";
import { FormField } from "~/components/FormField";
import { api, apiErrorMessage } from "~/lib/api";
import { keys, queryClient } from "~/lib/query";
import { projectCreateSchema, type ProjectCreateInput } from "~/lib/schemas";

export default function HomeRoute() {
  const navigate = useNavigate();
  const { t } = useTranslation(['home', 'common']);
  const projects = useQuery({ queryKey: keys.projects, queryFn: api.projects });
  const health = useQuery({ queryKey: keys.health, queryFn: api.health, retry: 0 });
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProjectCreateInput>({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: { name: '', status: 'draft' },
  });

  const create = useMutation({
    mutationFn: (data: ProjectCreateInput) => api.createProject({ name: data.name, status: data.status, settings_json: { locations_json: [] } }),
    onSuccess: async (project) => {
      reset();
      await queryClient.invalidateQueries({ queryKey: keys.projects });
      navigate(`/projects/${project.id}`);
    },
  });
  const onSubmit = (data: ProjectCreateInput) => create.mutate(data);
  const open = useMutation({ mutationFn: (projectId: string) => api.openProject(projectId), onSuccess: async (project) => { await queryClient.invalidateQueries({ queryKey: keys.projects }); navigate(`/projects/${project.id}`); } });
  const archive = useMutation({ mutationFn: (projectId: string) => api.archiveProject(projectId), onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }) });
  const clone = useMutation({ mutationFn: (projectId: string) => api.cloneProject(projectId, {}), onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.projects }) });

  const items = projects.data?.items || [];
  const backendStatus = typeof health.data?.status === "string" ? health.data.status : "unknown";
  const backendService = typeof health.data?.service === "string" ? health.data.service : t('backend.service');
  const backendVersion = typeof health.data?.version === "string" ? health.data.version : "-";
  const backendTimestamp = typeof health.data?.timestamp === "string" ? health.data.timestamp : null;
  const backendDataDir = typeof health.data?.dataDir === "string" ? health.data.dataDir : "-";

  return (
    <main className="p-1.5">
      <header className="mb-6 flex items-start justify-between gap-5 py-4 max-md:grid">
        <div className="min-w-0">
          <span className="mb-2 block text-xs font-bold uppercase text-accent">{t('common:tagline')}</span>
          <h1 className="m-0 text-[clamp(36px,5vw,68px)] font-bold leading-none text-ink">{t('common:appName')}</h1>
        </div>
        <Button variant="ghost" onClick={() => projects.refetch()}><RefreshCw size={16} /> {t('common:nav.refresh')}</Button>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <SectionTitle title={t('createProject.title')} meta={t('createProject.meta')} />
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <FormField label={t('common:fields.name')} error={errors.name}>
              <input {...register('name')} placeholder={t('createProject.placeholder')} />
            </FormField>
            <Button variant="primary" disabled={isSubmitting || create.isPending}><Plus size={16} /> {t('createProject.button')}</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Card>

        <Card className="grid content-start">
          <SectionTitle title={t('backend.title')} meta={health.isSuccess ? t('backend.status.connected') : t('backend.status.waiting')} />
          {health.isLoading ? <LoadingState label={t('states.loading')} /> : null}
          {health.error ? <ErrorState message={apiErrorMessage(health.error)} /> : null}
          {health.data ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[7px] border border-success/30 bg-success/10 p-3">
                <span className="h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_0_5px_color-mix(in_srgb,var(--success)_15%,transparent)]" />
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-ink">{backendService}</strong>
                  <span className="block text-xs text-muted">{backendStatus === "ok" ? t('backend.operational') : backendStatus}</span>
                </div>
                <Badge tone={backendStatus === "ok" ? "active" : "warning"}>{backendStatus}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-[7px] border border-line bg-surface-2/55 p-2.5"><Server className="row-span-2 text-accent" size={17} /><span className="text-[11px] text-muted">{t('backend.version')}</span><strong className="truncate text-sm text-ink">{backendVersion}</strong></div>
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-[7px] border border-line bg-surface-2/55 p-2.5"><Activity className="row-span-2 text-accent" size={17} /><span className="text-[11px] text-muted">{t('backend.lastCheck')}</span><strong className="truncate text-sm text-ink">{dateLabel(backendTimestamp)}</strong></div>
                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 rounded-[7px] border border-line bg-surface-2/55 p-2.5 sm:col-span-2"><Database className="row-span-2 text-accent" size={17} /><span className="text-[11px] text-muted">{t('backend.dataDir')}</span><strong className="truncate text-sm text-ink">{backendDataDir}</strong></div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-5">
        <SectionTitle title={t('projects.title')} meta={`${items.length} ${items.length === 1 ? 'project' : 'projects'}`} />
        {projects.isLoading ? <LoadingState /> : null}
        {projects.error ? <ErrorState message={apiErrorMessage(projects.error)} /> : null}
        {!projects.isLoading && !projects.error && items.length === 0 ? <EmptyState title={t('projects.empty.title')} description={t('projects.empty.description')} /> : null}
        <div className="grid gap-3 lg:grid-cols-3">
          {items.map((project) => (
            <Card key={project.id}>
              <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{project.name}</strong><Badge>{project.status}</Badge></div>
              <p className="mt-2 text-xs leading-5 text-muted">{project.root_path}</p>
              <p className="mt-2 text-xs leading-5 text-muted">{t('common:meta.updated')} {dateLabel(project.updated_at)} · {t('common:meta.opened')} {dateLabel(project.last_opened_at)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" onClick={() => open.mutate(project.id)}><FolderOpen size={16} /> {t('projects.actions.open')}</Button>
                <Button onClick={() => clone.mutate(project.id)}><Copy size={16} /> {t('projects.actions.clone')}</Button>
                <Button variant="danger" onClick={() => archive.mutate(project.id)}><Archive size={16} /> {t('projects.actions.archive')}</Button>
                <Link className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[7px] border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2" to={`/projects/${project.id}`}>{t('projects.actions.dashboard')}</Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
