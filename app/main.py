"""Fundlark: local-first, open-source funding discovery MVP."""
import csv
import io
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

from docx import Document
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, StringConstraints
from pypdf import PdfReader

from . import connectors, matching, storage, profiles

STATIC = Path(__file__).parent / "static"
MAX_FILE_BYTES = 8 * 1024 * 1024


@asynccontextmanager
async def lifespan(app):
    storage.init_db()
    yield


app = FastAPI(title="Fundlark API", description="Research funding search and transparent profile matching", version="0.1.0", lifespan=lifespan)
app.mount("/static",StaticFiles(directory=STATIC),name="static")


class MatchInput(BaseModel):
    keywords: list[Annotated[str, Field(max_length=120)]] = Field(default_factory=list, max_length=30)
    career_stage: str = "unspecified"
    query: str = Field(default="", max_length=300)


class SyncInput(BaseModel):
    queries: list[Annotated[str, StringConstraints(min_length=1, max_length=100, strip_whitespace=True)]] = Field(default_factory=list, max_length=5)


class SourceProfileInput(BaseModel):
    keywords: list[Annotated[str, Field(max_length=120)]] = Field(default_factory=list, max_length=30)
    societies: list[Annotated[str, Field(max_length=160)]] = Field(default_factory=list, max_length=20)
    institutions: list[Annotated[str, Field(max_length=160)]] = Field(default_factory=list, max_length=20)


@app.post("/api/profile/sources")
async def profile_sources(payload: SourceProfileInput):
    return profiles.recommend_sources(connectors.SOURCES, payload.keywords, payload.societies, payload.institutions)


class SourceReviewInput(BaseModel):
    content_hash: str = Field(pattern=r"^[a-f0-9]{64}$")
    note: str = Field(min_length=3, max_length=1000)


class CandidateReviewInput(BaseModel):
    status: Literal["unreviewed", "shortlisted", "dismissed"]
    note: str = Field(default="", max_length=1000)


@app.get("/")
async def home():
    return FileResponse(STATIC / "index.html")


@app.get("/api/health")
async def health():
    return {"ok":True,"version":"0.1.0","mode":"local-first"}


@app.get("/api/opportunities")
async def opportunities():
    return storage.get_opportunities()


@app.post("/api/match")
async def match(payload:MatchInput):
    return matching.match_all(storage.get_opportunities(),payload.keywords,payload.career_stage,payload.query)


@app.get("/api/overview")
async def overview():
    opportunities = storage.get_opportunities()
    from datetime import date, timedelta
    upcoming = date.today() + timedelta(days=14)
    return {
        "total":len(opportunities),
        "industry":sum(x["category"]=="Industry" for x in opportunities),
        "closing_soon":sum(x["status"]=="open" and bool(x["deadline"]) and date.today().isoformat()<=x["deadline"]<=upcoming.isoformat() for x in opportunities),
        "source_count":len(connectors.SOURCES),
        "live_api_results":sum(x["origin"]!="curated" for x in opportunities),
        "last_sync":storage.sync_history()[:1],
    }


@app.get("/api/sources")
async def sources():
    state = storage.get_source_checks()
    return [{**x,"check":state.get(x["id"])} for x in connectors.SOURCES]


@app.post("/api/sync/federal")
async def sync_federal(payload:SyncInput):
    return await connectors.sync_federal(payload.queries or None)


@app.post("/api/sync/monitor")
async def sync_monitor():
    checks=await connectors.check_industry_sources()
    return {"results":checks,"checked":len(checks),
            "changed":sum(x["status"]=="changed" for x in checks),
            "failed":sum(x["status"]=="error" for x in checks),
            "skipped":sum(x["status"]=="skipped" for x in checks)}


@app.get("/api/sources/{source_id}/changes")
async def source_changes(source_id: str):
    if not any(s["id"] == source_id and s["mode"] == "watch" for s in connectors.SOURCES):
        raise HTTPException(404, "Monitored source not found.")
    return storage.source_changes(source_id)


@app.post("/api/sources/{source_id}/review")
async def review_source(source_id: str, payload: SourceReviewInput):
    if not any(s["id"] == source_id and s["mode"] == "watch" for s in connectors.SOURCES):
        raise HTTPException(404, "Monitored source not found.")
    if not payload.note.strip():
        raise HTTPException(422, "Enter a review note.")
    try:
        storage.review_source(source_id, payload.content_hash, payload.note.strip())
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {"reviewed": True, "message": "Page review recorded. Opportunity claims remain unchanged."}


@app.get("/api/candidates")
async def candidates(status: Literal["unreviewed", "shortlisted", "dismissed", "all"] = "unreviewed"):
    return storage.get_candidate_links(status=None if status == "all" else status)


@app.patch("/api/candidates/{candidate_id}")
async def review_candidate(candidate_id: str, payload: CandidateReviewInput):
    try:
        return storage.review_candidate(candidate_id, payload.status, payload.note.strip())
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/api/sync/history")
async def history():
    return storage.sync_history()


@app.post("/api/profile/extract")
async def extract_cv(file:UploadFile=File(...)):
    name = (file.filename or "").lower()
    ext = Path(name).suffix
    if ext not in {".pdf",".docx",".txt"}:
        raise HTTPException(415,"Upload a PDF, DOCX or TXT file.")
    raw = await file.read(MAX_FILE_BYTES+1)
    await file.close()
    if len(raw)>MAX_FILE_BYTES:
        raise HTTPException(413,"Maximum CV size is 8 MB.")
    try:
        if ext==".pdf":
            reader=PdfReader(io.BytesIO(raw),strict=False)
            if len(reader.pages)>60:
                raise ValueError("Too many PDF pages")
            text="\n".join(p.extract_text() or "" for p in reader.pages)
        elif ext==".docx":
            doc=Document(io.BytesIO(raw))
            text="\n".join(p.text for p in doc.paragraphs)
        else:
            text=raw.decode("utf-8-sig",errors="replace")
    except Exception as e:
        raise HTTPException(422,"Could not extract text. Try a text-based PDF, DOCX or TXT CV.") from e
    if not text.strip():
        raise HTTPException(422,"No extractable text found. Scanned PDFs require OCR (not enabled).")
    return {"keywords":matching.extract_keywords(text),"affiliations":profiles.extract_affiliations(text),"characters_processed":len(text),
            "privacy":"Document processed in memory and discarded; no CV uploaded to third-party AI APIs."}


@app.get("/api/export.csv")
async def export_csv():
    output=io.StringIO()
    columns=["title","funder","category","funding_type","amount","deadline","status","url","last_verified_at","origin"]
    w=csv.DictWriter(output,fieldnames=columns,extrasaction="ignore")
    w.writeheader()
    # Quoting alone does not prevent spreadsheet formula execution.
    for opportunity in storage.get_opportunities():
        w.writerow({key: "'" + value if isinstance(value, str)
                    and value.lstrip().startswith(("=", "+", "-", "@")) else value
                    for key, value in opportunity.items()})
    output.seek(0)
    return StreamingResponse(iter([output.getvalue()]),media_type="text/csv",
                             headers={"Content-Disposition":"attachment; filename=fundlark-opportunities.csv"})
