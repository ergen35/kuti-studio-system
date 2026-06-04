import { useMemo, useState, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { clsx } from "clsx";
import {
  ArrowLeft,
  FileText,
  Save,
  Clock,
  Trash2,
  Sparkles,
  Layout,
  Monitor,
  ChevronRight,
} from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingState,
  Panel,
  SectionTitle,
  Field,
  toCsv,
} from "~/components/ui";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { LexicalEditor } from "~/components/editor";
import "~/components/editor/styles.css";
import type { GetStorySummaryResponse } from "~/lib/backend";
import { apiErrorMessage } from "~/lib/errors";
import { csv } from "~/lib/utils";
import { invalidateQueriesById } from "~/lib/query";
import { ReorderControls } from "~/components/story/ReorderControls";
import {
  buildReferenceToken,
  getReferenceSyntax,
  normalizeReferenceKind,
  normalizeReferenceSlug,
  type ReferenceKind,
  type ReferenceUrlResolver,
} from "~/lib/references";
import { getOrderSwap } from "~/lib/story-order";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProjectCharacterImagesOptions,
  getProjectOptions,
  getStorySummaryOptions,
  updateSceneMutation,
  deleteSceneMutation,
  listCharactersOptions,
  listAssetsOptions,
  listWarningsOptions,
} from "~/lib/backend/@tanstack/react-query.gen";
import { StoryBreadcrumb, StoryCompletionButton } from "~/components/story";
import { SceneGenerationModal, SceneMangaGallery } from "~/components/scene";
import type {
  ListCharactersResponse,
  ListWarningsResponse,
} from "~/lib/backend";

// Orchestra Mode imports
import { useOrchestraStore } from "~/stores/orchestra";
import { PixiOrchestra } from "~/components/orchestra-pixi";
import { StoryTreeNavigator } from "~/components/navigation/StoryTreeNavigator";

type Tome = GetStorySummaryResponse["tomes"][number];
type Chapter = GetStorySummaryResponse["chapters"][number];
type SceneMetadata = GetStorySummaryResponse["scenes"][number]["metadataJson"];
type Scene = GetStorySummaryResponse["scenes"][number];
type SceneCharacter = ListCharactersResponse[number];
type SceneWarning = ListWarningsResponse[number];
type StoryReference = GetStorySummaryResponse["references"][number];

function labelFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeCharacterLookupKey(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/^@(?:chara|character):(.+)$/i);
  return normalizeReferenceSlug(match?.[1] ?? trimmed);
}

function resolveSceneCharacter(token: string, characters: SceneCharacter[]) {
  const normalizedToken = normalizeCharacterLookupKey(token);

  return (
    characters.find((character) => {
      if (normalizeCharacterLookupKey(character.id) === normalizedToken) {
        return true;
      }

      if (normalizeCharacterLookupKey(character.slug) === normalizedToken) {
        return true;
      }

      if (normalizeCharacterLookupKey(character.name) === normalizedToken) {
        return true;
      }

      return (
        typeof character.alias === "string" &&
        normalizeCharacterLookupKey(character.alias) === normalizedToken
      );
    }) ?? null
  );
}

function resolveSceneLocation(
  location: string,
  projectId: string,
  projectLocations: string[],
) {
  const trimmed = location.trim();

  if (!trimmed) {
    return {
      label: "",
      href: null as string | null,
      registered: false,
    };
  }

  const registered = projectLocations.some(
    (item) => normalizeReferenceSlug(item) === normalizeReferenceSlug(trimmed),
  );

  return {
    label: trimmed,
    href: `/projects/${projectId}/settings?location=${encodeURIComponent(trimmed)}`,
    registered,
  };
}

const DEFAULT_SCENE_METADATA = {
  narrativeIntent: "",
  duration: "",
  tone: "",
  rhythm: "",
  visualConstraints: "",
  stagingNotes: "",
};

const SCENE_FIELD_LABEL_IDS = {
  type: "scene-type-label",
  location: "scene-location-label",
  summary: "scene-summary-label",
  characters: "scene-characters-label",
  tags: "scene-tags-label",
  notes: "scene-notes-label",
} as const;

function normalizeSceneMetadata(metadataJson?: SceneMetadata | null) {
  return {
    ...DEFAULT_SCENE_METADATA,
    ...(metadataJson ?? {}),
  };
}

function getProjectLocations(project: { settingsJson?: unknown } | undefined) {
  const settings =
    project &&
    typeof project.settingsJson === "object" &&
    project.settingsJson !== null
      ? (project.settingsJson as Record<string, unknown>)
      : {};

  return Array.isArray(settings.locationsJson)
    ? (settings.locationsJson as string[])
    : [];
}

