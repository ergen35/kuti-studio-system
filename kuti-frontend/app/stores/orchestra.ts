import { create } from "zustand";
import { persist } from "zustand/middleware";
import gsap from "gsap";

interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface OrchestraState {
  // Mode activation (persisté)
  isActive: boolean;
  toggle: () => void;
  setActive: (value: boolean) => void;

  // Navigation tree (expanded state)
  expandedTomeIds: Set<string>;
  expandedChapterIds: Set<string>;
  toggleTome: (id: string) => void;
  toggleChapter: (id: string) => void;
  expandTome: (id: string) => void;
  expandChapter: (id: string) => void;

  // Sélection
  selectedSceneId: string | null;
  selectedChapterId: string | null;
  selectedTomeId: string | null;
  selectScene: (id: string | null) => void;
  selectChapter: (id: string | null) => void;
  selectTome: (id: string | null) => void;
  selectNode: (type: 'tome' | 'chapter' | 'scene', id: string | null) => void;

  // Viewport 2D (remplace caméra 3D)
  viewport: ViewportState;
  setViewport: (viewport: ViewportState) => void;
  panViewport: (deltaX: number, deltaY: number) => void;
  zoomViewport: (factor: number, centerX?: number, centerY?: number) => void;
  resetViewport: () => void;

  // Focus node avec GSAP animation
  focusNode: (
    nodeId: string,
    getNodePosition: (id: string) => { x: number; y: number } | undefined,
    canvasWidth: number,
    canvasHeight: number
  ) => void;

  // Fit to bounds
  fitToBounds: (
    bounds: { x: number; y: number; width: number; height: number },
    canvasWidth: number,
    canvasHeight: number
  ) => void;

  // Layout nodes positions
  nodePositions: Map<string, { x: number; y: number }>;
  setNodePositions: (positions: Map<string, { x: number; y: number }>) => void;
  getNodePosition: (id: string) => { x: number; y: number } | undefined;

  // GSAP tweens tracking (pour cleanup)
  viewportTween: gsap.core.Tween | null;
}

