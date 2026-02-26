import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const dealStages = pgTable("deal_stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertDealStageSchema = createInsertSchema(dealStages).omit({ id: true });
export type InsertDealStage = z.infer<typeof insertDealStageSchema>;
export type DealStage = typeof dealStages.$inferSelect;

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  stageId: integer("stage_id").references(() => dealStages.id),
  targetCompany: text("target_company"),
  geography: text("geography"),
  valuation: numeric("valuation"),
  revenue: numeric("revenue"),
  ebitda: numeric("ebitda"),
  status: text("status").notNull().default("active"),
  aiSummary: text("ai_summary"),
  aiAnalysis: text("ai_analysis"),
  summaryContext: text("summary_context"),
  analysisContext: text("analysis_context"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type"),
  size: integer("size"),
  objectPath: text("object_path").notNull(),
  category: text("category").default("general"),
  aiProcessed: boolean("ai_processed").default(false),
  aiSummary: text("ai_summary"),
  extractedText: text("extracted_text"),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, uploadedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export const dealMessages = pgTable("deal_messages", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDealMessageSchema = createInsertSchema(dealMessages).omit({ id: true, createdAt: true });
export type InsertDealMessage = z.infer<typeof insertDealMessageSchema>;
export type DealMessage = typeof dealMessages.$inferSelect;

export const dealActivities = pgTable("deal_activities", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => deals.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertDealActivitySchema = createInsertSchema(dealActivities).omit({ id: true, createdAt: true });
export type InsertDealActivity = z.infer<typeof insertDealActivitySchema>;
export type DealActivity = typeof dealActivities.$inferSelect;

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
