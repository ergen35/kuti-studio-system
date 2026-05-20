import { randomUUIDv7, S3Client } from "bun";

export const s3Client = new S3Client({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  bucket: process.env.S3_BUCKET,
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION || undefined,
});

export function generateS3Key(folder: string, extension: string) {
  const ext = extension.replace(/^\./, "") || "bin";
  return `${folder}/${randomUUIDv7("base64url")}.${ext}`;
}

export function getS3FileUrl(s3Key: string): string {
  return `${process.env.S3_CDN_URL}/${s3Key}`;
}

export function getS3PresignedUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const file = s3Client.file(key);
  return file.presign({ method: "PUT", expiresIn, type: contentType });
}

export function getPresignedS3FileUrl(s3Key: string, expiresIn = 3600): string {
  const file = s3Client.file(s3Key);
  return file.presign({ method: "GET", expiresIn });
}
