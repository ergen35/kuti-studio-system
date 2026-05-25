import { useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Focus } from 'lucide-react';
import { useOrchestraStore } from '~/stores/orchestra';
import { getLayoutBounds } from '~/lib/orchestra/layout-engine';

interface ViewControlsProps {
  canvasWidth: number;
  canvasHeight: number;
  getNodePosition: (id: string) => { x: number; y: number } | undefined;
  selectedNodeId: string | null;
}

export function ViewControls({
  canvasWidth,
  canvasHeight,
  getNodePosition,
  selectedNodeId,
}: ViewControlsProps) {
  const {
    zoomViewport,
    resetViewport,
    focusNode,
    fitToBounds,
    nodePositions,
  } = useOrchestraStore();

  const handleZoomIn = useCallback(() => {
    zoomViewport(1.2, canvasWidth / 2, canvasHeight / 2);
  }, [zoomViewport, canvasWidth, canvasHeight]);

  const handleZoomOut = useCallback(() => {
    zoomViewport(0.8, canvasWidth / 2, canvasHeight / 2);
  }, [zoomViewport, canvasWidth, canvasHeight]);

  const handleReset = useCallback(() => {
    resetViewport();
  }, [resetViewport]);

  const handleFocus = useCallback(() => {
    if (selectedNodeId) {
      focusNode(selectedNodeId, getNodePosition, canvasWidth, canvasHeight);
    }
  }, [selectedNodeId, getNodePosition, canvasWidth, canvasHeight, focusNode]);

  const handleFit = useCallback(() => {
    const bounds = getLayoutBounds(nodePositions);
    if (bounds) {
      fitToBounds(
        {
          x: bounds.min.x - 100,
          y: bounds.min.y - 100,
          width: bounds.size.x + 200,
          height: bounds.size.y + 200,
        },
        canvasWidth,
        canvasHeight
      );
    }
  }, [fitToBounds, nodePositions, canvasWidth, canvasHeight]);

  return (
    <div className="absolute bottom-4 left-4 flex flex-col gap-2 pointer-events-auto">
      <div className="flex flex-col gap-1.5 bg-slate-800/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border border-slate-700">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-md transition-colors"
          title="Zoom in"
          type="button"
        >
          <ZoomIn size={18} className="text-slate-200" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-md transition-colors"
          title="Zoom out"
          type="button"
        >
          <ZoomOut size={18} className="text-slate-200" />
        </button>
        <div className="h-px bg-slate-600 my-1" />
        <button
          onClick={handleFocus}
          disabled={!selectedNodeId}
          className="p-2 bg-slate-700/50 hover:bg-slate-600/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors"
          title={selectedNodeId ? "Focus on selected node" : "Select a node first"}
          type="button"
        >
          <Focus size={18} className="text-indigo-400" />
        </button>
        <button
          onClick={handleFit}
          className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-md transition-colors"
          title="Fit all nodes"
          type="button"
        >
          <Maximize size={18} className="text-slate-200" />
        </button>
        <div className="h-px bg-slate-600 my-1" />
        <button
          onClick={handleReset}
          className="p-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-md transition-colors"
          title="Reset view"
          type="button"
        >
          <RotateCcw size={18} className="text-slate-200" />
        </button>
      </div>
    </div>
  );
}
