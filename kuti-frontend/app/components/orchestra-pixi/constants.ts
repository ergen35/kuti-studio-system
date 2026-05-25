/**
 * Visual constants for Orchestra PixiJS rendering
 * Blender-inspired node editor aesthetic
 */

// ============================================
// PALETTE - Dark professional node editor style
// ============================================

export const COLORS = {
  // Canvas
  canvasBase: '#1b1d20',
  canvasVignette: '#111214',

  // Grid
  gridMinor: 'rgba(42, 45, 49, 0.5)',
  gridMajor: 'rgba(58, 62, 69, 0.7)',

  // Node body
  nodeBody: '#2b2f35',
  nodeBodyHover: '#343941',
  nodeBorder: '#4a4f57',
  nodeBorderHover: '#5a6069',
  nodeShadow: 'rgba(0, 0, 0, 0.4)',

  // Node headers by type
  headerTome: '#3f6ea8',
  headerChapter: '#4f7d5f',
  headerScene: '#5f6f82',
  headerActiveScene: '#b9782d',

  // Text
  textPrimary: '#e6e8eb',
  textSecondary: '#9aa1aa',
  textMuted: '#6b7280',
  textHeader: '#ffffff',

  // Sockets
  socketNeutral: '#b5bbc5',
  socketBorder: '#4a4f57',

  // Selection and active states
  selectionOutline: '#f6a63a',
  selectionGlow: 'rgba(246, 166, 58, 0.3)',
  activeBadge: '#f59e0b',

  // Connections
  connectionTomeChapter: '#9aa1aa',
  connectionChapterScene: '#c9d1d9',
  connectionSceneScene: '#8f98a3',
} as const;

// ============================================
// NODE DIMENSIONS per type (Blender-style cards)
// ============================================

export interface NodeDimensions {
  width: number;
  height: number;
  headerHeight: number;
  radius: number;
}

export const NODE_DIMENSIONS: Record<'tome' | 'chapter' | 'scene', NodeDimensions> = {
  tome: {
    width: 190,
    height: 88,
    headerHeight: 24,
    radius: 8,
  },
  chapter: {
    width: 180,
    height: 78,
    headerHeight: 22,
    radius: 7,
  },
  scene: {
    width: 155,
    height: 66,
    headerHeight: 20,
    radius: 6,
  },
} as const;

// ============================================
// SPACING & LAYOUT
// ============================================

export const SPACING = {
  /** Horizontal spacing between scenes */
  sceneSpacing: 210,
  /** Vertical offset between narrative levels */
  verticalOffset: 170,
  /** Padding inside nodes */
  nodePadding: 8,
  /** Socket size (diameter) */
  socketSize: 10,
  /** Socket border width */
  socketBorderWidth: 2,
} as const;

// ============================================
// CONNECTION STYLES
// ============================================

export interface ConnectionStyle {
  width: number;
  alpha: number;
  color: string;
  shadowAlpha: number;
}

export const CONNECTION_STYLES: Record<'tome-chapter' | 'chapter-scene' | 'scene-scene', ConnectionStyle> = {
  'tome-chapter': {
    width: 2,
    alpha: 0.55,
    color: COLORS.connectionTomeChapter,
    shadowAlpha: 0.2,
  },
  'chapter-scene': {
    width: 3,
    alpha: 0.7,
    color: COLORS.connectionChapterScene,
    shadowAlpha: 0.25,
  },
  'scene-scene': {
    width: 2,
    alpha: 0.55,
    color: COLORS.connectionSceneScene,
    shadowAlpha: 0.2,
  },
} as const;

// ============================================
// GRID SETTINGS
// ============================================

export const GRID = {
  /** Minor grid spacing in pixels */
  minorSpacing: 24,
  /** Major grid spacing in pixels */
  majorSpacing: 120,
  /** Padding around content when calculating grid bounds */
  padding: 500,
} as const;

// ============================================
// Z-INDEX LAYERS (for Pixi container ordering)
// ============================================

export const LAYERS = {
  grid: 0,
  connections: 10,
  nodes: 20,
  overlays: 30,
} as const;

// ============================================
// SELECTION & STATES
// ============================================

export const SELECTION = {
  /** Outline width when selected */
  outlineWidth: 2,
  /** Glow blur radius */
  glowBlur: 8,
  /** Glow alpha */
  glowAlpha: 0.4,
  /** Hover scale factor */
  hoverScale: 1.02,
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const TYPOGRAPHY = {
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  headerFontSize: 13,
  titleFontSize: 12,
  subtitleFontSize: 11,
  badgeFontSize: 9,
} as const;

// ============================================
// HELPERS
// ============================================

/**
 * Convert hex color string to number for Pixi Graphics
 */
export function colorToHex(color: string): number {
  // Handle rgba format
  if (color.startsWith('rgba')) {
    // Extract hex portion or default to white
    return 0xffffff;
  }
  // Handle rgb format  
  if (color.startsWith('rgb')) {
    return 0xffffff;
  }
  // Handle hex format
  return parseInt(color.replace('#', ''), 16);
}

/**
 * Parse rgba string to hex number and alpha
 * Returns { color: number, alpha: number }
 */
export function parseRgba(rgba: string): { color: number; alpha: number } {
  const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (match) {
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    const a = match[4] ? parseFloat(match[4]) : 1;
    return { color: (r << 16) | (g << 8) | b, alpha: a };
  }
  // Fallback for hex
  if (rgba.startsWith('#')) {
    return { color: parseInt(rgba.replace('#', ''), 16), alpha: 1 };
  }
  return { color: 0xffffff, alpha: 1 };
}
