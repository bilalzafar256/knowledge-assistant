export const dynamic = "force-dynamic";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { type Metadata } from "next";
import { db } from "@/lib/db";
import { ragSettings, auditLogs } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { SettingsTabs } from "@/components/settings-tabs";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress ?? "—";

  const allEmails = user.emailAddresses.map((e) => ({
    id: e.id,
    emailAddress: e.emailAddress,
    isPrimary: e.id === user.primaryEmailAddressId,
  }));

  // Load RAG settings (or use defaults)
  const [ragRow] = await db
    .select({ chunkSize: ragSettings.chunkSize, chunkOverlap: ragSettings.chunkOverlap })
    .from(ragSettings)
    .where(eq(ragSettings.userId, userId));

  const currentChunkSize = ragRow?.chunkSize ?? 500;
  const currentChunkOverlap = ragRow?.chunkOverlap ?? 50;

  // Load recent audit logs (last 50 entries)
  const recentAuditLogs = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  const createdAt = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage your profile and account preferences</p>
      </div>

      <SettingsTabs
        fullName={user.fullName}
        username={user.username}
        userId={userId}
        primaryEmail={primaryEmail}
        allEmails={allEmails}
        createdAt={createdAt}
        initialChunkSize={currentChunkSize}
        initialChunkOverlap={currentChunkOverlap}
        auditLogs={recentAuditLogs}
      />
    </div>
  );
}
