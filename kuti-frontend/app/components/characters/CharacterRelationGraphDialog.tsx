import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowUpRight, Network, PencilLine, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Badge,
  Button,
  Panel,
  RouterLinkButton,
  SectionTitle,
} from "~/components/ui";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { FormField } from "~/components/FormField";
import { CharacterAvatar } from "./CharacterAvatar";
import { useTranslation } from "~/hooks/useTranslation";
import { apiErrorMessage } from "~/lib/errors";
import { invalidateWorkspace } from "~/lib/query";
import {
  deleteRelationMutation,
  updateRelationMutation,
} from "~/lib/backend/@tanstack/react-query.gen";
import type {
  GetCharacterResponse,
  ListCharactersResponse,
} from "~/lib/backend";

type CharacterFromList = ListCharactersResponse[number];
type CharacterRelation = GetCharacterResponse["relations"][number];

type RelationNode = {
  relation: CharacterRelation;
  character: CharacterFromList | null;
  x: number;
  y: number;
};

const relationEditSchema = z.object({
  relationType: z.string().min(1),
  strength: z.coerce.number().min(0).max(100),
  narrativeDependency: z.string(),
  notes: z.string(),
});

type RelationEditInput = z.infer<typeof relationEditSchema>;

function relationTone(strength: number) {
  if (strength >= 80) return "ready";
  if (strength >= 50) return "info";
  return "warning";
}

