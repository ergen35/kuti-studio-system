import type { GetStorySummaryResponse } from "~/lib/backend";
import type { TaskItem, TaskSourceEntity, SourceKind } from "./types";

type CharacterSource = Array<{
  id: string;
  slug: string;
  name: string;
}>;

export type TaskSourceResolutionData = {
  projectId: string;
  story?: GetStorySummaryResponse;
  characters?: CharacterSource;
};

function resolveSceneHref(
  projectId: string,
  sceneId: string,
  story?: GetStorySummaryResponse,
): string | null {
  const scene = story?.scenes.find((item) => item.id === sceneId);
  return scene
    ? `/projects/${projectId}/story/${scene.tomeId}/scenes/${scene.id}`
    : null;
}

function resolveChapterHref(
  projectId: string,
  chapterId: string,
  story?: GetStorySummaryResponse,
): string | null {
  const chapter = story?.chapters.find((item) => item.id === chapterId);
  return chapter
    ? `/projects/${projectId}/story/${chapter.tomeId}/chapters/${chapter.id}`
    : null;
}

function resolveTomeHref(
  projectId: string,
  tomeId: string,
  story?: GetStorySummaryResponse,
): string | null {
  const tome = story?.tomes.find((item) => item.id === tomeId);
  return tome ? `/projects/${projectId}/story/${tome.id}` : null;
}

function resolveCharacterHref(
  projectId: string,
  characterId: string,
  characters?: CharacterSource,
): string | null {
  const character = characters?.find((item) => item.id === characterId);
  return character ? `/projects/${projectId}/characters/${character.id}` : null;
}

function resolveSourceLabel(
  kind: SourceKind,
  id: string,
  data: TaskSourceResolutionData,
): string | undefined {
  switch (kind) {
    case "scene":
      return data.story?.scenes.find((item) => item.id === id)?.title;
    case "chapter":
      return data.story?.chapters.find((item) => item.id === id)?.title;
    case "tome":
      return data.story?.tomes.find((item) => item.id === id)?.title;
    case "character":
      return data.characters?.find((item) => item.id === id)?.name;
    default:
      return undefined;
  }
}

export function resolveTaskSourceEntity(
  task: TaskItem,
  data: TaskSourceResolutionData,
): TaskItem {
  const sourceEntity =
    task.sourceEntity ??
    (task.sourceId
      ? ({
          kind: task.sourceKind,
          id: task.sourceId,
          label: task.sourceLabel,
        } satisfies TaskSourceEntity)
      : undefined);

  if (!sourceEntity) {
    return task;
  }

  const resolvedLabel =
    sourceEntity.label ??
    resolveSourceLabel(sourceEntity.kind, sourceEntity.id, data);
  let resolvedHref = sourceEntity.href ?? null;

  if (!resolvedHref) {
    switch (sourceEntity.kind) {
      case "scene":
        resolvedHref = resolveSceneHref(
          data.projectId,
          sourceEntity.id,
          data.story,
        );
        break;
      case "chapter":
        resolvedHref = resolveChapterHref(
          data.projectId,
          sourceEntity.id,
          data.story,
        );
        break;
      case "tome":
        resolvedHref = resolveTomeHref(
          data.projectId,
          sourceEntity.id,
          data.story,
        );
        break;
      case "character":
        resolvedHref = resolveCharacterHref(
          data.projectId,
          sourceEntity.id,
          data.characters,
        );
        break;
      default:
        resolvedHref = null;
    }
  }

  return {
    ...task,
    sourceLabel: task.sourceLabel || resolvedLabel,
    sourceEntity: {
      ...sourceEntity,
      label: resolvedLabel ?? sourceEntity.label,
      href: resolvedHref,
    },
  };
}

export function resolveTaskSourceEntities(
  tasks: TaskItem[],
  data: TaskSourceResolutionData,
): TaskItem[] {
  return tasks.map((task) => resolveTaskSourceEntity(task, data));
}
