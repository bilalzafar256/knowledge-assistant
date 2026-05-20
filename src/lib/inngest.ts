import { Inngest } from "inngest";
import { env } from "./env";

export const inngest = new Inngest({
  id: "knowledge-assistant",
  name: "Knowledge Assistant",
  eventKey: env.INNGEST_EVENT_KEY,
});

// ── Event types ───────────────────────────────────────────────────────────────

export type DocumentUploadedEvent = {
  name: "document/uploaded";
  data: {
    documentId: string;
    userId: string;
  };
};

export type Events = {
  "document/uploaded": DocumentUploadedEvent;
};
