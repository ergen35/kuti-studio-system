/**
 * Configuration du client API généré
 * Wrapper pour configurer l'URL de base et les intercepteurs
 */

import { client } from "~/lib/backend/client.gen";

const API_BASE_URL = ((import.meta.env.VITE_KUTI_API_URL as string | undefined) || "http://127.0.0.1:8000").replace(/\/$/, "");

// Configuration du client
client.setConfig({
  baseUrl: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour la gestion des erreurs
client.interceptors.response.use(async (response) => {
  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    throw new ApiError(response.status, errorData);
  }
  return response;
});

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown
  ) {
    super(`API Error ${status}`);
    this.name = "ApiError";
  }
}

export { client };
