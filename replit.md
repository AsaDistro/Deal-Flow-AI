# DealFlow AI - M&A/PE Deal Tracking CRM

## Overview
AI-first M&A and Private Equity deal tracking platform with chat-first interface, secure document storage, and automated deal analysis.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2 for chat/analysis)
- **Storage**: Replit Object Storage for secure document file uploads

## Key Files
- `shared/schema.ts` - Database schema (deals, deal_stages, documents, deal_messages, deal_activities)
- `server/routes.ts` - All API endpoints with Zod validation
- `server/storage.ts` - Database storage interface (DatabaseStorage class)
- `server/openai.ts` - OpenAI client, AI_MODEL constant, and prompt templates (with no-hallucination instructions)
- `server/document-extractor.ts` - Downloads files from Object Storage and extracts text (xlsx, docx, csv, txt, md, json)
- `server/db.ts` - Database connection
- `client/src/App.tsx` - App router with sidebar layout
- `client/src/pages/dashboard.tsx` - Deal pipeline dashboard
- `client/src/pages/deal-detail.tsx` - Deal detail with chat, dataroom, summary, analysis tabs
- `client/src/components/app-sidebar.tsx` - Navigation sidebar

## Database Tables
- `users` - User accounts
- `deal_stages` - Customizable pipeline stages (seeded with defaults)
- `deals` - Deal records with financials (valuation/revenue/ebitda in $M), summaryContext, analysisContext, and AI-generated content
- `documents` - Document metadata linked to deals (with Object Storage paths)
- `deal_messages` - Per-deal chat history
- `deal_activities` - Activity timeline per deal

## Deal Fields
- name, description, targetCompany, geography
- valuation ($M), revenue ($M), ebitda ($M)
- summaryContext (custom instructions included in every summary generation)
- analysisContext (custom instructions included in every analysis generation)
- aiSummary, aiAnalysis (generated content)

## API Routes
- `GET/POST /api/stages` - Stage management
- `POST /api/stages/seed` - Seed default stages
- `GET/POST/PATCH/DELETE /api/deals` - Deal CRUD
- `GET/POST /api/deals/:id/documents` - Document management
- `POST /api/documents/:id/process` - AI document processing
- `GET/POST/DELETE /api/deals/:id/messages` - Deal chat
- `POST /api/deals/:id/generate-summary` - AI summary generation (SSE, includes summaryContext)
- `POST /api/deals/:id/generate-analysis` - AI analysis generation (SSE, includes analysisContext)
- `GET /api/deals/:id/activities` - Activity timeline
- `POST /api/uploads/request-url` - Object Storage upload URL

## Integrations
- Replit AI Integrations (OpenAI) - Chat, analysis, document processing
- Replit Object Storage - Secure document file storage with real file upload

## Running
- `npm run dev` starts both frontend and backend on port 5000
- `npm run db:push` syncs database schema
