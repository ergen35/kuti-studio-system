import type { GetStorySummaryResponse } from '~/lib/backend';

export type Tome = GetStorySummaryResponse['tomes'][number];
export type Chapter = GetStorySummaryResponse['chapters'][number];
export type Scene = GetStorySummaryResponse['scenes'][number];

export type NodeType = 'tome' | 'chapter' | 'scene';

export interface NodePosition {
  x: number;
  y: number;
}

export interface NarrativeNodeData {
  id: string;
  type: NodeType;
  title: string;
  position: NodePosition;
  isSelected: boolean;
  isActive: boolean;
}

export interface ConnectionData {
  id: string;
  start: NodePosition;
  end: NodePosition;
  type: 'tome-chapter' | 'chapter-scene' | 'scene-scene';
}

export interface LayoutConfig {
  /** Espacement horizontal entre les tomes (en pixels) */
  tomeSpacing: number;
  /** Espacement horizontal entre les chapitres d'un même tome */
  chapterSpacing: number;
  /** Espacement horizontal entre les scènes d'un même chapitre */
  sceneSpacing: number;
  /** Décalage vertical entre les niveaux (tome=0, chapitre=offset, scène=2*offset) */
  verticalOffset: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  tomeSpacing: 240,
  chapterSpacing: 120,
  sceneSpacing: 210, // Increased for card sizes
  verticalOffset: 170, // Increased for card heights
};

// Configuration couleurs CSS pour PixiJS (format string)
export const NODE_COLORS = {
  /** Tome - accent color (indigo-600) */
  tome: '#4f46e5',
  /** Chapter - lighter accent (indigo-500) */
  chapter: '#6366f1',
  /** Scene - muted color (slate-400) */
  scene: '#94a3b8',
  /** Scene active - warning/amber */
  sceneActive: '#f59e0b',
  /** Selected highlight - brighter */
  selected: '#ffffff',
  /** Connection line color (slate-200) */
  connection: '#e2e8f0',
  /** Background color (slate-900) */
  background: '#0f172a',
  /** Hover state color */
  hover: '#818cf8',
} as const;

// Tailles des nœuds en pixels (diamètre)
export const NODE_SIZES = {
  tome: 48,
  chapter: 32,
  scene: 16,
} as const;

// Conversion string color → hex pour Pixi Graphics
export function colorToHex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}
