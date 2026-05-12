import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function reactStatelySubpathResolver() {
  return {
    name: "react-stately-subpath-resolver",
    resolveId(source: string) {
      if (!source.startsWith("react-stately/")) {
        return null;
      }

      const subpath = source.slice("react-stately/".length);
      return resolve("node_modules/react-stately/dist/exports", `${subpath}.js`);
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), reactRouter(), reactStatelySubpathResolver()],
  ssr: {
    noExternal: [
      "@adobe/react-spectrum",
      "react-aria",
      "react-aria-components",
      "react-stately",
      "@spectrum-icons/ui",
      "@spectrum-icons/workflow",
    ],
  },
});
