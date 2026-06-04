import { Elysia } from "elysia";
import { archiveDramaVideo, listProjectDramaVideos } from "./controller";
import { dramaVideoIdParamsSchema, dramaVideoListResponseSchema, projectIdParamsSchema } from "./dto";

export const dramaVideosModule = new Elysia({
  prefix: "/api/projects/:projectId/drama-videos",
  name: "dramaVideosModule",
  detail: { tags: ["Drama Videos"] },
})
  .get("/", ({ params: { projectId } }) => listProjectDramaVideos(projectId), {
    params: projectIdParamsSchema,
    response: dramaVideoListResponseSchema,
    detail: {
      operationId: "listProjectDramaVideos",
      summary: "List Korean drama videos for a project",
    },
  });

dramaVideosModule.post("/:dramaVideoId/archive", async ({ params: { projectId, dramaVideoId } }) => {
  const archived = await archiveDramaVideo(projectId, dramaVideoId);
  if (!archived) throw new Error("Drama video not found");
  return archived;
}, {
  params: dramaVideoIdParamsSchema,
  response: dramaVideoListResponseSchema.element,
  detail: {
    operationId: "archiveDramaVideo",
    summary: "Archive a drama video",
  },
});
