import { z } from "zod";

// Project create schema
export const projectCreateSchema = z.object({
  name: z.string().min(1, "Project name is required").max(255),
  status: z.enum(["draft", "active", "archived", "maintenance"]),
});

// Character schema
export const characterSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  alias: z.string().max(255),
  narrativeRole: z.string().max(255),
  description: z.string(),
  physicalDescription: z.string(),
  keyTraitsJson: z.string(),
  colorPaletteJson: z.string(),
  costumeElementsJson: z.string(),
  personality: z.string(),
  narrativeArc: z.string(),
  tagsJson: z.string(),
});

// Relation schema
export const relationSchema = z.object({
  targetCharacterId: z.string().min(1, "Target character is required"),
  relationType: z.string().min(1, "Type is required"),
  strength: z.number().int().min(0).max(100),
});

// Scene schema
export const sceneSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  sceneType: z.string(),
  location: z.string(),
  summary: z.string(),
  content: z.string(),
  charactersJson: z.string(),
  tagsJson: z.string(),
  notes: z.string(),
  narrativeIntent: z.string().optional(),
  duration: z.string().optional(),
  tone: z.string().optional(),
  rhythm: z.string().optional(),
  visualConstraints: z.string().optional(),
  stagingNotes: z.string().optional(),
});

// Asset import schema
export const assetImportSchema = z.object({
  sourcePath: z.string().min(1, "Source path is required"),
  name: z.string(),
  tags: z.string(),
});

// Generation job schema
export const generationJobSchema = z.object({
  sourceKind: z.enum(["scene", "chapter", "tome"]),
  sourceId: z.string().min(1, "Source is required"),
  modelKey: z.string(),
  mode: z.enum(["separate", "grid"]),
});

// Version create schema
export const versionCreateSchema = z.object({
  branchName: z.string().min(1, "Branch is required"),
  label: z.string().min(1, "Label is required"),
  summary: z.string().max(1000),
});

// Export create schema
export const exportKindSchema = z.enum(["work", "publication"]);
export const exportFormatSchema = z.enum([
  "json",
  "tree",
  "zip",
  "paged_images",
  "pdf",
  "cbz",
  "epub",
]);

export const exportCreateSchema = z.object({
  kind: exportKindSchema,
  formats: z.array(exportFormatSchema).min(1, "Select at least one format"),
  label: z.string().min(1, "Label is required").max(255),
  summary: z.string(),
});

// Project settings schema
export const projectCoherenceRulesSchema = z.object({
  orphanCharacter: z.boolean(),
  brokenReference: z.boolean(),
  emptyScene: z.boolean(),
  locationConflict: z.boolean(),
  timelineConflict: z.boolean(),
  continuityBreak: z.boolean(),
  toneBreak: z.boolean(),
  impossibleFact: z.boolean(),
});

export const projectCoherenceSignalsSchema = z.object({
  timelineAnchors: z.string(),
  requiredToneTags: z.string(),
  forbiddenToneTags: z.string(),
  continuityFacts: z.string(),
  impossibleFacts: z.string(),
});

export const projectCoherenceAutomationSchema = z.object({
  autoScanOnSave: z.boolean(),
});

export const projectGenerationSettingsSchema = z.object({
  defaultModelKey: z.string(),
  defaultMode: z.enum(["separate", "grid"]),
});

export const projectPreviewSettingsSchema = z.object({
  readingDirection: z.enum(["ltr", "rtl"]),
  panelDensity: z.enum(["comfortable", "compact"]),
});

export const projectVersioningSettingsSchema = z.object({
  retainedVersionsPerBranch: z.number().int().min(1).max(12),
});

export const projectExportsSettingsSchema = z.object({
  defaultKind: exportKindSchema,
  defaultFormats: z.array(exportFormatSchema).min(1),
});

export const projectLanguageSettingsSchema = z.object({
  preferredLocale: z.enum(["en", "fr"]),
});

export const projectAssetSettingsSchema = z.object({
  archiveOnDelete: z.boolean(),
  showUsageHints: z.boolean(),
});

export const projectSettingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  status: z.enum(["draft", "active", "archived", "maintenance"]),
  locations: z.string(),
  coherenceRules: projectCoherenceRulesSchema,
  coherenceSignals: projectCoherenceSignalsSchema,
  coherenceAutomation: projectCoherenceAutomationSchema,
  generation: projectGenerationSettingsSchema,
  preview: projectPreviewSettingsSchema,
  versioning: projectVersioningSettingsSchema,
  exports: projectExportsSettingsSchema,
  language: projectLanguageSettingsSchema,
  assets: projectAssetSettingsSchema,
});

// Types
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type CharacterInput = z.infer<typeof characterSchema>;
export type RelationInput = z.infer<typeof relationSchema>;
export type SceneInput = z.infer<typeof sceneSchema>;
export type AssetImportInput = z.infer<typeof assetImportSchema>;
export type GenerationJobInput = z.infer<typeof generationJobSchema>;
export type VersionCreateInput = z.infer<typeof versionCreateSchema>;
export type ExportCreateInput = z.infer<typeof exportCreateSchema>;
export type ProjectSettingsInput = z.infer<typeof projectSettingsSchema>;
export type ProjectCoherenceSignalsInput = z.infer<
  typeof projectCoherenceSignalsSchema
>;
export type ProjectCoherenceAutomationInput = z.infer<
  typeof projectCoherenceAutomationSchema
>;
