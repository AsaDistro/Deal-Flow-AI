import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { openai, AI_MODEL, buildDealContext, SYSTEM_PROMPT, SUMMARY_PROMPT, ANALYSIS_PROMPT } from "./openai";
import { insertDealSchema, insertDealStageSchema, insertDocumentSchema } from "@shared/schema";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { extractDocumentText } from "./document-extractor";
import { z } from "zod";
import express from "express";

async function extractFinancialDataAndUpdateDeal(dealId: number, contentPreview: string, docName: string) {
  try {
    const deal = await storage.getDeal(dealId);
    if (!deal) return;

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a financial data extraction assistant. Extract key financial metrics from the document content. Return ONLY valid JSON with no additional text. All monetary values must be in millions (e.g., if the document says "$500 million revenue", return 500; if it says "$1.2 billion", return 1200). CRITICAL: Only extract values explicitly stated in the document. Do NOT estimate, calculate, or infer values that are not directly present. If a field is not found, use null.`
        },
        {
          role: "user",
          content: `Extract financial data from this document. Current deal info for reference (only update fields where the document provides NEW or MORE RECENT data):\n- Target Company: ${deal.targetCompany || 'not set'}\n- Geography: ${deal.geography || 'not set'}\n- Valuation: ${deal.valuation ? '$' + deal.valuation + 'M' : 'not set'}\n- Revenue: ${deal.revenue ? '$' + deal.revenue + 'M' : 'not set'}\n- EBITDA: ${deal.ebitda ? '$' + deal.ebitda + 'M' : 'not set'}\n\n--- DOCUMENT: ${docName} ---\n${contentPreview}\n--- END ---\n\nReturn JSON with these fields (use null for any not found in document):\n{"valuation": number|null, "revenue": number|null, "ebitda": number|null, "targetCompany": string|null, "geography": string|null}`
        }
      ],
      max_completion_tokens: 500,
    });

    const raw = response.choices[0]?.message?.content || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`No financial data JSON extracted from ${docName}`);
      return;
    }

    const extracted = JSON.parse(jsonMatch[0]);
    const updates: Record<string, any> = {};
    let updatedFields: string[] = [];

    if (extracted.valuation != null && typeof extracted.valuation === "number") {
      updates.valuation = extracted.valuation.toString();
      updatedFields.push(`Valuation: $${extracted.valuation}M`);
    }
    if (extracted.revenue != null && typeof extracted.revenue === "number") {
      updates.revenue = extracted.revenue.toString();
      updatedFields.push(`Revenue: $${extracted.revenue}M`);
    }
    if (extracted.ebitda != null && typeof extracted.ebitda === "number") {
      updates.ebitda = extracted.ebitda.toString();
      updatedFields.push(`EBITDA: $${extracted.ebitda}M`);
    }
    if (extracted.targetCompany && typeof extracted.targetCompany === "string" && !deal.targetCompany) {
      updates.targetCompany = extracted.targetCompany;
      updatedFields.push(`Target Company: ${extracted.targetCompany}`);
    }
    if (extracted.geography && typeof extracted.geography === "string" && !deal.geography) {
      updates.geography = extracted.geography;
      updatedFields.push(`Geography: ${extracted.geography}`);
    }

    if (Object.keys(updates).length > 0) {
      await storage.updateDeal(dealId, updates);
      await storage.createActivity({
        dealId,
        type: "document_processed",
        description: `Financial data extracted from "${docName}": ${updatedFields.join(", ")}`,
      });
      console.log(`Deal ${dealId} updated from document ${docName}: ${updatedFields.join(", ")}`);
    } else {
      console.log(`No new financial data found in ${docName} for deal ${dealId}`);
    }
  } catch (error) {
    console.error(`Error extracting financial data from ${docName}:`, error);
  }
}

async function processDocumentInBackground(docId: number, name: string, category: string | null, type: string | null, objectPath: string, dealId: number) {
  try {
    console.log(`Auto-processing document ${docId}: ${name}`);

    const extractedText = await extractDocumentText(objectPath, name, type);
    console.log(`Extracted ${extractedText.length} chars from ${name}`);

    const contentPreview = extractedText.substring(0, 8000);

    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: "You are a document analysis assistant specializing in M&A and Private Equity. Analyze the actual document content provided and create a thorough summary. Focus on financial data, legal terms, business metrics, and strategic insights. CRITICAL: Do NOT fabricate, invent, or hallucinate any data. Only use information explicitly present in the document content. If information is missing, state it is unavailable."
        },
        {
          role: "user",
          content: `Please analyze and summarize this document:\n\nDocument Name: ${name}\nCategory: ${category || 'general'}\nType: ${type || 'unknown'}\n\n--- DOCUMENT CONTENT ---\n${contentPreview}\n--- END DOCUMENT CONTENT ---\n\nProvide a detailed summary focusing on key financial data, business metrics, legal terms, and strategic insights that would be relevant for M&A due diligence. Reference specific numbers and data points from the document.`
        }
      ],
      max_completion_tokens: 2000,
    });

    const summary = response.choices[0]?.message?.content || "";

    await storage.updateDocument(docId, {
      aiProcessed: true,
      aiSummary: summary,
      extractedText: extractedText.substring(0, 50000),
    });
    console.log(`Document ${docId} processed successfully`);

    await extractFinancialDataAndUpdateDeal(dealId, contentPreview, name);
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

  const createFromDocSchema = z.object({
    objectPath: z.string().min(1, "objectPath is required"),
    fileName: z.string().min(1, "fileName is required"),
    fileType: z.string().nullable().optional(),
    fileSize: z.number().nullable().optional(),
  });

  app.post("/api/deals/create-from-document", async (req, res) => {
    try {
      const { objectPath, fileName, fileType, fileSize } = createFromDocSchema.parse(req.body);

      const extractedText = await extractDocumentText(objectPath, fileName, fileType || null);
      console.log(`Extracted ${extractedText.length} chars from ${fileName} for deal creation`);

      const contentPreview = extractedText.substring(0, 8000);

      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: `You are a deal creation assistant for M&A and Private Equity. Extract deal information from the document to create a new deal record. Return ONLY valid JSON with no additional text. All monetary values must be in millions (e.g., "$500 million" = 500, "$1.2 billion" = 1200). CRITICAL: Only extract values explicitly stated in the document. Do NOT estimate or fabricate any data. If a field is not found, use null.`
          },
          {
            role: "user",
            content: `Extract deal information from this document to create a new deal:\n\n--- DOCUMENT: ${fileName} ---\n${contentPreview}\n--- END ---\n\nReturn JSON with these fields:\n{"name": string (a short deal name, e.g. "Acme Corp Acquisition" or company name), "description": string|null (brief deal description), "targetCompany": string|null, "geography": string|null, "valuation": number|null (in millions), "revenue": number|null (in millions), "ebitda": number|null (in millions)}`
          }
        ],
        max_completion_tokens: 500,
      });

      const raw = response.choices[0]?.message?.content || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(422).json({ error: "Could not extract deal information from document" });
      }

      let extracted: any;
      try {
        extracted = JSON.parse(jsonMatch[0]);
      } catch {
        return res.status(422).json({ error: "AI returned invalid JSON when parsing document" });
      }

      const stages = await storage.getDealStages();
      const firstStage = stages.length > 0 ? stages[0] : null;

      const dealData: any = {
        name: extracted.name || fileName.replace(/\.[^.]+$/, ""),
        description: extracted.description || null,
        targetCompany: extracted.targetCompany || null,
        geography: extracted.geography || null,
        stageId: firstStage?.id || null,
        status: "active",
      };
      if (extracted.valuation != null && typeof extracted.valuation === "number") {
        dealData.valuation = extracted.valuation.toString();
      }
      if (extracted.revenue != null && typeof extracted.revenue === "number") {
        dealData.revenue = extracted.revenue.toString();
      }
      if (extracted.ebitda != null && typeof extracted.ebitda === "number") {
        dealData.ebitda = extracted.ebitda.toString();
      }

      const deal = await storage.createDeal(dealData);

      await storage.createDealActivity({
        dealId: deal.id,
        type: "deal_created",
        description: `Deal "${deal.name}" was created from document "${fileName}"`,
      });

      const doc = await storage.createDocument({
        dealId: deal.id,
        name: fileName,
        objectPath,
        type: fileType || null,
        size: fileSize || null,
        category: "general",
      });

      await storage.createDealActivity({
        dealId: deal.id,
        type: "document_uploaded",
        description: `Document "${fileName}" was uploaded`,
      });

      processDocumentInBackground(doc.id, doc.name, doc.category, doc.type, doc.objectPath, deal.id);

      res.status(201).json({ deal, document: doc, extracted });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating deal from document:", error);
      res.status(500).json({ error: "Failed to create deal from document" });
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

      processDocumentInBackground(doc.id, doc.name, doc.category, doc.type, doc.objectPath, doc.dealId);
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

      const extractedText = await extractDocumentText(doc.objectPath, doc.name, doc.type);
      console.log(`Extracted ${extractedText.length} chars from ${doc.name}`);

      const contentPreview = extractedText.substring(0, 8000);

      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a document analysis assistant specializing in M&A and Private Equity. Analyze the actual document content provided and create a thorough summary. Focus on financial data, legal terms, business metrics, and strategic insights. CRITICAL: Do NOT fabricate, invent, or hallucinate any data. Only use information explicitly present in the document content. If information is missing, state it is unavailable."
          },
          {
            role: "user",
            content: `Please analyze and summarize this document:\n\nDocument Name: ${doc.name}\nCategory: ${doc.category || 'general'}\nType: ${doc.type || 'unknown'}\n\n--- DOCUMENT CONTENT ---\n${contentPreview}\n--- END DOCUMENT CONTENT ---\n\nProvide a detailed summary focusing on key financial data, business metrics, legal terms, and strategic insights that would be relevant for M&A due diligence. Reference specific numbers and data points from the document.`
          }
        ],
        max_completion_tokens: 2000,
      });

      const summary = response.choices[0]?.message?.content || "";

      await storage.updateDocument(id, {
        aiProcessed: true,
        aiSummary: summary,
        extractedText: extractedText.substring(0, 50000),
      });

      await extractFinancialDataAndUpdateDeal(doc.dealId, contentPreview, doc.name);

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
