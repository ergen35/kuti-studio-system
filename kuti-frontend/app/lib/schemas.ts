import { z } from 'zod';

// Project create schema
export const projectCreateSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  status: z.enum(['draft', 'active', 'archived', 'maintenance']),
});

// Character schema
export const characterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  alias: z.string().max(255),
  narrative_role: z.string().max(255),
  description: z.string(),
  physical_description: z.string(),
  key_traits_json: z.string(),
  color_palette_json: z.string(),
  costume_elements_json: z.string(),
  personality: z.string(),
  narrative_arc: z.string(),
  tags_json: z.string(),
});

// Relation schema
export const relationSchema = z.object({
  target_character_id: z.string().min(1, 'Target character is required'),
  relation_type: z.string().min(1, 'Type is required'),
  strength: z.number().int().min(0).max(100),
});

// Scene schema
export const sceneSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  scene_type: z.string(),
  location: z.string(),
  summary: z.string(),
  content: z.string(),
  characters_json: z.string(),
  tags_json: z.string(),
  notes: z.string(),
});

// Asset import schema
export const assetImportSchema = z.object({
  source_path: z.string().min(1, 'Source path is required'),
  name: z.string(),
  tags: z.string(),
});

// Generation job schema
export const generationJobSchema = z.object({
  source_kind: z.enum(['scene', 'chapter', 'tome']),
  source_id: z.string().min(1, 'Source is required'),
  model_key: z.string(),
  mode: z.enum(['separate', 'grid']),
});

// Version create schema
export const versionCreateSchema = z.object({
  branch: z.string().min(1, 'Branch is required'),
  label: z.string().min(1, 'Label is required'),
});

// Export create schema
export const exportCreateSchema = z.object({
  kind: z.enum(['work', 'publication']),
  format: z.enum(['json', 'tree', 'zip']),
  label: z.string().min(1, 'Label is required'),
  summary: z.string().default(''),
});

// Project settings schema
export const projectSettingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  status: z.enum(['draft', 'active', 'archived', 'maintenance']),
  locations: z.string(),
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
