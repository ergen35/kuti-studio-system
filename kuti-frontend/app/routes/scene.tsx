import { useMemo, useState, useCallback, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { clsx } from "clsx";
import { toast } from "sonner";
import {
  FileText,
  Save,
  Trash2,
  Sparkles,
  Monitor,
  ChevronDown,
  ChevronRight,
  Users,
  Image as ImageIcon,
  AlertTriangle,
  Link2,
  Layout,
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
import {
  buildReferenceToken,
  getReferenceSyntax,
  normalizeReferenceKind,
  normalizeReferenceSlug,
  type ReferenceKind,
  type ReferenceUrlResolver,
} from "~/lib/references";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getProjectOptions,
  getStorySummaryOptions,
  updateSceneMutation,
  deleteSceneMutation,
  listCharactersOptions,
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

function SceneSidebar({
  projectId,
  sceneId,
  scene,
  chapter,
  tome,
  sceneNumber,
  tomeNumber,
  chapterNumber,
  projectLocations,
  characters,
  references,
  warnings,
  warningsLoading,
  referenceResolverData,
  onOpenGenerationModal,
}: {
  projectId: string;
  sceneId: string;
  scene: Scene;
  chapter: Chapter;
  tome: Tome;
  sceneNumber: number;
  tomeNumber: number;
  chapterNumber: number;
  projectLocations: string[];
  characters: SceneCharacter[];
  references: StoryReference[];
  warnings: SceneWarning[];
  warningsLoading: boolean;
  referenceResolverData: {
    projectId: string;
    tomes: Tome[];
    chapters: Chapter[];
    scenes: Scene[];
    characters: Array<{ id: string; slug: string; name: string }>;
    assets: Array<{ id: string; slug: string; name: string }>;
    locations: string[];
  };
  onOpenGenerationModal: () => void;
}) {
  const { t } = useTranslation(["story", "common"]);

  const sceneLocation = useMemo(
    () => resolveSceneLocation(scene.location, projectId, projectLocations),
    [projectId, projectLocations, scene.location],
  );
  const sceneReferences = useMemo(
    () => references.filter((r) => r.sceneId === sceneId),
    [references, sceneId],
  );
  const openWarnings = useMemo(
    () => warnings.filter((w) => w.status === "open"),
    [warnings],
  );

  return (
    <div className="rounded-xl border border-line bg-surface">
      {/* Fixed header */}
      <div className="border-b border-line p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">S{sceneNumber}</span>
              <span className="truncate font-medium text-ink">{scene.title}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              T{tomeNumber} · C{chapterNumber}
            </p>
          </div>
          <Badge tone={scene.status} className="text-[10px]">
            {scene.status}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone={scene.sceneType ? "info" : "warning"} className="text-[10px]">
            {scene.sceneType || t("scene.placeholders.type")}
          </Badge>
          <Badge
            tone={scene.location ? (sceneLocation.registered ? "ready" : "warning") : "warning"}
            className="text-[10px]"
          >
            {scene.location || t("meta.noLocation")}
          </Badge>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="divide-y divide-line">
        {/* Characters */}
        <details className="group" open>
          <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-ink">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-primary" />
              {t("panels.context.characters")}
              <Badge tone="info" className="text-[10px]">
                {scene.charactersJson.length}
              </Badge>
            </div>
            <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3">
            <SceneCharacterChips
              projectId={projectId}
              charactersValue={scene.charactersJson.join(", ")}
              characters={characters}
            />
          </div>
        </details>

        {/* Manga boards */}
        <details className="group" open>
          <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-ink">
            <div className="flex items-center gap-2">
              <ImageIcon size={14} className="text-primary" />
              {t("scene.mangaBoards")}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="size-6 p-0 text-primary hover:bg-primary/10"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenGenerationModal();
                }}
                title={t("scene.generateBoard")}
              >
                <Sparkles size={14} />
              </Button>
              <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
            </div>
          </summary>
          <div className="px-3 pb-3">
            <SceneMangaGallery projectId={projectId} sceneId={sceneId} />
          </div>
        </details>

        {/* References */}
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-ink">
            <div className="flex items-center gap-2">
              <Link2 size={14} className="text-primary" />
              {t("panels.references.title")}
              <Badge tone="info" className="text-[10px]">
                {sceneReferences.length}
              </Badge>
            </div>
            <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3">
            {sceneReferences.length === 0 ? (
              <p className="text-xs text-muted">{t("panels.references.empty.title")}</p>
            ) : (
              <div className="space-y-1.5">
                {sceneReferences.slice(0, 5).map((ref) => {
                  const resolved = resolveSceneReferenceDisplay(
                    ref.referenceKind,
                    ref.targetSlug,
                    referenceResolverData,
                  );
                  return (
                    <div key={ref.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-primary">
                        {buildReferenceToken(resolved.canonicalKind ?? "character", ref.targetSlug)}
                      </span>
                      {resolved.href ? (
                        <Link to={resolved.href} className="truncate text-accent hover:underline">
                          {resolved.label}
                        </Link>
                      ) : (
                        <span className="truncate text-muted">{resolved.label}</span>
                      )}
                    </div>
                  );
                })}
                {sceneReferences.length > 5 && (
                  <p className="text-xs text-muted">+{sceneReferences.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        </details>

        {/* Warnings */}
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-ink">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className={openWarnings.length > 0 ? "text-warning" : "text-primary"} />
              {t("panels.context.warnings")}
              <Badge tone={openWarnings.length > 0 ? "warning" : "ready"} className="text-[10px]">
                {warningsLoading ? "..." : openWarnings.length}
              </Badge>
            </div>
            <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3">
            {warnings.length === 0 ? (
              <p className="text-xs text-muted">{t("panels.context.emptyWarnings")}</p>
            ) : (
              <div className="space-y-1.5">
                {warnings.slice(0, 3).map((warning) => (
                  <div key={warning.id} className="rounded-lg border border-line bg-surface-2/50 p-2">
                    <p className="truncate text-xs font-medium text-ink">{warning.title}</p>
                    <p className="mt-0.5 truncate text-[10px] text-muted">{warning.message}</p>
                  </div>
                ))}
              </div>
            )}
            <LinkButton
              className="mt-2 h-7 text-xs"
              href={`/projects/${projectId}/warnings?entityKind=scene&entityId=${sceneId}`}
            >
              {t("panels.context.openWarningsCta")}
            </LinkButton>
          </div>
        </details>

        {/* Navigation */}
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-ink">
            <div className="flex items-center gap-2">
              <ChevronRight size={14} className="text-primary" />
              {t("scene.navigation.title")}
            </div>
            <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div className="px-3 pb-3 space-y-1.5">
            <LinkButton className="h-7 w-full justify-start text-xs" href={`/projects/${projectId}/story/${tome.id}`}>
              {t("panels.context.openTome")}
            </LinkButton>
            <LinkButton
              className="h-7 w-full justify-start text-xs"
              href={`/projects/${projectId}/story/${tome.id}/chapters/${chapter.id}`}
            >
              {t("panels.context.openChapter")}
            </LinkButton>
            <LinkButton
              className="h-7 w-full justify-start text-xs"
              href={`/projects/${projectId}/settings`}
            >
              {t("panels.context.openSettings")}
            </LinkButton>
          </div>
        </details>
      </div>
    </div>
  );
}

const sceneSchema = z.object({
  title: z.string().min(1, "titleRequired"),
  sceneType: z.string().optional(),
  location: z.string().optional(),
  targetPageCount: z.coerce.number().int().min(1).max(10).nullable().optional(),
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

  const sceneWarnings = useQuery({
    ...listWarningsOptions({
      path: { projectId },
      query: { entityKind: "scene", entityId: sceneId },
    }),
    enabled: !!projectId && !!sceneId,
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
      assets: [] as Array<{
        id: string;
        slug: string;
        name: string;
      }>,
      locations: projectLocations,
    }),
    [projectId, storyData, characters.data, projectLocations],
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
      toast.success(t("common:toast.saved"));
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error(apiErrorMessage(error));
    },
  });

  const deleteScene = useMutation({
    ...deleteSceneMutation(),
    onSuccess: () => {
      invalidateQueriesById(queryClient, "getStorySummary");
      toast.success(t("common:toast.deleted"));
      navigate(
        `/projects/${projectId}/story/${tomeId}/chapters/${scene?.chapterId}`,
      );
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error));
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
      targetPageCount: null,
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
        targetPageCount: typeof scene.targetPageCount === "number" ? scene.targetPageCount : null,
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
          targetPageCount: data.targetPageCount ?? null,
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

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
          {/* Main content */}
          <div className="flex flex-col gap-4">
            {/* Compact header with title input */}
            <div className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText size={20} />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary">S{sceneNumber}</span>
                    <div className="flex items-center gap-2">
                      <Badge tone={scene.status} className="text-[10px]">
                        {scene.status}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={toggleOrchestra}
                        className="h-7 gap-1.5 border border-primary/25 bg-primary/10 px-2 text-xs text-primary hover:bg-primary/15"
                        title={t("scene.orchestra.switchToOrchestra")}
                      >
                        <Monitor size={14} />
                        {t("scene.orchestra.mode")}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>{t("fields.title")}</span>
                      <StoryCompletionButton
                        projectId={projectId}
                        targetKind="scene"
                        targetId={sceneId}
                        field="title"
                        currentValue={watch("title")}
                        onComplete={(text) =>
                          setValue("title", text, { shouldDirty: true, shouldValidate: true })
                        }
                      />
                    </div>
                    <Input {...register("title")} className="text-lg font-semibold" />
                    {errors.title && (
                      <span className="text-danger text-xs">{errors.title.message}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Scene editor */}
            <div className="rounded-xl border border-line bg-surface p-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">{t("panels.sceneEditor.title")}</h2>
              <div className="flex flex-col gap-4">
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

                {/* Target page count */}
                <div className="grid gap-1.5 text-xs text-muted-foreground max-w-48">
                  <span>{t("fields.targetPageCount")}</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    {...register("targetPageCount", { valueAsNumber: true })}
                    placeholder={t("scene.placeholders.targetPageCount")}
                  />
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
                      <div>
                        <LexicalEditor
                          key={`${sceneId}-${editorVersion}`}
                          initialValue={field.value || ""}
                          onChange={field.onChange}
                          placeholder={t("editor.placeholder")}
                          minHeight="600px"
                          referenceProjectId={projectId}
                          referenceUrlResolver={resolveReferenceUrl}
                        />
                        <div className="mt-2 rounded-lg border border-dashed border-border/70 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">
                            {t("editor.scriptGuideTitle")}
                          </p>
                          <p className="mt-1 leading-5">
                            {t("editor.scriptGuideDescription")}
                          </p>
                        </div>
                      </div>
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

                {/* Metadata - collapsible */}
                <details className="group rounded-lg border border-line">
                  <summary className="flex cursor-pointer items-center justify-between p-3 text-sm font-medium text-ink">
                    {t("panels.metadata.title")}
                    <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-4 px-3 pb-3 lg:grid-cols-2">
                    <Field label={t("fields.narrativeIntent")}>
                      <Textarea
                        {...register("narrativeIntent")}
                        rows={3}
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
                        rows={3}
                        placeholder={t("scene.placeholders.visualConstraints")}
                      />
                    </Field>
                    <Field label={t("fields.stagingNotes")}>
                      <Textarea
                        {...register("stagingNotes")}
                        rows={3}
                        placeholder={t("scene.placeholders.stagingNotes")}
                      />
                    </Field>
                  </div>
                </details>
              </div>
            </div>

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

          {/* Consolidated sidebar */}
          <SceneSidebar
            projectId={projectId}
            sceneId={sceneId}
            scene={scene}
            chapter={chapter}
            tome={tome}
            sceneNumber={sceneNumber}
            tomeNumber={tomeNumber}
            chapterNumber={chapterNumber}
            projectLocations={projectLocations}
            characters={(characters.data || []) as SceneCharacter[]}
            references={(storyData?.references ?? []) as StoryReference[]}
            warnings={(sceneWarnings.data ?? []) as SceneWarning[]}
            warningsLoading={sceneWarnings.isLoading}
            referenceResolverData={referenceResolverData}
            onOpenGenerationModal={() => setIsGenerationModalOpen(true)}
          />
        </div>
      </form>

      {/* Generation Modal */}
      <SceneGenerationModal
        projectId={projectId}
        scene={scene}
        isOpen={isGenerationModalOpen}
        onClose={() => setIsGenerationModalOpen(false)}
      />
    </AppShell>
  );
}
