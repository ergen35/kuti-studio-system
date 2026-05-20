import { z } from "zod";

export const presignBodySchema = z.object({
  folder: z.string(),
  contentType: z.string(),
  fileName: z.string(),
});

export const presignResponseSchema = z.object({
  presignedUrl: z.string(),
  s3Key: z.string(),
  fileUrl: z.string(),
  expiresIn: z.number(),
});

export type PresignBody = z.infer<typeof presignBodySchema>;
export type PresignResponse = z.infer<typeof presignResponseSchema>;
