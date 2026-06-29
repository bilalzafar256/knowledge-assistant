import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function SignUpPage() {
  return (
    <div className="mkt relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[12vw] -top-[10vh] -z-10 h-[60vh] w-[60vh] rounded-full opacity-60 blur-[120px]"
        style={{ background: "radial-gradient(closest-side, rgba(52,211,153,0.13), transparent 65%)" }}
      />

      <Link href="/" className="mb-9 flex items-center gap-2.5">
        <span className="relative flex h-7 w-7 items-center justify-center">
          <span className="absolute inset-0 rounded-sm border border-[var(--accent)]/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        </span>
        <span className="text-[0.95rem] font-medium tracking-tight text-[var(--text)]">
          Knowledge Assistant
        </span>
      </Link>

      <SignUp
        appearance={{
          variables: {
            colorPrimary: "#34d399",
            colorBackground: "#101216",
            colorText: "#e9ecef",
            colorTextSecondary: "#9aa1ab",
            colorInputBackground: "#161a1f",
            colorInputText: "#e9ecef",
            colorTextOnPrimaryBackground: "#04130d",
            borderRadius: "0px",
          },
          elements: {
            rootBox: "w-full max-w-md",
            card: "border border-[var(--line)] bg-[var(--surface)] shadow-2xl shadow-black/40",
            headerTitle: "text-[var(--text)] font-semibold",
            headerSubtitle: "text-[var(--text-dim)]",
            socialButtonsBlockButton:
              "border border-[var(--line-strong)] hover:bg-[var(--surface-2)] transition-colors",
            formButtonPrimary:
              "bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-[var(--accent-ink)] font-medium normal-case",
            footerActionLink: "text-[var(--accent)] hover:text-[var(--accent-strong)]",
          },
        }}
      />

      <p className="mt-6 text-sm text-[var(--text-dim)]">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-[var(--accent)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
