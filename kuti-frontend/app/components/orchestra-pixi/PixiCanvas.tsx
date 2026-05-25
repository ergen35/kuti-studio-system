import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Application, extend, useApplication } from '@pixi/react';
import {
  Container as PixiContainer,
  Graphics as PixiGraphics,
} from 'pixi.js';
import { Viewport as PixiViewportBase } from 'pixi-viewport';
import type { Tome, Chapter, Scene, NodePosition } from '~/lib/orchestra/types';
import { calculateConnections } from '~/lib/orchestra/layout-engine';
import { useOrchestraStore } from '~/stores/orchestra';
import { NarrativeNode2D } from './NarrativeNode2D';
import { drawAllCables } from './ConnectionCable';

// Extend Pixi components for React usage
extend({
  Container: PixiContainer,
  Graphics: PixiGraphics,
});

interface PixiCanvasProps {
  tomes: Tome[];
  chapters: Chapter[];
  scenes: Scene[];
  positions: Map<string, NodePosition>;
  currentSceneId?: string;
  selectedTomeId: string | null;
  selectedChapterId: string | null;
  selectedSceneId: string | null;
  width: number;
  height: number;
  onSelectNode: (type: 'tome' | 'chapter' | 'scene', id: string) => void;
}

export function PixiCanvas(props: PixiCanvasProps) {
  const { width, height } = props;

  return (
    <Application
      resizeTo={undefined}
      width={width}
      height={height}
      background="#0f172a"
      antialias={true}
      resolution={typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1}
      autoDensity={true}
    >
      <PixiCanvasInner {...props} />
    </Application>
  );
}

