import {
  Archive,
  File,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Music2,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocation, useParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  PageHeader,
  Panel,
  SectionTitle,
  dateLabel,
} from "~/components/ui";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { FormField } from "~/components/FormField";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { apiErrorMessage, API_BASE_URL } from "~/lib/errors";
import { csv } from "~/lib/utils";
import { invalidateQueriesById } from "~/lib/query";
import { normalizeReferenceSlug } from "~/lib/references";
import {
  getAssetOptions,
  getProjectOptions,
  listAssetsOptions,
  importAssetMutation,
  archiveAssetMutation,
  deleteAssetMutation,
  deleteAssetLinkMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import { readProjectSettings } from "~/lib/project-settings";
import type {
  GetAssetResponse,
  ListAssetsResponse,
} from "~/lib/backend/types.gen";
import { assetImportSchema, type AssetImportInput } from "~/lib/schemas";

type AssetItem = ListAssetsResponse[number];
type AssetLinkItem = GetAssetResponse["links"][number];

function assetTypeIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon size={22} />;
  }

  if (mimeType.startsWith("audio/")) {
    return <Music2 size={22} />;
  }

  if (mimeType.startsWith("video/")) {
    return <Film size={22} />;
  }

  if (mimeType === "application/pdf") {
    return <FileText size={22} />;
  }

  return <File size={22} />;
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "asset"
  );
}

