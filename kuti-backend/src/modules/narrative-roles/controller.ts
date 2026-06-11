import { randomUUIDv7 } from "bun";
import { prisma } from "@lib/db";
import { normalizeNarrativeRoleCode } from "@lib/narrative-roles";
import type {
  CreateNarrativeRoleBody,
  NarrativeRoleResponse,
} from "./dto";

function serializeNarrativeRole(role: {
  id: string;
  projectId: string;
  code: string;
  label: string;
  createdAt: Date;
  updatedAt: Date;
}): NarrativeRoleResponse {
  return {
    id: role.id,
    projectId: role.projectId,
    code: role.code,
    label: role.label,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

export async function listNarrativeRoles(
  projectId: string,
): Promise<NarrativeRoleResponse[]> {
  const roles = await prisma.narrativeRole.findMany({
    where: { projectId },
    orderBy: [{ label: "asc" }, { code: "asc" }],
  });

  return roles.map(serializeNarrativeRole);
}

export async function createNarrativeRole(
  projectId: string,
  data: CreateNarrativeRoleBody,
): Promise<NarrativeRoleResponse> {
  const label = data.label.trim();
  const code = normalizeNarrativeRoleCode(label);

  const existing = await prisma.narrativeRole.findUnique({
    where: { projectId_code: { projectId, code } },
  });

  if (existing) {
    return serializeNarrativeRole(existing);
  }

  const now = new Date();

  const role = await prisma.narrativeRole.create({
    data: {
      id: randomUUIDv7(),
      projectId,
      code,
      label,
      createdAt: now,
      updatedAt: now,
    },
  });

  return serializeNarrativeRole(role);
}