export const useOrchestraStore = create<OrchestraState>()(
  persist(
    (set, get) => ({
      // Mode activation
      isActive: false,
      toggle: () => set((state) => ({ isActive: !state.isActive })),
      setActive: (value: boolean) => set({ isActive: value }),

      // Navigation tree expansion
      expandedTomeIds: new Set(),
      expandedChapterIds: new Set(),
      toggleTome: (id: string) => set((state) => {
        const next = new Set(state.expandedTomeIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { expandedTomeIds: next };
      }),
      toggleChapter: (id: string) => set((state) => {
        const next = new Set(state.expandedChapterIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return { expandedChapterIds: next };
      }),
      expandTome: (id: string) => set((state) => ({
        expandedTomeIds: new Set([...state.expandedTomeIds, id]),
      })),
      expandChapter: (id: string) => set((state) => ({
        expandedChapterIds: new Set([...state.expandedChapterIds, id]),
      })),

      // Selection
      selectedSceneId: null,
      selectedChapterId: null,
      selectedTomeId: null,
      selectScene: (id: string | null) => set({
        selectedSceneId: id,
        selectedChapterId: null,
        selectedTomeId: null,
      }),
      selectChapter: (id: string | null) => set({
        selectedSceneId: null,
        selectedChapterId: id,
        selectedTomeId: null,
      }),
      selectTome: (id: string | null) => set({
        selectedSceneId: null,
        selectedChapterId: null,
        selectedTomeId: id,
      }),
      selectNode: (type: 'tome' | 'chapter' | 'scene', id: string | null) => {
        const state = get();
        if (type === 'scene') {
          state.selectScene(id);
        } else if (type === 'chapter') {
          state.selectChapter(id);
        } else {
          state.selectTome(id);
        }
      },

      // Viewport 2D
      viewport: { x: 0, y: 0, zoom: 1 },
      setViewport: (viewport) => set({ viewport }),
      panViewport: (deltaX, deltaY) => set((state) => ({
        viewport: {
          ...state.viewport,
          x: state.viewport.x + deltaX,
          y: state.viewport.y + deltaY,
        },
      })),
      zoomViewport: (factor, centerX, centerY) => set((state) => {
        const newZoom = Math.max(0.2, Math.min(3, state.viewport.zoom * factor));

        // Zoom towards center point if provided
        if (centerX !== undefined && centerY !== undefined) {
          const zoomRatio = newZoom / state.viewport.zoom;
          const newX = centerX - (centerX - state.viewport.x) * zoomRatio;
          const newY = centerY - (centerY - state.viewport.y) * zoomRatio;
          return { viewport: { x: newX, y: newY, zoom: newZoom } };
        }

        return { viewport: { ...state.viewport, zoom: newZoom } };
      }),
      resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),

      // Focus node with GSAP animation
      focusNode: (
        nodeId: string,
        getNodePosition: (id: string) => { x: number; y: number } | undefined,
        canvasWidth: number,
        canvasHeight: number
      ) => {
        const nodePosition = getNodePosition(nodeId);
        if (!nodePosition) return;

        // Kill any existing tween
        const { viewportTween } = get();
        if (viewportTween) {
          viewportTween.kill();
        }

        const targetZoom = 1.5;
        const targetX = canvasWidth / 2 - nodePosition.x * targetZoom;
        const targetY = canvasHeight / 2 - nodePosition.y * targetZoom;

        const currentViewport = { ...get().viewport };

        const tween = gsap.to(currentViewport, {
          x: targetX,
          y: targetY,
          zoom: targetZoom,
          duration: 0.8,
          ease: "power3.out",
          onUpdate: () => {
            set({
              viewport: {
                x: currentViewport.x,
                y: currentViewport.y,
                zoom: currentViewport.zoom,
              },
            });
          },
          onComplete: () => {
            set({ viewportTween: null });
          },
        });

        set({ viewportTween: tween });
      },

      // Fit to bounds
      fitToBounds: (
        bounds: { x: number; y: number; width: number; height: number },
        canvasWidth: number,
        canvasHeight: number
      ) => {
        // Kill any existing tween
        const { viewportTween } = get();
        if (viewportTween) {
          viewportTween.kill();
        }

        const padding = 80;
        const availableWidth = canvasWidth - padding * 2;
        const availableHeight = canvasHeight - padding * 2;

        const zoomX = availableWidth / bounds.width;
        const zoomY = availableHeight / bounds.height;
        const targetZoom = Math.min(zoomX, zoomY, 1.5);

        const targetX = canvasWidth / 2 - (bounds.x + bounds.width / 2) * targetZoom;
        const targetY = canvasHeight / 2 - (bounds.y + bounds.height / 2) * targetZoom;

        const currentViewport = { ...get().viewport };

        const tween = gsap.to(currentViewport, {
          x: targetX,
          y: targetY,
          zoom: targetZoom,
          duration: 0.6,
          ease: "power2.out",
          onUpdate: () => {
            set({
              viewport: {
                x: currentViewport.x,
                y: currentViewport.y,
                zoom: currentViewport.zoom,
              },
            });
          },
          onComplete: () => {
            set({ viewportTween: null });
          },
        });

        set({ viewportTween: tween });
      },

      // Node positions
      nodePositions: new Map(),
      setNodePositions: (positions) => set({ nodePositions: positions }),
      getNodePosition: (id: string) => get().nodePositions.get(id),

      // GSAP tween tracking
      viewportTween: null,
    }  ),
    {
      name: "kuti-orchestra",
      partialize: (state) => ({
        isActive: state.isActive,
        expandedTomeIds: Array.from(state.expandedTomeIds),
        expandedChapterIds: Array.from(state.expandedChapterIds),
      }),
      onRehydrateStorage: () => (state) => {
        // Restore Sets from Arrays during rehydration
        if (state) {
          state.expandedTomeIds = new Set(state.expandedTomeIds);
          state.expandedChapterIds = new Set(state.expandedChapterIds);
        }
      },
    }
  )
);
