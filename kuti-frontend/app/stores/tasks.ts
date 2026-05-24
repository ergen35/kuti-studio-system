import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TaskStatus = 'pending' | 'running' | 'ready' | 'validated' | 'failed';

export type SourceKind = 'tome' | 'chapter' | 'scene' | 'panel' | 'custom' | 'character';

interface TasksState {
  // SideSheet state
  isSideSheetOpen: boolean;
  openSideSheet: () => void;
  closeSideSheet: () => void;
  toggleSideSheet: () => void;

  // Selected task for detail view
  selectedTaskId: string | null;
  setSelectedTask: (taskId: string | null) => void;

  // Filtres globaux (partagés entre side-sheet et page)
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Filtres par statut (multi-select)
  selectedStatuses: TaskStatus[];
  toggleStatus: (status: TaskStatus) => void;
  selectAllStatuses: () => void;
  clearStatuses: () => void;

  // Filtres par sourceKind
  selectedSourceKinds: SourceKind[];
  toggleSourceKind: (kind: SourceKind) => void;
  selectAllSourceKinds: () => void;
  clearSourceKinds: () => void;

  // Expanding rows (pour la vue hiérarchique)
  expandedTaskIds: Set<string>;
  toggleExpanded: (taskId: string) => void;
  expandAll: (taskIds: string[]) => void;
  collapseAll: () => void;
}

const ALL_STATUSES: TaskStatus[] = ['pending', 'running', 'ready', 'validated', 'failed'];
const ALL_SOURCE_KINDS: SourceKind[] = ['tome', 'chapter', 'scene', 'panel', 'custom', 'character'];

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      // SideSheet state
      isSideSheetOpen: false,
      openSideSheet: () => set({ isSideSheetOpen: true }),
      closeSideSheet: () => set({ isSideSheetOpen: false }),
      toggleSideSheet: () => set((state) => ({ isSideSheetOpen: !state.isSideSheetOpen })),

      // Selected task
      selectedTaskId: null,
      setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),

      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Status filters
      selectedStatuses: ALL_STATUSES,
      toggleStatus: (status) => set((state) => {
        const exists = state.selectedStatuses.includes(status);
        if (exists) {
          const filtered = state.selectedStatuses.filter((s) => s !== status);
          return { selectedStatuses: filtered.length > 0 ? filtered : [status] };
        } else {
          return { selectedStatuses: [...state.selectedStatuses, status] };
        }
      }),
      selectAllStatuses: () => set({ selectedStatuses: ALL_STATUSES }),
      clearStatuses: () => set({ selectedStatuses: [] }),

      // SourceKind filters
      selectedSourceKinds: ALL_SOURCE_KINDS,
      toggleSourceKind: (kind) => set((state) => {
        const exists = state.selectedSourceKinds.includes(kind);
        if (exists) {
          const filtered = state.selectedSourceKinds.filter((k) => k !== kind);
          return { selectedSourceKinds: filtered.length > 0 ? filtered : [kind] };
        } else {
          return { selectedSourceKinds: [...state.selectedSourceKinds, kind] };
        }
      }),
      selectAllSourceKinds: () => set({ selectedSourceKinds: ALL_SOURCE_KINDS }),
      clearSourceKinds: () => set({ selectedSourceKinds: [] }),

      // Expanded rows
      expandedTaskIds: new Set(),
      toggleExpanded: (taskId) => set((state) => {
        const newSet = new Set(state.expandedTaskIds);
        if (newSet.has(taskId)) {
          newSet.delete(taskId);
        } else {
          newSet.add(taskId);
        }
        return { expandedTaskIds: newSet };
      }),
      expandAll: (taskIds) => set({ expandedTaskIds: new Set(taskIds) }),
      collapseAll: () => set({ expandedTaskIds: new Set() }),
    }),
    {
      name: "kuti-tasks",
      partialize: (state) => ({
        selectedStatuses: state.selectedStatuses,
        selectedSourceKinds: state.selectedSourceKinds,
      }),
    },
  ),
);
