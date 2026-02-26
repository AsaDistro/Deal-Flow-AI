import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function buildDealContext(deal: any, documents: any[]): string {
  let context = `Deal: ${deal.name}\n`;
  if (deal.targetCompany) context += `Target Company: ${deal.targetCompany}\n`;
  if (deal.acquirer) context += `Acquirer: ${deal.acquirer}\n`;
  if (deal.industry) context += `Industry: ${deal.industry}\n`;
  if (deal.geography) context += `Geography: ${deal.geography}\n`;
  if (deal.transactionType) context += `Transaction Type: ${deal.transactionType}\n`;
  if (deal.valuation) context += `Valuation: $${Number(deal.valuation).toLocaleString()}\n`;
  if (deal.revenue) context += `Revenue: $${Number(deal.revenue).toLocaleString()}\n`;
  if (deal.ebitda) context += `EBITDA: $${Number(deal.ebitda).toLocaleString()}\n`;
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

export const SYSTEM_PROMPT = `You are an expert M&A and Private Equity associate AI assistant. You help analysts and associates manage their deal pipeline, analyze documents, create investment memos, and provide strategic insights.

Your capabilities:
- Analyze deal financials, valuation metrics, and market positioning
- Review and summarize uploaded documents (financial statements, pitch decks, legal docs, etc.)
- Generate investment thesis and risk assessment
- Create comprehensive deal summaries and investment memos
- Answer questions about specific deals using the document context provided
- Help structure due diligence processes
- Provide industry analysis and comparable transaction insights

When responding:
- Be precise and data-driven when financial information is available
- Use professional M&A/PE terminology
- Structure responses clearly with headers and bullet points when appropriate
- Highlight key risks and opportunities
- Reference specific documents when available
- If asked to generate a memo or analysis, use a structured professional format

Format your responses using markdown for readability.`;

export const SUMMARY_PROMPT = `Based on the deal information and documents provided below, create a comprehensive executive summary of this deal. Include:

1. **Deal Overview** - Key transaction details
2. **Target Company Profile** - Business description, market position
3. **Financial Highlights** - Key financial metrics and trends
4. **Strategic Rationale** - Why this deal makes sense
5. **Key Developments** - What has happened so far
6. **Next Steps** - What needs to be done

Be concise but thorough. Use data from the documents when available.`;

export const ANALYSIS_PROMPT = `Based on the deal information and documents provided below, create a detailed investment analysis. Include:

1. **Investment Thesis** - Core reasons to pursue this deal
2. **Valuation Assessment** - Analysis of the deal valuation and comparables
3. **Financial Analysis** - Revenue, EBITDA, margins, growth trajectory
4. **Market Analysis** - Industry dynamics, competitive landscape
5. **Risk Assessment** - Key risks and mitigants
6. **Due Diligence Findings** - Key items identified from documents
7. **Recommendation** - Overall assessment with conditions

Use professional PE/M&A analysis frameworks. Reference specific data points when available.`;
