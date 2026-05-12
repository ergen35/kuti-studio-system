import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "light" | "dark";
export type DensityMode = "comfortable" | "compact";

interface UiState {
  theme: ThemeMode;
  density: DensityMode;
  commandPaletteOpen: boolean;
  mobileNavOpen: boolean;
  inspectorPinned: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setDensity: (density: DensityMode) => void;
  toggleDensity: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleInspectorPinned: () => void;
}

export const useUiStore = create<UiState>()(
    persist(
      (set) => ({
      theme: "light",
      density: "comfortable",
      commandPaletteOpen: false,
      mobileNavOpen: false,
      inspectorPinned: true,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setDensity: (density) => set({ density }),
      toggleDensity: () => set((state) => ({ density: state.density === "comfortable" ? "compact" : "comfortable" })),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      openMobileNav: () => set({ mobileNavOpen: true }),
      closeMobileNav: () => set({ mobileNavOpen: false }),
      toggleInspectorPinned: () => set((state) => ({ inspectorPinned: !state.inspectorPinned })),
      }),
      {
        name: "kuti-ui",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          theme: state.theme,
          density: state.density,
          inspectorPinned: state.inspectorPinned,
          commandPaletteOpen: state.commandPaletteOpen,
          mobileNavOpen: state.mobileNavOpen,
        }),
      },
    ),
  );
