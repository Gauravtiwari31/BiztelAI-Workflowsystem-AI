# BiztelAI – AI-Powered Workflow Automation System

A full-stack web application that digitises handwritten/semi-structured manufacturing operational documents using **Google Gemini 1.5 Flash** for OCR/extraction, with a review workflow, confidence scoring, validation, and operational analytics dashboard.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  React Frontend (port 3000)                          │
│  Dashboard | Upload | Review | History               │
└──────────────────┬───────────────────────────────────┘
                   │ REST API
┌──────────────────▼───────────────────────────────────┐
│  FastAPI Backend (port 8000)                         │
│  /process-document  /review  /history  /dashboard   │
└──────────────────┬──────────────┬────────────────────┘
                   │              │
          Gemini 1.5 Flash     SQLite DB
          (Vision + Text)      (records.db)
```

## Features

| Feature | Details |
|---|---|
| Document Upload | PDF, PNG, JPG, TIFF, BMP, WEBP |
| AI Extraction | Gemini 1.5 Flash vision model |
| Extracted Fields | Date, Shift, Employee #, Operation Code, Machine #, Work Order #, Qty Produced, Time Taken |
| Confidence Scoring | Per-field confidence 0–100% with colour coding |
| Validation | Missing fields, invalid shift, qty range, machine code format, duplicate work orders |
| Review Workflow | Editable form per field, re-validates on save |
| Dashboard | KPIs, shift charts, machine summaries, quantity analytics, upload timeline |
| History | Search by filename, filter by status, paginated |

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and set GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (required) |

## Assumptions & Tradeoffs

- SQLite used for simplicity — swap for PostgreSQL in production
- PDF pages are rendered as images (200 DPI) for Gemini vision input
- Confidence scores are AI-estimated (Gemini self-reports certainty)
- Duplicate work order detection uses simple string match in SQLite JSON
- No authentication — add JWT middleware for production

## Tech Stack

- **Backend:** FastAPI, PyMuPDF, google-generativeai, SQLite
- **Frontend:** React 19, Tailwind CSS, Recharts, Lucide Icons
- **AI:** Google Gemini 1.5 Flash
