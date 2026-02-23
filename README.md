# Edwin Slides Creator

AI-powered presentation generator that creates professional slide decks using multiple LLM providers (OpenAI, Anthropic Claude, Google Gemini, PwC Shared Services, AWS Bedrock).

## Project Structure

```
.
├── slide-generator/    # React + Vite frontend (port 5173)
├── backend/            # Express API server (port 3001)
├── gpt-export/         # ChatGPT custom GPT knowledge files
├── examples/           # Sample HTML decks and templates
└── docs/plans/         # Architecture and feature planning docs
```

## Features

- AI slide generation with multi-provider support
- Agentic workflow (consulting team agent with manager/worker roles)
- Monaco-based slide editor (HTML/CSS)
- PowerPoint (.pptx) export via PptxGenJS
- Knowledge base / RAG for contextual generation
- Theme and template system with CSS variables
- Enterprise backend with JWT auth, organizations, and audit logging

## Prerequisites

- **Node.js** 18+
- **Docker** (for PostgreSQL, Redis, MinIO)
- An LLM API key (OpenAI, PwC Shared Services, or another supported provider)

## Quick Start

### 1. Start infrastructure (PostgreSQL, Redis, MinIO)

```bash
cd backend
docker-compose up -d
```

### 2. Backend

```bash
cd backend
cp .env.example .env    # Edit with real values (JWT_SECRET, ENCRYPTION_KEY, etc.)
npm install
npm run migrate
npm run dev             # Runs on http://localhost:3001
```

### 3. Frontend

```bash
cd slide-generator
npm install
npm run dev             # Runs on http://localhost:5173
```

The frontend proxies `/api` requests to the backend automatically.

### 4. Configure AI provider

Open the app at `http://localhost:5173`, go to **Settings**, select a provider, and enter your API key.

## Environment Variables

See `backend/.env.example` for the full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `ENCRYPTION_KEY` | Key for encrypting stored API keys |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 7, Monaco Editor |
| Backend | Express, TypeScript, PostgreSQL, Redis |
| Export | PptxGenJS, html2canvas, jsPDF |
| AI | OpenAI, Anthropic, Google Gemini, PwC Shared Services |
| Infra | Docker (Postgres 16, Redis 7, MinIO) |
