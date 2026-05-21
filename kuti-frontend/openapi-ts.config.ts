import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  // Utiliser le fichier OpenAPI JSON local (généré depuis le backend)
  input: "./openapi.json",
  output: {
    path: "app/lib/backend",
    clean: true,
  },
  plugins: [
    "zod",
    "@hey-api/typescript",
    "@hey-api/client-fetch",
    "@hey-api/sdk",
    "@tanstack/react-query",
    "@hey-api/schemas",
  ],
});
