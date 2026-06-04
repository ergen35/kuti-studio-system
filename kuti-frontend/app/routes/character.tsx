import { useMemo, useState, useEffect } from "react";
import {
  useMutation,
  useQuery,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useParams, Link, useNavigate, useLocation } from "react-router";
import { clsx } from "clsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Save,
  Archive,
  Trash2,
  UserRoundPlus,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Search,
  ChevronDown,
  Users,
  AudioWaveform,
  Link2,
  Image as ImageIcon,
} from "lucide-react";
import { useTranslation } from "~/hooks/useTranslation";
import { AppShell } from "~/components/layout";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Panel,
  RouterLinkButton,
  SectionTitle,
  toCsv,
} from "~/components/ui";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { FormField } from "~/components/FormField";
import {
  CharacterAvatar,
  CharacterImageGallery,
  CharacterImageGenerator,
  CharacterRelationGraphDialog,
  ImageLightbox,
} from "~/components/characters";
import { apiErrorMessage } from "~/lib/errors";
import { csv } from "~/lib/utils";
import { invalidateWorkspace, queryClient } from "~/lib/query";
import { invalidateQueriesById } from "~/lib/query";
import type {
  GetCharacterResponse,
  GetStorySummaryResponse,
  ListCharactersResponse,
  ListCharacterImagesResponse,
  UpdateCharacterData,
} from "~/lib/backend";
import {
  createCharacterMutation,
  getCharacterOptions,
  getStorySummaryOptions,
  listCharactersOptions,
  listCharacterImagesOptions,
  updateCharacterMutation,
  archiveCharacterMutation,
  deleteCharacterMutation,
  createRelationMutation,
  createVoiceSampleMutation,
  deleteCharacterImageMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import {
  characterSchema,
  relationSchema,
  type CharacterInput,
  type RelationInput,
} from "~/lib/schemas";

const ITEMS_PER_PAGE = 10;

const sidePanelItemClass =
  "flex h-auto w-full items-center justify-start gap-3 rounded-lg border border-border bg-secondary/30 p-2.5 text-left transition-colors hover:border-primary/45 hover:bg-secondary/60";

// Derived types from SDK
type CharacterFromList = ListCharactersResponse[number];
type CharacterImageFromList = ListCharacterImagesResponse[number];
type CharacterRelationFromSDK = GetCharacterResponse["relations"][number];
type VoiceSampleFromSDK = GetCharacterResponse["voiceSamples"][number];
type StoryReferenceFromSDK = GetStorySummaryResponse["references"][number];
type StorySceneFromSDK = GetStorySummaryResponse["scenes"][number];

type CharacterUsageScene = {
  scene: StorySceneFromSDK;
  reference: StoryReferenceFromSDK;
  tomeTitle: string;
  chapterTitle: string;
  href: string;
};

// Accordion section component
function AccordionSection({
  title,
  icon: Icon,
  meta,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  meta?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex h-auto w-full items-center justify-between rounded-none p-3 transition-colors",
          isOpen ? "bg-primary/5" : "hover:bg-secondary/40",
        )}
      >
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">{title}</span>
          {meta && (
            <span className="text-xs text-muted-foreground">({meta})</span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={clsx(
            "text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </Button>
      {isOpen && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
}

function DuplicateCharacterModal({
  isOpen,
  onClose,
  onConfirm,
  sourceName,
  relationCount,
  voiceSampleCount,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    name: string;
    includeRelations: boolean;
    includeVoiceSamples: boolean;
  }) => void;
  sourceName: string;
  relationCount: number;
  voiceSampleCount: number;
  isLoading: boolean;
}) {
  const { t } = useTranslation("characters");
  const [name, setName] = useState(sourceName);
  const [includeRelations, setIncludeRelations] = useState(true);
  const [includeVoiceSamples, setIncludeVoiceSamples] = useState(true);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName(sourceName);
    setIncludeRelations(relationCount > 0);
    setIncludeVoiceSamples(voiceSampleCount > 0);
  }, [isOpen, relationCount, sourceName, voiceSampleCount]);

  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }

    onConfirm({
      name: name.trim(),
      includeRelations,
      includeVoiceSamples,
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !isLoading && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("duplicate.title")}</DialogTitle>
          <DialogDescription>{t("duplicate.description")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField label={t("duplicate.nameLabel")}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </FormField>

          <div className="grid gap-2 rounded-2xl border border-border/70 bg-secondary/20 p-4">
            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3 transition-colors hover:border-primary/30">
              <Checkbox
                checked={includeRelations}
                onCheckedChange={(checked) =>
                  setIncludeRelations(Boolean(checked))
                }
                className="mt-0.5"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {t("duplicate.includeRelations")}
                </span>
                <span className="text-xs leading-5 text-muted-foreground">
                  {t("duplicate.includeRelationsHint", {
                    count: relationCount,
                  })}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3 transition-colors hover:border-primary/30">
              <Checkbox
                checked={includeVoiceSamples}
                onCheckedChange={(checked) =>
                  setIncludeVoiceSamples(Boolean(checked))
                }
                className="mt-0.5"
              />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium text-foreground">
                  {t("duplicate.includeVoiceSamples")}
                </span>
                <span className="text-xs leading-5 text-muted-foreground">
                  {t("duplicate.includeVoiceSamplesHint", {
                    count: voiceSampleCount,
                  })}
                </span>
              </span>
            </label>

            <p className="text-xs leading-5 text-muted-foreground">
              {t("duplicate.note")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            type="button"
          >
            {t("duplicate.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? t("actions.creating") : t("duplicate.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CharacterUsagePanel({
  projectId,
  characterSlug,
  characterStatus,
  relationCount,
  voiceSampleCount,
  sceneReferences,
  onDuplicate,
  onOpenGraph,
}: {
  projectId: string;
  characterSlug: string;
  characterStatus: CharacterFromList["status"];
  relationCount: number;
  voiceSampleCount: number;
  sceneReferences: CharacterUsageScene[];
  onDuplicate: () => void;
  onOpenGraph: () => void;
}) {
  const { t } = useTranslation("characters");

  const usageStatus =
    characterStatus === "archived"
      ? "archived"
      : sceneReferences.length > 0 || relationCount > 0
        ? "used"
        : characterStatus === "draft"
          ? "nonReferenced"
          : "orphan";

  const usageTone =
    usageStatus === "used"
      ? "ready"
      : usageStatus === "archived"
        ? "info"
        : "warning";

  return (
    <Panel className="border-border/70">
      <SectionTitle title={t("usage.title")} meta={t("usage.meta")} />

      <div className="grid gap-3 text-sm">
        <div className="rounded-2xl border border-border/70 bg-secondary/20 p-3">
          <div className="grid gap-1">
            <Badge tone={usageTone} className="w-fit">
              {t(`usage.status.${usageStatus}`)}
            </Badge>
            <span className="text-xs leading-5 text-muted-foreground">
              {t("usage.summary", {
                sceneCountLabel: t("usage.linkedScenes", {
                  count: sceneReferences.length,
                }),
                relationCountLabel: t("relations.count", {
                  count: relationCount,
                }),
                voiceSampleCountLabel: t("voiceSamples.count", {
                  count: voiceSampleCount,
                }),
              })}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {sceneReferences.length > 0
              ? t("usage.linkedScenes", { count: sceneReferences.length })
              : t("usage.noLinkedScenes")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <RouterLinkButton
            to={`/projects/${projectId}/story?q=${encodeURIComponent(characterSlug)}`}
            variant="ghost"
            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("usage.openStory")}
          </RouterLinkButton>
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenGraph}
            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("actions.openGraph")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onDuplicate}
            className="h-8 px-3 text-xs"
          >
            {t("actions.duplicate")}
          </Button>
        </div>

        <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/80 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("usage.scenesTitle")}
            </span>
            <Badge tone={sceneReferences.length > 0 ? "ready" : "warning"}>
              {sceneReferences.length}
            </Badge>
          </div>

          {sceneReferences.length > 0 ? (
            <div className="grid gap-2">
              {sceneReferences.map((entry) => (
                <RouterLinkButton
                  key={entry.reference.id}
                  to={entry.href}
                  variant="ghost"
                  className="h-auto w-full justify-between border border-border/60 px-3 py-2 text-left text-xs hover:border-primary/30"
                >
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {entry.scene.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.tomeTitle}
                      {entry.chapterTitle ? ` / ${entry.chapterTitle}` : ""}
                    </span>
                  </span>
                  <span className="ml-3 shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {entry.reference.rawToken}
                  </span>
                </RouterLinkButton>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              {t("usage.noLinkedScenes")}
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}

// Side panel with search, filters, pagination
function CharacterSidePanel({
  characters,
  currentCharacterId,
  projectId,
  relations,
  voiceSamples,
  images,
  imageLoading,
  onDeleteImage,
  onImageClick,
  relationMutation,
}: {
  characters: CharacterFromList[];
  currentCharacterId: string;
  projectId: string;
  relations: CharacterRelationFromSDK[];
  voiceSamples: VoiceSampleFromSDK[];
  images: CharacterImageFromList[];
  imageLoading: boolean;
  onDeleteImage?: (image: CharacterImageFromList) => void;
  onImageClick: (image: CharacterImageFromList, index: number) => void;
  relationMutation: UseMutationResult<unknown, Error, RelationInput, unknown>;
}) {
  const { t } = useTranslation("characters");
  const navigate = useNavigate();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter characters
  const filteredCharacters = useMemo(() => {
    let result = characters.filter((c) => c.id !== currentCharacterId);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.narrativeRole &&
            typeof c.narrativeRole === "string" &&
            c.narrativeRole.toLowerCase().includes(query)) ||
          (c.alias &&
            typeof c.alias === "string" &&
            c.alias.toLowerCase().includes(query)),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    return result;
  }, [characters, currentCharacterId, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE);
  const paginatedCharacters = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCharacters.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCharacters, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleNavigate = (charId: string) => {
    navigate(`/projects/${projectId}/characters/${charId}`);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Characters list accordion */}
      <AccordionSection
        title={t("sidepanel.otherCharacters")}
        icon={Users}
        meta={String(filteredCharacters.length)}
        defaultOpen={true}
      >
        {/* Search bar */}
        <div className="relative mb-3">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder={t("sidepanel.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-3"
          />
        </div>

        {/* Status filter */}
        <ToggleGroup
          type="single"
          value={statusFilter}
          onValueChange={(value) =>
            value && setStatusFilter(value as typeof statusFilter)
          }
          className="mb-3 flex gap-2"
        >
          {(["all", "active", "draft", "archived"] as const).map((status) => (
            <ToggleGroupItem
              key={status}
              value={status}
              className="px-2 py-1 text-xs"
            >
              {status === "all" ? t("filters.all") : t(`status.${status}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Characters list */}
        <div className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto pr-1">
          {paginatedCharacters.length > 0 ? (
            paginatedCharacters.map((char) => (
              <Button
                type="button"
                variant="ghost"
                key={char.id}
                onClick={() => handleNavigate(char.id)}
                className={sidePanelItemClass}
              >
                <CharacterAvatar
                  name={char.name}
                  colorPalette={char.colorPaletteJson}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {char.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {typeof char.narrativeRole === "string"
                      ? char.narrativeRole
                      : char.slug}
                  </p>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </Button>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("sidepanel.noResults")}
            </p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} /> {t("pagination.prev")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("pagination.next")} <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </AccordionSection>

      {/* Relations accordion */}
      <AccordionSection
        title={t("relations.title")}
        icon={Link2}
        meta={String(relations.length)}
      >
        {relations.length > 0 ? (
          <div className="flex flex-col gap-2">
            {relations.map((rel) => (
              <div
                key={rel.id}
                className="rounded-lg border border-border bg-secondary/35 p-2.5"
              >
                <div className="flex items-center justify-between">
                  <Badge>{rel.relationType}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {rel.strength}%
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  -&gt; {rel.targetCharacterId}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("relations.empty")}
          </p>
        )}

        {/* Add relation form */}
        <RelationQuickAdd
          characters={characters.filter((c) => c.id !== currentCharacterId)}
          onSubmit={
            ((relationData: {
              targetCharacterId: string;
              relationType: string;
              strength: number;
            }) => {
              relationMutation.mutate({
                path: { projectId, characterId: currentCharacterId },
                body: {
                  sourceCharacterId: currentCharacterId,
                  ...relationData,
                },
              } as never);
            }) as never
          }
          submitting={relationMutation.isPending}
        />
      </AccordionSection>

      {/* Voice samples accordion */}
      <AccordionSection
        title={t("voiceSamples.title")}
        icon={AudioWaveform}
        meta={String(voiceSamples.length)}
      >
        {voiceSamples.length > 0 ? (
          <div className="flex flex-col gap-2">
            {voiceSamples.map((sample) => (
              <div
                key={sample.id}
                className="rounded-lg border border-border bg-secondary/35 p-2.5"
              >
                <p className="text-sm font-medium text-foreground">
                  {sample.label}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {sample.voiceNotes ||
                    (typeof sample.assetPath === "string"
                      ? sample.assetPath
                      : "")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("voiceSamples.empty")}
          </p>
        )}
      </AccordionSection>

      {/* Character images accordion */}
      <AccordionSection
        title={t("images.title")}
        icon={ImageIcon}
        meta={imageLoading || !images ? "..." : String(images.length)}
      >
        {imageLoading || !images ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : images.length > 0 ? (
          <CharacterImageGallery
            images={images}
            projectId={projectId}
            characterId={currentCharacterId}
            onImageClick={onImageClick}
            onDelete={onDeleteImage}
          />
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t("images.empty")}
          </p>
        )}
      </AccordionSection>
    </div>
  );
}

export default function CharacterRoute() {
  const { projectId = "", characterId = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation(["characters", "common"]);

  // Fetch current character detail using SDK
  const character = useQuery({
    ...getCharacterOptions({
      path: { projectId, characterId },
    }),
  });

  // Fetch all characters for sidepanel using SDK
  const allCharacters = useQuery({
    ...listCharactersOptions({
      path: { projectId },
    }),
  });

  const storySummary = useQuery({
    ...getStorySummaryOptions({
      path: { projectId },
    }),
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const characterData = character.data;
  const characterReferences = useMemo<CharacterUsageScene[]>(() => {
    const summary = storySummary.data;
    if (!characterData || !summary) {
      return [];
    }

    const scenesById = new Map(
      summary.scenes.map((scene) => [scene.id, scene]),
    );
    const tomesById = new Map(summary.tomes.map((tome) => [tome.id, tome]));
    const chaptersById = new Map(
      summary.chapters.map((chapter) => [chapter.id, chapter]),
    );
    const seenSceneIds = new Set<string>();

    return summary.references
      .filter(
        (reference) =>
          reference.referenceKind === "character" &&
          reference.targetSlug === characterData.slug,
      )
      .flatMap((reference) => {
        if (seenSceneIds.has(reference.sceneId)) {
          return [];
        }

        const scene = scenesById.get(reference.sceneId);
        if (!scene) {
          return [];
        }

        const tomeTitle = tomesById.get(scene.tomeId)?.title ?? "";
        const chapterTitle = chaptersById.get(scene.chapterId)?.title ?? "";
        seenSceneIds.add(scene.id);

        return [
          {
            scene,
            reference,
            tomeTitle,
            chapterTitle,
            href: `/projects/${projectId}/story/${scene.tomeId}/scenes/${scene.id}`,
          },
        ];
      });
  }, [characterData?.slug, projectId, storySummary.data]);

  // Mutations using SDK
  const updateConfig = updateCharacterMutation();
  const update = useMutation({
    ...updateConfig,
    onSuccess: () => {
      invalidateQueriesById(queryClient, "getCharacter");
    },
  });

  const archiveConfig = archiveCharacterMutation();
  const archive = useMutation({
    ...archiveConfig,
    onSuccess: () => {
      invalidateQueriesById(queryClient, "getCharacter");
    },
  });

  const deleteConfig = deleteCharacterMutation();
  const remove = useMutation({
    ...deleteConfig,
    onSuccess: () => {
      navigate(`/projects/${projectId}/characters`);
    },
  });

  const relationConfig = createRelationMutation();
  const relation = useMutation({
    ...relationConfig,
    onSuccess: () => {
      invalidateQueriesById(queryClient, "getCharacter");
    },
  });

  // Fetch character images using SDK
  const imagesQuery = useQuery({
    ...listCharacterImagesOptions({
      path: { projectId, characterId },
    }),
  });

  // Delete image mutation using SDK
  const deleteImageConfig = deleteCharacterImageMutation();
  const deleteImageMutation = useMutation({
    ...deleteImageConfig,
    onSuccess: () => {
      invalidateQueriesById(queryClient, "listCharacterImages");
    },
  });

  const createCharacter = useMutation({
    ...createCharacterMutation(),
  });

  const createVoiceSample = useMutation({
    ...createVoiceSampleMutation(),
  });

  const duplicateCharacter = useMutation({
    mutationFn: async (payload: {
      name: string;
      includeRelations: boolean;
      includeVoiceSamples: boolean;
    }) => {
      if (!characterData) {
        throw new Error("Character data not loaded");
      }

      const duplicate = await createCharacter.mutateAsync({
        path: { projectId },
        body: {
          name: payload.name,
          alias:
            typeof characterData.alias === "string"
              ? characterData.alias
              : undefined,
          narrativeRole:
            typeof characterData.narrativeRole === "string"
              ? characterData.narrativeRole
              : undefined,
          description: characterData.description,
          physicalDescription: characterData.physicalDescription,
          keyTraitsJson: characterData.keyTraitsJson,
          colorPaletteJson: characterData.colorPaletteJson,
          costumeElementsJson: characterData.costumeElementsJson,
          personality: characterData.personality,
          narrativeArc: characterData.narrativeArc,
          tagsJson: characterData.tagsJson,
        },
      });

      if (payload.includeRelations && characterData.relations?.length) {
        await Promise.all(
          characterData.relations.map((rel) =>
            relation.mutateAsync({
              path: { projectId, characterId: duplicate.id },
              body: {
                sourceCharacterId: duplicate.id,
                targetCharacterId: rel.targetCharacterId,
                relationType: rel.relationType,
                strength: rel.strength,
                narrativeDependency: rel.narrativeDependency,
                notes: rel.notes,
              },
            }),
          ),
        );
      }

      if (payload.includeVoiceSamples && characterData.voiceSamples?.length) {
        await Promise.all(
          characterData.voiceSamples.map((sample) =>
            createVoiceSample.mutateAsync({
              path: { projectId, characterId: duplicate.id },
              body: {
                label: sample.label,
                assetPath:
                  typeof sample.assetPath === "string"
                    ? sample.assetPath
                    : undefined,
                voiceNotes: sample.voiceNotes,
              },
            }),
          ),
        );
      }

      return duplicate;
    },
    onSuccess: async (duplicate) => {
      await invalidateWorkspace(projectId);
      setIsDuplicateModalOpen(false);
      navigate(`/projects/${projectId}/characters/${duplicate.id}`);
    },
  });

  // Lightbox state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null,
  );
  const lightboxImage =
    selectedImageIndex !== null
      ? imagesQuery.data?.[selectedImageIndex] || null
      : null;
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get("view") === "graph";
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    setIsGraphOpen(searchParams.get("view") === "graph");
  }, [location.search]);

  const handleGraphOpenChange = (open: boolean) => {
    setIsGraphOpen(open);

    const searchParams = new URLSearchParams(location.search);
    if (open) {
      searchParams.set("view", "graph");
    } else {
      searchParams.delete("view");
    }

    navigate(
      {
        pathname: location.pathname,
        search: searchParams.toString() ? `?${searchParams.toString()}` : "",
      },
      { replace: true },
    );
  };

  const handleImageClick = (image: CharacterImageFromList, index: number) => {
    setSelectedImageIndex(index);
    setIsLightboxOpen(true);
  };

  const handleLightboxNavigate = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleCloseLightbox = () => {
    setIsLightboxOpen(false);
    setSelectedImageIndex(null);
  };

  const handleDeleteImage = (image: CharacterImageFromList) => {
    if (confirm(t("images.confirmDelete"))) {
      deleteImageMutation.mutate({
        path: { projectId, characterId, imageId: image.id },
      });
    }
  };

  if (character.isLoading || allCharacters.isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (character.error) {
    return (
      <AppShell>
        <ErrorState message={apiErrorMessage(character.error)} />
      </AppShell>
    );
  }

  if (!characterData) {
    return (
      <AppShell>
        <EmptyState title={t("empty.noSelection")} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Back link */}
      <div className="mb-4">
        <Link
          to={`/projects/${projectId}/characters`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} /> {t("actions.backToGrid")}
        </Link>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Main content - Character form */}
        <Panel className="overflow-hidden">
          {/* Header with avatar */}
          <div className="-mx-4 -mt-4 mb-4 flex items-start gap-4 border-b border-border bg-secondary/20 p-4 compact:-mx-3 compact:-mt-3 compact:p-3">
            <CharacterAvatar
              name={characterData.name}
              colorPalette={characterData.colorPaletteJson}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h1 className="truncate text-xl font-semibold text-foreground">
                {characterData.name}
              </h1>
              <p className="font-mono text-sm text-muted-foreground">
                {characterData.slug}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge tone={characterData.status}>
                  {characterData.status}
                </Badge>
                {typeof characterData.narrativeRole === "string" &&
                  characterData.narrativeRole && (
                    <span className="text-xs text-muted-foreground">
                      · {characterData.narrativeRole}
                    </span>
                  )}
              </div>
            </div>
          </div>

          {/* Image Generator */}
          <div className="mb-4">
            <CharacterImageGenerator
              character={characterData as unknown as CharacterFromList}
              projectId={projectId}
            />
          </div>

          {/* Form */}
          <CharacterForm
            initialData={characterData}
            saving={update.isPending}
            onDuplicate={() => setIsDuplicateModalOpen(true)}
            onSave={(body) =>
              update.mutate({ path: { projectId, characterId }, body })
            }
            onArchive={() =>
              archive.mutate({ path: { projectId, characterId } })
            }
            onDelete={() => remove.mutate({ path: { projectId, characterId } })}
            archiving={archive.isPending}
            deleting={remove.isPending}
          />
        </Panel>

        {/* Sidepanel with accordion */}
        <div className="flex flex-col gap-4">
          <CharacterUsagePanel
            projectId={projectId}
            characterSlug={characterData.slug}
            characterStatus={characterData.status}
            relationCount={characterData.relations?.length ?? 0}
            voiceSampleCount={characterData.voiceSamples?.length ?? 0}
            sceneReferences={characterReferences}
            onDuplicate={() => setIsDuplicateModalOpen(true)}
            onOpenGraph={() => handleGraphOpenChange(true)}
          />

          <CharacterSidePanel
            characters={allCharacters.data || []}
            currentCharacterId={characterId}
            projectId={projectId}
            relations={characterData.relations || []}
            voiceSamples={characterData.voiceSamples || []}
            images={imagesQuery.data || []}
            imageLoading={imagesQuery.isLoading}
            onDeleteImage={handleDeleteImage}
            onImageClick={handleImageClick}
            relationMutation={
              relation as unknown as UseMutationResult<
                unknown,
                Error,
                RelationInput,
                unknown
              >
            }
          />
        </div>

        {/* Lightbox */}
        <ImageLightbox
          image={lightboxImage}
          isOpen={isLightboxOpen}
          onClose={handleCloseLightbox}
          images={imagesQuery.data || []}
          currentIndex={selectedImageIndex ?? 0}
          onNavigate={handleLightboxNavigate}
          projectId={projectId}
          characterId={characterId}
        />
      </div>

      <DuplicateCharacterModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onConfirm={(payload) => duplicateCharacter.mutate(payload)}
        sourceName={`${characterData.name} (${t("duplicate.copySuffix")})`}
        relationCount={characterData.relations?.length ?? 0}
        voiceSampleCount={characterData.voiceSamples?.length ?? 0}
        isLoading={
          duplicateCharacter.isPending ||
          createCharacter.isPending ||
          createVoiceSample.isPending
        }
      />

      <CharacterRelationGraphDialog
        isOpen={isGraphOpen}
        onOpenChange={handleGraphOpenChange}
        projectId={projectId}
        sourceCharacter={characterData}
        relations={characterData.relations || []}
        characters={allCharacters.data || []}
      />
    </AppShell>
  );
}

// Character form component
type UpdateCharacterBody = UpdateCharacterData["body"];

function CharacterForm({
  initialData,
  saving,
  onDuplicate,
  onSave,
  onArchive,
  onDelete,
  archiving,
  deleting,
}: {
  initialData: GetCharacterResponse;
  saving: boolean;
  onDuplicate: () => void;
  onSave: (body: UpdateCharacterBody) => void;
  onArchive: () => void;
  onDelete: () => void;
  archiving: boolean;
  deleting: boolean;
}) {
  const { t } = useTranslation("characters");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CharacterInput>({
    resolver: zodResolver(characterSchema),
    defaultValues: {
      name: initialData.name,
      alias: typeof initialData.alias === "string" ? initialData.alias : "",
      narrativeRole:
        typeof initialData.narrativeRole === "string"
          ? initialData.narrativeRole
          : "",
      description: initialData.description,
      physicalDescription: initialData.physicalDescription,
      keyTraitsJson: toCsv(initialData.keyTraitsJson),
      colorPaletteJson: toCsv(initialData.colorPaletteJson),
      costumeElementsJson: toCsv(initialData.costumeElementsJson),
      personality: initialData.personality,
      narrativeArc: initialData.narrativeArc,
      tagsJson: toCsv(initialData.tagsJson),
    },
  });

  const onSubmit = (data: CharacterInput) =>
    onSave({
      name: data.name,
      alias: data.alias,
      narrativeRole: data.narrativeRole,
      description: data.description,
      physicalDescription: data.physicalDescription,
      keyTraitsJson: csv(data.keyTraitsJson),
      colorPaletteJson: csv(data.colorPaletteJson),
      costumeElementsJson: csv(data.costumeElementsJson),
      personality: data.personality,
      narrativeArc: data.narrativeArc,
      tagsJson: csv(data.tagsJson),
    });

  return (
    <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 lg:grid-cols-2">
        <FormField label={t("fields.name")} error={errors.name}>
          <Input {...register("name")} />
        </FormField>
        <FormField label={t("fields.alias")} error={errors.alias}>
          <Input {...register("alias")} />
        </FormField>
      </div>

      <FormField label={t("fields.narrativeRole")} error={errors.narrativeRole}>
        <Input {...register("narrativeRole")} />
      </FormField>

      <FormField label={t("fields.description")} error={errors.description}>
        <Textarea {...register("description")} rows={3} />
      </FormField>

      <FormField
        label={t("fields.physicalDescription")}
        error={errors.physicalDescription}
      >
        <Textarea {...register("physicalDescription")} rows={3} />
      </FormField>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormField label={t("fields.traits")} error={errors.keyTraitsJson}>
          <Input
            {...register("keyTraitsJson")}
            placeholder={t("placeholders.traits")}
          />
        </FormField>
        <FormField label={t("fields.palette")} error={errors.colorPaletteJson}>
          <Input
            {...register("colorPaletteJson")}
            placeholder={t("placeholders.palette")}
          />
        </FormField>
      </div>

      <FormField
        label={t("fields.costumeElements")}
        error={errors.costumeElementsJson}
      >
        <Input {...register("costumeElementsJson")} />
      </FormField>

      <FormField label={t("fields.personality")} error={errors.personality}>
        <Textarea {...register("personality")} rows={3} />
      </FormField>

      <FormField label={t("fields.narrativeArc")} error={errors.narrativeArc}>
        <Textarea {...register("narrativeArc")} rows={3} />
      </FormField>

      <FormField label={t("fields.tags")} error={errors.tagsJson}>
        <Input {...register("tagsJson")} />
      </FormField>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="primary" disabled={saving || isSubmitting}>
          <Save size={16} /> {t("actions.saveProfile")}
        </Button>
        <Button variant="secondary" onClick={onDuplicate} type="button">
          <ChevronRight size={15} /> {t("actions.duplicate")}
        </Button>
        <Button
          variant="ghost"
          onClick={onArchive}
          disabled={archiving}
          type="button"
        >
          <Archive size={15} /> {t("actions.archive")}
        </Button>
        <Button
          variant="danger"
          onClick={onDelete}
          disabled={deleting}
          type="button"
        >
          <Trash2 size={15} /> {t("actions.delete")}
        </Button>
      </div>
    </form>
  );
}

// Quick relation add form
function RelationQuickAdd({
  characters,
  onSubmit,
  submitting,
}: {
  characters: CharacterFromList[];
  onSubmit: (data: {
    targetCharacterId: string;
    relationType: string;
    strength: number;
  }) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation("characters");
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    watch,
    reset,
    setValue,
  } = useForm<RelationInput>({
    resolver: zodResolver(relationSchema),
    defaultValues: {
      targetCharacterId: "",
      relationType: "ally",
      strength: 50,
    },
  });

  const target = watch("targetCharacterId");

  const handleFormSubmit = (data: RelationInput) => {
    onSubmit({
      targetCharacterId: data.targetCharacterId,
      relationType: data.relationType,
      strength: data.strength,
    });
    reset({ targetCharacterId: "", relationType: "ally", strength: 50 });
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="mt-3 flex flex-col gap-2 border-t border-border pt-3"
    >
      <p className="text-xs font-medium text-muted-foreground">
        {t("relations.add.title")}
      </p>
      <Select
        value={target}
        onValueChange={(value) =>
          setValue("targetCharacterId", value, {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      >
        <SelectTrigger className="w-full text-xs">
          <SelectValue placeholder={t("relations.add.selectTarget")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {characters.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Input
          {...register("relationType")}
          className="text-xs"
          placeholder={t("relations.add.type")}
        />
        <Input
          type="number"
          min={0}
          max={100}
          {...register("strength", { valueAsNumber: true })}
          className="text-xs"
        />
      </div>
      <Button
        disabled={!target || isSubmitting || submitting}
        className="w-full text-xs py-1.5"
      >
        <UserRoundPlus size={12} /> {t("relations.add.title")}
      </Button>
    </form>
  );
}
