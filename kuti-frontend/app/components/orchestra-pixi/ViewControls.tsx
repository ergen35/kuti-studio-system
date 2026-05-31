import { useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Focus } from 'lucide-react';
import { Button } from '~/components/ui';
import { useTranslation } from '~/hooks/useTranslation';
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
  const { t } = useTranslation('story');
  const {
    zoomViewport,
    resetViewport,
    focusNode,
    fitToBounds,
    nodePositions,
    viewport,
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
          x: bounds.min.x - 150, // Increased padding for card sizes
          y: bounds.min.y - 120,
          width: bounds.size.x + 300,
          height: bounds.size.y + 240,
        },
        canvasWidth,
        canvasHeight
      );
    }
  }, [fitToBounds, nodePositions, canvasWidth, canvasHeight]);

  // Calculate zoom percentage for display
  const zoomPercent = Math.round(viewport.zoom * 100);

  return (
    <div className="absolute bottom-4 left-4 pointer-events-auto">
      {/* Main controls panel - Blender-like compact style */}
      <div 
        className="flex flex-col gap-1 rounded-md p-1.5 shadow-lg"
        style={{
          backgroundColor: 'rgba(35, 38, 43, 0.94)',
          border: '1px solid #3a3e45',
        }}
      >
        {/* Zoom percentage display */}
        <div 
          className="flex items-center justify-center py-1 px-2 text-[11px] font-medium tracking-wide"
          style={{ color: '#9aa1aa' }}
        >
          {zoomPercent}%
        </div>

        {/* Divider */}
        <div 
          className="h-px my-0.5"
          style={{ backgroundColor: '#3a3e45' }}
        />

        {/* Zoom controls */}
        <div className="flex flex-col gap-0.5">
          <ControlButton
            onClick={handleZoomIn}
            title="Zoom in (+)"
            icon={<ZoomIn size={16} />}
          />
          <ControlButton
            onClick={handleZoomOut}
            title="Zoom out (-)"
            icon={<ZoomOut size={16} />}
          />
        </div>

        {/* Divider */}
        <div 
          className="h-px my-0.5"
          style={{ backgroundColor: '#3a3e45' }}
        />

        {/* Navigation controls */}
        <div className="flex flex-col gap-0.5">
          <ControlButton
            onClick={handleFocus}
            disabled={!selectedNodeId}
            title={selectedNodeId ? "Focus selected node (F)" : "Select a node first"}
            icon={<Focus size={16} />}
            accent={!!selectedNodeId}
          />
          <ControlButton
            onClick={handleFit}
            title="Fit all nodes (Home)"
            icon={<Maximize size={16} />}
          />
        </div>

        {/* Divider */}
        <div 
          className="h-px my-0.5"
          style={{ backgroundColor: '#3a3e45' }}
        />

        {/* Reset */}
        <ControlButton
          onClick={handleReset}
          title={t('orchestra.resetView')}
          icon={<RotateCcw size={16} />}
        />
      </div>
    </div>
  );
}

/**
 * Individual control button with Blender-like styling
 */
interface ControlButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  accent?: boolean;
}

function ControlButton({ onClick, icon, title, disabled, accent }: ControlButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
      variant="ghost"
      className={`
        flex items-center justify-center w-7 h-7 rounded transition-colors
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#343941]'}
      `}
      style={{
        color: accent ? '#f6a63a' : '#b5bbc5',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = '#343941';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {icon}
    </Button>
  );
}
