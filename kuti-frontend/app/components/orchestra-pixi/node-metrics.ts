import { Point } from 'pixi.js';
import { NODE_DIMENSIONS, SPACING } from './constants';
import type { NodeType } from '~/lib/orchestra/types';

/**
 * Calculate the input and output socket positions for a narrative node
 * based on its type and the connection type.
 *
 * @param type - Node type ('tome' | 'chapter' | 'scene')
 * @param centerX - Node center X position
 * @param centerY - Node center Y position
 * @param connectionType - Type of connection to determine port position
 * @returns Object with input and output port positions (undefined if not applicable)
 */
export function getPortPositions(
  type: 'tome' | 'chapter' | 'scene',
  centerX: number,
  centerY: number,
  connectionType?: 'tome-chapter' | 'chapter-scene' | 'scene-scene'
): {
  input?: { x: number; y: number };
  output?: { x: number; y: number };
} {
  const dims = NODE_DIMENSIONS[type];
  const halfWidth = dims.width / 2;
  const halfHeight = dims.height / 2;

  switch (type) {
    case 'tome':
      // Tome only has output at bottom center
      return {
        output: {
          x: centerX,
          y: centerY + halfHeight,
        },
      };

    case 'chapter':
      // Chapter has input at top and output at bottom
      return {
        input: {
          x: centerX,
          y: centerY - halfHeight,
        },
        output: {
          x: centerX,
          y: centerY + halfHeight,
        },
      };

    case 'scene':
      // Scene has more complex port positioning:
      // - First scene in chapter: input at top (from chapter), output at right
      // - Other scenes: input at left (from previous scene), output at right
      // - Last scene might have different output, but we keep consistent for now

      const isFirstScene = connectionType === 'chapter-scene';

      return {
        input: {
          x: isFirstScene ? centerX : centerX - halfWidth,
          y: isFirstScene ? centerY - halfHeight : centerY,
        },
        output: {
          x: centerX + halfWidth,
          y: centerY,
        },
      };

    default:
      return {};
  }
}

/**
 * Get the card bounds (top-left corner and dimensions)
 * given the center position.
 *
 * @param type - Node type
 * @param centerX - Center X position
 * @param centerY - Center Y position
 * @returns Object with x, y (top-left), width, height
 */
export function getCardBounds(
  type: 'tome' | 'chapter' | 'scene',
  centerX: number,
  centerY: number
): { x: number; y: number; width: number; height: number } {
  const dims = NODE_DIMENSIONS[type];
  return {
    x: centerX - dims.width / 2,
    y: centerY - dims.height / 2,
    width: dims.width,
    height: dims.height,
  };
}

/**
 * Get socket position on a node edge.
 * Used when calculating connection start/end points.
 *
 * @param cardBounds - The card bounds from getCardBounds
 * @param type - Node type
 * @param socketType - Which socket to position
 * @param connectionType - For scene nodes, determines if it's a chapter input
 * @returns Point with x, y coordinates
 */
export function getSocketPosition(
  cardBounds: { x: number; y: number; width: number; height: number },
  type: 'tome' | 'chapter' | 'scene',
  socketType: 'input' | 'output',
  connectionType?: 'chapter-scene' | 'scene-scene'
): Point {
  const centerX = cardBounds.x + cardBounds.width / 2;
  const centerY = cardBounds.y + cardBounds.height / 2;

  const ports = getPortPositions(type, centerX, centerY, connectionType);

  if (socketType === 'input' && ports.input) {
    return new Point(ports.input.x, ports.input.y);
  }
  if (socketType === 'output' && ports.output) {
    return new Point(ports.output.x, ports.output.y);
  }

  // Fallback to center (should not happen)
  return new Point(centerX, centerY);
}

/**
 * Calculate connection points between two narrative nodes.
 *
 * @param sourceType - Type of source node
 * @param sourceBounds - Bounds of source card
 * @param targetType - Type of target node
 * @param targetBounds - Bounds of target card
 * @param connectionType - Type of connection
 * @returns Object with start and end Points
 */
export function calculateConnectionPoints(
  sourceType: 'tome' | 'chapter' | 'scene',
  sourceBounds: { x: number; y: number; width: number; height: number },
  targetType: 'tome' | 'chapter' | 'scene',
  targetBounds: { x: number; y: number; width: number; height: number },
  connectionType: 'tome-chapter' | 'chapter-scene' | 'scene-scene'
): { start: Point; end: Point } {
  const start = getSocketPosition(
    sourceBounds,
    sourceType,
    'output',
    connectionType === 'chapter-scene' ? 'chapter-scene' : undefined
  );

  const end = getSocketPosition(
    targetBounds,
    targetType,
    'input',
    connectionType === 'chapter-scene' ? 'chapter-scene' : undefined
  );

  return { start, end };
}

/**
 * Truncate text to fit within a given pixel width.
 * Simple character-based truncation with ellipsis.
 */
export function truncateText(text: string, maxWidth: number, charWidth = 7): string {
  const maxChars = Math.floor(maxWidth / charWidth);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}

/**
 * Get node label based on type and index.
 */
export function getNodeTypeLabel(type: NodeType): string {
  switch (type) {
    case 'tome':
      return 'TOME';
    case 'chapter':
      return 'CHAP';
    case 'scene':
      return 'SCÈNE';
    default:
      return '';
  }
}
