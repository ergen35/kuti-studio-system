import { Download, PackagePlus } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  Panel,
  SectionTitle,
  dateLabel,
} from "~/components/ui";
import { FormField } from "~/components/FormField";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { apiErrorMessage, API_BASE_URL } from "~/lib/errors";
import { invalidateQueriesById } from "~/lib/query";
import { getProjectOptions } from "~/lib/backend/@tanstack/react-query.gen";
import {
  listExportsOptions,
  createExportMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { readProjectSettings } from "~/lib/project-settings";
import { exportCreateSchema, type ExportCreateInput } from "~/lib/schemas";

type ExportKind = ExportCreateInput["kind"];
type ExportFormat = ExportCreateInput["formats"][number];

type ExportSourceSnapshot = {
  schemaVersion: number;
  capturedAt: string;
  project: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  counts: Record<string, number>;
};

const DEFAULT_FORMATS_BY_KIND: Record<ExportKind, ExportFormat[]> = {
  work: ["json"],
  publication: ["paged_images"],
};

const AVAILABLE_FORMATS_BY_KIND: Record<ExportKind, ExportFormat[]> = {
  work: ["json", "tree", "zip"],
  publication: ["paged_images", "pdf", "cbz", "epub"],
};

function formatByteSize(sizeBytes: unknown): string {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes)) {
    return "";
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function readSourceSnapshot(
  metadataJson: unknown,
): ExportSourceSnapshot | null {
  if (
    !metadataJson ||
    typeof metadataJson !== "object" ||
    Array.isArray(metadataJson)
  ) {
    return null;
  }

  const metadata = metadataJson as Record<string, unknown>;
  const sourceSnapshot = metadata.sourceSnapshot;

  if (
    !sourceSnapshot ||
    typeof sourceSnapshot !== "object" ||
    Array.isArray(sourceSnapshot)
  ) {
    return null;
  }

  const snapshot = sourceSnapshot as Record<string, unknown>;
  const project = snapshot.project;
  const counts = snapshot.counts;

  if (
    typeof snapshot.schemaVersion !== "number" ||
    typeof snapshot.capturedAt !== "string"
  ) {
    return null;
  }

  if (!project || typeof project !== "object" || Array.isArray(project)) {
    return null;
  }

  if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
    return null;
  }

  const projectRecord = project as Record<string, unknown>;
  const countRecord: Record<string, number> = {};

  for (const [key, value] of Object.entries(
    counts as Record<string, unknown>,
  )) {
    if (typeof value === "number" && Number.isFinite(value)) {
      countRecord[key] = value;
    }
  }

  return {
    schemaVersion: snapshot.schemaVersion,
    capturedAt: snapshot.capturedAt,
    project: {
      id: typeof projectRecord.id === "string" ? projectRecord.id : "",
      name: typeof projectRecord.name === "string" ? projectRecord.name : "",
      slug: typeof projectRecord.slug === "string" ? projectRecord.slug : "",
      status:
        typeof projectRecord.status === "string" ? projectRecord.status : "",
    },
    counts: countRecord,
  };
}

function snapshotItemCount(snapshot: ExportSourceSnapshot) {
  return Object.values(snapshot.counts).reduce(
    (total, value) => total + value,
    0,
  );
}

