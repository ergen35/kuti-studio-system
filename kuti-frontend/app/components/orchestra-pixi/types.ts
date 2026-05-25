import type { NodeType, NodePosition } from '~/lib/orchestra/types';

/**
 * Rendering-specific types for Pixi Orchestra components.
 * These extend the domain types with visual/positional data.
 */

/**
 * Dimensions of a rendered narrative node.
 */
export interface NodeDimensions {
  width: number;
  height: number;
  headerHeight: number;
  radius: number;
}

/**
 * Position of a connection socket/port on a node.
 */
export interface NodePortPosition {
  x: number;
  y: number;
}

/**
 * Complete metadata for a rendered narrative node.
 * Used by the rendering system to draw a node card.
 */
export interface RenderedNodeMeta {
  /** Node ID */
  id: string;
  /** Node type */
  type: NodeType;
  /** Display title */
  title: string;
  /** Subtitle/metadata line */
  subtitle: string;
  /** Type label with order (e.g., "TOME 1") */
  orderLabel: string;
  /** World position */
  position: NodePosition;
  /** Card dimensions */
  dimensions: NodeDimensions;
  /** Input socket position (relative to center) */
  inputPort?: NodePortPosition;
  /** Output socket position (relative to center) */
  outputPort?: NodePortPosition;
  /** Whether this node is selected */
  isSelected: boolean;
  /** Whether this node is the active scene */
  isActive: boolean;
}

/**
 * Visual state for a node.
 */
export type NodeVisualState = 'normal' | 'hover' | 'selected' | 'active';

/**
 * Configuration for a cable/connection style.
 */
export interface CableStyle {
  /** Line width in pixels */
  width: number;
  /** Stroke color (hex string or number) */
  color: string | number;
  /** Alpha transparency (0-1) */
  alpha: number;
  /** Shadow alpha for depth effect */
  shadowAlpha?: number;
  /** Curve tension (0.3-0.6 typical) */
  tension?: number;
}

/**
 * Filter settings for node visibility.
 */
export interface NodeFilter {
  /** Filter by node type */
  type?: NodeType;
  /** Filter by selection state */
  selected?: boolean;
  /** Search text for titles */
  search?: string;
}

/**
 * Viewport state managed by the orchestra store.
 */
export interface ViewportState {
  /** X position in world coordinates */
  x: number;
  /** Y position in world coordinates */
  y: number;
  /** Zoom scale (1 = 100%) */
  zoom: number;
}

/**
 * Bounds in world coordinates.
 */
export interface WorldBounds {
  /** Minimum X */
  minX: number;
  /** Minimum Y */
  minY: number;
  /** Maximum X */
  maxX: number;
  /** Maximum Y */
  maxY: number;
}

/**
 * Configurable text truncation options.
 */
export interface TruncateOptions {
  /** Maximum pixel width */
  maxWidth: number;
  /** Approximate character width for estimation */
  charWidth?: number;
  /** Ellipsis string */
  ellipsis?: string;
}
