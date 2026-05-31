/**
 * Error handling utilities
 * Extracted from legacy api.ts for SDK compatibility
 */

export const API_BASE_URL = ((import.meta.env.VITE_KUTI_API_URL as string | undefined) || "http://127.0.0.1:8000").replace(/\/$/, "");

export function backendUrl(pathOrUrl: unknown): string {
  if (typeof pathOrUrl !== "string" || !pathOrUrl.trim()) return "";
  const value = pathOrUrl.trim();
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) return value;
  if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

/**
 * Extract error message from SDK or standard errors
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // SDK errors may have response data
    const sdkError = error as { response?: { data?: { detail?: string } } };
    if (sdkError.response?.data?.detail) {
      return sdkError.response.data.detail;
    }
    return error.message;
  }
  return "Unexpected error";
}
