# AI Workflow Document — AGENTS.md

## AI Tools Used
- **Claude (claude.ai)** — Primary coding assistant for architecture design, full code generation, and debugging
- **Google Gemini 1.5 Flash** — Runtime AI for OCR/data extraction from document images

## How AI Was Used

### Architecture & Planning
Claude designed the overall system architecture: FastAPI + SQLite backend with Gemini vision API, React frontend with multi-page navigation (no router dependency), confidence scoring schema, and validation rule set.

### Code Generation
Claude generated ~95% of the code in one structured session:
- Complete FastAPI backend (`main.py`) with all endpoints
- SQLite database initialisation and all CRUD operations  
- Gemini prompt engineering for manufacturing field extraction
- All 4 React pages (Dashboard, Upload, Review, History)
- Reusable components (Navbar, ConfidenceBadge, StatusBadge)
- Recharts integration for analytics visualisations
- Tailwind CSS styling throughout

### Prompting Strategy
- Provided the full assignment PDF as context
- Asked Claude to plan then implement each layer (backend → components → pages)
- Used iterative refinement: "add validation for shift values", "add duplicate WO detection"
- Specified exact JSON schema for Gemini extraction prompt to ensure consistent output

### Areas Where AI Helped Most
- Designing the extraction schema with confidence scoring
- Writing the Gemini vision API integration (base64 encoding, prompt engineering)
- Recharts dashboard with multiple chart types
- Validation logic covering all assignment requirements
- Editable review form with per-field issue display

### Areas Requiring Manual Intervention
- API key configuration and environment setup
- Testing with real handwritten document images
- Fine-tuning the Gemini prompt for specific document formats
- Adjusting CORS settings for local development

## Prompting & Debugging Workflow
1. Share assignment PDF → get architectural overview from Claude
2. Ask for backend first (`main.py` with all endpoints)
3. Ask for frontend page by page, providing context about backend API shape
4. For bugs: paste error → Claude identifies fix and explains root cause
