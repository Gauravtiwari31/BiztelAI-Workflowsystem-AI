from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import fitz  # PyMuPDF
import json, os, logging, base64, sqlite3, uuid
from datetime import datetime
from pathlib import Path

# ── dotenv ────────────────────────────────────────────────────────────────────
from dotenv import load_dotenv
_env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_env_path, override=True)
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Gemini state ──────────────────────────────────────────────────────────────
_gemini_model  = None   # GenerativeModel instance
_active_model  = None   # model name string e.g. "models/gemini-2.0-flash"

def _save_env(key: str, value: str):
    env_path = Path(__file__).parent / ".env"
    env_dict: dict = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env_dict[k.strip()] = v.strip()
    env_dict[key] = value
    env_path.write_text("\n".join(f"{k}={v}" for k, v in env_dict.items()) + "\n")

def init_gemini(api_key: str = "", model_name: str = "") -> tuple:
    global _gemini_model, _active_model
    key   = (api_key   or os.getenv("GEMINI_API_KEY", "")).strip()
    model = (model_name or os.getenv("GEMINI_MODEL",   "")).strip()
    if not key:
        _gemini_model = _active_model = None
        return False, "No GEMINI_API_KEY provided."
    if not model:
        _gemini_model = _active_model = None
        return False, "No Gemini model selected."
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        _gemini_model  = genai.GenerativeModel(model)
        _active_model  = model
        os.environ["GEMINI_API_KEY"] = key
        os.environ["GEMINI_MODEL"]   = model
        logger.info(f"Gemini configured: {model}")
        return True, None
    except Exception as e:
        _gemini_model = _active_model = None
        return False, str(e)

_ok, _err = init_gemini()
if not _ok:
    logger.warning(f"Gemini not ready at startup: {_err}")

# ── Database ──────────────────────────────────────────────────────────────────
DB_PATH = Path(__file__).parent / "records.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS records (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            upload_time TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            raw_extracted TEXT,
            reviewed_data TEXT,
            validation_issues TEXT,
            review_time TEXT,
            file_type TEXT DEFAULT 'pdf',
            row_index INTEGER DEFAULT 0,
            batch_id TEXT
        )
    """)
    for col in ("row_index INTEGER DEFAULT 0", "batch_id TEXT"):
        try:
            conn.execute(f"ALTER TABLE records ADD COLUMN {col}")
        except Exception:
            pass
    conn.commit()
    conn.close()

init_db()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="BiztelAI Workflow API", version="5.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic models ───────────────────────────────────────────────────────────
class ValidationIssue(BaseModel):
    field: str
    severity: str
    message: str

class ReviewUpdate(BaseModel):
    record_id: str
    reviewed_data: Dict[str, Any]

class GeminiKeyPayload(BaseModel):
    gemini_key: str = ""
    model_name: str = ""

# ── Extraction prompt ─────────────────────────────────────────────────────────
EXTRACTION_PROMPT = """
You are an OCR extraction assistant for handwritten manufacturing/operational data sheets.

The document may contain a TABLE with MULTIPLE ROWS of data. Each row is one production record.

Extract ALL rows you can see. Return ONLY valid JSON (no markdown, no preamble, no explanation):

{
  "rows": [
    {
      "date":             {"value": null, "confidence": 0.0, "flagged": false},
      "shift":            {"value": null, "confidence": 0.0, "flagged": false},
      "employee_number":  {"value": null, "confidence": 0.0, "flagged": false},
      "operation_code":   {"value": null, "confidence": 0.0, "flagged": false},
      "machine_number":   {"value": null, "confidence": 0.0, "flagged": false},
      "work_order_number":{"value": null, "confidence": 0.0, "flagged": false},
      "quantity_produced":{"value": null, "confidence": 0.0, "flagged": false},
      "time_taken":       {"value": null, "confidence": 0.0, "flagged": false}
    }
  ],
  "raw_text": ""
}

