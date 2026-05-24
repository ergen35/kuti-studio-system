import { Check, ImagePlus, RefreshCw, Image, Video, AudioLines } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Panel, dateLabel } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { apiErrorMessage, API_BASE_URL } from "~/lib/errors";
import {
  getStorySummaryOptions,
  listGenerationJobsOptions,
  listGenerationBoardsOptions,
  listModelsOptions,
  createGenerationJobMutation,
  validateGenerationBoardMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { generationJobSchema, type GenerationJobInput } from "~/lib/schemas";
import type { ListModelsResponses } from "~/lib/backend/types.gen";

type Model = ListModelsResponses['200'][number];

interface CustomModelSelectProps {
  modelsByKind: { image: Model[]; video: Model[]; audio: Model[] };
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  notConfiguredLabel: string;
}

function CustomModelSelect({ modelsByKind, value, onChange, placeholder, notConfiguredLabel }: CustomModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedModel = useMemo(() => {
    const all = [...modelsByKind.image, ...modelsByKind.video, ...modelsByKind.audio];
    return all.find(m => m.key === value);
  }, [value, modelsByKind]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const groups = [
    { kind: 'image' as const, label: 'Images', icon: Image, items: modelsByKind.image },
    { kind: 'video' as const, label: 'Vidéos', icon: Video, items: modelsByKind.video },
    { kind: 'audio' as const, label: 'Audio', icon: AudioLines, items: modelsByKind.audio },
  ].filter(g => g.items.length > 0);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-[7px] border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none transition-colors hover:bg-surface-2 focus:border-accent"
      >
        <span className={selectedModel ? 'text-ink' : 'text-muted'}>
          {selectedModel ? selectedModel.displayName : placeholder}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-[7px] border border-line bg-surface shadow-card">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.kind} className="border-b border-line last:border-b-0">
                <div className="flex items-center gap-2 bg-surface-2 px-2.5 py-1.5 text-xs font-medium uppercase text-muted">
                  <Icon size={14} />
                  <span>{group.label}</span>
                </div>
                {group.items.map((model) => (
                  <button
                    type="button"
                    key={model.key}
                    onClick={() => {
                      onChange(model.key);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/10 ${value === model.key ? 'bg-accent/10 text-accent' : 'text-ink'}`}
                  >
                    <span>{model.displayName}</span>
                    {!model.configured && (
                      <span className="text-xs text-muted">({notConfiguredLabel})</span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GenerationRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(['generation', 'common']);
  const queryClient = useQueryClient();
  const story = useQuery({ ...getStorySummaryOptions({ path: { projectId: projectId } }), enabled: !!projectId });
  const models = useQuery({ ...listModelsOptions(), staleTime: 5 * 60 * 1000 });
  const jobs = useQuery({ ...listGenerationJobsOptions({ path: { projectId: projectId } }), enabled: !!projectId });
  const boards = useQuery({ ...listGenerationBoardsOptions({ path: { projectId: projectId } }), enabled: !!projectId });
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, control, setValue, watch } = useForm<GenerationJobInput>({
    resolver: zodResolver(generationJobSchema),
    defaultValues: { source_kind: 'scene', source_id: '', model_key: '', mode: 'separate' },
  });
  
  const model_key = watch('model_key');
  
  const sourceKind = useWatch({ control, name: 'source_kind' });
  const [prevKind, setPrevKind] = useState(sourceKind);
  
  useEffect(() => {
    if (sourceKind !== prevKind) {
      setValue('source_id', '');
      setPrevKind(sourceKind);
    }
  }, [sourceKind, prevKind, setValue]);
  
  const sources = useMemo<Array<unknown>>(() => 
    sourceKind === "tome" ? story.data?.tomes || [] : 
    sourceKind === "chapter" ? story.data?.chapters || [] : 
    story.data?.scenes || [], 
  [sourceKind, story.data]);
  
  // Group models by kind for organized display
  const modelsByKind = useMemo(() => {
    const all = (models.data as Model[] | undefined) ?? [];
    return {
      image: all.filter(m => m.kind === 'image'),
      video: all.filter(m => m.kind === 'video'),
      audio: all.filter(m => m.kind === 'audio'),
    };
  }, [models.data]);
  
  // Set default model to gpt_images_2 if configured, otherwise first configured image model
  useEffect(() => {
    if (models.data && !model_key) {
      const all = models.data as Model[];
      const defaultModel = all.find(m => m.key === 'gpt_images_2' && m.configured)
        || all.find(m => m.kind === 'image' && m.configured);
      if (defaultModel) {
        setValue('model_key', defaultModel.key);
      }
    }
  }, [models.data, model_key, setValue]);
  
  const create = useMutation({
    ...createGenerationJobMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listGenerationJobs"] });
      queryClient.invalidateQueries({ queryKey: ["listGenerationBoards"] });
    },
  });
  const onSubmit = (data: GenerationJobInput) => create.mutate({
    // @ts-expect-error - SDK types have path as never but the API requires projectId
    path: { projectId },
    body: {
      sourceKind: data.source_kind,
      sourceId: data.source_id,
      strategy: "direct",
      modelKey: data.model_key || undefined,
      mode: data.mode,
      gridRows: data.mode === "grid" ? 2 : undefined,
      gridCols: data.mode === "grid" ? 2 : undefined
    }
  }, { onSuccess: () => reset() });
  
  const validate = useMutation(validateGenerationBoardMutation());

  const jobItems = (jobs.data as Array<{ id: string; title: string; status: string; sourceKind?: string; progress?: number; modelName?: string; entrypoint?: string }> | undefined) ?? [];
  const boardItems = (boards.data as Array<{ id: string; title: string; status: string; sourceKind?: string; createdAt?: string; panels?: Array<{ id: string; title: string }> }> | undefined) ?? [];

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
                {(sources as Array<{ id: string; title: string }>).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </FormField>
            <FormField label={t('panels.create.model')} error={errors.model_key}>
              <CustomModelSelect
                modelsByKind={modelsByKind}
                value={model_key}
                onChange={(value) => setValue('model_key', value)}
                placeholder={t('panels.create.selectModel')}
                notConfiguredLabel={t('panels.create.notConfigured')}
              />
              {/* Hidden input for react-hook-form */}
              <input type="hidden" {...register('model_key')} value={model_key} />
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
          {jobItems.length === 0 ? <EmptyState title={t('empty.noJob')} /> : null}
          <div className="grid gap-2">{(jobItems).map((job) => <div className="grid gap-1 rounded-[7px] border border-line bg-surface-2/55 p-2.5" key={job.id}><div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{job.title}</strong><Badge tone={job.status}>{job.status}</Badge></div><small className="text-xs text-muted">{t('panels.jobs.sourceKind')}: {job.sourceKind} · {job.progress}%</small><small className="text-xs text-muted">{job.modelName || job.entrypoint}</small></div>)}</div>
        </Panel>
      </div>
      <Panel className="mt-3">
        <h2 className="mb-3 text-[15px] font-semibold text-ink">{t('panels.boards.title')}</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {(boardItems).map((board) => (
            <Card key={board.id}>
              <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{board.title}</strong><Badge tone={board.status}>{board.status}</Badge></div>
              <p className="mt-2 text-xs text-muted">{board.sourceKind} · {dateLabel(board.createdAt)}</p>
              {board.panels?.[0] ? <img className="mt-3 aspect-[4/5] w-full rounded-[7px] border border-line bg-surface-2 object-cover" src={`${API_BASE_URL}/api/projects/${projectId}/generation/boards/${board.id}/panels/${board.panels[0].id}/image`} alt={board.panels[0].title} /> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2"><Button onClick={() => {
                validate.mutate({
                  // @ts-expect-error - SDK types have path as never but the API requires it
                  path: { projectId, boardId: board.id }
                });
              }}><Check size={15} /> {t('common:actions.validate')}</Button></div>
            </Card>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
