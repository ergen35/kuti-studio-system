import { Graphics, Container } from 'pixi.js';
import { CONNECTION_STYLES, LAYERS } from './constants';
import { drawCableBezier } from './pixi-utils';
import type { Point } from 'pixi.js';
import type { ConnectionData } from '~/lib/orchestra/types';
import type { NarrativeNode2D } from './NarrativeNode2D';

/**
 * ConnectionCable represents a curved connection between two narrative nodes.
 * Draws a Bézier curve from source output socket to target input socket.
 */
export class ConnectionCable {
  private container: Container;
  private graphics: Graphics;
  private connectionId: string;
  private sourceNode: NarrativeNode2D;
  private targetNode: NarrativeNode2D;
  private connectionType: 'tome-chapter' | 'chapter-scene' | 'scene-scene';

  // Cached positions
  private lastStartX: number = 0;
  private lastStartY: number = 0;
  private lastEndX: number = 0;
  private lastEndY: number = 0;

  constructor(
    id: string,
    sourceNode: NarrativeNode2D,
    targetNode: NarrativeNode2D,
    connectionType: 'tome-chapter' | 'chapter-scene' | 'scene-scene'
  ) {
    this.connectionId = id;
    this.sourceNode = sourceNode;
    this.targetNode = targetNode;
    this.connectionType = connectionType;

    // Create container
    this.container = new Container();
    this.container.zIndex = LAYERS.connections;

    // Create graphics
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  /**
   * Get the Pixi container for adding to viewport.
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Get the connection ID.
   */
  getId(): string {
    return this.connectionId;
  }

  /**
   * Get source node.
   */
  getSourceNode(): NarrativeNode2D {
    return this.sourceNode;
  }

  /**
   * Get target node.
   */
  getTargetNode(): NarrativeNode2D {
    return this.targetNode;
  }

  /**
   * Update the cable position based on current node positions.
   * Returns true if redrawn, false if unchanged.
   */
  update(): boolean {
    // Get socket positions
    const sourceSockets = this.sourceNode.getSocketPositions();
    const targetSockets = this.targetNode.getSocketPositions(
      this.connectionType === 'chapter-scene' ? 'chapter-scene' : undefined
    );

    if (!sourceSockets.output || !targetSockets.input) {
      return false;
    }

    const startX = sourceSockets.output.x;
    const startY = sourceSockets.output.y;
    const endX = targetSockets.input.x;
    const endY = targetSockets.input.y;

    // Check if positions changed
    const eps = 0.5;
    if (
      Math.abs(startX - this.lastStartX) < eps &&
      Math.abs(startY - this.lastStartY) < eps &&
      Math.abs(endX - this.lastEndX) < eps &&
      Math.abs(endY - this.lastEndY) < eps
    ) {
      return false;
    }

    this.lastStartX = startX;
    this.lastStartY = startY;
    this.lastEndX = endX;
    this.lastEndY = endY;

    this.redraw(startX, startY, endX, endY);
    return true;
  }

  /**
   * Force a complete redraw of the cable.
   */
  forceRedraw(): void {
    const sourceSockets = this.sourceNode.getSocketPositions();
    const targetSockets = this.targetNode.getSocketPositions(
      this.connectionType === 'chapter-scene' ? 'chapter-scene' : undefined
    );

    if (sourceSockets.output && targetSockets.input) {
      this.lastStartX = sourceSockets.output.x;
      this.lastStartY = sourceSockets.output.y;
      this.lastEndX = targetSockets.input.x;
      this.lastEndY = targetSockets.input.y;

      this.redraw(this.lastStartX, this.lastStartY, this.lastEndX, this.lastEndY);
    }
  }

  /**
   * Redraw the cable with given coordinates.
   */
  private redraw(startX: number, startY: number, endX: number, endY: number): void {
    this.graphics.clear();

    const style = CONNECTION_STYLES[this.connectionType];

    drawCableBezier(this.graphics, startX, startY, endX, endY, {
      width: style.width,
      color: style.color,
      alpha: style.alpha,
      shadowAlpha: style.shadowAlpha,
      tension: 0.45,
    });
  }

  /**
   * Set visibility of the cable.
   */
  setVisible(visible: boolean): void {
    this.container.visible = visible;
  }

  /**
   * Check if the cable is visible.
   */
  isVisible(): boolean {
    return this.container.visible;
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}

/**
 * Factory function to create a ConnectionCable from ConnectionData.
 * Requires a map of NarrativeNode2D instances.
 */
export function createConnectionCable(
  connection: ConnectionData,
  nodeMap: Map<string, NarrativeNode2D>
): ConnectionCable | null {
  // Extract source and target node IDs from connection ID
  // Format: "tome-{tomeId}", "chapter-tome-{chapterId}", "scene-chapter-{sceneId}", "scene-chain-{sceneId}"
  let sourceNode: NarrativeNode2D | undefined;
  let targetNode: NarrativeNode2D | undefined;

  const connId = connection.id;

  // Parse connection ID to find source and target
  if (connId.startsWith('tome-')) {
    // Tome to chapter connection
    const tomeId = connId.replace('tome-', '');
    sourceNode = nodeMap.get(tomeId);
    // Target is implicit - find the chapter connected to this tome
    // This is handled differently as we don't have the target in the connection ID
    // We'll need to look at the connection start/end positions
  } else if (connId.startsWith('chapter-tome-')) {
    const chapterId = connId.replace('chapter-tome-', '');
    targetNode = nodeMap.get(chapterId);
    // Source is the tome - need to find it from connection start
  } else if (connId.startsWith('scene-chapter-')) {
    const sceneId = connId.replace('scene-chapter-', '');
    targetNode = nodeMap.get(sceneId);
  } else if (connId.startsWith('scene-chain-')) {
    const sceneId = connId.replace('scene-chain-', '');
    targetNode = nodeMap.get(sceneId);
    // Source is the previous scene - need to determine from position or data
  }

  // Alternative: Use position-based lookup
  // Find source and target nodes by their positions matching connection start/end
  if (!sourceNode || !targetNode) {
    for (const node of nodeMap.values()) {
      const pos = node.getPosition();

      // Check if this node is at the start position
      if (!sourceNode && Math.abs(pos.x - connection.start.x) < 1 && Math.abs(pos.y - connection.start.y) < 1) {
        sourceNode = node;
      }

      // Check if this node is at the end position
      if (!targetNode && Math.abs(pos.x - connection.end.x) < 1 && Math.abs(pos.y - connection.end.y) < 1) {
        targetNode = node;
      }

      if (sourceNode && targetNode) break;
    }
  }

  if (!sourceNode || !targetNode) {
    return null;
  }

  return new ConnectionCable(connId, sourceNode, targetNode, connection.type);
}

/**
 * Batch update all cables in a collection.
 * Only redraws cables whose connected nodes have moved.
 */
export function updateAllCables(cables: ConnectionCable[]): void {
  for (const cable of cables) {
    cable.update();
  }
}

/**
 * Draw all cables into a single graphics object for better performance.
 * Use when individual cable management is not needed.
 */
export function drawAllCables(
  graphics: Graphics,
  connections: ConnectionData[],
  nodeMap: Map<string, NarrativeNode2D>
): void {
  graphics.clear();

  for (const conn of connections) {
    // Find source and target nodes by position
    let sourceNode: NarrativeNode2D | undefined;
    let targetNode: NarrativeNode2D | undefined;

    for (const node of nodeMap.values()) {
      const pos = node.getPosition();

      if (!sourceNode && Math.abs(pos.x - conn.start.x) < 1 && Math.abs(pos.y - conn.start.y) < 1) {
        sourceNode = node;
      }

      if (!targetNode && Math.abs(pos.x - conn.end.x) < 1 && Math.abs(pos.y - conn.end.y) < 1) {
        targetNode = node;
      }

      if (sourceNode && targetNode) break;
    }

    if (!sourceNode || !targetNode) continue;

    // Get socket positions
    const sourceSockets = sourceNode.getSocketPositions();
    const targetSockets = targetNode.getSocketPositions(
      conn.type === 'chapter-scene' ? 'chapter-scene' : undefined
    );

    if (!sourceSockets.output || !targetSockets.input) continue;

    // Draw cable
    const style = CONNECTION_STYLES[conn.type];
    drawCableBezier(
      graphics,
      sourceSockets.output.x,
      sourceSockets.output.y,
      targetSockets.input.x,
      targetSockets.input.y,
      {
        width: style.width,
        color: style.color,
        alpha: style.alpha,
        shadowAlpha: style.shadowAlpha,
        tension: 0.45,
      }
    );
  }
}
