import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  // Utiliser le fichier OpenAPI JSON local (généré depuis le backend)
  input: "http://localhost:8000/openapi/api-doc.json",
  output: {
    path: "app/lib/backend",
    clean: true,
  },
  logs: {
    file: true,
    path: "./openapi-ts-logs"
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
