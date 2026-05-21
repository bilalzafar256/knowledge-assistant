import { logger } from "@/lib/axiom/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/schema";
import type { NextRequest } from "next/server";

interface AuditParams {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  request?: NextRequest;
}

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 * Call with `void logAudit(...)` to avoid blocking the response.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  const { userId, action, resourceType, resourceId, metadata = {}, request } = params;
  try {
    const ipAddress =
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request?.headers.get("x-real-ip") ??
      undefined;

    const userAgent = request?.headers.get("user-agent") ?? undefined;

    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType,
      resourceId,
      metadata,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // Audit logging must never break the main request, but the failure
    // itself is important — surface it to Axiom so we can detect a broken
    // compliance trail without scraping the DB.
    logger.error("audit.write_failed", {
      userId,
      action,
      resourceType,
      resourceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
