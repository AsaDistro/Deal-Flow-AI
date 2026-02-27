# DealFlow AI

-------------------------------------------------------------------------------
Language                     files          blank        comment           code
-------------------------------------------------------------------------------
JSON                             4              0              0          10357
TypeScript                      93           1049            482           8750
CSS                              1             25              1            228
JavaScript                       2             11              7            100
Markdown                         1              9              0             57
HTML                             1              0              0             15
-------------------------------------------------------------------------------
SUM:                           102           1094            490          19507
-------------------------------------------------------------------------------

An AI-first M&A and Private Equity deal tracking CRM with a chat-first interface, secure document storage, and automated deal analysis.

## Features

- **Deal Pipeline Management** – Kanban-style board with customizable stages for tracking deals through your M&A/PE workflow
- **AI Chat per Deal** – Chat with an AI assistant that has full context of each deal, its documents, and financials
- **Automated AI Summaries & Analysis** – Generate investment summaries and detailed analyses with one click (streamed via SSE)
- **Document Data Room** – Upload and manage deal documents (PDF, XLSX, DOCX, CSV, etc.) with secure cloud storage
- **Create Deal from Document** – Upload a document and let AI extract deal info and create the deal automatically
- **Activity Timeline** – Automatically tracked activity log per deal
- **Mobile Responsive** – Full mobile support with a slide-out navigation drawer

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Shadcn UI |
| Backend | Express.js, TypeScript, Node.js |
| Database | PostgreSQL via Drizzle ORM |
| AI | OpenAI (GPT) via Replit AI Integrations |
| Storage | Replit Object Storage (document file uploads) |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- OpenAI API key (configured via Replit AI Integrations)

### Installation

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start development server (frontend + backend on port 5000)
npm run dev
```

### Build for Production

```bash
npm run build
npm run start
```

## Project Structure

```
├── client/          # React frontend
│   └── src/
│       ├── pages/   # Dashboard, Deal Detail
│       └── components/
├── server/          # Express backend
│   ├── routes.ts    # All API endpoints
│   ├── storage.ts   # Database storage interface
│   ├── openai.ts    # AI client & prompt templates
│   └── document-extractor.ts
├── shared/
│   └── schema.ts    # Database schema (Drizzle ORM)
└── script/          # Build scripts
```

## Database Schema

- **users** – User accounts
- **deal_stages** – Customizable pipeline stages (seeded with defaults)
- **deals** – Deal records with financials (valuation/revenue/EBITDA in $M), AI-generated summaries and analyses
- **documents** – Document metadata linked to deals
- **deal_messages** – Per-deal AI chat history
- **deal_activities** – Activity timeline per deal

## API Overview

| Method | Route | Description |
|--------|-------|-------------|
| GET/POST | `/api/stages` | Stage management |
| GET/POST/PATCH/DELETE | `/api/deals` | Deal CRUD |
| POST | `/api/deals/create-from-document` | Create deal from uploaded document via AI |
| GET/POST | `/api/deals/:id/documents` | Document management |
| POST | `/api/deals/:id/messages` | Deal AI chat |
| POST | `/api/deals/:id/generate-summary` | Streaming AI summary (SSE) |
| POST | `/api/deals/:id/generate-analysis` | Streaming AI analysis (SSE) |
| POST | `/api/uploads/request-url` | Object Storage upload URL |

## License

MIT
