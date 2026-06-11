export type NarrativeRoleCatalogEntry = {
  code: string;
  label: string;
};

export const PREDEFINED_NARRATIVE_ROLES: NarrativeRoleCatalogEntry[] = [
  { code: "protagonist", label: "Protagonist" },
  { code: "deuteragonist", label: "Deuteragonist" },
  { code: "antagonist", label: "Antagonist" },
  { code: "tritagonist", label: "Tritagonist" },
  { code: "mentor", label: "Mentor" },
  { code: "ally", label: "Ally" },
  { code: "foil", label: "Foil" },
  { code: "love-interest", label: "Love interest" },
  { code: "guardian", label: "Guardian" },
  { code: "comic-relief", label: "Comic relief" },
  { code: "wildcard", label: "Wildcard" },
];

export function normalizeNarrativeRoleCode(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "role";
}

export function mergeNarrativeRoleCatalog(
  customRoles: Array<{ code: string; label: string }>,
): NarrativeRoleCatalogEntry[] {
  const merged = new Map<string, NarrativeRoleCatalogEntry>();

  for (const role of PREDEFINED_NARRATIVE_ROLES) {
    merged.set(role.code, role);
  }

  for (const role of customRoles) {
    const code = normalizeNarrativeRoleCode(role.code || role.label);
    if (!merged.has(code)) {
      merged.set(code, { code, label: role.label.trim() || code });
    }
  }

  return Array.from(merged.values());
}

export function resolveNarrativeRoleLabel(
  value: string | null | undefined,
  catalog: Array<{ code: string; label: string }>,
): string {
  if (!value?.trim()) {
    return "";
  }

  const normalizedValue = normalizeNarrativeRoleCode(value);
  const exactCode = catalog.find((role) => role.code === value.trim());
  if (exactCode) {
    return exactCode.label;
  }

  const codeMatch = catalog.find((role) => role.code === normalizedValue);
  if (codeMatch) {
    return codeMatch.label;
  }

  const labelMatch = catalog.find(
    (role) => normalizeNarrativeRoleCode(role.label) === normalizedValue,
  );
  if (labelMatch) {
    return labelMatch.label;
  }

  return value.trim();
}

export function resolveNarrativeRoleCode(
  value: string | null | undefined,
  catalog: Array<{ code: string; label: string }>,
): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalizedValue = normalizeNarrativeRoleCode(value);
  const exactCode = catalog.find((role) => role.code === value.trim());
  if (exactCode) {
    return exactCode.code;
  }

  const codeMatch = catalog.find((role) => role.code === normalizedValue);
  if (codeMatch) {
    return codeMatch.code;
  }

  const labelMatch = catalog.find(
    (role) => normalizeNarrativeRoleCode(role.label) === normalizedValue,
  );
  if (labelMatch) {
    return labelMatch.code;
  }

  return normalizedValue;
}

export async function ensureNarrativeRoleCode(
  value: string | null | undefined,
  catalog: Array<{ code: string; label: string }>,
  createRole: (label: string) => Promise<{ code: string; label: string }>,
): Promise<string | undefined> {
  const rawValue = value?.trim();
  if (!rawValue) {
    return undefined;
  }

  const resolvedCode = resolveNarrativeRoleCode(rawValue, catalog);
  if (!resolvedCode) {
    return undefined;
  }

  const existing = catalog.find((role) => role.code === resolvedCode);
  if (existing) {
    return existing.code;
  }

  const created = await createRole(rawValue);
  return created.code;
}
