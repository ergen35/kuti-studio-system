import { z } from "zod";

export const narrativeRoleResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  code: z.string(),
  label: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type NarrativeRoleResponse = z.infer<typeof narrativeRoleResponseSchema>;

export const narrativeRoleListResponseSchema = z.array(narrativeRoleResponseSchema);

export const createNarrativeRoleBodySchema = z.object({
  label: z.string().min(1).max(255),
});

export type CreateNarrativeRoleBody = z.infer<typeof createNarrativeRoleBodySchema>;

