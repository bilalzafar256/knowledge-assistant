import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const dimensions = (config as { dimensions?: number } | undefined)
      ?.dimensions ?? 1536;
    return `vector(${dimensions})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/[\[\]]/g, "")
      .split(",")
      .map(Number);
  },
});

// ── Collections ───────────────────────────────────────────────────────────────

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color").notNull().default("#6366f1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("collections_user_id_idx").on(table.userId),
  ]
);

// ── Documents ────────────────────────────────────────────────────────────────

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    collectionId: uuid("collection_id").references(() => collections.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    fileType: text("file_type").notNull().default("text"),
    fileSize: integer("file_size"),
    /** Ingestion pipeline status */
    status: text("status")
      .$type<"pending" | "processing" | "ready" | "failed">()
      .notNull()
      .default("pending"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("documents_user_id_idx").on(table.userId),
    index("documents_created_at_idx").on(table.createdAt),
    index("documents_status_idx").on(table.status),
    index("documents_collection_id_idx").on(table.collectionId),
  ]
);

// ── Document Chunks ──────────────────────────────────────────────────────────

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    content: text("content").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chunks_document_id_idx").on(table.documentId),
    index("chunks_user_id_idx").on(table.userId),
    // For vector similarity search — requires pgvector extension
    // The actual ivfflat index is created via raw SQL migration:
    // CREATE INDEX chunks_embedding_idx ON document_chunks
    //   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
  ]
);

// ── Chat Sessions ─────────────────────────────────────────────────────────────

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    title: text("title").notNull().default("New Chat"),
    pinned: boolean("pinned").notNull().default(false),
    isShared: boolean("is_shared").notNull().default(false),
    shareId: text("share_id").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_sessions_user_id_idx").on(table.userId),
    index("chat_sessions_updated_at_idx").on(table.updatedAt),
    index("chat_sessions_share_id_idx").on(table.shareId),
  ]
);

// ── Chat Messages ─────────────────────────────────────────────────────────────

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_messages_session_id_idx").on(table.sessionId),
    index("chat_messages_user_id_idx").on(table.userId),
  ]
);

// ── RAG Settings ─────────────────────────────────────────────────────────────

export const ragSettings = pgTable("rag_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  /** Approximate token count per chunk (~4 chars/token) */
  chunkSize: integer("chunk_size").notNull().default(500),
  /** Token overlap between consecutive chunks */
  chunkOverlap: integer("chunk_overlap").notNull().default(50),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Audit Logs ────────────────────────────────────────────────────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    action: text("action").notNull(),         // e.g. "document.upload", "document.delete"
    resourceType: text("resource_type"),      // e.g. "document", "chat_session"
    resourceId: text("resource_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_user_id_idx").on(table.userId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ]
);

// ── Relations ────────────────────────────────────────────────────────────────

export const collectionsRelations = relations(collections, ({ many }) => ({
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  collection: one(collections, {
    fields: [documents.collectionId],
    references: [collections.id],
  }),
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(
  documentChunks,
  ({ one }) => ({
    document: one(documents, {
      fields: [documentChunks.documentId],
      references: [documents.id],
    }),
  })
);

export const chatSessionsRelations = relations(chatSessions, ({ many }) => ({
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

// ── Types ────────────────────────────────────────────────────────────────────

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type RagSettings = typeof ragSettings.$inferSelect;
export type NewRagSettings = typeof ragSettings.$inferInsert;
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
