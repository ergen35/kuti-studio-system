import { inngest } from "./client";

export type GenerationRunEventData = {
  jobId: string;
};

export async function sendGenerationRunEvent(data: GenerationRunEventData): Promise<void> {
  await inngest.send({
    id: `generation-run-${data.jobId}`,
    name: "kuti/generation.run",
    data,
  });
}