Rules:
- rows: one object per data row found. 3 rows of data → 3 objects.
- confidence: 0.0-1.0 per field
- flagged: true if illegible or suspicious
- shift: use exactly what is written (I, II, III, A, B, Morning etc.)
- quantity_produced: numeric value only
- date: DD-MM-YYYY preferred
- raw_text: all readable text concatenated
- Skip completely blank rows
"""

def _parse_ai_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        text = parts[1] if len(parts) > 1 else text
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())

def _normalise_extraction(raw: dict) -> dict:
    if "rows" in raw and isinstance(raw["rows"], list):
        return raw
    row = {k: v for k, v in raw.items() if k != "raw_text"}
    return {"rows": [row], "raw_text": raw.get("raw_text", "")}

def extract_with_gemini(image_bytes: bytes, mime_type: str) -> dict:
    if _gemini_model is None:
        raise RuntimeError("Gemini not configured. Add your API key and select a model in Settings.")
    b64 = base64.b64encode(image_bytes).decode()
    response = _gemini_model.generate_content([
        EXTRACTION_PROMPT,
        {"mime_type": mime_type, "data": b64},
    ])
    return _normalise_extraction(_parse_ai_json(response.text))

def extract_from_image_bytes(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    return extract_with_gemini(image_bytes, mime_type)

def extract_from_pdf(pdf_bytes: bytes) -> dict:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        all_rows, raw_texts = [], []
        for page in doc:
            pix = page.get_pixmap(dpi=200)
            result = extract_from_image_bytes(pix.tobytes("png"), "image/png")
            all_rows.extend(result.get("rows", []))
            raw_texts.append(result.get("raw_text", ""))
    finally:
        doc.close()
    return {"rows": all_rows, "raw_text": "\n".join(raw_texts)}

# ── Validation ────────────────────────────────────────────────────────────────
VALID_SHIFTS = {"morning","day","evening","night","a","b","c","i","ii","iii","1","2","3"}

def validate_record(data: dict, record_id: str) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    for field in ["date", "work_order_number", "quantity_produced"]:
        fv  = data.get(field, {})
        val = fv.get("value") if isinstance(fv, dict) else fv
        if val is None or str(val).strip() in ("", "null", "None"):
            issues.append(ValidationIssue(field=field, severity="error",
                message=f"Mandatory field '{field}' is missing"))
    shift_fv  = data.get("shift", {})
    shift_val = (shift_fv.get("value") if isinstance(shift_fv, dict) else shift_fv) or ""
    if shift_val and str(shift_val).lower() not in VALID_SHIFTS:
        issues.append(ValidationIssue(field="shift", severity="warning",
            message=f"Unrecognised shift '{shift_val}'"))
    qty_fv  = data.get("quantity_produced", {})
    qty_val = qty_fv.get("value") if isinstance(qty_fv, dict) else qty_fv
    if qty_val not in (None, "", "null", "None"):
        try:
            qty = float(qty_val)
            if qty <= 0:
                issues.append(ValidationIssue(field="quantity_produced", severity="error",
                    message="Quantity must be > 0"))
            elif qty > 100000:
                issues.append(ValidationIssue(field="quantity_produced", severity="warning",
                    message=f"Suspiciously large: {qty}"))
        except (ValueError, TypeError):
            issues.append(ValidationIssue(field="quantity_produced", severity="error",
                message="Quantity must be a number"))
    for field, fv in data.items():
        if field == "raw_text":
            continue
        if isinstance(fv, dict) and fv.get("confidence", 1) < 0.5 and fv.get("value") is not None:
            if not any(i.field == field for i in issues):
                issues.append(ValidationIssue(field=field, severity="warning",
                    message=f"Low confidence ({fv['confidence']:.0%}) for '{field}'"))
    return issues

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "BiztelAI Workflow API v5.0", "status": "online"}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "ai_backend": "gemini" if _gemini_model else "none",
        "ai_ready": _gemini_model is not None,
        "active_model": _active_model or "",
    }

@app.get("/api-key-status")
async def api_key_status():
    gkey = os.getenv("GEMINI_API_KEY", "")
    def mask(k): return k[:6] + "..." + k[-4:] if len(k) > 10 else ("***" if k else "")
    return {
        "configured": _gemini_model is not None,
        "gemini_key": mask(gkey),
        "active_model": _active_model or "",
    }

@app.get("/list-models")
async def list_models():
    """Return Gemini models that support generateContent."""
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        raise HTTPException(400, "GEMINI_API_KEY not set. Save your key first.")
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        all_models = genai.list_models()
        result = []
        for m in all_models:
            if "generateContent" in (m.supported_generation_methods or []):
                name = m.name
                display = name.replace("models/", "")
                result.append({
                    "name": name,
                    "display_name": display,
                    "description": getattr(m, "description", ""),
                })
        def sort_key(m):
            d = m["display_name"]
            if "flash" in d and "2.5" in d: return 0
            if "flash" in d and "2.0" in d: return 1
            if "flash" in d: return 2
            if "pro"   in d and "2.5" in d: return 3
            if "pro"   in d: return 4
            return 5
        result.sort(key=sort_key)
        return {"models": result}
    except Exception as e:
        raise HTTPException(500, f"Failed to list models: {e}")

@app.post("/set-api-key")
async def set_api_key(payload: GeminiKeyPayload):
    gkey  = payload.gemini_key.strip()
    model = payload.model_name.strip()

    # Fall back to existing values if not changing
    if not gkey:
        gkey = os.getenv("GEMINI_API_KEY", "").strip()
    if not model:
        model = os.getenv("GEMINI_MODEL", "").strip()

    if not gkey:
        raise HTTPException(400, "GEMINI_API_KEY is required.")
    if not model:
        raise HTTPException(400, "A Gemini model must be selected.")

    _save_env("GEMINI_API_KEY", gkey)
    _save_env("GEMINI_MODEL",   model)

    ok, err = init_gemini(api_key=gkey, model_name=model)
    if not ok:
        raise HTTPException(400, f"Gemini configuration failed: {err}")

    display = model.replace("models/", "")
    return {
        "success": True,
        "active_model": _active_model,
        "message": f"Configured with model: {display}",
    }

@app.post("/process-document")
async def process_document(file: UploadFile = File(...)):
    if _gemini_model is None:
        raise HTTPException(503,
            "Gemini not configured. Add GEMINI_API_KEY and select a model in Settings.")
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower()
    allowed = {"pdf", "png", "jpg", "jpeg", "tiff", "bmp", "webp"}
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type '{ext}'")
    content    = await file.read()
    upload_time = datetime.utcnow().isoformat()
    batch_id    = str(uuid.uuid4())
    try:
        if ext == "pdf":
            extraction = extract_from_pdf(content)
        else:
            mime_map = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png",
                        "tiff":"image/tiff","bmp":"image/bmp","webp":"image/webp"}
            extraction = extract_from_image_bytes(content, mime_map.get(ext, "image/jpeg"))
        rows     = extraction.get("rows", [])
        raw_text = extraction.get("raw_text", "")
        if not rows:
            return {"batch_id": batch_id, "filename": filename, "success": False,
                    "total_rows": 0, "records": [], "error": "AI returned no rows"}
        results = []
        conn = get_db()
        for idx, row_data in enumerate(rows):
            row_data["raw_text"] = raw_text
            record_id = str(uuid.uuid4())
            issues    = validate_record(row_data, record_id)
            status    = "error" if any(i.severity == "error" for i in issues) \
                        else ("warning" if issues else "ok")
            conn.execute(
                "INSERT INTO records (id,filename,upload_time,status,raw_extracted,"
                "validation_issues,file_type,row_index,batch_id) VALUES (?,?,?,?,?,?,?,?,?)",
                (record_id, filename, upload_time, status,
                 json.dumps(row_data), json.dumps([i.dict() for i in issues]),
                 ext, idx, batch_id))
            results.append({
                "record_id": record_id, "row_index": idx,
                "extracted": row_data,
                "validation_issues": [i.dict() for i in issues],
                "status": status,
            })
        conn.commit(); conn.close()
        return {"batch_id": batch_id, "filename": filename, "success": True,
                "total_rows": len(results), "records": results,
                "ai_backend": "gemini", "model": _active_model}
    except Exception as e:
        logger.error(f"Processing error for {filename}: {e}", exc_info=True)
        return {"batch_id": None, "filename": filename, "success": False,
                "total_rows": 0, "records": [], "error": str(e)}

@app.post("/review")
async def save_review(update: ReviewUpdate):
    conn = get_db()
    row  = conn.execute("SELECT id FROM records WHERE id=?", (update.record_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Record not found")
    issues = validate_record(update.reviewed_data, update.record_id)
    conn.execute(
        "UPDATE records SET reviewed_data=?,status='reviewed',validation_issues=?,review_time=? WHERE id=?",
        (json.dumps(update.reviewed_data), json.dumps([i.dict() for i in issues]),
         datetime.utcnow().isoformat(), update.record_id))
    conn.commit(); conn.close()
    return {"success": True, "validation_issues": [i.dict() for i in issues]}

@app.get("/record/{record_id}")
async def get_record(record_id: str):
    conn = get_db()
    row  = conn.execute("SELECT * FROM records WHERE id=?", (record_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Record not found")
    r = dict(row)
    for col in ("raw_extracted", "reviewed_data", "validation_issues"):
        if r.get(col):
            r[col] = json.loads(r[col])
    return r

@app.get("/history")
async def get_history(search: str = "", status: str = "", limit: int = 50, offset: int = 0):
    conn = get_db()
    q = "SELECT id,filename,upload_time,status,file_type,review_time,row_index,batch_id FROM records WHERE 1=1"
    params: list = []
    if search: q += " AND filename LIKE ?"; params.append(f"%{search}%")
    if status: q += " AND status=?";       params.append(status)
    q += " ORDER BY upload_time DESC, row_index ASC LIMIT ? OFFSET ?"
    params += [limit, offset]
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/dashboard")
async def dashboard():
    conn  = get_db()
    total = conn.execute("SELECT COUNT(*) FROM records").fetchone()[0]
    by_status: Dict[str, int] = {}
    for row in conn.execute("SELECT status, COUNT(*) as n FROM records GROUP BY status"):
        by_status[row[0]] = row[1]
    shifts: Dict[str, int]       = {}
    qty_by_shift: Dict[str, float] = {}
    machine_counts: Dict[str, int] = {}
    total_qty  = 0.0
    daily_uploads: Dict[str, int]  = {}
    for row in conn.execute("SELECT raw_extracted, upload_time FROM records WHERE raw_extracted IS NOT NULL"):
        try:
            d     = json.loads(row[0])
            shift = (d.get("shift") or {}).get("value") or "Unknown"
            shifts[shift] = shifts.get(shift, 0) + 1
            qty_raw = (d.get("quantity_produced") or {}).get("value")
            if qty_raw is not None:
                try:
                    qty = float(qty_raw); total_qty += qty
                    qty_by_shift[shift] = qty_by_shift.get(shift, 0) + qty
                except Exception: pass
            mach = (d.get("machine_number") or {}).get("value") or "Unknown"
            machine_counts[mach] = machine_counts.get(mach, 0) + 1
        except Exception: pass
        try:
            day = row[1][:10]; daily_uploads[day] = daily_uploads.get(day, 0) + 1
        except Exception: pass
    recent = [dict(r) for r in conn.execute(
        "SELECT id,filename,upload_time,status,row_index FROM records ORDER BY upload_time DESC LIMIT 7").fetchall()]
    conn.close()
    return {"total_uploads": total, "by_status": by_status,
            "validation_errors": by_status.get("error", 0),
            "validation_warnings": by_status.get("warning", 0),
            "shift_summary": shifts, "total_quantity": total_qty,
            "quantity_by_shift": qty_by_shift, "machine_summary": machine_counts,
            "daily_uploads": daily_uploads, "recent_uploads": recent}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
