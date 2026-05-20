import { z } from "zod";
import {
  generateS3Key,
  getS3FileUrl,
  getS3PresignedUploadUrl,
} from "@lib/s3";
import { presignBodySchema } from "./dto";

export async function createPresignedUploadUrl(
  body: z.infer<typeof presignBodySchema>
) {
  const { folder, contentType, fileName } = body;

  const extension = fileName.includes(".")
    ? fileName.split(".").pop() || "bin"
    : "bin";

  const s3Key = generateS3Key(folder, extension);
  const presignedUrl = getS3PresignedUploadUrl(s3Key, contentType);
  const fileUrl = getS3FileUrl(s3Key);

  return {
    presignedUrl,
    s3Key,
    fileUrl,
    expiresIn: 3600,
  };
}
