"""
KIberXuligan Server
"""

import os
import uuid
import json
import asyncio
import webbrowser
import threading
import time
from typing import List, Optional
from collections import OrderedDict
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

from runner import ScanSession, build_osint_graph, get_tool_config
from extra_tools import analyze_phone, analyze_exif, analyze_ip_domain, analyze_email, run_holehe_email_scan, analyze_telegram, analyze_crypto, analyze_auto, analyze_face_image, analyze_breaches, run_pivot_chain, analyze_vk

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)

# Session store with max-size LRU protection (prevents memory leak from infinite scans)
MAX_STORED_SESSIONS = 25
sessions = OrderedDict()  # session_id -> ScanSession

def register_session(session_id: str, session: ScanSession):
    if len(sessions) >= MAX_STORED_SESSIONS:
        # Evict oldest session
        oldest_id, oldest_sess = sessions.popitem(last=False)
        oldest_sess.stop()
    sessions[session_id] = session

def stop_all_active_sessions():
    """Immediately terminates all active scan sessions and their subprocess trees."""
    for sess in list(sessions.values()):
        if sess.is_active or not sess.is_stopped:
            sess.stop()

def open_browser_delayed():
    time.sleep(1.2)
    try:
        webbrowser.open("http://127.0.0.1:8888")
    except Exception:
        pass

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: open browser after 1.2s in a background thread
    threading.Thread(target=open_browser_delayed, daemon=True).start()
    yield
    # Shutdown: gracefully terminate any active scanning sessions
    stop_all_active_sessions()

app = FastAPI(title="KIberXuligan — Osint By kiber", lifespan=lifespan)

class ScanRequest(BaseModel):
    username: str
    tools: Optional[List[str]] = ["maigret", "snoop", "sherlock", "blackbird", "nexfil", "holehe"]
    fast_mode: Optional[bool] = True

@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def serve_index():
    index_file = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>KIberXuligan — Osint By kiber Web UI</h1>"

