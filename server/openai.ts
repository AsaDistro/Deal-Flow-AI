import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const AI_MODEL = "gpt-5.2";

export function buildDealContext(deal: any, documents: any[]): string {
  let context = `Deal: ${deal.name}\n`;
  if (deal.targetCompany) context += `Target Company: ${deal.targetCompany}\n`;
  if (deal.geography) context += `Geography: ${deal.geography}\n`;
  if (deal.valuation) context += `Valuation: $${Number(deal.valuation).toLocaleString()}M\n`;
  if (deal.revenue) context += `Revenue: $${Number(deal.revenue).toLocaleString()}M\n`;
  if (deal.ebitda) context += `EBITDA: $${Number(deal.ebitda).toLocaleString()}M\n`;
  if (deal.valuation && deal.ebitda && Number(deal.ebitda) > 0) {
    context += `EV/EBITDA Multiple: ${(Number(deal.valuation) / Number(deal.ebitda)).toFixed(1)}x\n`;
  }
  if (deal.description) context += `Description: ${deal.description}\n`;
  if (deal.status) context += `Status: ${deal.status}\n`;

  if (documents.length > 0) {
    context += `\n--- Documents in Dataroom ---\n`;
    for (const doc of documents) {
      context += `\nDocument: ${doc.name} (${doc.category || 'general'})`;
      if (doc.aiSummary) context += `\nSummary: ${doc.aiSummary}`;
      if (doc.extractedText) context += `\nContent:\n${doc.extractedText.substring(0, 4000)}`;
      context += "\n";
    }
  }

  return context;
}

const NO_HALLUCINATION_INSTRUCTION = `

CRITICAL INSTRUCTION: You must ONLY use information that is explicitly provided in the deal context, uploaded documents, and conversation history. Do NOT fabricate, invent, or hallucinate any data, numbers, facts, company details, or financial figures. If information is not available, clearly state that the data has not been provided or is unavailable. Never fill in gaps with assumed or made-up information.`;

export const SYSTEM_PROMPT = `You are an expert M&A and Private Equity associate AI assistant. You help analysts and associates manage their deal pipeline, analyze documents, create investment memos, and provide strategic insights.

Your capabilities:
- Analyze deal financials, valuation metrics, and market positioning
- Review and summarize uploaded documents (financial statements, pitch decks, legal docs, etc.)
- Generate investment thesis and risk assessment
- Create comprehensive deal summaries and investment memos
- Answer questions about specific deals using the document context provided
- Help structure due diligence processes
- Provide industry analysis and comparable transaction insights

All financial figures (Valuation, Revenue, EBITDA) are denominated in millions of dollars ($M) unless otherwise specified.

When responding:
- Be precise and data-driven when financial information is available
- Use professional M&A/PE terminology
- Structure responses clearly with headers and bullet points when appropriate
- Highlight key risks and opportunities
- Reference specific documents when available
- If asked to generate a memo or analysis, use a structured professional format
- If data is not available, explicitly say so — never guess or fabricate numbers

Format your responses using markdown for readability.${NO_HALLUCINATION_INSTRUCTION}`;

export const SUMMARY_PROMPT = `Based on the deal information and documents provided below, create a comprehensive executive summary of this deal. Include:

1. **Deal Overview** - Key transaction details
2. **Target Company Profile** - Business description, market position
3. **Financial Highlights** - Key financial metrics and trends (all values in $M)
4. **Strategic Rationale** - Why this deal makes sense
5. **Key Developments** - What has happened so far
6. **Next Steps** - What needs to be done

Be concise but thorough. Use data from the documents when available. Do NOT make up or fabricate any data, financial figures, or facts that are not explicitly provided in the deal context or documents. If information is missing, clearly note it as "Not provided" or "Data unavailable."${NO_HALLUCINATION_INSTRUCTION}`;

export const ANALYSIS_PROMPT = `Based on the deal information and documents provided below, create a detailed investment analysis. Include:

1. **Investment Thesis** - Core reasons to pursue this deal
2. **Valuation Assessment** - Analysis of the deal valuation and comparables (all values in $M)
3. **Financial Analysis** - Revenue, EBITDA, margins, growth trajectory (all values in $M)
4. **Market Analysis** - Industry dynamics, competitive landscape
5. **Risk Assessment** - Key risks and mitigants
6. **Due Diligence Findings** - Key items identified from documents
7. **Recommendation** - Overall assessment with conditions

Use professional PE/M&A analysis frameworks. Reference specific data points when available. Do NOT make up or fabricate any data, financial figures, or facts that are not explicitly provided in the deal context or documents. If information is missing, clearly note it as "Not provided" or "Data unavailable."${NO_HALLUCINATION_INSTRUCTION}`;