function resolveSceneReferenceDisplay(
  kind: string,
  slug: string,
  data: {
    projectId: string;
    tomes: Tome[];
    chapters: Chapter[];
    scenes: Scene[];
    characters: Array<{ id: string; slug: string; name: string }>;
    assets: Array<{ id: string; slug: string; name: string }>;
    locations: string[];
  },
): {
  label: string;
  href: string | null;
  resolved: boolean;
  syntax: string;
  canonicalKind: ReferenceKind | null;
} {
  const canonicalKind = normalizeReferenceKind(kind);
  const syntaxKind = canonicalKind ?? "character";
  const syntax = getReferenceSyntax(syntaxKind);

  switch (canonicalKind) {
    case "character": {
      const character = data.characters.find((item) => item.slug === slug);
      return {
        label: character?.name ?? labelFromSlug(slug),
        href: character
          ? `/projects/${data.projectId}/characters/${character.id}`
          : null,
        resolved: !!character,
        syntax,
        canonicalKind,
      };
    }
    case "scene": {
      const scene = data.scenes.find((item) => item.slug === slug);
      return {
        label: scene?.title ?? labelFromSlug(slug),
        href: scene
          ? `/projects/${data.projectId}/story/${scene.tomeId}/scenes/${scene.id}`
          : null,
        resolved: !!scene,
        syntax,
        canonicalKind,
      };
    }
    case "chapter": {
      const chapter = data.chapters.find((item) => item.slug === slug);
      return {
        label: chapter?.title ?? labelFromSlug(slug),
        href: chapter
          ? `/projects/${data.projectId}/story/${chapter.tomeId}/chapters/${chapter.id}`
          : null,
        resolved: !!chapter,
        syntax,
        canonicalKind,
      };
    }
    case "tome": {
      const tome = data.tomes.find((item) => item.slug === slug);
      return {
        label: tome?.title ?? labelFromSlug(slug),
        href: tome ? `/projects/${data.projectId}/story/${tome.id}` : null,
        resolved: !!tome,
        syntax,
        canonicalKind,
      };
    }
    case "asset": {
      const asset = data.assets.find((item) => item.slug === slug);
      return {
        label: asset?.name ?? labelFromSlug(slug),
        href: `/projects/${data.projectId}/assets?asset=${encodeURIComponent(slug)}`,
        resolved: !!asset,
        syntax,
        canonicalKind,
      };
    }
    case "environment": {
      const location = data.locations.find(
        (item) => normalizeReferenceSlug(item) === slug,
      );
      return {
        label: location ?? labelFromSlug(slug),
        href: `/projects/${data.projectId}/settings?location=${encodeURIComponent(slug)}`,
        resolved: !!location,
        syntax,
        canonicalKind,
      };
    }
    default:
      return {
        label: labelFromSlug(slug),
        href: null,
        resolved: false,
        syntax,
        canonicalKind,
      };
  }
}

