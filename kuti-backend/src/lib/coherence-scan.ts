import { db } from "@lib/db";
import { readCoherenceAutomation } from "@lib/coherence-settings";

export async function runCoherenceScanIfEnabled(projectId: string): Promise<boolean> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { settingsJson: true },
  });

  if (!project) {
    return false;
  }

  if (!readCoherenceAutomation(project.settingsJson).autoScanOnSave) {
    return false;
  }

  try {
    const { scanWarnings } = await import("@modules/warnings/controller");
    await scanWarnings(projectId);
    return true;
  } catch (error) {
    console.error("Failed to auto-scan coherence warnings", error);
    return false;
  }
}
