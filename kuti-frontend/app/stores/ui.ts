import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark";
type Density = "comfortable" | "compact";

type UiState = {
  theme: Theme;
  density: Density;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setDensity: (density: Density) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "light",
      density: "comfortable",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      setDensity: (density) => set({ density }),
    }),
    { name: "kuti-ui" },
  ),
);
