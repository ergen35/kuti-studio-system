import { Elysia } from "elysia";
import { authProvider } from "@modules/authentication";
import * as UploadController from "./controller";
import {
  presignBodySchema,
  presignResponseSchema,
} from "./dto";

export const uploadModule = new Elysia({
  prefix: "/api/v1/files",
  name: "uploadModule",
  detail: { tags: ["Files"] },
})
  .use(authProvider)
  .post("/presign", ({ body }) => UploadController.createPresignedUploadUrl(body), {
    accessControl: { roles: ["admin", "user", "teacher"], permissions: [] },
    body: presignBodySchema,
    response: { 200: presignResponseSchema },
    detail: {
      operationId: "createFilePresign",
      summary: "Generate a presigned S3 PUT URL for direct client upload",
    },
  });
