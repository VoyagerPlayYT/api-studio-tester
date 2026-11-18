import os
import sqlite3
import json
import time
from typing import Dict, Any, Optional, List
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

DB_PATH = os.path.join(os.path.dirname(__file__), "api_studio.db")

app = FastAPI(title="API Studio Tester Backend", version="1.0.0")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER,
            name TEXT NOT NULL,
            method TEXT NOT NULL,
            url TEXT NOT NULL,
            headers_json TEXT,
            params_json TEXT,
            auth_json TEXT,
            body_type TEXT,
            body_content TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            method TEXT NOT NULL,
            url TEXT NOT NULL,
            status_code INTEGER NOT NULL,
            time_ms REAL NOT NULL,
            size_bytes INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Populate default collection with sample queries if empty
    cursor.execute("SELECT COUNT(*) FROM collections")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO collections (name, description) VALUES (?, ?)", ("Core Services & Test APIs", "Standard testing endpoints"))
        col_id = cursor.lastrowid
        samples = [
            (col_id, "HTTPBin Get IP", "GET", "https://httpbin.org/ip", "{}", "{}", "{}", "none", ""),
            (col_id, "HTTPBin Post JSON", "POST", "https://httpbin.org/post", '{"Content-Type": "application/json"}', "{}", "{}", "json", '{"service": "API Studio", "status": "active", "code": 200}'),
            (col_id, "Local Port 8011 Status", "GET", "http://localhost:8011/api/stats", "{}", "{}", "{}", "none", "")
        ]
        cursor.executemany("""
            INSERT INTO saved_requests (collection_id, name, method, url, headers_json, params_json, auth_json, body_type, body_content)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, samples)

    conn.commit()
    conn.close()

init_db()

class ProxyRequest(BaseModel):
    method: str = Field(default="GET")
    url: str
    headers: Optional[Dict[str, str]] = {}
    params: Optional[Dict[str, str]] = {}
    auth_type: Optional[str] = "none" # none, bearer, basic
    auth_token: Optional[str] = ""
    auth_user: Optional[str] = ""
    auth_pass: Optional[str] = ""
    body_type: Optional[str] = "none" # none, json, text
    body_content: Optional[str] = ""

class SaveRequestPayload(BaseModel):
    collection_id: Optional[int] = 1
    name: str
    method: str
    url: str
    headers: Dict[str, str] = {}
    params: Dict[str, str] = {}
    auth: Dict[str, Any] = {}
    body_type: str = "none"
    body_content: str = ""

@app.post("/api/proxy/request")
async def execute_http_request(req: ProxyRequest):
    req_headers = dict(req.headers) if req.headers else {}
    req_params = dict(req.params) if req.params else {}

    # Handle Auth
    auth = None
    if req.auth_type == "bearer" and req.auth_token:
        req_headers["Authorization"] = f"Bearer {req.auth_token.strip()}"
    elif req.auth_type == "basic" and req.auth_user:
        auth = (req.auth_user, req.auth_pass or "")

    # Clean headers & prepare payload
    content = None
    if req.method.upper() not in ("GET", "HEAD") and req.body_type in ("json", "text") and req.body_content:
        content = req.body_content
        if req.body_type == "json" and "Content-Type" not in req_headers:
            req_headers["Content-Type"] = "application/json"

    t0 = time.perf_counter()
    status_code = 0
    status_text = ""
    res_headers = {}
    res_body = ""
    size_bytes = 0

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False) as client:
            resp = await client.request(
                method=req.method.upper(),
                url=req.url,
                headers=req_headers,
                params=req_params,
                auth=auth,
                content=content
            )
            time_ms = round((time.perf_counter() - t0) * 1000, 2)
            status_code = resp.status_code
            status_text = resp.reason_phrase
            res_headers = dict(resp.headers)
            res_body = resp.text
            size_bytes = len(resp.content)

    except httpx.TimeoutException:
        time_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "error": True,
            "status_code": 408,
            "status_text": "Request Timeout",
            "time_ms": time_ms,
            "size_bytes": 0,
            "headers": {},
            "body": "Error: HTTP request timed out after 30 seconds."
        }
    except Exception as e:
        time_ms = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "error": True,
            "status_code": 502,
            "status_text": "Bad Gateway / Proxy Error",
            "time_ms": time_ms,
            "size_bytes": 0,
            "headers": {},
            "body": f"Error dispatching request: {str(e)}"
        }

    # Record into history SQLite
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO history (method, url, status_code, time_ms, size_bytes)
            VALUES (?, ?, ?, ?, ?)
        """, (req.method.upper(), req.url, status_code, time_ms, size_bytes))
        conn.commit()
        conn.close()
    except Exception:
        pass

    # Check if JSON
    is_json = False
    try:
        parsed_json = json.loads(res_body)
        res_body = json.dumps(parsed_json, indent=2)
        is_json = True
    except Exception:
        pass

    return {
        "error": False,
        "status_code": status_code,
        "status_text": status_text,
        "time_ms": time_ms,
        "size_bytes": size_bytes,
        "headers": res_headers,
        "body": res_body,
        "is_json": is_json
    }

@app.get("/api/history")
def get_history():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM history ORDER BY id DESC LIMIT 30")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"history": rows}

@app.delete("/api/history")
def clear_history():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM history")
    conn.commit()
    conn.close()
    return {"status": "cleared"}

@app.get("/api/collections")
def get_collections():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM collections ORDER BY id ASC")
    cols = [dict(r) for r in cursor.fetchall()]

    for col in cols:
        cursor.execute("SELECT * FROM saved_requests WHERE collection_id = ? ORDER BY id ASC", (col["id"],))
        col["requests"] = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {"collections": cols}

@app.post("/api/requests/save")
def save_request(req: SaveRequestPayload):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO saved_requests (collection_id, name, method, url, headers_json, params_json, auth_json, body_type, body_content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.collection_id,
        req.name,
        req.method.upper(),
        req.url,
        json.dumps(req.headers),
        json.dumps(req.params),
        json.dumps(req.auth),
        req.body_type,
        req.body_content
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"status": "saved", "id": new_id}

@app.delete("/api/requests/{request_id}")
def delete_saved_request(request_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM saved_requests WHERE id = ?", (request_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(static_dir, "index.html"))
