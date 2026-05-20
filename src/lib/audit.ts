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
  try {
    const { userId, action, resourceType, resourceId, metadata = {}, request } = params;

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
  } catch {
    // Audit logging must never break the main request
  }
}
