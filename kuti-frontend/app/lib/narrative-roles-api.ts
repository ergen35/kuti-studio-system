import { client } from "~/lib/backend/client.gen";

export type NarrativeRoleRecord = {
  id: string;
  projectId: string;
  code: string;
  label: string;
  createdAt: string;
  updatedAt: string;
};

export type CharacterDraft = {
  description: string;
  physicalDescription: string;
  keyTraitsJson: string[];
  colorPaletteJson: string[];
  costumeElementsJson: string[];
  personality: string;
  tagsJson: string[];
  sourceModelKey: string | null;
  usedFallback: boolean;
};

export async function listNarrativeRoles(projectId: string): Promise<NarrativeRoleRecord[]> {
  return (await client.request({
    method: "GET",
    url: `/api/projects/${projectId}/narrative-roles`,
    responseStyle: "data",
    throwOnError: true,
  })) as unknown as NarrativeRoleRecord[];
}

export async function createNarrativeRole(
  projectId: string,
  label: string,
): Promise<NarrativeRoleRecord> {
  return (await client.request({
    method: "POST",
    url: `/api/projects/${projectId}/narrative-roles`,
    body: { label },
    responseStyle: "data",
    throwOnError: true,
  })) as unknown as NarrativeRoleRecord;
}

export async function generateCharacterProfileDraft(
  projectId: string,
  characterId: string,
  descriptionMinimal: string,
): Promise<CharacterDraft> {
  return (await client.request({
    method: "POST",
    url: `/api/projects/${projectId}/characters/${characterId}/generate-profile`,
    body: { descriptionMinimal },
    responseStyle: "data",
    throwOnError: true,
  })) as unknown as CharacterDraft;
}
