import { Graphics, Text, TextStyle, Rectangle, type ColorSource } from 'pixi.js';
import { parseRgba, colorToHex, COLORS, TYPOGRAPHY } from './constants';

/**
 * Draw a rounded rectangle with fill and optional stroke.
 * Pixi v8 compatible API.
 */
export function drawRoundedRect(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor: string | number,
  fillAlpha = 1,
  strokeOptions?: {
    width: number;
    color: string | number;
    alpha?: number;
  }
): void {
  g.roundRect(x, y, width, height, radius);

  // Fill
  if (typeof fillColor === 'string') {
    const { color, alpha } = parseRgba(fillColor);
    g.fill({ color, alpha: fillAlpha * alpha });
  } else {
    g.fill({ color: fillColor, alpha: fillAlpha });
  }

  // Stroke if provided
  if (strokeOptions) {
    g.roundRect(x, y, width, height, radius);
    if (typeof strokeOptions.color === 'string') {
      const { color, alpha } = parseRgba(strokeOptions.color);
      g.stroke({
        width: strokeOptions.width,
        color,
        alpha: strokeOptions.alpha ?? alpha,
      });
    } else {
      g.stroke({
        width: strokeOptions.width,
        color: strokeOptions.color,
        alpha: strokeOptions.alpha ?? 1,
      });
    }
  }
}

/**
 * Draw a socket (circular port) for node connections.
 */
export function drawSocket(
  g: Graphics,
  x: number,
  y: number,
  radius: number,
  fillColor: string | number,
  strokeColor?: string | number,
  strokeWidth = 2
): void {
  // Fill
  if (typeof fillColor === 'string') {
    const { color, alpha } = parseRgba(fillColor);
    g.circle(x, y, radius);
    g.fill({ color, alpha });
  } else {
    g.circle(x, y, radius);
    g.fill({ color: fillColor });
  }

  // Stroke
  if (strokeColor) {
    g.circle(x, y, radius);
    if (typeof strokeColor === 'string') {
      const { color, alpha } = parseRgba(strokeColor);
      g.stroke({ width: strokeWidth, color, alpha });
    } else {
      g.stroke({ width: strokeWidth, color: strokeColor });
    }
  }
}

/**
 * Draw a curved cable (Bézier curve) between two points.
 * Automatically determines control points based on orientation.
 */
export function drawCableBezier(
  g: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  options: {
    width: number;
    color: string | number;
    alpha: number;
    shadowAlpha?: number;
    tension?: number;
  }
): void {
  const { width, color, alpha, shadowAlpha = 0.2, tension = 0.45 } = options;

  const dx = endX - startX;
  const dy = endY - startY;

  // Determine if connection is more horizontal or vertical
  const isVertical = Math.abs(dy) > Math.abs(dx);

  let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

  if (isVertical) {
    // Vertical connection: control points based on Y distance
    cp1x = startX;
    cp1y = startY + dy * tension;
    cp2x = endX;
    cp2y = endY - dy * tension;
  } else {
    // Horizontal connection: control points based on X distance
    cp1x = startX + dx * tension;
    cp1y = startY;
    cp2x = endX - dx * tension;
    cp2y = endY;
  }

  // Draw shadow first (offset slightly)
  if (shadowAlpha > 0) {
    g.moveTo(startX + 2, startY + 2);
    g.bezierCurveTo(cp1x + 2, cp1y + 2, cp2x + 2, cp2y + 2, endX + 2, endY + 2);
    const shadowColor = 0x000000;
    g.stroke({ width, color: shadowColor, alpha: shadowAlpha });
  }

  // Draw main cable
  g.moveTo(startX, startY);
  g.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);

  if (typeof color === 'string') {
    const { color: col, alpha: a } = parseRgba(color);
    g.stroke({ width, color: col, alpha: alpha * a });
  } else {
    g.stroke({ width, color, alpha });
  }
}

/**
 * Simple straight line for fallback or specific cases.
 */
export function drawLine(
  g: Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number,
  color: string | number,
  alpha = 1
): void {
  g.moveTo(startX, startY);
  g.lineTo(endX, endY);

  if (typeof color === 'string') {
    const { color: col, alpha: a } = parseRgba(color);
    g.stroke({ width, color: col, alpha: alpha * a });
  } else {
    g.stroke({ width, color, alpha });
  }
}

/**
 * Create a text object with consistent styling.
 */
export function createText(
  content: string,
  options: {
    fontSize?: number;
    color?: string | number;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    maxWidth?: number;
  } = {}
): Text {
  const {
    fontSize = TYPOGRAPHY.titleFontSize,
    color = COLORS.textPrimary,
    align = 'left',
    bold = false,
  } = options;

  let fillColor: ColorSource;
  if (typeof color === 'string') {
    fillColor = colorToHex(color);
  } else {
    fillColor = color;
  }

  const style = new TextStyle({
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize,
    fill: fillColor,
    align,
    fontWeight: bold ? '600' : '400',
  });

  const text = new Text({
    text: content,
    style,
  });

  // Handle alignment anchors
  if (align === 'center') {
    text.anchor.set(0.5, 0.5);
  } else if (align === 'right') {
    text.anchor.set(1, 0.5);
  } else {
    text.anchor.set(0, 0.5);
  }

  return text;
}

/**
 * Truncate text to fit within a given width using binary search.
 * More accurate than character-based for variable-width fonts.
 */
export function measureAndTruncate(
  text: string,
  maxWidth: number,
  style: TextStyle
): string {
  const tempText = new Text({ text, style });
  const fullWidth = tempText.width;

  if (fullWidth <= maxWidth) {
    tempText.destroy();
    return text;
  }

  // Binary search for truncation point
  let low = 0;
  let high = text.length;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const testStr = text.slice(0, mid) + '...';
    tempText.text = testStr;

    if (tempText.width <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  tempText.destroy();
  return best > 0 ? text.slice(0, best) + '...' : '...';
}

/**
 * Draw a selection glow/outline around a shape.
 */
export function drawSelectionOutline(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string | number = COLORS.selectionOutline,
  glowColor: string = COLORS.selectionGlow
): void {
  // Outer glow (simulated with thicker, semi-transparent stroke)
  const padding = 4;
  g.roundRect(x - padding, y - padding, width + padding * 2, height + padding * 2, radius + 2);

  if (typeof glowColor === 'string') {
    const { color: glowCol, alpha } = parseRgba(glowColor);
    g.stroke({ width: 4, color: glowCol, alpha });
  } else {
    g.stroke({ width: 4, color: glowColor, alpha: 0.4 });
  }

  // Main outline
  g.roundRect(x, y, width, height, radius);

  if (typeof color === 'string') {
    const { color: col } = parseRgba(color);
    g.stroke({ width: 2, color: col, alpha: 1 });
  } else {
    g.stroke({ width: 2, color: color, alpha: 1 });
  }
}
