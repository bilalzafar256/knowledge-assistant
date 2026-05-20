import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/sidebar-nav";
import { DashboardShell } from "@/components/dashboard-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s | Knowledge Assistant",
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  const sidebar = (
    <SidebarNav
      user={{
        name: user?.fullName ?? user?.username ?? "User",
        email: user?.emailAddresses[0]?.emailAddress ?? "",
        imageUrl: user?.imageUrl,
      }}
    />
  );

  return <DashboardShell sidebar={sidebar}>{children}</DashboardShell>;
}
