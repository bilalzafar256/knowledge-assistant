import { SignIn } from "@clerk/nextjs";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mb-8 group">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary group-hover:bg-primary/90 transition-colors">
          <BookOpen className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg text-foreground">
          Knowledge Assistant
        </span>
      </Link>

      {/* Clerk SignIn component */}
      <SignIn
        appearance={{
          elements: {
            rootBox: "w-full max-w-md",
            card: "shadow-lg border border-border rounded-xl",
            headerTitle: "text-foreground font-semibold",
            headerSubtitle: "text-muted-foreground",
            socialButtonsBlockButton:
              "border border-border hover:bg-accent transition-colors",
            formButtonPrimary:
              "bg-primary hover:bg-primary/90 text-primary-foreground",
            footerActionLink: "text-primary hover:text-primary/90",
          },
        }}
      />

      <p className="mt-6 text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-primary hover:underline">
          Sign up for free
        </Link>
      </p>
    </div>
  );
}
