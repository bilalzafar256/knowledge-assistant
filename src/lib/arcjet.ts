import arcjet, {
  tokenBucket,
  fixedWindow,
  shield,
  detectBot,
  type ArcjetDecision,
} from "@arcjet/next";
import { env } from "./env";

// Base Arcjet client with shared rules applied to all routes
export const aj = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    // Shield protects against common attacks including SQL injection, XSS,
    // path traversal attacks, and prompt injection in request bodies
    shield({
      mode: "LIVE",
    }),
    // Block bots that aren't legitimate crawlers or browsers
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "CATEGORY:MONITOR",
        "CATEGORY:PREVIEW",
      ],
    }),
  ],
});

// Arcjet client for the chat API — stricter rate limiting
export const chatAj = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:MONITOR"],
    }),
    // 20 chat requests per user per minute (token bucket)
    tokenBucket({
      mode: "LIVE",
      characteristics: ["userId"],
      refillRate: 20,
      interval: 60,
      capacity: 20,
    }),
  ],
});

// Arcjet client for document upload API — rate limit per user
export const uploadAj = arcjet({
  key: env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: ["CATEGORY:SEARCH_ENGINE", "CATEGORY:MONITOR"],
    }),
    // 50 uploads per user per hour (burst protection)
    tokenBucket({
      mode: "LIVE",
      characteristics: ["userId"],
      refillRate: 50,
      interval: 3600,
      capacity: 50,
    }),
    // 200 uploads per user per day (daily quota)
    fixedWindow({
      mode: "LIVE",
      characteristics: ["userId"],
      window: "86400s",
      max: 200,
    }),
  ],
});

export type { ArcjetDecision };
