"""SQLite catalog storage. No researcher CVs or profiles are stored server-side."""
import json
import os
import sqlite3
import difflib
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path

APP_DIR = Path(__file__).parent
# New installations use fundlark.sqlite3. Existing OpenGrant MVP data is picked up automatically.
_default_db = APP_DIR.parent / "data" / "fundlark.sqlite3"
_legacy_db = APP_DIR.parent / "data" / "opengrant.sqlite3"
DB_PATH = Path(os.getenv("FUNDLARK_DB") or os.getenv("OPENGRANT_DB") or (
    _legacy_db if _legacy_db.exists() and not _default_db.exists() else _default_db
))


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    try:
        yield db
        db.commit()
    finally:
        db.close()


def init_db():
    with connect() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS opportunities (
            id TEXT PRIMARY KEY, title TEXT NOT NULL, funder TEXT NOT NULL,
            category TEXT NOT NULL, funding_type TEXT, amount TEXT,
            deadline TEXT, status TEXT NOT NULL, description TEXT,
            topics TEXT NOT NULL DEFAULT '[]', eligibility TEXT,
            eligible_stages TEXT NOT NULL DEFAULT '[]',
            faculty_sponsor_possible INTEGER NOT NULL DEFAULT 0,
            url TEXT NOT NULL, source_date TEXT,
            origin TEXT NOT NULL DEFAULT 'curated',
            last_checked_at TEXT, last_verified_at TEXT,
            review_needed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS source_checks (
            source_id TEXT PRIMARY KEY, checked_at TEXT, status TEXT,
            content_hash TEXT, message TEXT, last_changed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS candidate_links (
            id TEXT PRIMARY KEY, source_id TEXT NOT NULL,
            title TEXT NOT NULL, url TEXT NOT NULL,
            first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'unreviewed'
        );
        CREATE INDEX IF NOT EXISTS candidate_source ON candidate_links(source_id);
        CREATE TABLE IF NOT EXISTS sync_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            started_at TEXT NOT NULL, finished_at TEXT,
            source TEXT NOT NULL, imported INTEGER NOT NULL DEFAULT 0,
            errors TEXT NOT NULL DEFAULT '[]'
        );
        CREATE INDEX IF NOT EXISTS opp_category ON opportunities(category);
        CREATE INDEX IF NOT EXISTS opp_deadline ON opportunities(deadline);
        CREATE TABLE IF NOT EXISTS source_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL,
            observed_at TEXT NOT NULL, content_hash TEXT NOT NULL,
            content TEXT NOT NULL, url TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS snapshot_source ON source_snapshots(source_id, id);
        CREATE TABLE IF NOT EXISTS source_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL,
            content_hash TEXT NOT NULL, reviewed_at TEXT NOT NULL, note TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS candidate_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id TEXT NOT NULL,
            reviewed_at TEXT NOT NULL, status TEXT NOT NULL, note TEXT NOT NULL
        );
        """)
        # Additive migrations preserve databases from the original MVP.
        for table, columns in {
            "opportunities": {"affiliation_tags": "TEXT NOT NULL DEFAULT '{}'"},
            "source_checks": {"review_needed": "INTEGER NOT NULL DEFAULT 0", "etag": "TEXT",
                              "last_modified": "TEXT", "final_url": "TEXT"},
            "candidate_links": {"reviewed_at": "TEXT", "review_note": "TEXT"},
        }.items():
            existing = {row["name"] for row in db.execute(f"PRAGMA table_info({table})")}
            for column, definition in columns.items():
                if column not in existing:
                    db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
                    if table == "source_checks" and column == "review_needed":
                        db.execute("UPDATE source_checks SET review_needed=1 WHERE last_changed_at IS NOT NULL")
        catalog = json.loads((APP_DIR / "catalog.json").read_text())
        catalog.extend(json.loads((APP_DIR / "coverage_catalog.json").read_text()))
        for item in catalog:
            insert_opportunity(db, item, origin="curated", if_absent=True)


def insert_opportunity(db, item, origin="federal_api", if_absent=False):
    now = now_iso()
    record = (
        item["id"], item["title"], item["funder"], item["category"],
        item.get("funding_type"), item.get("amount"), item.get("deadline"),
        item.get("status", "verify"), item.get("description", ""),
        json.dumps(item.get("topics", [])), item.get("eligibility", ""),
        json.dumps(item.get("eligible_stages", [])),
        int(item.get("faculty_sponsor_possible", False)), item["url"],
        item.get("source_date"), origin, item.get("last_checked_at", now if origin != "curated" else None),
        item.get("last_verified_at", item.get("source_date") if origin == "curated" else now),
        int(bool(item.get("review_needed", False))), now, now, json.dumps(item.get("affiliation_tags", {}))
    )
    placeholders = ",".join("?" for _ in record)
    cols = "id,title,funder,category,funding_type,amount,deadline,status,description,topics,eligibility,eligible_stages,faculty_sponsor_possible,url,source_date,origin,last_checked_at,last_verified_at,review_needed,created_at,updated_at"
    cols += ",affiliation_tags"
    action = "INSERT OR IGNORE" if if_absent else "INSERT"
    update = "" if if_absent else " ON CONFLICT(id) DO UPDATE SET title=excluded.title,funder=excluded.funder,category=excluded.category,funding_type=excluded.funding_type,amount=excluded.amount,deadline=excluded.deadline,status=excluded.status,description=excluded.description,topics=excluded.topics,eligibility=excluded.eligibility,eligible_stages=excluded.eligible_stages,faculty_sponsor_possible=excluded.faculty_sponsor_possible,url=excluded.url,source_date=excluded.source_date,origin=excluded.origin,last_checked_at=excluded.last_checked_at,last_verified_at=excluded.last_verified_at,updated_at=excluded.updated_at"
    if update:
        update += ",affiliation_tags=excluded.affiliation_tags"
    db.execute(f"{action} INTO opportunities ({cols}) VALUES ({placeholders}){update}", record)


def dynamic_status(row):
    status = row["status"]
    deadline = row["deadline"]
    if deadline and deadline < date.today().isoformat():
        return "closed"
    return status


def decode_row(row):
    d = dict(row)
    d["affiliation_tags"] = json.loads(d.get("affiliation_tags") or "{}")
    d["topics"] = json.loads(d.get("topics") or "[]")
    d["eligible_stages"] = json.loads(d.get("eligible_stages") or "[]")
    d["faculty_sponsor_possible"] = bool(d["faculty_sponsor_possible"])
    d["review_needed"] = bool(d["review_needed"])
    d["status"] = dynamic_status(d)
    try:
        verified = date.fromisoformat((d.get("last_verified_at") or "")[:10])
        d["stale"] = (date.today() - verified).days > 30
    except ValueError:
        d["stale"] = True
    return d


def get_opportunities():
    with connect() as db:
        return [decode_row(r) for r in db.execute("SELECT * FROM opportunities ORDER BY created_at DESC").fetchall()]


def get_source_checks():
    with connect() as db:
        return {r["source_id"]: dict(r) for r in db.execute("SELECT * FROM source_checks").fetchall()}


def record_source_check(source_id, status, message, content_hash=None, *, content=None,
                        url=None, etag=None, last_modified=None):
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        previous = db.execute("SELECT content_hash FROM source_checks WHERE source_id=?", (source_id,)).fetchone()
        previous_hash = previous["content_hash"] if previous else None
        changed = bool(previous_hash and content_hash and previous_hash != content_hash)
        status = "changed" if changed else status
        checked_at = now_iso()
        db.execute("""
          INSERT INTO source_checks (source_id,checked_at,status,content_hash,message,last_changed_at,
                                     review_needed,etag,last_modified,final_url)
          VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET
          checked_at=excluded.checked_at,status=excluded.status,
          content_hash=COALESCE(excluded.content_hash,source_checks.content_hash),
          message=excluded.message,
          last_changed_at=CASE WHEN ? THEN excluded.checked_at ELSE source_checks.last_changed_at END,
          review_needed=MAX(source_checks.review_needed,excluded.review_needed),
          etag=CASE WHEN ? THEN excluded.etag ELSE source_checks.etag END,
          last_modified=CASE WHEN ? THEN excluded.last_modified ELSE source_checks.last_modified END,
          final_url=COALESCE(excluded.final_url,source_checks.final_url)
        """, (source_id, checked_at, status, content_hash, message, checked_at if changed else None,
              int(changed), etag, last_modified, url, int(changed), content_hash is not None,
              content_hash is not None))
        latest = db.execute("SELECT content_hash FROM source_snapshots WHERE source_id=? ORDER BY id DESC LIMIT 1",
                            (source_id,)).fetchone()
        if content is not None and (not latest or latest["content_hash"] != content_hash):
            db.execute("INSERT INTO source_snapshots(source_id,observed_at,content_hash,content,url) VALUES(?,?,?,?,?)",
                       (source_id, checked_at, content_hash, content, url))
            db.execute("DELETE FROM source_snapshots WHERE source_id=? AND id NOT IN "
                       "(SELECT id FROM source_snapshots WHERE source_id=? ORDER BY id DESC LIMIT 20)",
                       (source_id, source_id))
        if changed:
            source_url_map = json.loads((APP_DIR / "sources.json").read_text())
            for source in source_url_map:
                if source["id"] == source_id:
                    db.execute("UPDATE opportunities SET review_needed=1 WHERE url=?", (source["url"],))
    return changed


def source_changes(source_id):
    with connect() as db:
        snapshots = [dict(r) for r in db.execute(
            "SELECT * FROM source_snapshots WHERE source_id=? ORDER BY id DESC LIMIT 2", (source_id,))]
        reviews = [dict(r) for r in db.execute(
            "SELECT * FROM source_reviews WHERE source_id=? ORDER BY id DESC LIMIT 10", (source_id,))]
    diff = ""
    if len(snapshots) == 2:
        diff = "\n".join(difflib.unified_diff(
            snapshots[1]["content"].splitlines(), snapshots[0]["content"].splitlines(),
            fromfile=snapshots[1]["observed_at"], tofile=snapshots[0]["observed_at"], lineterm=""))
    return {"snapshots": [{k: v for k, v in s.items() if k != "content"} for s in snapshots],
            "diff": diff[:16000], "truncated": len(diff) > 16000, "reviews": reviews}


def review_source(source_id, expected_hash, note):
    """Acknowledge this page snapshot only; this does not verify any opportunity."""
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM source_checks WHERE source_id=?", (source_id,)).fetchone()
        if not row or not row["content_hash"]:
            raise LookupError("No page snapshot is available to review.")
        if row["content_hash"] != expected_hash:
            raise ValueError("The source changed again. Reload and review its latest snapshot.")
        db.execute("INSERT INTO source_reviews(source_id,content_hash,reviewed_at,note) VALUES(?,?,?,?)",
                   (source_id, expected_hash, now_iso(), note))
        db.execute("UPDATE source_checks SET review_needed=0 WHERE source_id=?", (source_id,))


def record_sync(source, count, errors, started_at=None):
    with connect() as db:
        db.execute("INSERT INTO sync_runs (started_at,finished_at,source,imported,errors) VALUES (?,?,?,?,?)", (started_at or now_iso(), now_iso(), source, count, json.dumps(errors)))


def sync_history():
    with connect() as db:
        return [dict(r) for r in db.execute("SELECT * FROM sync_runs ORDER BY id DESC LIMIT 6")]


def upsert_candidate_links(source_id, candidates):
    """Record possible program links. Never promote them to opportunities automatically."""
    import hashlib
    now = now_iso()
    with connect() as db:
        for candidate in candidates[:25]:
            uid = hashlib.sha256((source_id + '|' + candidate['url']).encode()).hexdigest()[:20]
            db.execute("""INSERT INTO candidate_links(id,source_id,title,url,first_seen,last_seen)
                VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,last_seen=excluded.last_seen""",
                (uid,source_id,candidate['title'][:180],candidate['url'],now,now))


def get_candidate_links(limit=50, status=None):
    with connect() as db:
        return [dict(r) for r in db.execute("""SELECT c.*, s.status as source_status
            FROM candidate_links c LEFT JOIN source_checks s ON s.source_id=c.source_id
            WHERE (? IS NULL OR c.status=?)
            ORDER BY c.first_seen DESC, c.id LIMIT ?""",(status,status,limit))]


def review_candidate(candidate_id, status, note):
    with connect() as db:
        reviewed_at = now_iso()
        result = db.execute("UPDATE candidate_links SET status=?,reviewed_at=?,review_note=? WHERE id=?",
                            (status, reviewed_at, note, candidate_id))
        if not result.rowcount:
            raise LookupError("Candidate link not found.")
        db.execute("INSERT INTO candidate_reviews(candidate_id,reviewed_at,status,note) VALUES(?,?,?,?)",
                   (candidate_id, reviewed_at, status, note))
        return dict(db.execute("SELECT * FROM candidate_links WHERE id=?", (candidate_id,)).fetchone())