function PixiCanvasInner({
  tomes,
  chapters,
  scenes,
  positions,
  currentSceneId,
  selectedTomeId,
  selectedChapterId,
  selectedSceneId,
  onSelectNode,
  width,
  height,
}: PixiCanvasProps) {
  const { app } = useApplication();
  const viewportRef = useRef<PixiViewportBase | null>(null);
  const { viewport: viewportState, setViewport } = useOrchestraStore();
  const [isReady, setIsReady] = useState(false);

  // Node and cable refs for cleanup
  const nodesRef = useRef<Map<string, NarrativeNode2D>>(new Map());
  const cablesGraphicsRef = useRef<PixiGraphics | null>(null);

  // Calculate connections
  const connections = useMemo(
    () => calculateConnections(tomes, chapters, scenes, positions),
    [tomes, chapters, scenes, positions]
  );

  // Determine world bounds for viewport
  const worldBounds = useMemo(() => {
    const values = Array.from(positions.values());
    if (values.length === 0) {
      return { width: 2000, height: 1500 };
    }

    const xs = values.map((p) => p.x);
    const ys = values.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const padX = 600; // Increased padding for card sizes
    const padY = 400;

    return {
      width: maxX - minX + padX * 2,
      height: maxY - minY + padY * 2,
    };
  }, [positions]);

  // Setup viewport
  useEffect(() => {
    if (!app || !('renderer' in app)) return;

    const timeoutId = setTimeout(() => {
      const appWithRenderer = app as typeof app & { renderer?: { events: unknown } };
      if (!appWithRenderer.renderer?.events) return;

      const viewport = new PixiViewportBase({
        screenWidth: width,
        screenHeight: height,
        worldWidth: worldBounds.width,
        worldHeight: worldBounds.height,
        events: appWithRenderer.renderer.events,
      });

      viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate()
        .clampZoom({
          minScale: 0.2,
          maxScale: 3,
        });

      viewport.x = viewportState.x;
      viewport.y = viewportState.y;
      viewport.scale.set(viewportState.zoom);

      viewport.on('moved', () => {
        setViewport({
          x: viewport.x,
          y: viewport.y,
          zoom: viewport.scale.x,
        });
      });

      viewportRef.current = viewport;

      // Enable z-index sorting
      viewport.sortableChildren = true;

      if (app.stage) {
        app.stage.addChild(viewport);
      }

      setIsReady(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      setIsReady(false);
      
      // Cleanup
      nodesRef.current.forEach((node) => node.destroy());
      nodesRef.current.clear();
      
      if (cablesGraphicsRef.current) {
        cablesGraphicsRef.current.destroy();
        cablesGraphicsRef.current = null;
      }
      
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.destroy();
        viewportRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, worldBounds.width, worldBounds.height, width, height]);

  // Sync external changes from props (resize)
  useEffect(() => {
    if (!app || !('renderer' in app)) return;
    
    // Resize the renderer when width/height props change
    const appWithRenderer = app as typeof app & { renderer?: { resize: (w: number, h: number) => void } };
    if (appWithRenderer.renderer?.resize) {
      appWithRenderer.renderer.resize(width, height);
    }
  }, [app, width, height]);

  // Sync external changes (GSAP animations)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const eps = 0.01;
    if (
      Math.abs(vp.x - viewportState.x) > eps ||
      Math.abs(vp.y - viewportState.y) > eps ||
      Math.abs(vp.scale.x - viewportState.zoom) > eps
    ) {
      vp.x = viewportState.x;
      vp.y = viewportState.y;
      vp.scale.set(viewportState.zoom);
    }
  }, [viewportState]);

  // Render connections (cables)
  useEffect(() => {
    if (!isReady || !viewportRef.current) return;

    const viewport = viewportRef.current;

    // Clean up existing cables
    if (cablesGraphicsRef.current) {
      viewport.removeChild(cablesGraphicsRef.current);
      cablesGraphicsRef.current.destroy();
    }

    // Create cables graphics (batched for performance)
    const cablesGraphics = new PixiGraphics();
    cablesGraphics.zIndex = 10;
    cablesGraphicsRef.current = cablesGraphics;
    viewport.addChild(cablesGraphics);

    // Draw cables using the batched approach
    drawAllCables(cablesGraphics, connections, nodesRef.current);

    return () => {
      if (cablesGraphicsRef.current && viewport) {
        viewport.removeChild(cablesGraphicsRef.current);
        cablesGraphicsRef.current.destroy();
        cablesGraphicsRef.current = null;
      }
    };
  }, [isReady, connections]);

  // Render nodes
  useEffect(() => {
    if (!isReady || !viewportRef.current) return;

    const viewport = viewportRef.current;
    const nodeMap = nodesRef.current;

    // Build all items to render
    const allItems: Array<{
      id: string;
      type: 'tome' | 'chapter' | 'scene';
      title: string;
      orderIndex: number;
      subtitle: string;
    }> = [
      ...tomes.map((t, index) => ({
        id: t.id,
        type: 'tome' as const,
        title: t.title,
        orderIndex: index,
        subtitle: `Tome ${index + 1}`,
      })),
      ...chapters.map((c, index) => ({
        id: c.id,
        type: 'chapter' as const,
        title: c.title,
        orderIndex: index,
        subtitle: `Chapitre ${index + 1}`,
      })),
      ...scenes.map((s, index) => ({
        id: s.id,
        type: 'scene' as const,
        title: s.title,
        orderIndex: index,
        subtitle: '',
      })),
    ];

    // Track which nodes to keep
    const currentIds = new Set<string>();

    // Create or update nodes
    allItems.forEach((item) => {
      const pos = positions.get(item.id);
      if (!pos) return;

      currentIds.add(item.id);

      const isSelected =
        (item.type === 'tome' && selectedTomeId === item.id) ||
        (item.type === 'chapter' && selectedChapterId === item.id) ||
        (item.type === 'scene' && selectedSceneId === item.id);
      
      const isActive = item.type === 'scene' && currentSceneId === item.id;

      let node = nodeMap.get(item.id);

      if (!node) {
        // Create new node
        node = new NarrativeNode2D(
          item.id,
          item.type,
          item.title,
          item.orderIndex,
          item.subtitle,
          isActive
        );

        node.setPosition(pos.x, pos.y);

        // Set up interactions
        node.onClick = () => {
          onSelectNode(item.type, item.id);
        };

        nodeMap.set(item.id, node);
        viewport.addChild(node.getContainer());
      } else {
        // Update existing node state
        node.setSelected(isSelected);
        // Note: Active state is set at construction, would need update method if dynamic
      }
    });

    // Remove nodes that no longer exist
    nodeMap.forEach((node, id) => {
      if (!currentIds.has(id)) {
        viewport.removeChild(node.getContainer());
        node.destroy();
        nodeMap.delete(id);
      }
    });

    // Redraw cables after nodes are updated
    const cablesGraphics = cablesGraphicsRef.current;
    if (cablesGraphics) {
      drawAllCables(cablesGraphics, connections, nodeMap);
    }

    return () => {
      // Cleanup handled in other effects or on unmount
    };
  }, [
    isReady,
    tomes,
    chapters,
    scenes,
    positions,
    selectedTomeId,
    selectedChapterId,
    selectedSceneId,
    currentSceneId,
    onSelectNode,
    connections,
  ]);

  return null;
}
