import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import arcjet, { shield, tokenBucket, detectBot } from "@arcjet/next";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/api/chat(.*)",
  "/api/documents(.*)",
  "/api/workflows(.*)",
]);

// Routes that are always public
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
]);

// Arcjet middleware client for route-level protection
const aj = arcjet({
  key: process.env["ARCJET_KEY"] ?? "ajkey_placeholder",
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:MONITOR",
        "CATEGORY:PREVIEW",
      ],
    }),
    tokenBucket({
      mode: "LIVE",
      characteristics: ["ip.src"],
      refillRate: 100,
      interval: 60,
      capacity: 100,
    }),
  ],
});

export default clerkMiddleware(
  async (auth, request: NextRequest) => {
    // 1. Run Arcjet security checks on all routes
    const decision = await aj.protect(request, { requested: 1 });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return NextResponse.json(
          {
            error: "Too many requests. Please slow down.",
            code: "RATE_LIMITED",
          },
          { status: 429 }
        );
      }

      if (decision.reason.isBot()) {
        return NextResponse.json(
          { error: "Bot traffic is not allowed.", code: "BOT_DETECTED" },
          { status: 403 }
        );
      }

      if (decision.reason.isShield()) {
        return NextResponse.json(
          {
            error: "Request blocked for security reasons.",
            code: "SHIELD_BLOCKED",
          },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Request denied.", code: "DENIED" },
        { status: 403 }
      );
    }

    // 2. Enforce Clerk authentication on protected routes
    if (isProtectedRoute(request) && !isPublicRoute(request)) {
      await auth.protect();
    }

    return NextResponse.next();
  },
  {
    // Clerk config
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  }
);

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
