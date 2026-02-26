import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openai, AI_MODEL, buildDealContext, SYSTEM_PROMPT, SUMMARY_PROMPT, ANALYSIS_PROMPT } from "./openai";
import { insertDealSchema, insertDealStageSchema, insertDocumentSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { z } from "zod";
import express from "express";

async function processDocumentInBackground(docId: number, name: string, category: string | null, type: string | null) {
  try {
    console.log(`Auto-processing document ${docId}: ${name}`);
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a document analysis assistant specializing in M&A and Private Equity. Extract and summarize the key information from the document description provided. Focus on financial data, legal terms, business metrics, and strategic insights. CRITICAL: Do NOT fabricate, invent, or hallucinate any data. Only use information explicitly provided. If information is missing, state it is unavailable."
        },
        {
          role: "user",
          content: `Please analyze and summarize this document:\n\nDocument Name: ${name}\nCategory: ${category || 'general'}\nType: ${type || 'unknown'}\n\nProvide a detailed summary focusing on key financial data, business metrics, legal terms, and strategic insights that would be relevant for M&A due diligence.`
        }
      ],
      max_completion_tokens: 2000,
    });

    const summary = response.choices[0]?.message?.content || "";

    await storage.updateDocument(docId, {
      aiProcessed: true,
      aiSummary: summary,
      extractedText: `[Processed] ${name} - ${summary}`,
    });
    console.log(`Document ${docId} processed successfully`);
  } catch (error) {
    console.error(`Error auto-processing document ${docId}:`, error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerObjectStorageRoutes(app);

  app.get("/api/stages", async (_req, res) => {
    try {
      const stages = await storage.getDealStages();
      res.json(stages);
    } catch (error) {
      console.error("Error fetching stages:", error);
      res.status(500).json({ error: "Failed to fetch stages" });
    }
  });

  app.post("/api/stages", async (req, res) => {
    try {
      const parsed = insertDealStageSchema.parse(req.body);
      const stage = await storage.createDealStage(parsed);
      res.status(201).json(stage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating stage:", error);
      res.status(500).json({ error: "Failed to create stage" });
    }
  });

  app.patch("/api/stages/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid stage ID" });
      const stage = await storage.updateDealStage(id, req.body);
      if (!stage) return res.status(404).json({ error: "Stage not found" });
      res.json(stage);
    } catch (error) {
      console.error("Error updating stage:", error);
      res.status(500).json({ error: "Failed to update stage" });
    }
  });

  app.delete("/api/stages/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid stage ID" });
      await storage.deleteDealStage(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting stage:", error);
      res.status(500).json({ error: "Failed to delete stage" });
    }
  });

  app.post("/api/stages/seed", async (_req, res) => {
    try {
      const existing = await storage.getDealStages();
      if (existing.length > 0) {
        return res.json(existing);
      }
      const defaultStages = [
        { name: "Sourcing", color: "#6366f1", sortOrder: 0, description: "Initial deal identification and screening" },
        { name: "Preliminary Review", color: "#8b5cf6", sortOrder: 1, description: "Initial analysis and information gathering" },
        { name: "Due Diligence", color: "#f59e0b", sortOrder: 2, description: "Detailed investigation and analysis" },
        { name: "Negotiation", color: "#ef4444", sortOrder: 3, description: "Term sheet and deal structure negotiations" },
        { name: "Closing", color: "#10b981", sortOrder: 4, description: "Final documentation and closing" },
        { name: "Post-Close", color: "#06b6d4", sortOrder: 5, description: "Integration and value creation" },
      ];
      const created = [];
      for (const stage of defaultStages) {
        created.push(await storage.createDealStage(stage));
      }
      res.status(201).json(created);
    } catch (error) {
      console.error("Error seeding stages:", error);
      res.status(500).json({ error: "Failed to seed stages" });
    }
  });

  const dealCreateSchema = z.object({
    name: z.string().min(1, "Deal name is required"),
    description: z.string().optional().nullable(),
    stageId: z.number().int().positive().optional().nullable(),
    targetCompany: z.string().optional().nullable(),
    geography: z.string().optional().nullable(),
    valuation: z.string().optional().nullable(),
    revenue: z.string().optional().nullable(),
    ebitda: z.string().optional().nullable(),
    status: z.string().optional(),
    summaryContext: z.string().optional().nullable(),
    analysisContext: z.string().optional().nullable(),
  });

  app.get("/api/deals", async (req, res) => {
    try {
      const filters: any = {};
      if (req.query.stageId) {
        const stageId = parseInt(req.query.stageId as string);
        if (!isNaN(stageId)) filters.stageId = stageId;
      }
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.search) filters.search = req.query.search as string;
      const allDeals = await storage.getDeals(filters);
      res.json(allDeals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  app.get("/api/deals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid deal ID" });
      const deal = await storage.getDeal(id);
      if (!deal) return res.status(404).json({ error: "Deal not found" });
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ error: "Failed to fetch deal" });
    }
  });

  app.post("/api/deals", async (req, res) => {
    try {
      const parsed = dealCreateSchema.parse(req.body);
      const deal = await storage.createDeal(parsed);
      await storage.createDealActivity({
        dealId: deal.id,
        type: "deal_created",
        description: `Deal "${deal.name}" was created`,
      });
      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating deal:", error);
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  const dealUpdateSchema = dealCreateSchema.partial();

  app.patch("/api/deals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid deal ID" });
      const parsed = dealUpdateSchema.parse(req.body);
      const deal = await storage.updateDeal(id, parsed);
      if (!deal) return res.status(404).json({ error: "Deal not found" });

      if (parsed.stageId !== undefined) {
        const stage = await storage.getDealStage(parsed.stageId!);
        if (stage) {
          await storage.createDealActivity({
            dealId: id,
            type: "stage_changed",
            description: `Deal moved to "${stage.name}" stage`,
          });
        }
      }

      res.json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating deal:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  app.delete("/api/deals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid deal ID" });
      await storage.deleteDeal(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  app.get("/api/deals/:id/documents", async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });
      const docs = await storage.getDocuments(dealId);
      res.json(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  const docCreateSchema = z.object({
    name: z.string().min(1, "Document name is required"),
    type: z.string().optional().nullable(),
    size: z.number().optional().nullable(),
    objectPath: z.string().min(1, "Object path is required"),
    category: z.string().optional().default("general"),
  });

  app.post("/api/deals/:id/documents", async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });
      const parsed = docCreateSchema.parse(req.body);
      const doc = await storage.createDocument({ ...parsed, dealId });
      await storage.createDealActivity({
        dealId,
        type: "document_uploaded",
        description: `Document "${doc.name}" was uploaded`,
      });
      res.status(201).json(doc);

      processDocumentInBackground(doc.id, doc.name, doc.category, doc.type);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating document:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  app.delete("/api/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });
      await storage.deleteDocument(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  app.post("/api/documents/:id/process", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid document ID" });
      const doc = await storage.getDocument(id);
      if (!doc) return res.status(404).json({ error: "Document not found" });

      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a document analysis assistant specializing in M&A and Private Equity. Extract and summarize the key information from the document description provided. Focus on financial data, legal terms, business metrics, and strategic insights. CRITICAL: Do NOT fabricate, invent, or hallucinate any data. Only use information explicitly provided. If information is missing, state it is unavailable."
          },
          {
            role: "user",
            content: `Please analyze and summarize this document:\n\nDocument Name: ${doc.name}\nCategory: ${doc.category || 'general'}\nType: ${doc.type || 'unknown'}\n\nProvide a detailed summary focusing on key financial data, business metrics, legal terms, and strategic insights that would be relevant for M&A due diligence.`
          }
        ],
        max_completion_tokens: 2000,
      });

      const summary = response.choices[0]?.message?.content || "";

      await storage.updateDocument(id, {
        aiProcessed: true,
        aiSummary: summary,
        extractedText: `[Processed] ${doc.name} - ${summary}`,
      });

      const updated = await storage.getDocument(id);
      res.json(updated);
    } catch (error) {
      console.error("Error processing document:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  app.get("/api/deals/:id/messages", async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });
      const msgs = await storage.getDealMessages(dealId);
      res.json(msgs);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/deals/:id/messages", async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });
      const { content } = req.body;
      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Message content is required" });
      }

      await storage.createDealMessage({ dealId, role: "user", content: content.trim() });

      const deal = await storage.getDeal(dealId);
      if (!deal) return res.status(404).json({ error: "Deal not found" });

      const docs = await storage.getAllDealDocuments(dealId);
      const dealContext = buildDealContext(deal, docs);

      const existingMessages = await storage.getDealMessages(dealId);
      const chatHistory = existingMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n\n--- Current Deal Context ---\n" + dealContext },
          ...chatHistory,
        ],
        stream: true,
        max_completion_tokens: 4096,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

      await storage.createDealMessage({ dealId, role: "assistant", content: fullResponse });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  app.delete("/api/deals/:id/messages", async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });
      await storage.clearDealMessages(dealId);
      res.status(204).send();
    } catch (error) {
      console.error("Error clearing messages:", error);
      res.status(500).json({ error: "Failed to clear messages" });
    }
  });

  app.post("/api/deals/:id/generate-summary", async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });
      const deal = await storage.getDeal(dealId);
      if (!deal) return res.status(404).json({ error: "Deal not found" });

      const docs = await storage.getAllDealDocuments(dealId);
      const dealContext = buildDealContext(deal, docs);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: SUMMARY_PROMPT + (deal.summaryContext ? "\n\n--- Additional Context/Instructions for Summary ---\n" + deal.summaryContext : "") + "\n\n--- Deal Data ---\n" + dealContext },
        ],
        stream: true,
        max_completion_tokens: 4096,
      });

      let fullSummary = "";

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullSummary += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

      await storage.updateDeal(dealId, { aiSummary: fullSummary });
      await storage.createDealActivity({
        dealId,
        type: "summary_generated",
        description: "AI deal summary was generated",
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error generating summary:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate summary" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to generate summary" });
      }
    }
  });

  app.post("/api/deals/:id/generate-analysis", async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });
      const deal = await storage.getDeal(dealId);
      if (!deal) return res.status(404).json({ error: "Deal not found" });

      const docs = await storage.getAllDealDocuments(dealId);
      const dealContext = buildDealContext(deal, docs);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: ANALYSIS_PROMPT + (deal.analysisContext ? "\n\n--- Additional Context/Instructions for Analysis ---\n" + deal.analysisContext : "") + "\n\n--- Deal Data ---\n" + dealContext },
        ],
        stream: true,
        max_completion_tokens: 4096,
      });

      let fullAnalysis = "";

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullAnalysis += text;
          res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
        }
      }

      await storage.updateDeal(dealId, { aiAnalysis: fullAnalysis });
      await storage.createDealActivity({
        dealId,
        type: "analysis_generated",
        description: "AI deal analysis was generated",
      });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error generating analysis:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate analysis" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to generate analysis" });
      }
    }
  });

  app.get("/api/deals/:id/activities", async (req, res) => {
    try {
      const dealId = parseInt(req.params.id);
      if (isNaN(dealId)) return res.status(400).json({ error: "Invalid deal ID" });
      const activities = await storage.getDealActivities(dealId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  return httpServer;
}
