import { Check, ImagePlus, RefreshCw } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Panel, dateLabel } from "~/components/ui";
import { FormField } from "~/components/FormField";
import { Progress } from "~/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "~/components/ui/select";
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
import type { CreateGenerationJobData, ListModelsResponses, ValidateGenerationBoardData } from "~/lib/backend/types.gen";
import type { Options } from "~/lib/backend";

type Model = ListModelsResponses['200'][number];

interface CustomModelSelectProps {
  modelsByKind: { image: Model[]; video: Model[]; audio: Model[] };
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  notConfiguredLabel: string;
}

function CustomModelSelect({ modelsByKind, value, onChange, placeholder, notConfiguredLabel }: CustomModelSelectProps) {
  const { t } = useTranslation('generation');
  const selectedModel = useMemo(() => {
    const all = [...modelsByKind.image, ...modelsByKind.video, ...modelsByKind.audio];
    return all.find(m => m.key === value);
  }, [value, modelsByKind]);

  const groups = [
    { kind: 'image' as const, label: t('modelKinds.image'), items: modelsByKind.image },
    { kind: 'video' as const, label: t('modelKinds.video'), items: modelsByKind.video },
    { kind: 'audio' as const, label: t('modelKinds.audio'), items: modelsByKind.audio },
  ].filter(g => g.items.length > 0);

  return (
    <Select value={selectedModel?.key ?? ''} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((group) => (
          <SelectGroup key={group.kind}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.items.map((model) => (
              <SelectItem key={model.key} value={model.key}>
                {model.displayName}{!model.configured ? ` ${notConfiguredLabel}` : ''}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
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
    defaultValues: { sourceKind: 'scene', sourceId: '', modelKey: '', mode: 'separate' },
  });
  
  const modelKey = watch('modelKey');
  const modeValue = watch('mode');
  
  const sourceKind = useWatch({ control, name: 'sourceKind' });
  const sourceId = useWatch({ control, name: 'sourceId' });
  const [prevKind, setPrevKind] = useState(sourceKind);
  
  useEffect(() => {
    register('modelKey');
  }, [register]);

  useEffect(() => {
    if (sourceKind !== prevKind) {
      setValue('sourceId', '');
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
    if (models.data && !modelKey) {
      const all = models.data as Model[];
      const defaultModel = all.find(m => m.key === 'gpt_images_2' && m.configured)
        || all.find(m => m.kind === 'image' && m.configured);
      if (defaultModel) {
        setValue('modelKey', defaultModel.key);
      }
    }
  }, [models.data, modelKey, setValue]);
  
  const create = useMutation({
    ...createGenerationJobMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listGenerationJobs"] });
      queryClient.invalidateQueries({ queryKey: ["listGenerationBoards"] });
    },
  });
  const onSubmit = (data: GenerationJobInput) => create.mutate({
    path: { projectId },
    body: {
      sourceKind: data.sourceKind,
      sourceId: data.sourceId,
      strategy: "direct",
      modelKey: data.modelKey || undefined,
      mode: data.mode,
      gridRows: data.mode === "grid" ? 2 : undefined,
      gridCols: data.mode === "grid" ? 2 : undefined
    }
  } as unknown as Options<CreateGenerationJobData>, { onSuccess: () => reset() });
  
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.9fr)]">
        <Panel>
          <div className="mb-4 border-b border-border pb-3">
            <h2 className="text-[15px] font-semibold text-foreground">{t('panels.create.title')}</h2>
          </div>
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <FormField label={t('panels.create.sourceKind')} error={errors.sourceKind}>
              <Select value={sourceKind} onValueChange={(value) => setValue('sourceKind', value as GenerationJobInput['sourceKind'], { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{sourceOptions.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </FormField>
            <FormField label={t('panels.create.source')} error={errors.sourceId}>
              <Select value={sourceId || undefined} onValueChange={(value) => setValue('sourceId', value, { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t('panels.create.selectSource')} /></SelectTrigger>
                <SelectContent><SelectGroup>{(sources as Array<{ id: string; title: string }>).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </FormField>
            <FormField label={t('panels.create.model')} error={errors.modelKey}>
              <CustomModelSelect
                modelsByKind={modelsByKind}
                value={modelKey}
                onChange={(value) => setValue('modelKey', value)}
                placeholder={t('panels.create.selectModel')}
                notConfiguredLabel={t('panels.create.notConfigured')}
              />
            </FormField>
            <FormField label={t('panels.create.mode')} error={errors.mode}>
              <Select value={modeValue} onValueChange={(value) => setValue('mode', value as GenerationJobInput['mode'], { shouldDirty: true, shouldValidate: true })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="separate">{t('panels.create.separate')}</SelectItem>
                    <SelectItem value="grid">{t('panels.create.grid')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>
            <Button variant="primary" disabled={isSubmitting || create.isPending}><ImagePlus size={16} /> {t('panels.create.button')}</Button>
            {create.error ? <ErrorState message={apiErrorMessage(create.error)} /> : null}
          </form>
        </Panel>
        <Panel>
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
            <h2 className="text-[15px] font-semibold text-foreground">{t('panels.jobs.title')}</h2>
            <Badge>{jobItems.length}</Badge>
          </div>
          {jobs.isLoading ? <LoadingState /> : null}
          {jobs.error ? <ErrorState message={apiErrorMessage(jobs.error)} /> : null}
          {jobItems.length === 0 ? <EmptyState title={t('empty.noJob')} /> : null}
          <div className="grid gap-2">{(jobItems).map((job) => {
            const progress = Math.max(0, Math.min(100, job.progress ?? 0));
            return (
              <div className="grid gap-2 rounded-lg border border-border bg-secondary/35 p-3" key={job.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm text-foreground">{job.title}</strong>
                    <small className="text-xs text-muted-foreground">{t('panels.jobs.sourceKind')}: {job.sourceKind}</small>
                  </div>
                  <Badge tone={job.status}>{job.status}</Badge>
                </div>
                <Progress value={progress} />
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{job.modelName || job.entrypoint}</span>
                  <span>{progress}%</span>
                </div>
              </div>
            );
          })}</div>
        </Panel>
      </div>
      <Panel className="mt-3">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="text-[15px] font-semibold text-foreground">{t('panels.boards.title')}</h2>
          <Badge>{boardItems.length}</Badge>
        </div>
        {boardItems.length === 0 ? <EmptyState title={t('empty.noBoard')} /> : null}
        <div className="grid gap-3 lg:grid-cols-3">
          {(boardItems).map((board) => (
            <Card key={board.id}>
              <div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{board.title}</strong><Badge tone={board.status}>{board.status}</Badge></div>
              <p className="mt-2 text-xs text-muted">{board.sourceKind} · {dateLabel(board.createdAt)}</p>
              {board.panels?.[0] ? <img className="mt-3 aspect-[4/5] w-full rounded-[7px] border border-line bg-surface-2 object-cover" src={`${API_BASE_URL}/api/projects/${projectId}/generation/boards/${board.id}/panels/${board.panels[0].id}/image`} alt={board.panels[0].title} /> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2"><Button onClick={() => {
                validate.mutate({
                  path: { projectId, boardId: board.id },
                  body: {},
                } as unknown as Options<ValidateGenerationBoardData>);
              }}><Check size={15} /> {t('common:actions.validate')}</Button></div>
            </Card>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
