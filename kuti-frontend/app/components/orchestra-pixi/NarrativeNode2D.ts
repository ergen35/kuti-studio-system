import { Container, Graphics, Text, TextStyle, Rectangle } from 'pixi.js';
import { COLORS, NODE_DIMENSIONS, SPACING, SELECTION, TYPOGRAPHY, LAYERS } from './constants';
import { getCardBounds, getPortPositions, getNodeTypeLabel } from './node-metrics';
import { drawRoundedRect, drawSocket, createText, measureAndTruncate, drawSelectionOutline } from './pixi-utils';
import type { NodeType } from '~/lib/orchestra/types';

/**
 * NarrativeNode2D represents a single narrative element (tome, chapter, scene)
 * as a Blender-style node card with header, body, metadata, and connection sockets.
 */
export class NarrativeNode2D {
  private container: Container;
  private graphics: Graphics;
  private headerText: Text;
  private titleText: Text;
  private subtitleText: Text;
  private badgeText?: Text;

  private nodeId: string;
  private nodeType: 'tome' | 'chapter' | 'scene';
  private isSelected: boolean = false;
  private isHovered: boolean = false;
  private isActive: boolean = false;

  // Callbacks
  public onClick?: () => void;
  public onHover?: (hovered: boolean) => void;

  constructor(
    id: string,
    type: 'tome' | 'chapter' | 'scene',
    title: string,
    orderIndex: number,
    subtitle?: string,
    isActive: boolean = false
  ) {
    this.nodeId = id;
    this.nodeType = type;
    this.isActive = isActive;

    // Create container
    this.container = new Container();
    this.container.zIndex = LAYERS.nodes;
    this.container.sortableChildren = true;

    // Create graphics layer
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);

    // Calculate dimensions
    const dims = NODE_DIMENSIONS[type];
    const bounds = getCardBounds(type, 0, 0);

    // Type label (e.g., "TOME", "CHAP")
    const typeLabel = getNodeTypeLabel(type);
    this.headerText = createText(`${typeLabel} ${orderIndex + 1}`, {
      fontSize: TYPOGRAPHY.headerFontSize,
      color: COLORS.textHeader,
      align: 'left',
      bold: true,
    });
    this.headerText.x = bounds.x + 10;
    this.headerText.y = bounds.y + dims.headerHeight / 2;
    this.container.addChild(this.headerText);

    // Title (truncated)
    const titleStyle = new TextStyle({
      fontFamily: TYPOGRAPHY.fontFamily,
      fontSize: TYPOGRAPHY.titleFontSize,
      fill: COLORS.textPrimary,
      fontWeight: '500',
    });
    const maxTitleWidth = dims.width - 20;
    const truncatedTitle = measureAndTruncate(title, maxTitleWidth, titleStyle);

    this.titleText = createText(truncatedTitle, {
      fontSize: TYPOGRAPHY.titleFontSize,
      color: COLORS.textPrimary,
      align: 'left',
    });
    this.titleText.x = bounds.x + 10;
    this.titleText.y = bounds.y + dims.headerHeight + (dims.height - dims.headerHeight) / 2 - 4;
    this.container.addChild(this.titleText);

    // Subtitle (optional metadata)
    if (subtitle) {
      const subtitleStyle = new TextStyle({
        fontFamily: TYPOGRAPHY.fontFamily,
        fontSize: TYPOGRAPHY.subtitleFontSize,
        fill: COLORS.textSecondary,
      });
      const truncatedSubtitle = measureAndTruncate(subtitle, maxTitleWidth, subtitleStyle);

      this.subtitleText = createText(truncatedSubtitle, {
        fontSize: TYPOGRAPHY.subtitleFontSize,
        color: COLORS.textSecondary,
        align: 'left',
      });
      this.subtitleText.x = bounds.x + 10;
      this.subtitleText.y = bounds.y + dims.height - 14;
      this.container.addChild(this.subtitleText);
    } else {
      // Placeholder for alignment
      this.subtitleText = createText('', { fontSize: TYPOGRAPHY.subtitleFontSize });
    }

    // Active badge for scenes
    if (type === 'scene' && isActive) {
      this.badgeText = createText('ACTIF', {
        fontSize: TYPOGRAPHY.badgeFontSize,
        color: COLORS.textHeader,
        align: 'center',
        bold: true,
      });
      this.badgeText.x = bounds.x + dims.width - 24;
      this.badgeText.y = dims.headerHeight / 2;
      this.container.addChild(this.badgeText);
    }

    // Set up interactivity
    this.setupInteractivity();