function SceneReferencePanel({
  projectId,
  sceneId,
  references,
  orphanReferences,
  resolverData,
}: {
  projectId: string;
  sceneId: string;
  references: StoryReference[];
  orphanReferences: Array<{ reference: StoryReference; reason: string }>;
  resolverData: {
    projectId: string;
    tomes: Tome[];
    chapters: Chapter[];
    scenes: Scene[];
    characters: Array<{ id: string; slug: string; name: string }>;
    assets: Array<{ id: string; slug: string; name: string }>;
    locations: string[];
  };
}) {
  const { t } = useTranslation("story");

  const sceneReferences = references.filter(
    (reference) => reference.sceneId === sceneId,
  );
  const sceneOrphans = orphanReferences.filter(
    (entry) => entry.reference.sceneId === sceneId,
  );

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {t("panels.references.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("panels.references.count", { count: sceneReferences.length })}
          </p>
        </div>
        <Badge tone={sceneOrphans.length > 0 ? "warning" : "ready"}>
          {sceneOrphans.length}
        </Badge>
      </div>

      {sceneReferences.length === 0 ? (
        <EmptyState
          title={t("panels.references.empty.title")}
          description={t("panels.references.empty.description")}
        />
      ) : (
        <div className="grid gap-2">
          {sceneReferences.map((reference) => {
            const resolved = resolveSceneReferenceDisplay(
              reference.referenceKind,
              reference.targetSlug,
              resolverData,
            );
            const isOrphan = sceneOrphans.some(
              (entry) => entry.reference.id === reference.id,
            );

            return (
              <div
                key={reference.id}
                className={clsx(
                  "grid gap-2 rounded-xl border p-3 transition-colors",
                  isOrphan
                    ? "border-warning/25 bg-warning/8"
                    : "border-border bg-secondary/25 hover:border-primary/35 hover:bg-secondary/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-primary">
                        {buildReferenceToken(
                          resolved.canonicalKind ?? "character",
                          reference.targetSlug,
                        )}
                      </span>
                      <Badge
                        tone={resolved.canonicalKind ?? reference.referenceKind}
                      >
                        {resolved.syntax.replace("@", "")}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">
                      {resolved.label}
                    </p>
                  </div>
                  <Badge tone={isOrphan ? "warning" : "ready"}>
                    {isOrphan
                      ? t("panels.references.orphan")
                      : t("panels.references.resolved")}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {resolved.href ? (
                    <LinkButton className="h-8" href={resolved.href}>
                      {t("panels.references.open")}
                    </LinkButton>
                  ) : null}
                  {isOrphan ? (
                    <LinkButton
                      className="h-8"
                      href={`/projects/${projectId}/warnings`}
                    >
                      {t("panels.references.fix")}
                    </LinkButton>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function SceneCharacterChips({
  projectId,
  charactersValue,
  characters,
}: {
  projectId: string;
  charactersValue: string;
  characters: SceneCharacter[];
}) {
  const { t } = useTranslation("story");

  const tokens = useMemo(() => csv(charactersValue), [charactersValue]);
  const chips = useMemo(
    () =>
      tokens.map((token, index) => {
        const resolvedCharacter = resolveSceneCharacter(token, characters);

        return {
          key: `${index}-${token}`,
          token,
          character: resolvedCharacter,
        };
      }),
    [characters, tokens],
  );

  if (tokens.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t("meta.noCharacters")}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/20 p-2.5">
      <div className="flex flex-wrap gap-2">
        {chips.map(({ key, token, character }) => {
          const chipClass = clsx(
            "inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:ring-offset-0",
            character
              ? "border-border bg-card text-foreground hover:border-primary/35 hover:bg-primary/8 hover:text-primary"
              : "border-dashed border-border bg-background/70 text-muted-foreground",
          );

          const dotClass = clsx(
            "size-1.5 shrink-0 rounded-full",
            character ? "bg-primary/70" : "bg-muted-foreground/50",
          );

          if (character) {
            return (
              <Link
                key={key}
                to={`/projects/${projectId}/characters/${character.id}`}
                className={chipClass}
                title={token}
              >
                <span className={dotClass} aria-hidden="true" />
                <span className="truncate">{character.name}</span>
              </Link>
            );
          }

          return (
            <span key={key} className={chipClass} title={token}>
              <span className={dotClass} aria-hidden="true" />
              <span className="truncate">{token}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function SceneContextPanel({
  projectId,
  sceneId,
  scene,
  chapter,
  tome,
  sceneNumber,
  projectLocations,
  characters,
  references,
  warnings,
  warningsLoading,
  warningsErrorMessage,
  referenceResolverData,
}: {
  projectId: string;
  sceneId: string;
  scene: Scene;
  chapter: Chapter;
  tome: Tome;
  sceneNumber: number;
  projectLocations: string[];
  characters: SceneCharacter[];
  references: StoryReference[];
  warnings: SceneWarning[];
  warningsLoading: boolean;
  warningsErrorMessage: string | null;
  referenceResolverData: {
    projectId: string;
    tomes: Tome[];
    chapters: Chapter[];
    scenes: Scene[];
    characters: Array<{ id: string; slug: string; name: string }>;
    assets: Array<{ id: string; slug: string; name: string }>;
    locations: string[];
  };
}) {
  const { t } = useTranslation(["story", "common"]);

  const sceneLocation = useMemo(
    () => resolveSceneLocation(scene.location, projectId, projectLocations),
    [projectId, projectLocations, scene.location],
  );
  const sceneAssetReferences = useMemo(
    () =>
      references.filter(
        (reference) =>
          reference.sceneId === sceneId &&
          normalizeReferenceKind(reference.referenceKind) === "asset",
      ),
    [references, sceneId],
  );
  const openWarnings = useMemo(
    () => warnings.filter((warning) => warning.status === "open"),
    [warnings],
  );
  const limitedWarnings = useMemo(() => warnings.slice(0, 3), [warnings]);

  return (
    <Panel className="overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            {t("panels.context.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("panels.context.description")}
          </p>
        </div>
        <Badge tone={openWarnings.length > 0 ? "warning" : "ready"}>
          {t("panels.context.openWarnings", { count: openWarnings.length })}
        </Badge>
      </div>

      <div className="grid gap-3">
        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {t("panels.context.scene")}
              </p>
              <h4 className="mt-1 truncate text-sm font-semibold text-foreground">
                {scene.title}
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("panels.context.inChapter", {
                  tome: tome.title,
                  chapter: chapter.title,
                })}
              </p>
            </div>
            <Badge tone={scene.status}>{t(`status.${scene.status}`)}</Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="info">
              {t("scene.number", { number: sceneNumber })}
            </Badge>
            <Badge tone={scene.sceneType ? "ready" : "warning"}>
              {scene.sceneType || t("scene.placeholders.type")}
            </Badge>
            <Badge
              tone={
                scene.location
                  ? sceneLocation.registered
                    ? "ready"
                    : "warning"
                  : "warning"
              }
            >
              {scene.location || t("meta.noLocation")}
            </Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton
              className="h-8"
              href={`/projects/${projectId}/story/${tome.id}`}
            >
              {t("panels.context.openTome")}
            </LinkButton>
            <LinkButton
              className="h-8"
              href={`/projects/${projectId}/story/${tome.id}/chapters/${chapter.id}`}
            >
              {t("panels.context.openChapter")}
            </LinkButton>
            <LinkButton
              className="h-8"
              href={
                scene.location
                  ? `/projects/${projectId}/settings?location=${encodeURIComponent(scene.location)}`
                  : `/projects/${projectId}/settings`
              }
            >
              {t("panels.context.openSettings")}
            </LinkButton>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("panels.context.location")}
            </span>
            <Badge tone={sceneLocation.registered ? "ready" : "warning"}>
              {sceneLocation.registered
                ? t("panels.context.locationLinked")
                : t("panels.context.locationUnlinked")}
            </Badge>
          </div>
          {scene.location ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {sceneLocation.href ? (
                <LinkButton className="h-8" href={sceneLocation.href}>
                  {sceneLocation.label}
                </LinkButton>
              ) : (
                <Badge tone="warning">{sceneLocation.label}</Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {sceneLocation.registered
                  ? t("panels.context.locationHint")
                  : t("panels.context.locationHintFallback")}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("meta.noLocation")}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("panels.context.characters")}
            </span>
            <Badge tone="info">{scene.charactersJson.length}</Badge>
          </div>
          <div className="mt-2">
            <SceneCharacterChips
              projectId={projectId}
              charactersValue={scene.charactersJson.join(", ")}
              characters={characters}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("panels.context.assets")}
            </span>
            <Badge tone="info">{sceneAssetReferences.length}</Badge>
          </div>
          {sceneAssetReferences.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {sceneAssetReferences.map((reference) => {
                const resolved = resolveSceneReferenceDisplay(
                  reference.referenceKind,
                  reference.targetSlug,
                  referenceResolverData,
                );

                if (resolved.href) {
                  return (
                    <LinkButton
                      key={reference.id}
                      className="h-8"
                      href={resolved.href}
                    >
                      {resolved.label}
                    </LinkButton>
                  );
                }

                return (
                  <Badge
                    key={reference.id}
                    tone="warning"
                    className="capitalize"
                  >
                    {resolved.label}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("panels.context.emptyAssets")}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("panels.context.warnings")}
            </span>
            {warningsLoading && warnings.length === 0 ? (
              <Badge tone="info">{t("states.loading", { ns: "common" })}</Badge>
            ) : warningsErrorMessage && warnings.length === 0 ? (
              <Badge tone="warning">
                {t("states.error", { ns: "common" })}
              </Badge>
            ) : (
              <Badge tone={openWarnings.length > 0 ? "warning" : "ready"}>
                {openWarnings.length}
              </Badge>
            )}
          </div>

          {warningsLoading && warnings.length === 0 ? (
            <div className="mt-2">
              <LoadingState />
            </div>
          ) : warningsErrorMessage && warnings.length === 0 ? (
            <div className="mt-2">
              <ErrorState message={warningsErrorMessage} />
            </div>
          ) : warnings.length > 0 ? (
            <div className="mt-2 grid gap-2">
              {limitedWarnings.map((warning) => (
                <div
                  key={warning.id}
                  className="grid gap-2 rounded-lg border border-border bg-card/80 p-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {warning.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {warning.message}
                      </p>
                    </div>
                    <Badge tone={warning.severity}>{warning.severity}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("panels.context.emptyWarnings")}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <LinkButton
              className="h-8"
              href={`/projects/${projectId}/warnings?entityKind=scene&entityId=${sceneId}`}
            >
              {t("panels.context.openWarningsCta")}
            </LinkButton>
          </div>
        </div>
      </div>
    </Panel>
  );
}

const sceneSchema = z.object({
  title: z.string().min(1, "titleRequired"),
  sceneType: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  content: z.string().optional(),
  charactersJson: z.string().optional(),
  tagsJson: z.string().optional(),
  notes: z.string().optional(),
  narrativeIntent: z.string().optional(),
  duration: z.string().optional(),
  tone: z.string().optional(),
  rhythm: z.string().optional(),
  visualConstraints: z.string().optional(),
  stagingNotes: z.string().optional(),
});

type SceneInput = z.infer<typeof sceneSchema>;

// Sidepanel with scenes in this chapter
function SceneNavigationPanel({
  scenes,
  currentSceneId,
  projectId,
  tomeId,
  chapterId,
  onMoveScene,
  reorderDisabled = false,
}: {
  scenes: Scene[];
  currentSceneId: string;
  projectId: string;
  tomeId: string;
  chapterId: string;
  onMoveScene?: (sceneId: string, direction: -1 | 1) => void;
  reorderDisabled?: boolean;
}) {
  const { t } = useTranslation("story");
  const navigate = useNavigate();

  const sortedScenes = [...scenes].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <Panel className="!p-3">
      <SectionTitle
        title={t("scene.navigation.title")}
        meta={String(sortedScenes.length)}
      />

      <div className="mt-3 flex flex-col gap-2">
        {sortedScenes.map((scene, index) => {
          const isCurrent = scene.id === currentSceneId;
          return (
            <div key={scene.id} className="group flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  navigate(
                    `/projects/${projectId}/story/${tomeId}/scenes/${scene.id}`,
                  )
                }
                className={clsx(
                  "flex h-auto w-full flex-1 items-center gap-3 rounded-lg border p-2.5 text-left transition-colors hover:text-foreground",
                  isCurrent
                    ? "border-primary/40 bg-primary/10 text-primary shadow-[inset_3px_0_0_var(--primary)]"
                    : "border-border bg-secondary/25 hover:border-primary/35 hover:bg-primary/8",
                )}
              >
                <span
                  className={clsx(
                    "text-xs font-semibold",
                    isCurrent ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {t("scene.shortNumber", { number: index + 1 })}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      "truncate text-sm",
                      isCurrent
                        ? "font-medium text-primary"
                        : "text-foreground",
                    )}
                  >
                    {scene.title}
                  </p>
                </div>
                {isCurrent && (
                  <span className="size-2 rounded-full bg-primary" />
                )}
                {!isCurrent && (
                  <ChevronRight size={14} className="text-muted-foreground" />
                )}
              </Button>
              {onMoveScene ? (
                <ReorderControls
                  entityLabel={scene.title}
                  canMoveUp={index > 0}
                  canMoveDown={index < sortedScenes.length - 1}
                  disabled={reorderDisabled}
                  onMoveUp={() => onMoveScene(scene.id, -1)}
                  onMoveDown={() => onMoveScene(scene.id, 1)}
                  className="self-center opacity-100 md:opacity-0 md:transition-opacity md:duration-150 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                />
              ) : null}
            </div>
          );
        })}

        {sortedScenes.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("scene.navigation.empty")}
          </p>
        )}
      </div>
    </Panel>
  );
}

export default function SceneRoute() {
  const {
    projectId = "",
    tomeId = "",
    chapterId = "",
    sceneId = "",
  } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["story", "common"]);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false);
  const [editorVersion, setEditorVersion] = useState(0);

  // Fetch story data
  const story = useQuery({
    ...getStorySummaryOptions({ path: { projectId } }),
  });

  const project = useQuery({
    ...getProjectOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  // Fetch characters for this project
  const characters = useQuery({
    ...listCharactersOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  const assets = useQuery({
    ...listAssetsOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  const sceneWarnings = useQuery({
    ...listWarningsOptions({
      path: { projectId },
      query: { entityKind: "scene", entityId: sceneId },
    }),
    enabled: !!projectId && !!sceneId,
  });

  const characterImages = useQuery({
    ...getProjectCharacterImagesOptions({ path: { projectId } }),
    enabled: !!projectId,
  });

  const storyData = story.data;

  const projectLocations = useMemo(
    () => getProjectLocations(project.data),
    [project.data],
  );

  const referenceResolverData = useMemo(
    () => ({
      projectId,
      tomes: storyData?.tomes ?? [],
      chapters: storyData?.chapters ?? [],
      scenes: storyData?.scenes ?? [],
      characters: (characters.data || []) as Array<{
        id: string;
        slug: string;
        name: string;
      }>,
      assets: (assets.data || []) as Array<{
        id: string;
        slug: string;
        name: string;
      }>,
      locations: projectLocations,
    }),
    [projectId, storyData, characters.data, assets.data, projectLocations],
  );

  const resolveReferenceUrl = useCallback<ReferenceUrlResolver>(
    (kind, slug) => {
      return resolveSceneReferenceDisplay(kind, slug, referenceResolverData)
        .href;
    },
    [referenceResolverData],
  );

  // Get scene
  const scene = useMemo(() => {
    return storyData?.scenes.find((s) => s.id === sceneId);
  }, [storyData, sceneId]);

  // Get chapter and tome
  const context = useMemo(() => {
    if (!storyData || !scene) return null;

    const chapter = storyData.chapters.find((c) => c.id === scene.chapterId);
    const tome = storyData.tomes.find((t) => t.id === scene.tomeId);
    const chapterScenes = storyData.scenes
      .filter((s) => s.chapterId === scene.chapterId)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    return { chapter, tome, chapterScenes };
  }, [storyData, scene]);

  // Calculate scene number
  const sceneNumber = useMemo(() => {
    if (!context?.chapterScenes || !scene) return 0;
    const index = context.chapterScenes.findIndex((s) => s.id === sceneId);
    return index + 1;
  }, [context, sceneId, scene]);

  // Calculate chapter and tome numbers
  const { chapterNumber, tomeNumber } = useMemo(() => {
    if (!storyData || !context?.chapter || !context?.tome)
      return { chapterNumber: 0, tomeNumber: 0 };

    const tomeIndex = storyData.tomes.findIndex(
      (t) => t.id === context.tome?.id,
    );
    const chapterIndex = storyData.chapters
      .filter((c) => c.tomeId === context.tome?.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .findIndex((c) => c.id === context.chapter?.id);

    return {
      tomeNumber: tomeIndex + 1,
      chapterNumber: chapterIndex + 1,
    };
  }, [storyData, context]);

  // Mutations using SDK
  const updateScene = useMutation({
    ...updateSceneMutation(),
    onSuccess: () => {
      invalidateQueriesById(queryClient, "getStorySummary");
      setIsSaving(false);
    },
  });

  const reorderScene = useMutation({
    ...updateSceneMutation(),
    onSuccess: () => {
      invalidateQueriesById(queryClient, "getStorySummary");
    },
  });

  const deleteScene = useMutation({
    ...deleteSceneMutation(),
    onSuccess: () => {
      invalidateQueriesById(queryClient, "getStorySummary");
      navigate(
        `/projects/${projectId}/story/${tomeId}/chapters/${scene?.chapterId}`,
      );
    },
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<SceneInput>({
    resolver: zodResolver(sceneSchema),
    defaultValues: {
      title: "",
      sceneType: "",
      location: "",
      summary: "",
      content: "",
      charactersJson: "",
      tagsJson: "",
      notes: "",
      narrativeIntent: "",
      duration: "",
      tone: "",
      rhythm: "",
      visualConstraints: "",
      stagingNotes: "",
    },
  });

  // Reset form when scene data loads or changes
  useEffect(() => {
    if (scene) {
      const sceneMetadata = normalizeSceneMetadata(scene.metadataJson);

      reset({
        title: scene.title ?? "",
        sceneType: scene.sceneType ?? "",
        location: scene.location ?? "",
        summary: scene.summary ?? "",
        content: scene.content ?? "",
        charactersJson: toCsv(scene.charactersJson) ?? "",
        tagsJson: toCsv(scene.tagsJson) ?? "",
        notes: scene.notes ?? "",
        narrativeIntent: sceneMetadata.narrativeIntent,
        duration: sceneMetadata.duration,
        tone: sceneMetadata.tone,
        rhythm: sceneMetadata.rhythm,
        visualConstraints: sceneMetadata.visualConstraints,
        stagingNotes: sceneMetadata.stagingNotes,
      });
    }
  }, [scene, reset]);

  const charactersJsonValue = watch("charactersJson") ?? "";

  // Orchestra mode state
  const {
    isActive: orchestraMode,
    toggle: toggleOrchestra,
    selectScene,
  } = useOrchestraStore();

  // Select current scene in orchestra store
  useEffect(() => {
    if (sceneId) {
      selectScene(sceneId);
    }
  }, [sceneId, selectScene]);

  const onSubmit = useCallback(
    (data: SceneInput) => {
      setIsSaving(true);
      updateScene.mutate({
        path: { projectId, sceneId },
        body: {
          title: data.title,
          sceneType: data.sceneType,
          location: data.location,
          summary: data.summary,
          content: data.content,
          charactersJson: csv(data.charactersJson || ""),
          tagsJson: csv(data.tagsJson || ""),
          notes: data.notes,
          metadataJson: {
            narrativeIntent: data.narrativeIntent,
            duration: data.duration,
            tone: data.tone,
            rhythm: data.rhythm,
            visualConstraints: data.visualConstraints,
            stagingNotes: data.stagingNotes,
          },
        },
      });
    },
    [updateScene, projectId, sceneId],
  );

  const moveScene = useCallback(
    async (movingSceneId: string, direction: -1 | 1) => {
      if (!context) {
        return;
      }

      const swap = getOrderSwap(
        context.chapterScenes,
        movingSceneId,
        direction,
      );
      if (!swap) {
        return;
      }

      await Promise.all([
        reorderScene.mutateAsync({
          path: { projectId, sceneId: swap.current.id },
          body: { orderIndex: swap.target.orderIndex },
        }),
        reorderScene.mutateAsync({
          path: { projectId, sceneId: swap.target.id },
          body: { orderIndex: swap.current.orderIndex },
        }),
      ]);
    },
    [context, projectId, reorderScene],
  );

  if (story.isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (story.error) {
    return (
      <AppShell>
        <ErrorState message={apiErrorMessage(story.error)} />
      </AppShell>
    );
  }

  if (!scene || !context || !context.chapter || !context.tome) {
    return (
      <AppShell>
        <EmptyState title={t("scene.notFound")} />
      </AppShell>
    );
  }

  const { chapter, tome, chapterScenes } = context;
  if (!chapter || !tome) return null;
  const formattedDate = new Date(scene.updatedAt).toLocaleDateString(
    t("locale"),
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  // Orchestra Mode View
  if (orchestraMode) {
    return (
      <AppShell reducedSidebar>
        {/* Full width override - sort du flux max-w-[1500px] du AppShell */}
        <div className="fixed inset-0 top-14 left-0 lg:left-[56px] right-0 bottom-0 z-10">
          <div className="grid h-full w-full grid-cols-[1fr_280px]">
            {/* Canvas 2D PixiJS */}
            <div className="relative w-full h-full">
              <PixiOrchestra
                tomes={storyData?.tomes || []}
                chapters={storyData?.chapters || []}
                scenes={storyData?.scenes || []}
                currentSceneId={sceneId}
                onNavigateToScene={(
                  selectedSceneId,
                  selectedChapterId,
                  selectedTomeId,
                ) => {
                  navigate(
                    `/projects/${projectId}/story/${selectedTomeId}/scenes/${selectedSceneId}`,
                    {
                      replace: true,
                    },
                  );
                }}
              />

              {/* Overlay: Button to switch back to classic mode */}
              <Button
                type="button"
                variant="ghost"
                onClick={toggleOrchestra}
                className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-border bg-card/90 px-3 py-2 text-sm text-foreground shadow-lg backdrop-blur transition-colors hover:bg-primary/8 hover:text-primary"
                title={t("scene.orchestra.backToClassic")}
              >
                <Layout size={16} />
                <span>{t("scene.orchestra.classicMode")}</span>
              </Button>

              {/* Overlay: Title */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className="rounded-lg border border-border bg-card/90 px-4 py-2 shadow-lg backdrop-blur">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("scene.orchestra.mode")}
                  </p>
                </div>
              </div>
            </div>

            {/* Tree Navigator */}
            <StoryTreeNavigator
              projectId={projectId}
              tomes={storyData?.tomes || []}
              chapters={storyData?.chapters || []}
              scenes={storyData?.scenes || []}
              currentSceneId={sceneId}
              onSelectScene={(
                selectedSceneId,
                selectedChapterId,
                selectedTomeId,
              ) => {
                navigate(
                  `/projects/${projectId}/story/${selectedTomeId}/scenes/${selectedSceneId}`,
                  {
                    replace: true,
                  },
                );
              }}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  // Classic Mode View
  return (
    <AppShell>
      {/* Breadcrumb */}
      <StoryBreadcrumb
        projectId={projectId}
        tomes={storyData?.tomes || []}
        chapters={storyData?.chapters || []}
        scenes={storyData?.scenes || []}
        currentTomeId={tomeId}
        currentChapterId={chapter.id}
        currentSceneId={sceneId}
        tomeNumber={tomeNumber}
        chapterNumber={chapterNumber}
        sceneNumber={sceneNumber}
      />

      {/* Back link - mobile only */}
      <div className="mb-4 lg:hidden">
        <Link
          to={`/projects/${projectId}/story/${tomeId}/chapters/${chapter.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t("scene.backToChapter")}
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px]">
          {/* Main content */}
          <div className="flex flex-col gap-4">
            {/* Scene header */}
            <Panel className="overflow-hidden">
              <div className="-m-4 mb-0 flex items-start gap-4 border-b border-border bg-secondary/20 p-5 compact:-m-3 compact:p-4">
                <div className="grid size-12 place-items-center rounded-lg bg-primary/10 text-primary">
                  <FileText size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {t("scene.number", { number: sceneNumber })}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={toggleOrchestra}
                      className="h-8 gap-2 border border-primary/25 bg-primary/10 px-2.5 text-primary hover:bg-primary/15"
                      title={t("scene.orchestra.switchToOrchestra")}
                    >
                      <Monitor size={16} />
                      <span>{t("scene.orchestra.mode")}</span>
                    </Button>
                  </div>

                  <Field label={t("fields.title")}>
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-end">
                        <StoryCompletionButton
                          projectId={projectId}
                          targetKind="scene"
                          targetId={sceneId}
                          field="title"
                          currentValue={watch("title")}
                          onComplete={(text) =>
                            setValue("title", text, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                      </div>
                      <Input
                        {...register("title")}
                        className="text-lg font-semibold w-full"
                      />
                    </div>
                  </Field>
                  {errors.title && (
                    <span className="text-danger text-xs">
                      {errors.title.message}
                    </span>
                  )}

                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    {scene.slug}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>
                        {t("scene.lastModified")}: {formattedDate}
                      </span>
                    </div>
                    <Badge tone={scene.status}>
                      {t(`status.${scene.status}`)}
                    </Badge>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Scene editor */}
            <Panel>
              <SectionTitle title={t("panels.sceneEditor.title")} />

              <div className="mt-3 flex flex-col gap-4">
                {/* Summary */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span id={SCENE_FIELD_LABEL_IDS.type}>
                        {t("fields.type")}
                      </span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="sceneType"
                        currentValue={watch("sceneType")}
                        instruction="Return only a concise scene type such as dialogue, action, reveal, transition, confrontation, flashback, or quiet beat."
                        onComplete={(text) =>
                          setValue("sceneType", text, { shouldDirty: true })
                        }
                      />
                    </div>
                    <Input
                      {...register("sceneType")}
                      placeholder={t("scene.placeholders.type")}
                      aria-labelledby={SCENE_FIELD_LABEL_IDS.type}
                    />
                  </div>
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span id={SCENE_FIELD_LABEL_IDS.location}>
                        {t("fields.location")}
                      </span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="location"
                        currentValue={watch("location")}
                        instruction="Return only a concise production-ready location name for this scene."
                        onComplete={(text) =>
                          setValue("location", text, { shouldDirty: true })
                        }
                      />
                    </div>
                    <Input
                      {...register("location")}
                      placeholder={t("scene.placeholders.location")}
                      aria-labelledby={SCENE_FIELD_LABEL_IDS.location}
                    />
                  </div>
                </div>

                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span id={SCENE_FIELD_LABEL_IDS.summary}>
                      {t("fields.summary")}
                    </span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="scene"
                      targetId={sceneId}
                      field="summary"
                      currentValue={watch("summary")}
                      onComplete={(text) =>
                        setValue("summary", text, { shouldDirty: true })
                      }
                    />
                  </div>
                  <Textarea
                    {...register("summary")}
                    rows={3}
                    placeholder={t("scene.placeholders.summary")}
                    aria-labelledby={SCENE_FIELD_LABEL_IDS.summary}
                  />
                </div>

                {/* Content - Lexical Editor */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{t("fields.content")}</span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="scene"
                      targetId={sceneId}
                      field="content"
                      currentValue={watch("content")}
                      onComplete={(text) => {
                        setValue("content", text, { shouldDirty: true });
                        setEditorVersion((value) => value + 1);
                      }}
                    />
                  </div>
                  <Controller
                    name="content"
                    control={control}
                    render={({ field }) => (
                      <LexicalEditor
                        key={`${sceneId}-${editorVersion}`}
                        initialValue={field.value || ""}
                        onChange={field.onChange}
                        placeholder={t("editor.placeholder")}
                        minHeight="600px"
                        referenceProjectId={projectId}
                        referenceUrlResolver={resolveReferenceUrl}
                      />
                    )}
                  />
                </div>

                {/* Characters & Tags */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span id={SCENE_FIELD_LABEL_IDS.characters}>
                        {t("fields.characters")}
                      </span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="charactersJson"
                        currentValue={watch("charactersJson")}
                        instruction="Return only a comma-separated list of relevant character names or slugs for this scene."
                        onComplete={(text) =>
                          setValue("charactersJson", text, {
                            shouldDirty: true,
                          })
                        }
                      />
                    </div>
                    <Input
                      {...register("charactersJson")}
                      placeholder={t("scene.placeholders.characters")}
                      aria-labelledby={SCENE_FIELD_LABEL_IDS.characters}
                    />
                    <SceneCharacterChips
                      projectId={projectId}
                      charactersValue={charactersJsonValue}
                      characters={(characters.data || []) as SceneCharacter[]}
                    />
                  </div>
                  <div className="grid gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      <span id={SCENE_FIELD_LABEL_IDS.tags}>
                        {t("fields.tags")}
                      </span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="tagsJson"
                        currentValue={watch("tagsJson")}
                        instruction="Return only a short comma-separated list of production and narrative tags for this scene."
                        onComplete={(text) =>
                          setValue("tagsJson", text, { shouldDirty: true })
                        }
                      />
                    </div>
                    <Input
                      {...register("tagsJson")}
                      placeholder={t("scene.placeholders.tags")}
                      aria-labelledby={SCENE_FIELD_LABEL_IDS.tags}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <span id={SCENE_FIELD_LABEL_IDS.notes}>
                      {t("fields.notes")}
                    </span>
                    <StoryCompletionButton
                      projectId={projectId}
                      targetKind="scene"
                      targetId={sceneId}
                      field="notes"
                      currentValue={watch("notes")}
                      onComplete={(text) =>
                        setValue("notes", text, { shouldDirty: true })
                      }
                    />
                  </div>
                  <Textarea
                    {...register("notes")}
                    rows={3}
                    placeholder={t("scene.placeholders.notes")}
                    aria-labelledby={SCENE_FIELD_LABEL_IDS.notes}
                  />
                </div>

                <div className="rounded-xl border border-border bg-secondary/20 p-4">
                  <SectionTitle
                    title={t("panels.metadata.title")}
                    meta={t("panels.metadata.description")}
                  />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label={t("fields.narrativeIntent")}>
                      <Textarea
                        {...register("narrativeIntent")}
                        rows={4}
                        placeholder={t("scene.placeholders.narrativeIntent")}
                      />
                    </Field>

                    <Field label={t("fields.duration")}>
                      <Input
                        {...register("duration")}
                        placeholder={t("scene.placeholders.duration")}
                      />
                    </Field>

                    <Field label={t("fields.tone")}>
                      <Input
                        {...register("tone")}
                        placeholder={t("scene.placeholders.tone")}
                      />
                    </Field>

                    <Field label={t("fields.rhythm")}>
                      <Input
                        {...register("rhythm")}
                        placeholder={t("scene.placeholders.rhythm")}
                      />
                    </Field>

                    <Field label={t("fields.visualConstraints")}>
                      <Textarea
                        {...register("visualConstraints")}
                        rows={4}
                        placeholder={t("scene.placeholders.visualConstraints")}
                      />
                    </Field>

                    <Field label={t("fields.stagingNotes")}>
                      <Textarea
                        {...register("stagingNotes")}
                        rows={4}
                        placeholder={t("scene.placeholders.stagingNotes")}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </Panel>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <Button
                variant="danger"
                type="button"
                onClick={() =>
                  deleteScene.mutate({ path: { projectId, sceneId } })
                }
                disabled={deleteScene.isPending}
              >
                <Trash2 size={16} />
                {t("actions.deleteScene")}
              </Button>

              <div className="flex items-center gap-4">
                {isDirty && (
                  <span className="text-xs text-warning">
                    {t("scene.unsavedChanges")}
                  </span>
                )}
                <Button
                  variant="primary"
                  type="submit"
                  disabled={updateScene.isPending || isSaving}
                >
                  <Save size={16} />
                  {updateScene.isPending || isSaving
                    ? t("actions.saving")
                    : t("actions.saveScene")}
                </Button>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="flex flex-col gap-4">
            <SceneContextPanel
              projectId={projectId}
              sceneId={sceneId}
              scene={scene}
              chapter={chapter}
              tome={tome}
              sceneNumber={sceneNumber}
              projectLocations={projectLocations}
              characters={(characters.data || []) as SceneCharacter[]}
              references={(storyData?.references ?? []) as StoryReference[]}
              warnings={(sceneWarnings.data ?? []) as SceneWarning[]}
              warningsLoading={sceneWarnings.isLoading}
              warningsErrorMessage={
                sceneWarnings.error
                  ? apiErrorMessage(sceneWarnings.error)
                  : null
              }
              referenceResolverData={referenceResolverData}
            />

            {/* Manga Generation Section */}
            <Panel>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-foreground">
                  {t("scene.mangaBoards")}
                </h3>
                <Button
                  variant="ghost"
                  className="size-8 border border-primary/25 bg-primary/10 p-0 text-primary hover:bg-primary/15"
                  onClick={() => setIsGenerationModalOpen(true)}
                  title={t("scene.generateBoard")}
                >
                  <Sparkles size={18} />
                </Button>
              </div>
              <SceneMangaGallery projectId={projectId} sceneId={sceneId} />
            </Panel>

            <SceneReferencePanel
              projectId={projectId}
              sceneId={sceneId}
              references={(storyData?.references ?? []) as StoryReference[]}
              orphanReferences={
                (storyData?.orphanReferences ?? []) as Array<{
                  reference: StoryReference;
                  reason: string;
                }>
              }
              resolverData={referenceResolverData}
            />

            {chapterScenes && (
              <SceneNavigationPanel
                scenes={chapterScenes}
                currentSceneId={sceneId}
                projectId={projectId}
                tomeId={tomeId}
                chapterId={chapter.id}
                onMoveScene={moveScene}
                reorderDisabled={
                  reorderScene.isPending || updateScene.isPending || isSaving
                }
              />
            )}
          </div>
        </div>
      </form>

      {/* Generation Modal */}
      <SceneGenerationModal
        projectId={projectId}
        scene={scene}
        characters={characters.data || []}
        characterImages={characterImages.data || {}}
        isOpen={isGenerationModalOpen}
        onClose={() => setIsGenerationModalOpen(false)}
      />
    </AppShell>
  );
}
