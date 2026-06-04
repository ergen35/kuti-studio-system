/**
 * Shared CORS helpers.
 *
 * The browser frontend runs on local development origins that must be
 * explicitly echoed back by the backend CORS layer.
 */

import { config } from "./config";

function normalizeOriginValue(origin: string): string | null {
  try {
    const url = new URL(origin);
    const hostname = url.hostname === "127.0.0.1" || url.hostname === "::1"
      ? "localhost"
      : url.hostname;

    return `${url.protocol}//${hostname}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return null;
  }
}

export function isTrustedOrigin(origin: string | null | undefined): boolean {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOriginValue(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return config.trustedOrigins.some((trustedOrigin) => normalizeOriginValue(trustedOrigin) === normalizedOrigin);
}