function RelationEditorPanel({
  projectId,
  sourceCharacterId,
  relation,
  targetCharacter,
  onClearSelection,
}: {
  projectId: string;
  sourceCharacterId: string;
  relation: CharacterRelation | null;
  targetCharacter: CharacterFromList | null;
  onClearSelection: () => void;
}) {
  const { t } = useTranslation("characters");

  const updateMutation = useMutation({
    ...updateRelationMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
    },
  });

  const deleteMutation = useMutation({
    ...deleteRelationMutation(),
    onSuccess: () => {
      invalidateWorkspace(projectId);
      onClearSelection();
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RelationEditInput>({
    resolver: zodResolver(relationEditSchema),
    defaultValues: {
      relationType: relation?.relationType ?? "",
      strength: relation?.strength ?? 50,
      narrativeDependency: relation?.narrativeDependency ?? "",
      notes: relation?.notes ?? "",
    },
  });

  useEffect(() => {
    if (!relation) return;

    reset({
      relationType: relation.relationType,
      strength: relation.strength,
      narrativeDependency: relation.narrativeDependency,
      notes: relation.notes,
    });
  }, [relation, reset]);

  if (!relation) {
    return (
      <Panel className="border-dashed border-border/70 bg-background/80">
        <SectionTitle
          title={t("graph.editorTitle")}
          meta={t("graph.editorMeta")}
        />
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("graph.editorEmpty")}
        </p>
      </Panel>
    );
  }

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  const handleDelete = async () => {
    const targetLabel = targetCharacter?.name ?? relation.targetCharacterId;
    if (!window.confirm(t("graph.deleteConfirm", { name: targetLabel }))) {
      return;
    }

    deleteMutation.mutate({
      path: {
        projectId,
        characterId: sourceCharacterId,
        relationId: relation.id,
      },
    });
  };

  const handleSave = handleSubmit((data) => {
    updateMutation.mutate({
      path: {
        projectId,
        characterId: sourceCharacterId,
        relationId: relation.id,
      },
      body: {
        relationType: data.relationType.trim(),
        strength: data.strength,
        narrativeDependency: data.narrativeDependency.trim(),
        notes: data.notes.trim(),
      },
    });
  });

  const mutationError = updateMutation.error ?? deleteMutation.error;

  return (
    <Panel className="border-primary/20 bg-primary/5">
      <SectionTitle
        title={t("graph.editorTitle")}
        meta={t("graph.editorMeta")}
      />

      <div className="mt-3 grid gap-3">
        <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/90 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("graph.targetCharacter")}
            </span>
            {targetCharacter ? (
              <Badge tone={targetCharacter.status}>
                {t(`status.${targetCharacter.status}`)}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <CharacterAvatar
              name={targetCharacter?.name ?? relation.targetCharacterId}
              colorPalette={targetCharacter?.colorPaletteJson}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {targetCharacter?.name ?? relation.targetCharacterId}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {targetCharacter?.slug ?? relation.targetCharacterId}
              </p>
            </div>
          </div>
        </div>

        <form className="grid gap-3" onSubmit={handleSave}>
          <FormField
            label={t("graph.relationTypeLabel")}
            error={errors.relationType}
          >
            <Input
              {...register("relationType")}
              placeholder={t("graph.relationTypePlaceholder")}
            />
          </FormField>

          <FormField
            label={t("graph.strengthLabelInput")}
            error={errors.strength}
          >
            <Input
              {...register("strength", { valueAsNumber: true })}
              type="number"
              min={0}
              max={100}
              step={1}
            />
          </FormField>

          <FormField
            label={t("graph.narrativeDependencyLabel")}
            error={errors.narrativeDependency}
          >
            <Textarea
              {...register("narrativeDependency")}
              rows={3}
              placeholder={t("graph.narrativeDependencyPlaceholder")}
            />
          </FormField>

          <FormField label={t("graph.notesFieldLabel")} error={errors.notes}>
            <Textarea
              {...register("notes")}
              rows={4}
              placeholder={t("graph.notesPlaceholder")}
            />
          </FormField>

          {mutationError ? (
            <div className="rounded-xl border border-danger/20 bg-danger/5 px-3 py-2 text-xs leading-5 text-danger">
              {apiErrorMessage(mutationError)}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-3 text-xs"
              onClick={onClearSelection}
              disabled={isPending}
            >
              {t("graph.clearSelection")}
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="danger"
                className="h-8 px-3 text-xs"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 size={12} />
                {isPending ? t("graph.deleting") : t("graph.removeRelation")}
              </Button>

              <Button
                type="submit"
                className="h-8 px-3 text-xs"
                disabled={isPending}
              >
                <PencilLine size={12} />
                {isPending ? t("graph.saving") : t("graph.saveRelation")}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </Panel>
  );
}

export function CharacterRelationGraphDialog({
  isOpen,
  onOpenChange,
  projectId,
  sourceCharacter,
  relations,
  characters,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sourceCharacter: {
    id: string;
    name: string;
    slug: string;
    status: string;
    colorPaletteJson?: string[];
  };
  relations: CharacterRelation[];
  characters: CharacterFromList[];
}) {
  const { t } = useTranslation("characters");
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(
    null,
  );
  const autoSelectedRef = useRef(false);

  const characterById = useMemo(() => {
    return new Map(characters.map((character) => [character.id, character]));
  }, [characters]);

  const nodes = useMemo<RelationNode[]>(() => {
    if (relations.length === 0) return [];

    const radiusX = relations.length === 1 ? 0 : 34;
    const radiusY = relations.length === 1 ? 26 : 28;

    return relations.map((relation, index) => {
      const angle =
        relations.length === 1
          ? -Math.PI / 2
          : -Math.PI / 2 + (Math.PI * 2 * index) / relations.length;

      return {
        relation,
        character: characterById.get(relation.targetCharacterId) ?? null,
        x: 50 + Math.cos(angle) * radiusX,
        y: relations.length === 1 ? 24 : 50 + Math.sin(angle) * radiusY,
      };
    });
  }, [characterById, relations]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedRelationId(null);
      autoSelectedRef.current = false;
      return;
    }

    if (!autoSelectedRef.current && !selectedRelationId && relations[0]) {
      setSelectedRelationId(relations[0].id);
      autoSelectedRef.current = true;
    }
  }, [isOpen, relations, selectedRelationId]);

  useEffect(() => {
    if (
      selectedRelationId &&
      !relations.some((relation) => relation.id === selectedRelationId)
    ) {
      setSelectedRelationId(relations[0]?.id ?? null);
    }
  }, [relations, selectedRelationId]);

  const relationCountLabel = t("graph.relationCount", {
    count: relations.length,
  });

  const selectedNode = useMemo(
    () => nodes.find((node) => node.relation.id === selectedRelationId) ?? null,
    [nodes, selectedRelationId],
  );

  const selectedCharacter = selectedNode?.character ?? null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-none flex-col overflow-hidden p-0 sm:w-[96vw] sm:max-w-none sm:rounded-3xl">
        <DialogHeader className="border-b border-border/70 bg-secondary/20 px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <Network size={18} className="text-primary" />
                <DialogTitle className="text-2xl">
                  {t("graph.title")}
                </DialogTitle>
              </div>
              <DialogDescription className="max-w-3xl">
                {t("graph.description", { name: sourceCharacter.name })}
              </DialogDescription>
            </div>
            <Badge tone={relations.length > 0 ? "ready" : "warning"}>
              {relationCountLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-[radial-gradient(circle_at_top,rgba(250,250,255,0.9),rgba(247,250,255,0.78)_34%,rgba(235,240,249,0.58)_64%,rgba(226,232,240,0.72))] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {nodes.map((node) => (
                <line
                  key={node.relation.id}
                  x1={50}
                  y1={50}
                  x2={node.x}
                  y2={node.y}
                  stroke="rgba(37, 99, 235, 0.28)"
                  strokeWidth="0.35"
                  strokeLinecap="round"
                  strokeDasharray="0.9 1.6"
                />
              ))}
            </svg>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.06),transparent_45%)]" />

            <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
              <div className="rounded-[28px] border border-primary/20 bg-background/95 p-4 shadow-[0_24px_60px_-32px_rgba(37,99,235,0.6)] backdrop-blur-sm">
                <CharacterAvatar
                  name={sourceCharacter.name}
                  colorPalette={sourceCharacter.colorPaletteJson}
                  size="xl"
                  className="ring-4 ring-background/70"
                />
              </div>
              <div className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground shadow-sm">
                {t("graph.centerLabel")}
              </div>
            </div>

            {nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <Panel className="max-w-lg border-border/70 bg-background/92 shadow-lg backdrop-blur-sm">
                  <SectionTitle
                    title={t("graph.emptyTitle")}
                    meta={t("graph.emptyMeta")}
                  />
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t("graph.emptyDescription")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => onOpenChange(false)}
                    >
                      {t("graph.close")}
                    </Button>
                  </div>
                </Panel>
              </div>
            ) : null}

            {nodes.map((node) => {
              const character = node.character;
              const to = character
                ? `/projects/${projectId}/characters/${character.id}`
                : null;

              const nodeContent = (
                <>
                  <div className="flex items-start gap-3">
                    <CharacterAvatar
                      name={character?.name ?? node.relation.targetCharacterId}
                      colorPalette={character?.colorPaletteJson}
                      size="sm"
                      className="shrink-0 ring-2 ring-background"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {character?.name ?? node.relation.targetCharacterId}
                        </span>
                        {character ? (
                          <Badge tone={character.status}>
                            {t(`status.${character.status}`)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {character?.slug ?? t("graph.missingCharacter")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge
                      tone={relationTone(node.relation.strength)}
                      className="rounded-full normal-case"
                    >
                      {node.relation.relationType}
                    </Badge>
                    <Badge
                      tone={node.relation.strength >= 70 ? "ready" : "warning"}
                      className="rounded-full normal-case"
                    >
                      {t("graph.strength", {
                        strength: node.relation.strength,
                      })}
                    </Badge>
                  </div>

                  {node.relation.narrativeDependency ? (
                    <p className="mt-2 max-h-10 overflow-hidden text-[11px] leading-5 text-muted-foreground">
                      {node.relation.narrativeDependency}
                    </p>
                  ) : null}

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{t("graph.openCharacter")}</span>
                    <ArrowUpRight size={12} />
                  </div>
                </>
              );

              return (
                <div
                  key={node.relation.id}
                  className="absolute z-20 h-auto w-[220px] -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                  {to ? (
                    <RouterLinkButton
                      to={to}
                      variant="ghost"
                      className="h-auto w-full rounded-[22px] border border-border/70 bg-background/94 p-3 text-left shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)] transition-transform duration-200 hover:-translate-y-[2px] hover:border-primary/40 hover:bg-background"
                    >
                      {nodeContent}
                    </RouterLinkButton>
                  ) : (
                    <div className="rounded-[22px] border border-border/70 bg-background/94 p-3 text-left shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)]">
                      {nodeContent}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 overflow-y-auto pr-1">
            <Panel className="border-border/70">
              <SectionTitle
                title={t("graph.detailsTitle")}
                meta={relationCountLabel}
              />
              <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
                <p>
                  {t("graph.detailsDescription", {
                    name: sourceCharacter.name,
                  })}
                </p>
                <div className="grid gap-2 rounded-2xl border border-border/70 bg-secondary/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {t("graph.sourceCharacter")}
                    </span>
                    <Badge tone={sourceCharacter.status}>
                      {t(`status.${sourceCharacter.status}`)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <CharacterAvatar
                      name={sourceCharacter.name}
                      colorPalette={sourceCharacter.colorPaletteJson}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {sourceCharacter.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {sourceCharacter.slug}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Panel>

            <RelationEditorPanel
              projectId={projectId}
              sourceCharacterId={sourceCharacter.id}
              relation={selectedNode?.relation ?? null}
              targetCharacter={selectedCharacter}
              onClearSelection={() => setSelectedRelationId(null)}
            />

            {nodes.length > 0 ? (
              <Panel className="border-border/70">
                <SectionTitle
                  title={t("graph.relationsListTitle")}
                  meta={t("graph.relationsListMeta")}
                />
                <div className="grid gap-3">
                  {nodes.map((node) => {
                    const character = node.character;
                    const isSelected = node.relation.id === selectedRelationId;

                    return (
                      <div
                        key={node.relation.id}
                        className={
                          isSelected
                            ? "grid gap-3 rounded-2xl border border-primary/35 bg-primary/6 p-4 shadow-sm"
                            : "grid gap-3 rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm"
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <CharacterAvatar
                              name={
                                character?.name ??
                                node.relation.targetCharacterId
                              }
                              colorPalette={character?.colorPaletteJson}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {character?.name ??
                                  node.relation.targetCharacterId}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {character?.slug ?? t("graph.missingCharacter")}
                              </p>
                            </div>
                          </div>
                          <Badge
                            tone={relationTone(node.relation.strength)}
                            className="rounded-full normal-case"
                          >
                            {node.relation.relationType}
                          </Badge>
                        </div>

                        <div className="grid gap-2 text-xs leading-5 text-muted-foreground">
                          <p>
                            {t("graph.strengthLabel", {
                              strength: node.relation.strength,
                            })}
                          </p>
                          <p>
                            {t("graph.dependencyLabel", {
                              dependency:
                                node.relation.narrativeDependency ||
                                t("graph.none"),
                            })}
                          </p>
                          <p>
                            {t("graph.notesLabel", {
                              notes: node.relation.notes || t("graph.none"),
                            })}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 px-3 text-xs"
                            onClick={() =>
                              setSelectedRelationId(node.relation.id)
                            }
                          >
                            <PencilLine size={12} />
                            {t("graph.editRelation")}
                          </Button>

                          {character ? (
                            <RouterLinkButton
                              to={`/projects/${projectId}/characters/${character.id}`}
                              variant="ghost"
                              className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                            >
                              {t("graph.openCharacter")}
                            </RouterLinkButton>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