export default function AssetsRoute() {
  const { projectId = "" } = useParams();
  const location = useLocation();
  const { t } = useTranslation(["assets", "common"]);
  const queryClient = useQueryClient();
  const project = useQuery({
    ...getProjectOptions({ path: { projectId } }),
    enabled: !!projectId,
  });
  const assets = useQuery({
    ...listAssetsOptions({ path: { projectId: projectId } }),
    enabled: !!projectId,
  });
  const [assetToDelete, setAssetToDelete] = useState<AssetItem | null>(null);
  const [linkToDetach, setLinkToDetach] = useState<{
    assetId: string;
    assetName: string;
    link: AssetLinkItem;
  } | null>(null);
  const highlightedAssetSlug = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("asset")?.trim() || null;
  }, [location.search]);
  const highlightedAssetRef = useRef<HTMLDivElement | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AssetImportInput>({
    resolver: zodResolver(assetImportSchema),
    defaultValues: { sourcePath: "", name: "", tags: "" },
  });
  const assetItems = (assets.data ?? []) as AssetItem[];
  const projectSettings = useMemo(() => {
    if (!project.data) {
      return null;
    }

    return readProjectSettings(project.data.settingsJson);
  }, [project.data]);
  const showUsageHints = projectSettings?.assets.showUsageHints ?? false;
  const archiveOnDelete = projectSettings?.assets.archiveOnDelete ?? true;
  const highlightedAsset = useMemo(() => {
    if (!highlightedAssetSlug) return null;
    const normalizedSlug = normalizeReferenceSlug(highlightedAssetSlug);
    return (
      assetItems.find(
        (asset) => normalizeReferenceSlug(asset.slug) === normalizedSlug,
      ) ?? null
    );
  }, [assetItems, highlightedAssetSlug]);
  const highlightedAssetClassName =
    "border-primary/45 bg-primary/10 ring-2 ring-primary/35 shadow-sm";
  const assetDetailQueries = useQueries({
    queries: assetItems.map((asset) => ({
      ...getAssetOptions({ path: { projectId, assetId: asset.id } }),
      enabled: !!projectId,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const selectedAssetIndex = useMemo(
    () =>
      assetToDelete
        ? assetItems.findIndex((asset) => asset.id === assetToDelete.id)
        : -1,
    [assetItems, assetToDelete],
  );
  const selectedAssetDetailQuery =
    selectedAssetIndex >= 0
      ? assetDetailQueries[selectedAssetIndex]
      : undefined;
  const selectedAssetUsages =
    (selectedAssetDetailQuery?.data as GetAssetResponse | undefined)?.usages ??
    [];
  const selectedAssetDetailLoading = Boolean(
    selectedAssetDetailQuery?.isLoading,
  );
  const linkKindLabels = useMemo(
    () => ({
      character: t("links.targetKinds.character"),
      scene: t("links.targetKinds.scene"),
      chapter: t("links.targetKinds.chapter"),
      tome: t("links.targetKinds.tome"),
    }),
    [t],
  );

  const refreshAssets = () => {
    invalidateQueriesById(queryClient, ["listAssets", "getAsset"]);
  };

  useEffect(() => {
    if (!highlightedAsset) return;
    highlightedAssetRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightedAsset]);

  const importAsset = useMutation({
    ...importAssetMutation(),
    onSuccess: () => {
      refreshAssets();
    },
  });
  const onSubmit = (data: AssetImportInput) =>
    importAsset.mutate(
      {
        path: { projectId: projectId },
        body: {
          sourcePath: data.sourcePath,
          name: data.name || data.sourcePath.split(/[\\/]/).pop() || "Asset",
          slug: slugify(
            data.name || data.sourcePath.split(/[\\/]/).pop() || "asset",
          ),
          tags: data.tags ? csv(data.tags) : undefined,
        },
      },
      { onSuccess: () => reset() },
    );

  const archive = useMutation({
    ...archiveAssetMutation(),
    onSuccess: () => {
      refreshAssets();
    },
  });
  const detachLink = useMutation({
    ...deleteAssetLinkMutation(),
    onSuccess: () => {
      refreshAssets();
      setLinkToDetach(null);
    },
  });
  const remove = useMutation({
    ...deleteAssetMutation(),
    onSuccess: () => {
      refreshAssets();
      setAssetToDelete(null);
    },
  });

  return (
    <AppShell>
      <PageHeader title={t("title")} description={t("description")} />
      <div className="grid items-start gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Panel>
          <SectionTitle title={t("panels.import.title")} />
          <form className="grid gap-3" onSubmit={handleSubmit(onSubmit)}>
            <FormField
              label={t("panels.import.sourcePath")}
              error={errors.sourcePath}
            >
              <Input
                {...register("sourcePath")}
                placeholder={t("panels.import.placeholder")}
              />
            </FormField>
            <FormField label={t("panels.import.name")} error={errors.name}>
              <Input {...register("name")} />
            </FormField>
            <FormField label={t("panels.import.tags")} error={errors.tags}>
              <Input {...register("tags")} />
            </FormField>
            <Button
              variant="primary"
              disabled={isSubmitting || importAsset.isPending}
            >
              <Plus size={16} /> {t("panels.import.button")}
            </Button>
            {importAsset.error ? (
              <ErrorState message={apiErrorMessage(importAsset.error)} />
            ) : null}
          </form>
        </Panel>
        <Panel>
          <SectionTitle
            title={t("panels.assets.title")}
            meta={t("panels.assets.count", { count: assetItems.length })}
          />
          {showUsageHints ? (
            <Alert className="mb-4 border-primary/20 bg-primary/5">
              <AlertTitle>{t("hints.title")}</AlertTitle>
              <AlertDescription>{t("hints.description")}</AlertDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={archiveOnDelete ? "ready" : "warning"}>
                  {archiveOnDelete
                    ? t("hints.archiveOnDeleteEnabled")
                    : t("hints.archiveOnDeleteDisabled")}
                </Badge>
                <Badge tone="info">{t("hints.showUsageHintsEnabled")}</Badge>
              </div>
            </Alert>
          ) : null}
          {assets.isLoading ? <LoadingState /> : null}
          {assets.error ? (
            <ErrorState message={apiErrorMessage(assets.error)} />
          ) : null}
          {!assets.isLoading && !assets.error && assetItems.length === 0 ? (
            <EmptyState
              title={t("empty.title")}
              description={t("empty.description")}
            />
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {assetItems.map((asset, index) => {
              const detailQuery = assetDetailQueries[index];
              const detailLoading = Boolean(detailQuery?.isLoading);
              const detail =
                (detailQuery?.data as GetAssetResponse | undefined) ??
                undefined;
              const links = detail?.links ?? [];
              const usages = detail?.usages ?? [];
              const isHighlighted =
                highlightedAsset &&
                normalizeReferenceSlug(asset.slug) ===
                  normalizeReferenceSlug(highlightedAsset.slug);
              const statusTone =
                asset.status === "archived" ? "warning" : "ready";
              const usageTone = detailLoading
                ? "info"
                : showUsageHints
                  ? usages.length > 0
                    ? "info"
                    : "warning"
                  : links.length > 0
                    ? "info"
                    : "warning";
              const archivedAt =
                typeof asset.archivedAt === "string" ? asset.archivedAt : null;

              return (
                <Card
                  key={asset.id}
                  ref={isHighlighted ? highlightedAssetRef : undefined}
                  className={[
                    isHighlighted ? highlightedAssetClassName : null,
                    asset.status === "archived"
                      ? "border-dashed bg-muted/20"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="grid gap-3">
                    <div className="overflow-hidden rounded-xl border border-border/70 bg-secondary/20">
                      {asset.mimeType.startsWith("image/") ? (
                        <img
                          src={`${API_BASE_URL}/api/projects/${projectId}/assets/${asset.id}/file`}
                          alt={asset.name}
                          className="aspect-[16/9] w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex aspect-[16/9] items-center justify-center gap-3 px-4 py-5">
                          <div className="rounded-full border border-border bg-background/80 p-3 text-muted-foreground shadow-sm">
                            {assetTypeIcon(asset.mimeType)}
                          </div>
                          <div className="grid gap-1 min-w-0">
                            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                              {asset.mimeType.split("/")[0]}
                            </span>
                            <strong className="truncate text-sm text-foreground">
                              {asset.originalFilename}
                            </strong>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm text-ink">
                        {asset.name}
                      </strong>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Badge tone={statusTone}>{asset.status}</Badge>
                        {detailLoading ? (
                          <Badge tone="info">{t("links.loading")}</Badge>
                        ) : showUsageHints ? (
                          <Badge tone={usageTone}>
                            {usages.length > 0
                              ? t("usage.linked", { count: usages.length })
                              : t("usage.orphan")}
                          </Badge>
                        ) : (
                          <Badge tone={usageTone}>
                            {links.length > 0
                              ? t("links.linked", { count: links.length })
                              : t("links.orphan")}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {asset.description ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {asset.description}
                      </p>
                    ) : null}
                    <p className="text-xs leading-5 text-muted">
                      {asset.originalFilename} · {asset.mimeType}
                    </p>
                    <p className="text-xs leading-5 text-muted">
                      {asset.sizeBytes} {t("meta.size")} ·{" "}
                      {dateLabel(asset.updatedAt)}
                    </p>
                    {archivedAt ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {t("meta.archivedAt")}: {dateLabel(archivedAt)}
                      </p>
                    ) : null}
                    {links.length > 0 ? (
                      <div className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {t("links.title")}
                          </span>
                          <Badge tone="info">
                            {t("links.linked", { count: links.length })}
                          </Badge>
                        </div>
                        <div className="grid gap-2">
                          {links.map((link) => (
                            <div
                              key={link.id}
                              className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2"
                            >
                              <div className="grid min-w-0 gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone="info">
                                    {linkKindLabels[
                                      link.targetKind as keyof typeof linkKindLabels
                                    ] ?? link.targetKind}
                                  </Badge>
                                  <span className="truncate text-xs text-foreground">
                                    {link.targetId}
                                  </span>
                                </div>
                                {link.note ? (
                                  <p className="text-xs leading-5 text-muted-foreground">
                                    {link.note}
                                  </p>
                                ) : null}
                              </div>
                              <Button
                                type="button"
                                variant="icon"
                                className="shrink-0"
                                title={t("links.detach")}
                                onClick={() =>
                                  setLinkToDetach({
                                    assetId: asset.id,
                                    assetName: asset.name,
                                    link,
                                  })
                                }
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {showUsageHints ? (
                      <div className="grid gap-2 rounded-xl border border-border/70 bg-background/70 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {t("usage.title")}
                          </span>
                          <Badge tone={usageTone}>
                            {detailLoading
                              ? t("usage.loading")
                              : usages.length > 0
                                ? t("usage.linked", { count: usages.length })
                                : t("usage.orphan")}
                          </Badge>
                        </div>
                        {detailLoading ? (
                          <p className="text-xs leading-5 text-muted-foreground">
                            {t("usage.loadingDescription")}
                          </p>
                        ) : usages.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {usages.slice(0, 4).map((usage) => (
                              <span
                                key={`${asset.id}-${usage.kind}-${usage.id}`}
                                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-2 py-1 text-xs text-foreground"
                              >
                                <span className="max-w-[180px] truncate">
                                  {usage.name}
                                </span>
                                <Badge tone="info">
                                  {usage.kind === "character_image"
                                    ? t("usageKinds.character_image")
                                    : usage.kind === "generation_panel"
                                      ? t("usageKinds.generation_panel")
                                      : usage.kind.replace(/_/g, " ")}
                                </Badge>
                              </span>
                            ))}
                            {usages.length > 4 ? (
                              <span className="text-xs text-muted-foreground">
                                +{usages.length - 4}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <p className="text-xs leading-5 text-muted-foreground">
                            {t("usage.empty")}
                          </p>
                        )}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <LinkButton
                        href={`${API_BASE_URL}/api/projects/${projectId}/assets/${asset.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Link2 size={15} /> {t("actions.open")}
                      </LinkButton>
                      <Button
                        onClick={() =>
                          archive.mutate({
                            path: { projectId: projectId, assetId: asset.id },
                          })
                        }
                      >
                        <Archive size={15} /> {t("actions.archive")}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setAssetToDelete(asset)}
                      >
                        <Trash2 size={15} /> {t("actions.delete")}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Panel>
      </div>
      <Dialog
        open={assetToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssetToDelete(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("deleteDialog.title")}</DialogTitle>
            <DialogDescription>
              {assetToDelete
                ? archiveOnDelete
                  ? t("deleteDialog.archiveDescription", {
                      name: assetToDelete.name,
                    })
                  : t("deleteDialog.hardDeleteDescription", {
                      name: assetToDelete.name,
                    })
                : null}
            </DialogDescription>
          </DialogHeader>

          {assetToDelete ? (
            <div className="grid gap-2 rounded-xl border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("deleteDialog.usageTitle")}
                </span>
                {selectedAssetDetailLoading ? (
                  <Badge tone="info">{t("usage.loading")}</Badge>
                ) : selectedAssetUsages.length > 0 ? (
                  <Badge tone="info">
                    {t("usage.linked", { count: selectedAssetUsages.length })}
                  </Badge>
                ) : (
                  <Badge tone="warning">{t("usage.orphan")}</Badge>
                )}
              </div>
              {selectedAssetDetailLoading ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("deleteDialog.checkingUsages")}
                </p>
              ) : selectedAssetUsages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedAssetUsages.slice(0, 4).map((usage) => (
                    <span
                      key={`delete-${assetToDelete.id}-${usage.kind}-${usage.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 text-xs text-foreground"
                    >
                      <span className="max-w-[180px] truncate">
                        {usage.name}
                      </span>
                      <Badge tone="info">
                        {usage.kind === "character_image"
                          ? t("usageKinds.character_image")
                          : usage.kind === "generation_panel"
                            ? t("usageKinds.generation_panel")
                            : usage.kind.replace(/_/g, " ")}
                      </Badge>
                    </span>
                  ))}
                  {selectedAssetUsages.length > 4 ? (
                    <span className="text-xs text-muted-foreground">
                      +{selectedAssetUsages.length - 4}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("deleteDialog.noUsages")}
                </p>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssetToDelete(null)}>
              {t("deleteDialog.cancel")}
            </Button>
            <Button
              variant={archiveOnDelete ? "secondary" : "danger"}
              disabled={!assetToDelete || remove.isPending}
              onClick={() => {
                if (!assetToDelete) return;
                remove.mutate({
                  path: { projectId: projectId, assetId: assetToDelete.id },
                });
              }}
            >
              <Trash2 size={15} />
              {archiveOnDelete
                ? t("deleteDialog.confirmArchive")
                : t("deleteDialog.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={linkToDetach !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLinkToDetach(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("links.detachDialog.title")}</DialogTitle>
            <DialogDescription>
              {linkToDetach
                ? t("links.detachDialog.description", {
                    assetName: linkToDetach.assetName,
                    targetKind:
                      linkKindLabels[
                        linkToDetach.link
                          .targetKind as keyof typeof linkKindLabels
                      ] ?? linkToDetach.link.targetKind,
                    targetId: linkToDetach.link.targetId,
                  })
                : null}
            </DialogDescription>
          </DialogHeader>

          {linkToDetach ? (
            <div className="grid gap-2 rounded-xl border border-border bg-secondary/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="info">
                  {linkKindLabels[
                    linkToDetach.link.targetKind as keyof typeof linkKindLabels
                  ] ?? linkToDetach.link.targetKind}
                </Badge>
                <span className="text-xs text-foreground">
                  {linkToDetach.link.targetId}
                </span>
              </div>
              {linkToDetach.link.note ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  {linkToDetach.link.note}
                </p>
              ) : null}
              <p className="text-xs leading-5 text-muted-foreground">
                {t("links.detachDialog.note")}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkToDetach(null)}>
              {t("links.detachDialog.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={!linkToDetach || detachLink.isPending}
              onClick={() => {
                if (!linkToDetach) return;
                detachLink.mutate({
                  path: {
                    projectId,
                    assetId: linkToDetach.assetId,
                    linkId: linkToDetach.link.id,
                  },
                });
              }}
            >
              <Trash2 size={15} />
              {t("links.detachDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
