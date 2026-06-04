import { describe, expect, test } from "bun:test";
import { redactSensitivePaths } from "./sanitization";

describe("redactSensitivePaths", () => {
  test("redacts local filesystem paths while keeping public api urls", () => {
    expect(redactSensitivePaths("ffmpeg failed at /home/kuti/data/projects/demo/generation/video.mp4")).toBe(
      "ffmpeg failed at [redacted-path]",
    );
    expect(redactSensitivePaths("open file:///tmp/kuti/source.png now")).toBe(
      "open file://[redacted-path] now",
    );
    expect(redactSensitivePaths("public endpoint /api/projects/demo/drama-videos stays visible")).toBe(
      "public endpoint /api/projects/demo/drama-videos stays visible",
    );
  });
});
