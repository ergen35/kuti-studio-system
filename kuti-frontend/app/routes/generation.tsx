import { Check, ImagePlus, RefreshCw } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Panel, dateLabel } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { api, apiErrorMessage, type Chapter, type Scene, type Tome } from "~/lib/api";
import { invalidateWorkspace, keys } from "~/lib/query";
import { generationJobSchema, type GenerationJobInput } from "~/lib/schemas";

export default function GenerationRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['generation', 'common']);
  const story = useQuery({ queryKey: keys.story(projectId), queryFn: () => api.story(projectId) });
  const models = useQuery({ queryKey: keys.models, queryFn: api.models });
  const jobs = useQuery({ queryKey: keys.generationJobs(projectId), queryFn: () => api.generationJobs(projectId) });
  const boards = useQuery({ queryKey: keys.generationBoards(projectId), queryFn: () => api.generationBoards(projectId) });
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control, setValue } = useForm<GenerationJobInput>({
    resolver: zodResolver(generationJobSchema),
    defaultValues: { source_kind: 'scene', source_id: '', model_key: '', mode: 'separate' },
  });
  
  const sourceKind = useWatch({ control, name: 'source_kind' });
  const [prevKind, setPrevKind] = useState(sourceKind);
  
  useEffect(() => {
    if (sourceKind !== prevKind) {
      setValue('source_id', '');
      setPrevKind(sourceKind);
    }
  }, [sourceKind, prevKind, setValue]);
  
  const sources = useMemo<Array<Tome | Chapter | Scene>>(() => 
    sourceKind === "tome" ? story.data?.tomes || [] : 
    sourceKind === "chapter" ? story.data?.chapters || [] : 
    story.data?.scenes || [], 
  [sourceKind, story.data]);
  
  const create = useMutation({ 
    mutationFn: (data: GenerationJobInput) => api.createGenerationJob(projectId, { 
      source_kind: data.source_kind, 
      source_id: data.source_id, 
      strategy: "direct", 
      model_key: data.model_key || undefined, 
      mode: data.mode, 
      grid_rows: data.mode === "grid" ? 2 : undefined, 
      grid_cols: data.mode === "grid" ? 2 : undefined 
    }), 
    onSuccess: () => { reset(); invalidateWorkspace(projectId); }
  });
  const onSubmit = (data: GenerationJobInput) => create.mutate(data);
  
  const validate = useMutation({ mutationFn: (boardId: string) => api.validateBoard(projectId, boardId), onSuccess: () => invalidateWorkspace(projectId) });

  const sourceOptions = [
    { value: "scene", label: t('sources.scene') },
    { value: "chapter", label: t('sources.chapter') },
    { value: "tome", label: t('sources.tome') },
  ];

  return (
    <AppShell>
      <PageHeader title={t('title')} description={t('description')} actions={<Button onClick={() => { jobs.refetch(); boards.refetch(); }}><RefreshCw size={16} /> {t('common:nav.refresh')}</Button>} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <FormField label={t('panels.create.sourceKind')} error={errors.source_kind}>
              <select {...register('source_kind')}>
                {sourceOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </FormField>
            <FormField label={t('panels.create.source')} error={errors.source_id}>
              <select {...register('source_id')}>
                <option value="">{t('panels.create.selectSource')}</option>
                {sources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </FormField>
            <FormField label={t('panels.create.model')} error={errors.model_key}>
              <select {...register('model_key')}>
                <option value="">{t('panels.create.defaultModel')}</option>
                {(models.data || []).map((model) => <option key={model.key} value={model.key}>{model.display_name} · {model.kind} {model.configured ? "" : t('panels.create.notConfigured')}</option>)}
              </select>
            </FormField>
            <FormField label={t('panels.create.mode')} error={errors.mode}>
              <select {...register('mode')}>
                <option value="separate">{t('panels.create.separate')}</option>
                <option value="grid">{t('panels.create.grid')}</option>
              </select>
            </FormField>
            <Button variant="primary" disabled={isSubmitting || create.isPending}><ImagePlus size={16} /> {t('panels.create.button')}</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t('panels.jobs.title')}</h2>
          {jobs.isLoading ? <LoadingState /> : null}
          {jobs.error ? <ErrorState message={apiErrorMessage(jobs.error)} /> : null}
          {jobs.data?.length === 0 ? <EmptyState title={t('empty.noJob')} /> : null}
          <div className="grid gap-2">{(jobs.data || []).map((job) => <div className="grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5" key={job.id}><div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{job.title}</strong><Badge tone={job.status}>{job.status}</Badge></div><small className="text-xs text-muted">{t('panels.jobs.sourceKind')}: {job.source_kind} · {job.progress}%</small><small className="text-xs text-muted">{job.model_name || job.entrypoint}</small></div>)}</div>
        </Panel>
      </div>
      <Panel className="mt-3">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">{t('panels.boards.title')}</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {(boards.data || []).map((board) => (
            <Card key={board.id}>
              <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{board.title}</strong><Badge tone={board.status}>{board.status}</Badge></div>
              <p className="mt-2 text-xs text-muted">{board.source_kind} · {dateLabel(board.created_at)}</p>
              {board.panels[0] ? <img className="mt-3 aspect-[4/5] w-full rounded-[7px] border border-line bg-surface-2 object-cover" src={api.fileUrl(`/projects/${projectId}/generation/boards/${board.id}/panels/${board.panels[0].id}/image`)} alt={board.panels[0].title} /> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2"><Button onClick={() => validate.mutate(board.id)}><Check size={15} /> {t('common:actions.validate')}</Button></div>
            </Card>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
