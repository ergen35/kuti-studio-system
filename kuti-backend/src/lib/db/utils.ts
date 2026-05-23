import { prisma } from ".";

export const throwIfNotExists = {
  async project(projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("project_not_found");
  },

  async character(projectId: string, characterId: string) {
    const char = await prisma.character.findFirst({
      where: { id: characterId, projectId },
    });
    if (!char) throw new Error("character_not_found");
  },

  async scene(projectId: string, sceneId: string) {
    const scene = await prisma.scene.findFirst({
      where: { id: sceneId, projectId },
    });
    if (!scene) throw new Error("scene_not_found");
  },

  async chapter(projectId: string, chapterId: string) {
    const chapter = await prisma.chapter.findFirst({
      where: { id: chapterId, projectId },
    });
    if (!chapter) throw new Error("chapter_not_found");
  },

  async tome(projectId: string, tomeId: string) {
    const tome = await prisma.tome.findFirst({
      where: { id: tomeId, projectId },
    });
    if (!tome) throw new Error("tome_not_found");
  },
};
