import { Elysia } from "elysia";
import { listProjectDramaVideos } from "./controller";
import { dramaVideoListResponseSchema, projectIdParamsSchema } from "./dto";

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