    // Initial draw
    this.redraw();
  }

  /**
   * Get the Pixi container for adding to viewport.
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Set the world position of the node.
   */
  setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  /**
   * Get the world position of the node.
   */
  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /**
   * Set selected state.
   */
  setSelected(selected: boolean): void {
    if (this.isSelected !== selected) {
      this.isSelected = selected;
      this.redraw();
    }
  }

  /**
   * Set hover state.
   */
  setHovered(hovered: boolean): void {
    if (this.isHovered !== hovered) {
      this.isHovered = hovered;
      this.redraw();

      if (this.onHover) {
        this.onHover(hovered);
      }
    }
  }

  /**
   * Get the ID of this node.
   */
  getId(): string {
    return this.nodeId;
  }

  /**
   * Get the type of this node.
   */
  getType(): 'tome' | 'chapter' | 'scene' {
    return this.nodeType;
  }

  /**
   * Get the bounds of the card (relative to container center).
   */
  getBounds(): { x: number; y: number; width: number; height: number } {
    const dims = NODE_DIMENSIONS[this.nodeType];
    return {
      x: -dims.width / 2,
      y: -dims.height / 2,
      width: dims.width,
      height: dims.height,
    };
  }

  /**
   * Get socket positions for connection drawing.
   * @param connectionType - For scenes, determines which input socket to use
   */
  getSocketPositions(connectionType?: 'chapter-scene' | 'scene-scene'): {
    input?: { x: number; y: number };
    output?: { x: number; y: number };
  } {
    const pos = this.getPosition();
    return getPortPositions(this.nodeType, pos.x, pos.y, connectionType);
  }

  /**
   * Redraw the entire node.
   */
  private redraw(): void {
    this.graphics.clear();

    const dims = NODE_DIMENSIONS[this.nodeType];
    const bounds = this.getBounds();

    // Determine colors based on state
    const headerColor = this.getHeaderColor();
    const bodyColor = this.isHovered ? COLORS.nodeBodyHover : COLORS.nodeBody;
    const borderColor = this.isHovered ? COLORS.nodeBorderHover : COLORS.nodeBorder;

    // Draw shadow
    this.graphics.roundRect(bounds.x + 2, bounds.y + 2, bounds.width, bounds.height, dims.radius);
    this.graphics.fill({ color: 0x000000, alpha: 0.3 });

    // Draw body (background)
    drawRoundedRect(
      this.graphics,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      dims.radius,
      bodyColor,
      1,
      { width: 1, color: borderColor, alpha: 0.8 }
    );

    // Draw header
    const headerHeight = dims.headerHeight;
    drawRoundedRect(
      this.graphics,
      bounds.x,
      bounds.y,
      bounds.width,
      headerHeight,
      dims.radius,
      headerColor,
      1
    );

    // Fill the rest of the header area (for rounded corners continuity)
    this.graphics.rect(bounds.x, bounds.y + dims.radius, bounds.width, headerHeight - dims.radius);
    this.graphics.fill({ color: headerColor });

    // Draw sockets
    const socketRadius = SPACING.socketSize / 2;
    const ports = getPortPositions(this.nodeType, 0, 0);

    // Input socket
    if (ports.input) {
      drawSocket(
        this.graphics,
        ports.input.x,
        ports.input.y,
        socketRadius,
        COLORS.nodeBody,
        COLORS.socketBorder,
        SPACING.socketBorderWidth
      );
    }

    // Output socket
    if (ports.output) {
      drawSocket(
        this.graphics,
        ports.output.x,
        ports.output.y,
        socketRadius,
        COLORS.nodeBody,
        COLORS.socketBorder,
        SPACING.socketBorderWidth
      );
    }

    // Draw selection outline
    if (this.isSelected) {
      drawSelectionOutline(
        this.graphics,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        dims.radius
      );
    }

    // Scale effect on hover
    if (this.isHovered && !this.isSelected) {
      this.container.scale.set(SELECTION.hoverScale);
    } else {
      this.container.scale.set(1);
    }
  }

  /**
   * Get the appropriate header color based on node type and state.
   */
  private getHeaderColor(): string {
    if (this.nodeType === 'scene' && this.isActive) {
      return COLORS.headerActiveScene;
    }
    switch (this.nodeType) {
      case 'tome':
        return COLORS.headerTome;
      case 'chapter':
        return COLORS.headerChapter;
      case 'scene':
        return COLORS.headerScene;
      default:
        return COLORS.headerScene;
    }
  }

  /**
   * Set up interactive events.
   */
  private setupInteractivity(): void {
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    // Handle interactions on the graphics
    this.graphics.eventMode = 'static';
    this.graphics.cursor = 'pointer';

    const hitArea = this.container.getBounds();
    this.container.hitArea = new Rectangle(
      hitArea.x - this.container.x,
      hitArea.y - this.container.y,
      hitArea.width,
      hitArea.height
    );

    this.graphics.on('pointerenter', () => {
      this.setHovered(true);
    });

    this.graphics.on('pointerleave', () => {
      this.setHovered(false);
    });

    this.graphics.on('pointerdown', () => {
      if (this.onClick) {
        this.onClick();
      }
    });

    // Propagate to container
    this.container.on('pointerenter', () => {
      this.setHovered(true);
    });

    this.container.on('pointerleave', () => {
      this.setHovered(false);
    });

    this.container.on('pointerdown', () => {
      if (this.onClick) {
        this.onClick();
      }
    });
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.headerText.destroy();
    this.titleText.destroy();
    this.subtitleText.destroy();
    if (this.badgeText) {
      this.badgeText.destroy();
    }
    this.graphics.destroy();
    this.container.destroy();
  }
}