@app.get("/api/scan/latest")
async def get_latest_scan():
    """Returns the latest scan session and its results, restoring state across F5 and reboots."""
    # 1. In-memory check
    if sessions:
        latest_id, latest_session = next(reversed(sessions.items()))
        items = list(latest_session.found_items.values())
        return {
            "found": True,
            "session_id": latest_id,
            "username": latest_session.clean_username,
            "target": latest_session.raw_target,
            "is_active": latest_session.is_active,
            "is_stopped": latest_session.is_stopped,
            "status": latest_session.status,
            "total_found": len(items),
            "items": items,
            "graph": build_osint_graph(latest_session.clean_username, items)
        }

    # 2. Disk persistence fallback
    disk_path = os.path.join(BASE_DIR, "latest_scan.json")
    if os.path.exists(disk_path):
        try:
            with open(disk_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                items = data.get("items", [])
                username = data.get("username", "")
                return {
                    "found": True,
                    "session_id": "restored",
                    "username": username,
                    "target": data.get("target", username),
                    "is_active": False,
                    "is_stopped": True,
                    "status": data.get("status", {}),
                    "total_found": len(items),
                    "items": items,
                    "graph": build_osint_graph(username, items)
                }
        except Exception:
            pass

    return {"found": False}

@app.post("/api/scan")
@app.post("/api/search")
async def start_scan(req: ScanRequest, background_tasks: BackgroundTasks):
    username = req.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Никнейм обязателен для поиска")

    # Stop all previous scans and kill lingering child processes
    stop_all_active_sessions()

    session_id = str(uuid.uuid4())
    session = ScanSession(
        username=username,
        enabled_tools=req.tools or ["maigret", "snoop", "sherlock", "blackbird", "nexfil", "holehe"],
        fast_mode=req.fast_mode
    )
    register_session(session_id, session)

    # Launch scanning as background async task
    background_tasks.add_task(session.execute_all)

    return {
        "session_id": session_id,
        "username": session.clean_username,
        "target": session.raw_target,
        "tools": session.enabled_tools
    }

@app.post("/api/scan/{session_id}/stop")
async def stop_scan(session_id: str):
    session = sessions.get(session_id)
    if session:
        session.stop()
        await session.emit("complete", {
            "username": session.clean_username,
            "target": session.raw_target,
            "total_found": len(session.found_items),
            "items": list(session.found_items.values())
        })
    return {"status": "stopped", "session_id": session_id}

@app.post("/api/scan/stop-all")
async def api_stop_all():
    stop_all_active_sessions()
    return {"status": "all_stopped"}

@app.get("/api/stream/{session_id}")
@app.get("/api/events/{session_id}")
async def sse_stream(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")

    async def event_generator():
        try:
            # If session was already completed or stopped, immediately stream final graph and complete event
            if not session.is_active and session.events_queue.empty():
                items = list(session.found_items.values())
                graph = build_osint_graph(session.clean_username, items)
                yield f"event: graph\ndata: {json.dumps(graph, ensure_ascii=False)}\n\n"
                yield f"event: complete\ndata: {json.dumps({'username': session.clean_username, 'total_found': len(items), 'items': items}, ensure_ascii=False)}\n\n"
                return

            while True:
                try:
                    event = await asyncio.wait_for(session.events_queue.get(), timeout=1.0)
                    yield f"event: {event['type']}\ndata: {json.dumps(event['data'], ensure_ascii=False)}\n\n"
                    if event['type'] == 'complete' or session.is_stopped:
                        break
                except asyncio.TimeoutError:
                    if not session.is_active and session.events_queue.empty():
                        break
                    # Keep-alive ping to maintain connection through firewalls/proxies
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/results/{session_id}")
async def get_results(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сессия не найдена")
    items = list(session.found_items.values())
    return {
        "username": session.username,
        "is_active": session.is_active,
        "total_found": len(items),
        "items": items,
        "graph": build_osint_graph(session.username, items)
    }

@app.get("/api/tools-check")
async def check_tools():
    """
    Returns available tools status WITHOUT leaking local system file paths.
    """
    tools = ["maigret", "sherlock", "blackbird", "snoop", "nexfil", "holehe"]
    res = {}
    for name in tools:
        cmd_prefix, cwd, is_avail = get_tool_config(name)
        res[name] = {
            "installed": is_avail
        }
    return res

class PhoneRequest(BaseModel):
    phone: str

class IpDomainRequest(BaseModel):
    query: str

@app.post("/api/tools/phone")
async def api_phone(req: PhoneRequest):
    return analyze_phone(req.phone)

@app.post("/api/tools/exif")
async def api_exif(file: UploadFile = File(...)):
    contents = await file.read()
    return analyze_exif(contents, filename=file.filename or "")

@app.post("/api/tools/ip-domain")
async def api_ip_domain(req: IpDomainRequest):
    return analyze_ip_domain(req.query)

class EmailRequest(BaseModel):
    email: str

@app.post("/api/tools/email")
async def api_email(req: EmailRequest):
    return analyze_email(req.email)

class TelegramRequest(BaseModel):
    target: str

class CryptoRequest(BaseModel):
    address: str

class AutoRequest(BaseModel):
    query: str

class VkRequest(BaseModel):
    query: str

class BreachesRequest(BaseModel):
    query: str

class PivotRequest(BaseModel):
    username: str
    found_items: Optional[List[dict]] = []

@app.post("/api/tools/telegram")
async def api_telegram(req: TelegramRequest):
    return analyze_telegram(req.target)

@app.post("/api/tools/vk")
async def api_vk(req: VkRequest):
    return await analyze_vk(req.query)

@app.post("/api/tools/crypto")
async def api_crypto(req: CryptoRequest):
    return analyze_crypto(req.address)

@app.post("/api/tools/auto")
async def api_auto(req: AutoRequest):
    return analyze_auto(req.query)

@app.post("/api/tools/face")
async def api_face(file: UploadFile = File(...)):
    content = await file.read()
    return await analyze_face_image(content, file.filename or "image.jpg")

@app.post("/api/tools/breaches")
async def api_breaches(req: BreachesRequest):
    return analyze_breaches(req.query)

@app.post("/api/tools/pivot")
async def api_pivot(req: PivotRequest):
    return run_pivot_chain(req.username, req.found_items or [])

@app.post("/api/tools/email/scan")
async def api_email_scan(req: EmailRequest):
    accounts = await run_holehe_email_scan(req.email)
    return {"success": True, "email": req.email, "accounts": accounts}

class DossierRequest(BaseModel):
    target: str
    found_items: Optional[List[dict]] = []
    email_data: Optional[dict] = None
    tg_data: Optional[dict] = None
    telegram_data: Optional[dict] = None
    breach_data: Optional[dict] = None
    phone_data: Optional[dict] = None

@app.post("/api/dossier/compile")
async def api_compile_dossier(req: DossierRequest):
    from datetime import datetime
    import hashlib
    from extra_tools import get_discovered_profiles_for_user, analyze_breaches, analyze_telegram, analyze_email, analyze_phone

    target = req.target.strip()
    if not target:
        target = "Target"

    if target.startswith("@"):
        clean_user = target[1:].strip()
    elif "@" in target and "." in target:
        clean_user = target.split("@")[0].strip()
    elif "t.me/" in target:
        clean_user = target.split("t.me/")[-1].replace("/", "").strip()
    else:
        clean_user = target.strip()

    items = list(req.found_items or [])
    if not items and clean_user and clean_user != "Target":
        items = get_discovered_profiles_for_user(clean_user)

    tg_data = req.tg_data or req.telegram_data or {}
    if not tg_data and clean_user and clean_user != "Target" and not target.startswith("+"):
        try:
            tg_data = analyze_telegram(clean_user)
        except Exception:
            tg_data = {}

    email_data = req.email_data or {}
    if not email_data and "@" in target and "." in target and not target.startswith("@"):
        try:
            email_data = analyze_email(target)
        except Exception:
            email_data = {}

    breach_info = req.breach_data or {}
    if not breach_info and target != "Target":
        try:
            breach_info = analyze_breaches(target)
        except Exception:
            breach_info = {}

    phone_data = req.phone_data or {}
    if not phone_data and (target.startswith("+") or (target.startswith("8") and len(target) == 11)):
        try:
            phone_data = analyze_phone(target)
        except Exception:
            phone_data = {}

    count = len(items)
    if count >= 15:
        level = "КРИТИЧЕСКИ ВЫСОКИЙ (Обширный цифровой след)"
    elif count >= 8:
        level = "ВЫСОКИЙ (Множественные подтвержденные профили)"
    elif count >= 3:
        level = "СРЕДНИЙ (Умеренная активность в сети)"
    elif count >= 1:
        level = "НАЧАЛЬНЫЙ (Единичные обнаружения)"
    else:
        level = "МИНИМАЛЬНЫЙ (Скрытый профиль)"

    categories_count = {}
    for it in items:
        cat = it.get("category", "other")
        categories_count[cat] = categories_count.get(cat, 0) + 1

    is_compromised = bool(breach_info.get("is_compromised") or breach_info.get("compromised"))
    stealers_count = breach_info.get("total_stealers", 0) or breach_info.get("stealers_count", 0)
    comb_matches = breach_info.get("comb_matches", 0) or ((breach_info.get("comb_data") or {}).get("count", 0))

    # Synthesize rich identities
    identities = []
    identities.append({"type": "Основная цель", "val": target})
    if clean_user and clean_user != target and clean_user != "Target":
        identities.append({"type": "Извлеченный логин", "val": clean_user})

    if email_data.get("email"):
        identities.append({"type": "Email", "val": email_data["email"]})
        if email_data.get("provider"):
            identities.append({"type": "Почтовый сервис", "val": email_data["provider"]})
        if email_data.get("mailru_exists"):
            identities.append({"type": "Mail.ru / VK", "val": "Зарегистрирован"})
        if email_data.get("github_commits_count", 0) > 0:
            identities.append({"type": "GitHub коммиты", "val": f"{email_data['github_commits_count']} шт"})

    if tg_data.get("username"):
        identities.append({"type": "Telegram", "val": f"@{tg_data['username']}"})
        identities.append({"type": "Telegram Desktop", "val": f"tg://resolve?domain={tg_data['username']}"})

    if phone_data.get("e164"):
        identities.append({"type": "Телефон", "val": phone_data["e164"]})
        if phone_data.get("carrier"):
            identities.append({"type": "Оператор", "val": phone_data["carrier"]})
        if phone_data.get("location"):
            identities.append({"type": "Регион", "val": phone_data["location"]})

    for em in breach_info.get("linked_emails", []):
        identities.append({"type": "Email из дампов", "val": em})

    # Add top verified profiles
    for it in items[:6]:
        identities.append({"type": it.get("site", "Аккаунт"), "val": it.get("url", "")})

    breach_summary = {
        "checked": bool(breach_info or email_data or tg_data),
        "stealer_infected": is_compromised,
        "stealers_count": stealers_count,
        "comb_matches": comb_matches,
        "compromised_user_services": breach_info.get("total_user_services", 0),
        "compromised_corporate_services": breach_info.get("total_corporate_services", 0),
        "risk_level": breach_info.get("risk_level", "Низкий (Чисто)" if not is_compromised else "Критический"),
        "verdict": breach_info.get("verdict", "Чисто: прямых совпадений компрометации не выявлено")
    }

    case_id = f"CASE-{hashlib.md5(target.encode('utf-8')).hexdigest()[:8].upper()}"
    now_str = datetime.now().strftime("%d.%m.%Y %H:%M:%S")

    return {
        "success": True,
        "case_id": case_id,
        "target": target,
        "total_count": count,
        "total_found": count,
        "generated_at": now_str,
        "footprint_level": level,
        "is_compromised": is_compromised,
        "stealers_count": stealers_count,
        "categories": categories_count,
        "categories_breakdown": categories_count,
        "identities": identities,
        "breach_summary": breach_summary,
        "items": items,
        "email_data": email_data or req.email_data,
        "tg_data": tg_data,
        "breach_data": breach_info or req.breach_data,
        "phone_data": phone_data or req.phone_data
    }

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if __name__ == "__main__":
    print("[*] Starting KIberXuligan OSINT Server on http://127.0.0.1:8888 ...")
    uvicorn.run("server:app", host="127.0.0.1", port=8888, reload=False)
