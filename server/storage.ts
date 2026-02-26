import {
  type Deal, type InsertDeal,
  type DealStage, type InsertDealStage,
  type Document, type InsertDocument,
  type DealMessage, type InsertDealMessage,
  type DealActivity, type InsertDealActivity,
  type User, type InsertUser,
  deals, dealStages, documents, dealMessages, dealActivities, users
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, ilike, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getDealStages(): Promise<DealStage[]>;
  getDealStage(id: number): Promise<DealStage | undefined>;
  createDealStage(stage: InsertDealStage): Promise<DealStage>;
  updateDealStage(id: number, stage: Partial<InsertDealStage>): Promise<DealStage | undefined>;
  deleteDealStage(id: number): Promise<void>;

  getDeals(filters?: { stageId?: number; status?: string; search?: string }): Promise<Deal[]>;
  getDeal(id: number): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: number): Promise<void>;

  getDocuments(dealId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: number, doc: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<void>;
  getAllDealDocuments(dealId: number): Promise<Document[]>;

  getDealMessages(dealId: number): Promise<DealMessage[]>;
  createDealMessage(msg: InsertDealMessage): Promise<DealMessage>;
  clearDealMessages(dealId: number): Promise<void>;

  getDealActivities(dealId: number): Promise<DealActivity[]>;
  createDealActivity(activity: InsertDealActivity): Promise<DealActivity>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getDealStages(): Promise<DealStage[]> {
    return db.select().from(dealStages).orderBy(asc(dealStages.sortOrder));
  }

  async getDealStage(id: number): Promise<DealStage | undefined> {
    const [stage] = await db.select().from(dealStages).where(eq(dealStages.id, id));
    return stage;
  }

  async createDealStage(stage: InsertDealStage): Promise<DealStage> {
    const [created] = await db.insert(dealStages).values(stage).returning();
    return created;
  }

  async updateDealStage(id: number, stage: Partial<InsertDealStage>): Promise<DealStage | undefined> {
    const [updated] = await db.update(dealStages).set(stage).where(eq(dealStages.id, id)).returning();
    return updated;
  }

  async deleteDealStage(id: number): Promise<void> {
    await db.delete(dealStages).where(eq(dealStages.id, id));
  }

  async getDeals(filters?: { stageId?: number; status?: string; search?: string }): Promise<Deal[]> {
    const conditions = [];
    if (filters?.stageId) conditions.push(eq(deals.stageId, filters.stageId));
    if (filters?.status) conditions.push(eq(deals.status, filters.status));
    if (filters?.search) conditions.push(ilike(deals.name, `%${filters.search}%`));

    if (conditions.length > 0) {
      return db.select().from(deals).where(and(...conditions)).orderBy(desc(deals.updatedAt));
    }
    return db.select().from(deals).orderBy(desc(deals.updatedAt));
  }

  async getDeal(id: number): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal;
  }

  async createDeal(deal: InsertDeal): Promise<Deal> {
    const [created] = await db.insert(deals).values(deal).returning();
    return created;
  }

  async updateDeal(id: number, deal: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [updated] = await db.update(deals).set({ ...deal, updatedAt: new Date() }).where(eq(deals.id, id)).returning();
    return updated;
  }

  async deleteDeal(id: number): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async getDocuments(dealId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.dealId, dealId)).orderBy(desc(documents.uploadedAt));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async updateDocument(id: number, doc: Partial<InsertDocument>): Promise<Document | undefined> {
    const [updated] = await db.update(documents).set(doc).where(eq(documents.id, id)).returning();
    return updated;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getAllDealDocuments(dealId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.dealId, dealId)).orderBy(desc(documents.uploadedAt));
  }

  async getDealMessages(dealId: number): Promise<DealMessage[]> {
    return db.select().from(dealMessages).where(eq(dealMessages.dealId, dealId)).orderBy(asc(dealMessages.createdAt));
  }

  async createDealMessage(msg: InsertDealMessage): Promise<DealMessage> {
    const [created] = await db.insert(dealMessages).values(msg).returning();
    return created;
  }

  async clearDealMessages(dealId: number): Promise<void> {
    await db.delete(dealMessages).where(eq(dealMessages.dealId, dealId));
  }

  async getDealActivities(dealId: number): Promise<DealActivity[]> {
    return db.select().from(dealActivities).where(eq(dealActivities.dealId, dealId)).orderBy(desc(dealActivities.createdAt));
  }

  async createDealActivity(activity: InsertDealActivity): Promise<DealActivity> {
    const [created] = await db.insert(dealActivities).values(activity).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
