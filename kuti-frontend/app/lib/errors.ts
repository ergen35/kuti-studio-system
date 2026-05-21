/**
 * Error handling utilities
 * Extracted from legacy api.ts for SDK compatibility
 */

export const API_BASE_URL = ((import.meta.env.VITE_KUTI_API_URL as string | undefined) || "http://127.0.0.1:8000").replace(/\/$/, "");

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
