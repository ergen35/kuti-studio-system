import { useRef, useState, useEffect, useCallback } from 'react';
import type { Tome, Chapter, Scene } from '~/lib/orchestra/types';
import { calculateNodePositions, getLayoutBounds } from '~/lib/orchestra/layout-engine';
import { useOrchestraStore } from '~/stores/orchestra';
import { PixiCanvas } from './PixiCanvas';
import { ViewControls } from './ViewControls';

interface PixiOrchestraProps {
  tomes: Tome[];
  chapters: Chapter[];
  scenes: Scene[];
  currentSceneId?: string;
  onNavigateToScene?: (sceneId: string, chapterId: string, tomeId: string) => void;
}

export function PixiOrchestra({
  tomes,
  chapters,
  scenes,
  currentSceneId,
  onNavigateToScene,
}: PixiOrchestraProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const {
    selectedTomeId,
    selectedChapterId,
    selectedSceneId,
    selectTome,
    selectChapter,
    selectScene,
    expandTome,
    expandChapter,
    nodePositions,
    setNodePositions,
    getNodePosition,
    fitToBounds,
  } = useOrchestraStore();

  // Calculate positions when data changes
  useEffect(() => {
    const positions = calculateNodePositions(tomes, chapters, scenes);
    setNodePositions(positions);
  }, [tomes, chapters, scenes, setNodePositions]);

  // Handle resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setSize({
          width: clientWidth,
          height: clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, []);

  // Initial fit to bounds when positions are loaded
  useEffect(() => {
    if (nodePositions.size > 0 && size.width > 0 && size.height > 0) {
      const bounds = getLayoutBounds(nodePositions);
      if (bounds) {
        fitToBounds(
          {
            x: bounds.min.x - 100,
            y: bounds.min.y - 100,
            width: bounds.size.x + 200,
            height: bounds.size.y + 200,
          },
          size.width,
          size.height
        );
      }
    }
    // Only run once on initial load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, nodePositions.size]);

  // Build lookup maps for parent relationships
  const chapterToTome = useCallback((chapterId: string) => {
    const chapter = chapters.find(c => c.id === chapterId);
    return chapter?.tomeId;
  }, [chapters]);

  const sceneToChapter = useCallback((sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    return scene?.chapterId;
  }, [scenes]);

  const sceneToTome = useCallback((sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return undefined;
    const chapter = chapters.find(c => c.id === scene.chapterId);
    return chapter?.tomeId;
  }, [scenes, chapters]);

  const handleSelectNode = useCallback(
    (type: 'tome' | 'chapter' | 'scene', id: string) => {
      if (type === 'tome') {
        // Select and expand tome
        selectTome(id);
        expandTome(id);
      } else if (type === 'chapter') {
        // Select and expand chapter
        selectChapter(id);
        expandChapter(id);
        // Also expand parent tome
        const tomeId = chapterToTome(id);
        if (tomeId) {
          expandTome(tomeId);
        }
      } else if (type === 'scene') {
        // Navigate to the scene
        const chapterId = sceneToChapter(id);
        const tomeId = sceneToTome(id);
        if (chapterId && tomeId && onNavigateToScene) {
          onNavigateToScene(id, chapterId, tomeId);
        }
        // Also select in store and expand parents for visual feedback
        selectScene(id);
        if (chapterId) {
          expandChapter(chapterId);
          const tomeIdFromCh = chapterToTome(chapterId);
          if (tomeIdFromCh) {
            expandTome(tomeIdFromCh);
          }
        }
      }
    },
    [selectTome, selectChapter, selectScene, expandTome, expandChapter, chapterToTome, sceneToChapter, sceneToTome, onNavigateToScene]
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-slate-900"
    >
      {size.width > 0 && size.height > 0 && (
        <PixiCanvas
          tomes={tomes}
          chapters={chapters}
          scenes={scenes}
          positions={nodePositions}
          currentSceneId={currentSceneId}
          selectedTomeId={selectedTomeId}
          selectedChapterId={selectedChapterId}
          selectedSceneId={selectedSceneId}
          width={size.width}
          height={size.height}
          onSelectNode={handleSelectNode}
        />
      )}

      <ViewControls
        canvasWidth={size.width}
        canvasHeight={size.height}
        getNodePosition={getNodePosition}
        selectedNodeId={selectedSceneId || selectedChapterId || selectedTomeId}
      />
    </div>
  );
}