export default function ExportsRoute() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation(["exports", "common"]);
  const queryClient = useQueryClient();
  const project = useQuery({
    ...getProjectOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  const exports = useQuery({
    ...listExportsOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  const projectSettings = useMemo(() => {
    if (!project.data) return null;
    return readProjectSettings(project.data.settingsJson);
  }, [project.data]);

  const defaultLabels = useMemo(
    () => ({
      work: t("panels.create.defaults.workLabel"),
      publication: t("panels.create.defaults.publicationLabel"),
    }),
    [t],
  );

  const getFormatsForKind = useMemo(
    () => (kind: ExportKind) => {
      if (!projectSettings) {
        return DEFAULT_FORMATS_BY_KIND[kind];
      }

      const allowedFormats = AVAILABLE_FORMATS_BY_KIND[kind];
      const preferredFormats = projectSettings.exports.defaultFormats.filter(
        (format) => allowedFormats.includes(format),
      );
      return preferredFormats.length > 0
        ? preferredFormats
        : DEFAULT_FORMATS_BY_KIND[kind];
    },
    [projectSettings],
  );

  const getDefaultLabelForKind = useMemo(
    () => (kind: ExportKind) =>
      kind === "publication" ? defaultLabels.publication : defaultLabels.work,
    [defaultLabels],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<ExportCreateInput>({
    resolver: zodResolver(exportCreateSchema),
    defaultValues: {
      kind: projectSettings?.exports.defaultKind ?? "work",
      formats: projectSettings
        ? getFormatsForKind(projectSettings.exports.defaultKind)
        : DEFAULT_FORMATS_BY_KIND.work,
      label: projectSettings
        ? getDefaultLabelForKind(projectSettings.exports.defaultKind)
        : defaultLabels.work,
      summary: "",
    },
  });

  const kindValue = watch("kind");
  const labelValue = watch("label");
  const selectedFormats = watch("formats");
  const previousKindRef = useRef<ExportKind>(kindValue);

  useEffect(() => {
    if (!projectSettings) {
      return;
    }

    const initialKind = projectSettings.exports.defaultKind;

    reset({
      kind: initialKind,
      formats: getFormatsForKind(initialKind),
      label: getDefaultLabelForKind(initialKind),
      summary: "",
    });
    previousKindRef.current = initialKind;
  }, [getDefaultLabelForKind, getFormatsForKind, projectSettings, reset]);

  const formatCatalog = useMemo(
    () => ({
      work: [
        {
          value: "json" as ExportFormat,
          label: t("panels.create.formats.json.label"),
          description: t("panels.create.formats.json.description"),
        },
        {
          value: "tree" as ExportFormat,
          label: t("panels.create.formats.tree.label"),
          description: t("panels.create.formats.tree.description"),
        },
        {
          value: "zip" as ExportFormat,
          label: t("panels.create.formats.zip.label"),
          description: t("panels.create.formats.zip.description"),
        },
      ],
      publication: [
        {
          value: "paged_images" as ExportFormat,
          label: t("panels.create.formats.pagedImages.label"),
          description: t("panels.create.formats.pagedImages.description"),
        },
        {
          value: "pdf" as ExportFormat,
          label: t("panels.create.formats.pdf.label"),
          description: t("panels.create.formats.pdf.description"),
        },
        {
          value: "cbz" as ExportFormat,
          label: t("panels.create.formats.cbz.label"),
          description: t("panels.create.formats.cbz.description"),
        },
        {
          value: "epub" as ExportFormat,
          label: t("panels.create.formats.epub.label"),
          description: t("panels.create.formats.epub.description"),
        },
      ],
    }),
    [t],
  );

  const kindCatalog = useMemo(
    () => [
      {
        value: "work" as const,
        label: t("panels.create.kinds.work.label"),
        description: t("panels.create.kinds.work.description"),
      },
      {
        value: "publication" as const,
        label: t("panels.create.kinds.publication.label"),
        description: t("panels.create.kinds.publication.description"),
      },
    ],
    [t],
  );

  useEffect(() => {
    if (previousKindRef.current === kindValue) {
      return;
    }

    const nextFormats = getFormatsForKind(kindValue);
    const previousKind = previousKindRef.current;
    previousKindRef.current = kindValue;

    setValue("formats", nextFormats, {
      shouldDirty: true,
      shouldValidate: true,
    });

    if (!labelValue || labelValue === getDefaultLabelForKind(previousKind)) {
      setValue("label", getDefaultLabelForKind(kindValue), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [
    getDefaultLabelForKind,
    getFormatsForKind,
    kindValue,
    labelValue,
    setValue,
  ]);

  const create = useMutation({
    ...createExportMutation(),
  });

  const onSubmit = async (data: ExportCreateInput) => {
    const label = data.label.trim();
    const summary = data.summary.trim();

    for (const format of data.formats) {
      await create.mutateAsync({
        path: { projectId },
        body: {
          kind: data.kind,
          format,
          label,
          summary,
        },
      });
    }

    await Promise.all([
      exports.refetch(),
      invalidateQueriesById(queryClient, "listExports"),
    ]);

    reset({
      kind: data.kind,
      formats: getFormatsForKind(data.kind),
      label: getDefaultLabelForKind(data.kind),
      summary: "",
    });
  };

  const selectedFormatCount = selectedFormats.length;
  const availableFormats = formatCatalog[kindValue];

  return (
    <AppShell>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Panel>
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <SectionTitle
              title={t("panels.create.title")}
              meta={t("panels.create.subtitle")}
            />

            <FormField label={t("panels.create.kind")} error={errors.kind}>
              <ToggleGroup
                type="single"
                variant="outline"
                value={kindValue}
                onValueChange={(value) => {
                  if (!value) return;
                  setValue("kind", value as ExportKind, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                className="w-full flex-wrap justify-start"
              >
                {kindCatalog.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="h-auto min-h-18 flex-1 basis-56 flex-col items-start gap-1.5 px-3 py-2.5 text-left"
                  >
                    <span className="text-sm font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FormField>

            <FormField
              label={t("panels.create.formats.label")}
              error={errors.formats}
            >
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={selectedFormats}
                onValueChange={(value) => {
                  setValue("formats", value as ExportFormat[], {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                className="w-full flex-wrap justify-start"
              >
                {availableFormats.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="h-auto min-h-20 flex-1 basis-64 flex-col items-start gap-1.5 px-3 py-2.5 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {option.label}
                      <Badge className="rounded-full px-1.5 py-0 text-[10px] uppercase tracking-[0.16em]">
                        {option.value}
                      </Badge>
                    </span>
                    <span className="text-xs leading-5 text-muted-foreground">
                      {option.description}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {t("panels.create.formats.hint")}
              </p>
            </FormField>

            <FormField label={t("panels.create.label")} error={errors.label}>
              <Input {...register("label")} />
            </FormField>

            <FormField
              label={t("panels.create.summary")}
              error={errors.summary}
            >
              <Textarea
                {...register("summary")}
                rows={4}
                placeholder={t("panels.create.summaryPlaceholder")}
              />
            </FormField>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs leading-5 text-muted-foreground">
                {t("panels.create.submitHint", { count: selectedFormatCount })}
              </p>
              <Button
                variant="primary"
                disabled={isSubmitting || create.isPending}
              >
                <PackagePlus size={16} />
                {selectedFormatCount > 1
                  ? t("panels.create.buttonMultiple", {
                      count: selectedFormatCount,
                    })
                  : t("panels.create.button")}
              </Button>
            </div>

            {create.error ? (
              <ErrorState message={apiErrorMessage(create.error)} />
            ) : null}
          </form>
        </Panel>

        <Panel>
          <SectionTitle
            title={t("panels.artifacts.title")}
            meta={
              exports.data
                ? t("panels.artifacts.count", { count: exports.data.length })
                : undefined
            }
          />
          {exports.isLoading ? (
            <LoadingState label={t("panels.artifacts.loading")} />
          ) : null}
          {exports.error ? (
            <ErrorState message={apiErrorMessage(exports.error)} />
          ) : null}
          {!exports.isLoading &&
          !exports.error &&
          exports.data?.length === 0 ? (
            <EmptyState
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : null}
          <div className="grid gap-3">
            {(exports.data || []).map((item) => {
              const sourceSnapshot = readSourceSnapshot(item.metadataJson);

              return (
                <article
                  className="grid gap-3 rounded-xl border border-border bg-secondary/25 p-3 transition-colors hover:border-primary/30 hover:bg-secondary/40"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="truncate text-sm font-semibold text-foreground">
                          {item.label}
                        </strong>
                        <Badge tone={item.kind}>{item.kind}</Badge>
                        <Badge tone={item.format}>{item.format}</Badge>
                      </div>
                      {item.summary ? (
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {item.summary}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={item.status}>{item.status}</Badge>
                  </div>

                  {sourceSnapshot ? (
                    <div className="flex flex-wrap items-center gap-2 text-[11px] leading-5 text-muted-foreground">
                      <Badge tone="info">
                        {t("panels.artifacts.sourceSnapshot")}
                      </Badge>
                      <span>{sourceSnapshot.project.name}</span>
                      <span>·</span>
                      <span>{dateLabel(sourceSnapshot.capturedAt)}</span>
                      <span>·</span>
                      <span>
                        {t("panels.artifacts.sourceSnapshotCount", {
                          count: snapshotItemCount(sourceSnapshot),
                        })}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{dateLabel(item.createdAt)}</span>
                    <span>
                      {formatByteSize(item.sizeBytes) ||
                        t("panels.artifacts.sizeUnknown")}
                    </span>
                  </div>

                  {item.artifactPath ? (
                    <LinkButton
                      href={`${API_BASE_URL}/api/projects/${projectId}/exports/${item.id}/download`}
                    >
                      <Download size={15} />
                      {t("common:actions.download")}
                    </LinkButton>
                  ) : null}
                </article>
              );
            })}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
