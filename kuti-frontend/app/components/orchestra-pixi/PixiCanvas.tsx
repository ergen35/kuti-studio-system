import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Application, extend, useApplication } from '@pixi/react';
import {
  Container as PixiContainer,
  Graphics as PixiGraphics,
  Text as PixiText,
} from 'pixi.js';
import { Viewport as PixiViewportBase } from 'pixi-viewport';
import type { Tome, Chapter, Scene, NodePosition } from '~/lib/orchestra/types';
import { calculateConnections } from '~/lib/orchestra/layout-engine';
import { useOrchestraStore } from '~/stores/orchestra';

// Extend Pixi components for React usage
extend({
  Container: PixiContainer,
  Graphics: PixiGraphics,
  Text: PixiText,
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

    const padX = 400;
    const padY = 300;

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
      if (app.stage) {
        app.stage.addChild(viewport);
      }
      setIsReady(true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      setIsReady(false);
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.destroy();
        viewportRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, worldBounds.width, worldBounds.height, width, height]);

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

  // Render elements directly into viewport using refs
  const viewport = viewportRef.current;

  // Manage connections
  useEffect(() => {
    if (!viewport) return;

    const graphicsMap = new Map<string, PixiGraphics>();

    connections.forEach((conn) => {
      const g = new PixiGraphics();

      // Draw connection based on type
      g.clear();

      let strokeStyle: { width: number; color: number; alpha: number };

      switch (conn.type) {
        case 'tome-chapter':
          strokeStyle = { width: 2, color: 0xe2e8f0, alpha: 0.6 };
          break;
        case 'chapter-scene':
          strokeStyle = { width: 3, color: 0xe2e8f0, alpha: 0.7 };
          break;
        case 'scene-scene':
          strokeStyle = { width: 1, color: 0xe2e8f0, alpha: 0.5 };
          break;
      }

      // Draw the line: moveTo -> lineTo -> stroke
      g.moveTo(conn.start.x, conn.start.y);
      g.lineTo(conn.end.x, conn.end.y);
      g.stroke(strokeStyle);

      graphicsMap.set(conn.id, g);
      viewport.addChild(g);
    });

    return () => {
      graphicsMap.forEach((g) => {
        viewport.removeChild(g);
        g.destroy();
      });
      graphicsMap.clear();
    };
  }, [viewport, connections]);

  // Manage nodes
  useEffect(() => {
    if (!viewport) return;

    const nodeMap = new Map<string, PixiContainer>();
    const allItems: Array<{ id: string; type: 'tome' | 'chapter' | 'scene'; title: string; pos?: NodePosition }> = [
      ...tomes.map(t => ({ ...t, type: 'tome' as const })),
      ...chapters.map(c => ({ ...c, type: 'chapter' as const })),
      ...scenes.map(s => ({ ...s, type: 'scene' as const })),
    ];

    allItems.forEach((item) => {
      const pos = positions.get(item.id);
      if (!pos) return;

      const container = new PixiContainer();
      container.x = pos.x;
      container.y = pos.y;
      container.eventMode = 'static';
      container.cursor = 'pointer';

      // Determine visual properties
      const isSelected =
        (item.type === 'tome' && selectedTomeId === item.id) ||
        (item.type === 'chapter' && selectedChapterId === item.id) ||
        (item.type === 'scene' && selectedSceneId === item.id);
      const isActive = item.type === 'scene' && currentSceneId === item.id;

      // Draw node graphics
      const radius = getNodeSize(item.type) / 2;
      const color = getNodeColor(item.type, isActive);

      const g = new PixiGraphics();

      // Shadow
      g.fill({ color: 0x000000, alpha: 0.2 });
      g.circle(2, 2, radius);
      g.fill();

      // Main shape
      g.fill({ color, alpha: 1 });
      if (item.type === 'tome') {
        drawOctagon(g, 0, 0, radius);
      } else if (item.type === 'chapter') {
        g.roundRect(-radius, -radius, radius * 2, radius * 2, 6);
      } else {
        g.circle(0, 0, radius);
      }
      g.fill();

      // Selection border
      if (isSelected) {
        g.stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
        if (item.type === 'tome') {
          drawOctagon(g, 0, 0, radius + 6);
        } else if (item.type === 'chapter') {
          g.roundRect(-radius - 6, -radius - 6, (radius + 6) * 2, (radius + 6) * 2, 8);
        } else {
          g.circle(0, 0, radius + 6);
        }
        g.stroke();
      }

      container.addChild(g);

      // Label (initially hidden, shown on hover)
      const text = new PixiText({
        text: item.title,
        style: {
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 12,
          fill: 0xffffff,
        },
        x: 0,
        y: -radius - 16,
      });
      text.anchor.set(0.5);
      text.visible = false;
      container.addChild(text);

      // Interactive handlers
      const handlePointerEnter = () => {
        // Scale up
        container.scale.set(1.15);
        text.visible = true;
      };

      const handlePointerLeave = () => {
        container.scale.set(1);
        text.visible = isSelected;
      };

      const handlePointerDown = () => {
        onSelectNode(item.type, item.id);
      };

      container.on('pointerenter', handlePointerEnter);
      container.on('pointerleave', handlePointerLeave);
      container.on('pointerdown', handlePointerDown);

      nodeMap.set(item.id, container);
      viewport.addChild(container);
    });

    return () => {
      nodeMap.forEach((c) => {
        viewport.removeChild(c);
        c.destroy();
      });
      nodeMap.clear();
    };
  }, [viewport, tomes, chapters, scenes, positions, selectedTomeId, selectedChapterId, selectedSceneId, currentSceneId, onSelectNode]);

  return null;
}

function getNodeSize(type: 'tome' | 'chapter' | 'scene'): number {
  switch (type) {
    case 'tome': return 48;
    case 'chapter': return 32;
    case 'scene': return 16;
  }
}

function getNodeColor(type: 'tome' | 'chapter' | 'scene', isActive: boolean): number {
  if (isActive && type === 'scene') {
    return colorToHex('#f59e0b'); // Scene active
  }
  switch (type) {
    case 'tome': return colorToHex('#4f46e5');
    case 'chapter': return colorToHex('#6366f1');
    case 'scene': return colorToHex('#94a3b8');
  }
}

function colorToHex(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

function drawOctagon(g: PixiGraphics, cx: number, cy: number, radius: number) {
  const sides = 8;
  const startAngle = Math.PI / 8;

  const points: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / sides;
    points.push(cx + Math.cos(angle) * radius);
    points.push(cy + Math.sin(angle) * radius);
  }

  g.poly(points);
}
