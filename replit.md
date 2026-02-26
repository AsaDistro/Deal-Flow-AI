# DealFlow AI - M&A/PE Deal Tracking CRM

## Overview
AI-first M&A and Private Equity deal tracking platform with chat-first interface, secure document storage, and automated deal analysis.

## Architecture
- **Frontend**: React + TypeScript with Vite, Tailwind CSS, Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-4.1 for chat/analysis)
- **Storage**: Replit Object Storage for document files

## Key Files
- `shared/schema.ts` - Database schema (deals, deal_stages, documents, deal_messages, deal_activities)
- `server/routes.ts` - All API endpoints
- `server/storage.ts` - Database storage interface (DatabaseStorage class)
- `server/openai.ts` - OpenAI client and prompt templates
- `server/db.ts` - Database connection
- `client/src/App.tsx` - App router with sidebar layout
- `client/src/pages/dashboard.tsx` - Deal pipeline dashboard
- `client/src/pages/deal-detail.tsx` - Deal detail with chat, dataroom, summary, analysis tabs
- `client/src/components/app-sidebar.tsx` - Navigation sidebar

## Database Tables
- `users` - User accounts
- `deal_stages` - Customizable pipeline stages (seeded with defaults)
- `deals` - Deal records with financials and AI-generated content
- `documents` - Document metadata linked to deals
- `deal_messages` - Per-deal chat history
- `deal_activities` - Activity timeline per deal

## API Routes
- `GET/POST /api/stages` - Stage management
- `POST /api/stages/seed` - Seed default stages
- `GET/POST/PATCH/DELETE /api/deals` - Deal CRUD
- `GET/POST /api/deals/:id/documents` - Document management
- `POST /api/documents/:id/process` - AI document processing
- `GET/POST/DELETE /api/deals/:id/messages` - Deal chat
- `POST /api/deals/:id/generate-summary` - AI summary generation (SSE)
- `POST /api/deals/:id/generate-analysis` - AI analysis generation (SSE)
- `GET /api/deals/:id/activities` - Activity timeline
- `POST /api/uploads/request-url` - Object Storage upload URL

## Integrations
- Replit AI Integrations (OpenAI) - Chat, analysis, document processing
- Replit Object Storage - Secure document file storage

## Running
- `npm run dev` starts both frontend and backend on port 5000
- `npm run db:push` syncs database schema
