import type { NextRequest } from "next/server";
import { env } from "./env";

/**
 * Validates the Origin header on mutating requests to prevent CSRF attacks.
 *
 * Returns true when the request is allowed, false when it should be rejected.
 *
 * Same-origin requests from the browser omit the Origin header on same-origin
 * navigations but always include it on cross-origin fetch/XHR. Clerk's
 * SameSite=Lax cookie already blocks most CSRF; this is an additional layer.
 */
export function isCsrfSafe(request: NextRequest): boolean {
  // Skip CSRF check in development — Origin header varies with port/proxy setups
  if (process.env.NODE_ENV === "development") return true;

  const origin = request.headers.get("origin");

  // No Origin header — allow (same-origin navigation or server-to-server)
  if (!origin) return true;

  try {
    const requestHost = new URL(origin).host;
    const appHost = new URL(env.NEXT_PUBLIC_APP_URL).host;
    return requestHost === appHost;
  } catch {
    // Malformed origin header — block
    return false;
  }
}
