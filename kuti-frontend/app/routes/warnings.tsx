import { CheckCircle2, ExternalLink, RefreshCw, X } from "lucide-react";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router";
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
} from "~/components/ui";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateQueriesById } from "~/lib/query";
import {
  COHERENCE_RULE_DEFINITIONS,
  getCoherenceRuleOrigin,
} from "~/lib/coherence-registry";
import {
  listWarningsOptions,
  scanWarningsMutation,
  updateWarningMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import type { ListWarningsResponse } from "~/lib/backend/types.gen";

type WarningItem = ListWarningsResponse[number];

const WARNING_KIND_OPTIONS = COHERENCE_RULE_DEFINITIONS.map((rule) => ({
  value: rule.kind,
  labelKey: rule.titleKey,
  origin: rule.origin,
}));

const ORIGIN_OPTIONS = [
  { value: "all", labelKey: "filters.all" },
  { value: "project", labelKey: "origin.project" },
  { value: "scene", labelKey: "origin.scene" },
  { value: "reference", labelKey: "origin.reference" },
  { value: "story", labelKey: "origin.story" },
] as const;

const ENTITY_KIND_OPTIONS = [
  { value: "scene", labelKey: "entityKinds.scene" },
  { value: "character", labelKey: "entityKinds.character" },
  { value: "chapter", labelKey: "entityKinds.chapter" },
  { value: "tome", labelKey: "entityKinds.tome" },
  { value: "asset", labelKey: "entityKinds.asset" },
] as const;

const STATUS_OPTIONS = [
  { value: "open", labelKey: "common:status.open" },
  { value: "ignored", labelKey: "common:status.ignored" },
  { value: "resolved", labelKey: "common:status.resolved" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "critical", labelKey: "common:status.critical" },
  { value: "warning", labelKey: "common:status.warning" },
  { value: "info", labelKey: "common:status.info" },
] as const;

function readMetadata(warning: WarningItem): Record<string, unknown> {
  return warning.metadataJson &&
    typeof warning.metadataJson === "object" &&
    !Array.isArray(warning.metadataJson)
    ? (warning.metadataJson as Record<string, unknown>)
    : {};
}

function readString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readValue(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return null;
}

function readList(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
}

function resolveWarningOrigin(warning: WarningItem): string {
  const metadata = readMetadata(warning);
  const origin = readString(metadata, "signalSource");

  return origin ?? getCoherenceRuleOrigin(warning.kind);
}

function resolveWarningContext(warning: WarningItem, projectId: string) {
  const metadata = readMetadata(warning);

  switch (warning.entityKind) {
    case "character":
      return {
        label: readString(metadata, "characterName") ?? warning.entityId,
        hint: readString(metadata, "characterSlug") ?? null,
        href: `/projects/${projectId}/characters/${warning.entityId}`,
      };
    case "scene": {
      const tomeId = readString(metadata, "sceneTomeId");
      return {
        label: readString(metadata, "sceneTitle") ?? warning.entityId,
        hint: readString(metadata, "sceneSlug") ?? null,
        href: tomeId
          ? `/projects/${projectId}/story/${tomeId}/scenes/${warning.entityId}`
          : null,
      };
    }
    case "chapter": {
      const tomeId =
        readString(metadata, "chapterTomeId") ?? readString(metadata, "tomeId");
      return {
        label: readString(metadata, "chapterTitle") ?? warning.entityId,
        hint: readString(metadata, "chapterSlug") ?? null,
        href: tomeId
          ? `/projects/${projectId}/story/${tomeId}/chapters/${warning.entityId}`
          : null,
      };
    }
    case "tome":
      return {
        label: readString(metadata, "tomeTitle") ?? warning.entityId,
        hint: readString(metadata, "tomeSlug") ?? null,
        href: `/projects/${projectId}/story/${warning.entityId}`,
      };
    case "asset":
      return {
        label: readString(metadata, "assetName") ?? warning.entityId,
        hint: readString(metadata, "assetSlug") ?? null,
        href: `/projects/${projectId}/assets`,
      };
    default:
      return {
        label: warning.entityId,
        hint: warning.entityKind,
        href: null,
      };
  }
}

function WarningMetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/45 px-2.5 py-1 text-[11px] leading-none text-muted-foreground">
      <span className="uppercase tracking-[0.16em] text-muted-foreground/70">
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

export default function WarningsRoute() {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(["warnings", "common", "settings"]);
  const queryClient = useQueryClient();

  const filters = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get("status");
    const severity = params.get("severity");

    return {
      search: params.get("search") ?? "",
      status:
        status === "open" || status === "ignored" || status === "resolved"
          ? status
          : "all",
      severity:
        severity === "info" || severity === "warning" || severity === "critical"
          ? severity
          : "all",
      kind: params.get("kind") ?? "all",
      entityKind: params.get("entityKind") ?? "all",
      origin: params.get("origin") ?? "all",
    } as {
      search: string;
      status: WarningItem["status"] | "all";
      severity: WarningItem["severity"] | "all";
      kind: string;
      entityKind: string;
      origin: string;
    };
  }, [location.search]);

  const updateFilters = (next: Partial<typeof filters>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };

    if (merged.search.trim()) params.set("search", merged.search.trim());
    if (merged.status !== "all") params.set("status", merged.status);
    if (merged.severity !== "all") params.set("severity", merged.severity);
    if (merged.kind !== "all") params.set("kind", merged.kind);
    if (merged.entityKind !== "all")
      params.set("entityKind", merged.entityKind);
    if (merged.origin !== "all") params.set("origin", merged.origin);

    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true },
    );
  };

  const query = useMemo(
    () => ({
      status: filters.status === "all" ? undefined : filters.status,
      severity: filters.severity === "all" ? undefined : filters.severity,
      kind: filters.kind === "all" ? undefined : filters.kind,
      entityKind: filters.entityKind === "all" ? undefined : filters.entityKind,
    }),
    [filters.entityKind, filters.kind, filters.severity, filters.status],
  );

  const warnings = useQuery({
    ...listWarningsOptions({ path: { projectId }, query }),
    enabled: !!projectId,
  });
  const scan = useMutation({
    ...scanWarningsMutation(),
    onSuccess: () => {
      invalidateQueriesById(queryClient, "listWarnings");
    },
  });
  const update = useMutation({
    ...updateWarningMutation(),
    onSuccess: () => {
      invalidateQueriesById(queryClient, "listWarnings");
    },
  });

  const warningItems = (warnings.data ?? []) as WarningItem[];
  const filteredWarnings = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    if (!term) {
      return warningItems.filter(
        (warning) =>
          filters.origin === "all" ||
          resolveWarningOrigin(warning) === filters.origin,
      );
    }

    return warningItems.filter((warning) => {
      const metadata = readMetadata(warning);
      const origin = resolveWarningOrigin(warning);
      const searchable = [
        warning.title,
        warning.message,
        warning.kind,
        warning.severity,
        warning.status,
        warning.entityKind,
        warning.entityId,
        origin,
        JSON.stringify(metadata),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        searchable.includes(term) &&
        (filters.origin === "all" || origin === filters.origin)
      );
    });
  }, [filters.origin, filters.search, warningItems]);

  const openCount = warningItems.filter(
    (warning) => warning.status === "open",
  ).length;
  const criticalCount = warningItems.filter(
    (warning) => warning.severity === "critical",
  ).length;
  const ignoredCount = warningItems.filter(
    (warning) => warning.status === "ignored",
  ).length;
  const resolvedCount = warningItems.filter(
    (warning) => warning.status === "resolved",
  ).length;

  const handleScan = () => scan.mutate({ path: { projectId } });

  const updateStatus = (warningId: string, status: WarningItem["status"]) => {
    update.mutate({
      path: { projectId, warningId },
      body: { status, note: undefined },
    });
  };

  const handleResetFilters = () => {
    navigate({ pathname: location.pathname, search: "" }, { replace: true });
  };

  const hasActiveFilters =
    filters.search.length > 0 ||
    filters.status !== "all" ||
    filters.severity !== "all" ||
    filters.kind !== "all" ||
    filters.entityKind !== "all" ||
    filters.origin !== "all";

  return (
    <AppShell>
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={openCount > 0 ? "warning" : "ready"}>
              {t("summary.open", { count: openCount })}
            </Badge>
            <Button
              variant="primary"
              onClick={handleScan}
              disabled={scan.isPending}
            >
              <RefreshCw
                size={16}
                className={scan.isPending ? "animate-spin" : ""}
              />
              {scan.isPending ? t("actions.scanning") : t("actions.scan")}
            </Button>
          </div>
        }
      />

      {warnings.isLoading ? <LoadingState /> : null}
      {warnings.error ? (
        <ErrorState message={apiErrorMessage(warnings.error)} />
      ) : null}
      {scan.error ? <ErrorState message={apiErrorMessage(scan.error)} /> : null}
      {update.error ? (
        <ErrorState message={apiErrorMessage(update.error)} />
      ) : null}

      {!warnings.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Panel className="overflow-hidden">
            <div className="grid gap-4 border-b border-border/70 pb-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(5,minmax(0,0.65fr))]">
                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  <span>{t("filters.search")}</span>
                  <Input
                    value={filters.search}
                    onChange={(event) =>
                      updateFilters({ search: event.target.value })
                    }
                    placeholder={t("filters.searchPlaceholder")}
                  />
                </label>

                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  <span>{t("filters.status")}</span>
                  <Select
                    value={filters.status}
                    onValueChange={(value) =>
                      updateFilters({
                        status: value as WarningItem["status"] | "all",
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">{t("filters.all")}</SelectItem>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey, { ns: "settings" })}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  <span>{t("filters.severity")}</span>
                  <Select
                    value={filters.severity}
                    onValueChange={(value) =>
                      updateFilters({
                        severity: value as WarningItem["severity"] | "all",
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">{t("filters.all")}</SelectItem>
                        {SEVERITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  <span>{t("filters.kind")}</span>
                  <Select
                    value={filters.kind}
                    onValueChange={(value) => updateFilters({ kind: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">{t("filters.all")}</SelectItem>
                        {WARNING_KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey, { ns: "settings" })}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  <span>{t("filters.entityKind")}</span>
                  <Select
                    value={filters.entityKind}
                    onValueChange={(value) =>
                      updateFilters({ entityKind: value })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="all">{t("filters.all")}</SelectItem>
                        {ENTITY_KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>

                <label className="grid gap-1.5 text-xs text-muted-foreground">
                  <span>{t("filters.origin")}</span>
                  <Select
                    value={filters.origin}
                    onValueChange={(value) => updateFilters({ origin: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ORIGIN_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone="info">
                    {t("summary.matched", { count: filteredWarnings.length })}
                  </Badge>
                  <Badge tone="warning">
                    {t("summary.critical", { count: criticalCount })}
                  </Badge>
                  <Badge tone="open">
                    {t("summary.ignored", { count: ignoredCount })}
                  </Badge>
                  <Badge tone="resolved">
                    {t("summary.resolved", { count: resolvedCount })}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={handleResetFilters}
                  disabled={!hasActiveFilters}
                >
                  <X size={15} />
                  {t("filters.reset")}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 pt-4">
              {filteredWarnings.length > 0 ? (
                filteredWarnings.map((warning) => {
                  const context = resolveWarningContext(warning, projectId);
                  const metadata = readMetadata(warning);
                  const origin = resolveWarningOrigin(warning);
                  const extraPills: Array<{ label: string; value: string }> =
                    [];
                  const location = readString(metadata, "location");
                  const rawToken = readString(metadata, "rawToken");
                  const targetSlug = readString(metadata, "targetSlug");
                  const sceneSlug = readString(metadata, "sceneSlug");
                  const sceneTitle = readString(metadata, "sceneTitle");
                  const chapterTitle = readString(metadata, "chapterTitle");
                  const allowedLocations = readList(
                    metadata,
                    "allowedLocations",
                  );
                  const timelineSlug = readString(metadata, "timelineSlug");
                  const timelineAnchorLabel = readString(
                    metadata,
                    "timelineAnchorLabel",
                  );
                  const expectedOrderIndex = readValue(
                    metadata,
                    "expectedOrderIndex",
                  );
                  const actualOrderIndex = readValue(
                    metadata,
                    "actualOrderIndex",
                  );
                  const continuityKey = readString(metadata, "continuityKey");
                  const continuityValue = readString(
                    metadata,
                    "continuityValue",
                  );
                  const canonicalValue = readString(metadata, "canonicalValue");
                  const canonicalScope = readString(metadata, "canonicalScope");
                  const toneTags = readList(metadata, "toneTags");
                  const requiredToneTags = readList(
                    metadata,
                    "requiredToneTags",
                  );
                  const missingRequiredToneTags = readList(
                    metadata,
                    "missingRequiredToneTags",
                  );
                  const forbiddenToneTags = readList(
                    metadata,
                    "forbiddenToneTags",
                  );
                  const forbiddenToneHits = readList(
                    metadata,
                    "forbiddenToneHits",
                  );
                  const factKey = readString(metadata, "factKey");
                  const factValue = readString(metadata, "factValue");
                  const prohibitedValues = readList(
                    metadata,
                    "prohibitedValues",
                  );
                  const signalSource = readValue(metadata, "signalSource");

                  if (sceneTitle)
                    extraPills.push({
                      label: t("metadata.scene"),
                      value: sceneTitle,
                    });
                  if (sceneSlug)
                    extraPills.push({
                      label: t("metadata.sceneSlug"),
                      value: sceneSlug,
                    });
                  if (chapterTitle)
                    extraPills.push({
                      label: t("metadata.chapter"),
                      value: chapterTitle,
                    });
                  if (location)
                    extraPills.push({
                      label: t("metadata.location"),
                      value: location,
                    });
                  if (targetSlug)
                    extraPills.push({
                      label: t("metadata.target"),
                      value: targetSlug,
                    });
                  if (rawToken)
                    extraPills.push({
                      label: t("metadata.token"),
                      value: rawToken,
                    });
                  if (allowedLocations.length > 0) {
                    extraPills.push({
                      label: t("metadata.allowed"),
                      value: String(allowedLocations.length),
                    });
                  }
                  if (signalSource)
                    extraPills.push({
                      label: t("metadata.source"),
                      value: t(`origin.${signalSource}`, {
                        defaultValue: signalSource,
                      }),
                    });
                  if (timelineSlug)
                    extraPills.push({
                      label: t("metadata.timeline"),
                      value: timelineSlug,
                    });
                  if (timelineAnchorLabel)
                    extraPills.push({
                      label: t("metadata.anchor"),
                      value: timelineAnchorLabel,
                    });
                  if (expectedOrderIndex)
                    extraPills.push({
                      label: t("metadata.expectedOrder"),
                      value: expectedOrderIndex,
                    });
                  if (actualOrderIndex)
                    extraPills.push({
                      label: t("metadata.actualOrder"),
                      value: actualOrderIndex,
                    });
                  if (continuityKey)
                    extraPills.push({
                      label: t("metadata.continuityKey"),
                      value: continuityKey,
                    });
                  if (continuityValue)
                    extraPills.push({
                      label: t("metadata.continuityValue"),
                      value: continuityValue,
                    });
                  if (canonicalValue)
                    extraPills.push({
                      label: t("metadata.canonicalValue"),
                      value: canonicalValue,
                    });
                  if (canonicalScope)
                    extraPills.push({
                      label: t("metadata.scope"),
                      value: canonicalScope,
                    });
                  if (toneTags.length > 0)
                    extraPills.push({
                      label: t("metadata.toneTags"),
                      value: toneTags.join(", "),
                    });
                  if (requiredToneTags.length > 0)
                    extraPills.push({
                      label: t("metadata.requiredToneTags"),
                      value: requiredToneTags.join(", "),
                    });
                  if (missingRequiredToneTags.length > 0)
                    extraPills.push({
                      label: t("metadata.missingToneTags"),
                      value: missingRequiredToneTags.join(", "),
                    });
                  if (forbiddenToneTags.length > 0)
                    extraPills.push({
                      label: t("metadata.forbiddenToneTags"),
                      value: forbiddenToneTags.join(", "),
                    });
                  if (forbiddenToneHits.length > 0)
                    extraPills.push({
                      label: t("metadata.forbiddenHits"),
                      value: forbiddenToneHits.join(", "),
                    });
                  if (factKey)
                    extraPills.push({
                      label: t("metadata.factKey"),
                      value: factKey,
                    });
                  if (factValue)
                    extraPills.push({
                      label: t("metadata.factValue"),
                      value: factValue,
                    });
                  if (prohibitedValues.length > 0)
                    extraPills.push({
                      label: t("metadata.prohibitedValues"),
                      value: prohibitedValues.join(", "),
                    });

                  return (
                    <article
                      key={warning.id}
                      className="grid gap-4 rounded-2xl border border-border bg-background/80 p-4 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-colors hover:border-primary/35 hover:bg-background"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={warning.severity}>
                              {t(`severity.${warning.severity}`)}
                            </Badge>
                            <Badge tone={warning.status}>
                              {t(`status.${warning.status}`)}
                            </Badge>
                            <Badge tone="info">
                              {t(`kinds.${warning.kind}`, {
                                defaultValue: warning.kind,
                              })}
                            </Badge>
                            <Badge
                              tone={
                                origin === "project"
                                  ? "warning"
                                  : origin === "scene"
                                    ? "ready"
                                    : "info"
                              }
                            >
                              {t(`origin.${origin}`, { defaultValue: origin })}
                            </Badge>
                          </div>
                          <h3 className="mt-2 text-sm font-semibold text-foreground">
                            {warning.title}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {warning.message}
                          </p>
                        </div>

                        <div className="min-w-[190px] rounded-xl border border-border/70 bg-secondary/30 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {t("entity.title")}
                          </p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {context.label}
                          </p>
                          {context.hint ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {context.hint}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {extraPills.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {extraPills.map((pill) => (
                            <WarningMetaPill
                              key={`${warning.id}-${pill.label}-${pill.value}`}
                              label={pill.label}
                              value={pill.value}
                            />
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                        {context.href ? (
                          <LinkButton href={context.href} className="gap-1.5">
                            <ExternalLink size={14} />
                            {t("actions.openContext")}
                          </LinkButton>
                        ) : null}
                        {!context.href ? (
                          <Button
                            variant="secondary"
                            disabled
                            className="gap-1.5"
                          >
                            <ExternalLink size={14} />
                            {t("actions.openContext")}
                          </Button>
                        ) : null}

                        {warning.status === "open" ? (
                          <>
                            <Button
                              variant="primary"
                              onClick={() =>
                                updateStatus(warning.id, "resolved")
                              }
                              disabled={update.isPending}
                              className="gap-1.5"
                            >
                              <CheckCircle2 size={14} />
                              {t("actions.resolve")}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                updateStatus(warning.id, "ignored")
                              }
                              disabled={update.isPending}
                            >
                              {t("actions.ignore")}
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : !warnings.error ? (
                <EmptyState
                  title={
                    hasActiveFilters
                      ? t("empty.filtered.title")
                      : t("empty.title")
                  }
                  description={
                    hasActiveFilters
                      ? t("empty.filtered.description")
                      : t("empty.description")
                  }
                  action={
                    hasActiveFilters ? (
                      <Button variant="ghost" onClick={handleResetFilters}>
                        {t("filters.reset")}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={handleScan}
                        disabled={scan.isPending}
                      >
                        <RefreshCw
                          size={16}
                          className={scan.isPending ? "animate-spin" : ""}
                        />
                        {t("actions.scan")}
                      </Button>
                    )
                  }
                />
              ) : null}
            </div>
          </Panel>

          <div className="grid gap-4 self-start">
            <Panel>
              <SectionTitle
                title={t("summary.title")}
                meta={t("summary.meta", { count: warningItems.length })}
              />
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-xl border border-border/70 bg-secondary/25 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("summary.openLabel")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {openCount}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/25 p-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {t("summary.criticalLabel")}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {criticalCount}
                  </p>
                </div>
              </div>

              {scan.data ? (
                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-6 text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-foreground">
                      {t("scan.lastRun.title")}
                    </strong>
                    <Badge tone={scan.data.added > 0 ? "warning" : "ready"}>
                      {t("scan.lastRun.added", { count: scan.data.added })}
                    </Badge>
                  </div>
                  <p className="mt-2">
                    {t("scan.lastRun.description", {
                      scanned: scan.data.scanned,
                      resolved: scan.data.resolved,
                    })}
                  </p>
                </div>
              ) : null}
            </Panel>

            <Panel>
              <SectionTitle title={t("context.title")} />
              <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
                <p>{t("context.description")}</p>
                <p>{t("context.hint")}</p>
              </div>
            </Panel>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
