"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserButton } from "@clerk/nextjs";
import { User, Mail, Calendar, Shield, Key, Settings2, Activity, FileText, MessageSquare, Trash2 } from "lucide-react";
import { RagSettingsForm } from "@/components/rag-settings-form";
import { timeAgo } from "@/lib/utils";

interface AuditLogEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
}

interface SettingsTabsProps {
  fullName: string | null;
  username: string | null;
  userId: string;
  primaryEmail: string;
  allEmails: { id: string; emailAddress: string; isPrimary: boolean }[];
  createdAt: string;
  initialChunkSize: number;
  initialChunkOverlap: number;
  auditLogs: AuditLogEntry[];
}

export function SettingsTabs({
  fullName,
  username,
  userId,
  primaryEmail,
  allEmails,
  createdAt,
  initialChunkSize,
  initialChunkOverlap,
  auditLogs,
}: SettingsTabsProps) {
  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="mb-6 h-10 bg-muted/60 border border-border/60 flex-wrap">
        <TabsTrigger value="profile" className="gap-2 text-sm">
          <User className="h-3.5 w-3.5" />
          Profile
        </TabsTrigger>
        <TabsTrigger value="knowledge" className="gap-2 text-sm">
          <Settings2 className="h-3.5 w-3.5" />
          Knowledge Base
        </TabsTrigger>
        <TabsTrigger value="security" className="gap-2 text-sm">
          <Shield className="h-3.5 w-3.5" />
          Security
        </TabsTrigger>
        <TabsTrigger value="activity" className="gap-2 text-sm">
          <Activity className="h-3.5 w-3.5" />
          Activity
        </TabsTrigger>
      </TabsList>

      {/* ── Profile Tab ─────────────────────────────────────────────── */}
      <TabsContent value="profile" className="space-y-4 mt-0">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 dark:bg-emerald-900/30">
                <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Profile
            </CardTitle>
            <CardDescription>Your personal information from Clerk</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <UserButton
                appearance={{ elements: { avatarBox: "h-16 w-16 rounded-xl" } }}
              />
              <div>
                <p className="font-semibold text-foreground text-lg">
                  {fullName ?? username ?? "—"}
                </p>
                {username && fullName && (
                  <p className="text-sm text-muted-foreground">@{username}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Mail} label="Email" value={primaryEmail} accent="teal" />
              <InfoRow
                icon={Key}
                label="User ID"
                value={userId.slice(0, 20) + "…"}
                accent="emerald"
              />
              <InfoRow icon={Calendar} label="Member since" value={createdAt} accent="emerald" />
              <InfoRow
                icon={Shield}
                label="Account status"
                value={
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                    Active
                  </Badge>
                }
                accent="emerald"
              />
            </div>
          </CardContent>
        </Card>

        {/* Email addresses */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/15 dark:bg-teal-900/30">
                <Mail className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              </div>
              Email Addresses
            </CardTitle>
            <CardDescription>Email addresses linked to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allEmails.map((email) => (
                <div
                  key={email.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
                >
                  <span className="text-sm text-foreground">{email.emailAddress}</span>
                  {email.isPrimary && (
                    <Badge variant="secondary" className="text-xs">Primary</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Knowledge Base Tab ──────────────────────────────────────── */}
      <TabsContent value="knowledge" className="mt-0">
        <RagSettingsForm
          initialChunkSize={initialChunkSize}
          initialChunkOverlap={initialChunkOverlap}
        />
      </TabsContent>

      {/* ── Security Tab ────────────────────────────────────────────── */}
      <TabsContent value="security" className="mt-0">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              Security
            </CardTitle>
            <CardDescription>Authentication and security settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manage your password, two-factor authentication, and active sessions via the profile button in the sidebar.
            </p>
            <div className="rounded-xl bg-muted/50 border border-border/60 p-4 flex items-center gap-3">
              <UserButton
                appearance={{ elements: { avatarBox: "h-10 w-10 rounded-lg" } }}
              />
              <div>
                <p className="text-sm font-medium text-foreground">Open account settings</p>
                <p className="text-xs text-muted-foreground">Click your avatar to manage security options</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Activity Tab ────────────────────────────────────────────── */}
      <TabsContent value="activity" className="mt-0">
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 dark:bg-emerald-900/30">
                  <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                Activity Log
              </CardTitle>
              <Badge variant="secondary" className="text-xs tabular-nums">
                {auditLogs.length} {auditLogs.length === 1 ? "entry" : "entries"}
              </Badge>
            </div>
            <CardDescription>Your 50 most recent actions in this workspace</CardDescription>
          </CardHeader>

          {auditLogs.length === 0 ? (
            <CardContent className="py-12 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Upload a document or start a chat to see your history here.</p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/40">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-36">Action</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Resource</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-32 hidden sm:table-cell">Time</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 w-32 hidden lg:table-cell">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {auditLogs.map((log, i) => (
                    <AuditLogRow key={log.id} log={log} zebra={i % 2 === 1} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </TabsContent>
    </Tabs>
  );
}

const ACTION_META: Record<string, { label: string; Icon: React.ElementType; badge: string }> = {
  "document.upload": {
    label: "Uploaded",
    Icon: FileText,
    badge: "bg-teal-500/15 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  },
  "document.delete": {
    label: "Deleted",
    Icon: Trash2,
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  },
  "chat.message": {
    label: "Message",
    Icon: MessageSquare,
    badge: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

function AuditLogRow({ log, zebra }: { log: AuditLogEntry; zebra?: boolean }) {
  const meta = ACTION_META[log.action] ?? {
    label: log.action,
    Icon: Activity,
    badge: "bg-muted text-muted-foreground",
  };
  const { label, Icon, badge } = meta;

  const resourceLabel =
    typeof log.metadata?.title === "string"
      ? log.metadata.title
      : log.resourceId
        ? log.resourceId.slice(0, 12) + "…"
        : <span className="text-muted-foreground/50 italic">—</span>;

  return (
    <tr className={zebra ? "bg-muted/20" : "bg-transparent"}>
      {/* Action badge */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${badge}`}>
          <Icon className="h-3 w-3" />
          {label}
        </span>
      </td>

      {/* Resource */}
      <td className="px-4 py-3 text-sm text-foreground max-w-0">
        <p className="truncate" title={typeof resourceLabel === "string" ? resourceLabel : undefined}>
          {resourceLabel}
        </p>
        {/* Show time on mobile (hidden sm column) */}
        <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">{timeAgo(log.createdAt)}</p>
      </td>

      {/* Time */}
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
        {timeAgo(log.createdAt)}
      </td>

      {/* IP */}
      <td className="px-4 py-3 text-xs text-muted-foreground/60 whitespace-nowrap font-mono hidden lg:table-cell">
        {log.ipAddress ?? "—"}
      </td>
    </tr>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  accent: "teal" | "emerald";
}) {
  const colors = {
    teal: "bg-teal-500/15 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400",
    emerald: "bg-emerald-500/15 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colors[accent]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium mb-0.5">{label}</p>
        <div className="text-sm text-foreground font-medium truncate">{value}</div>
      </div>
    </div>
  );
}
