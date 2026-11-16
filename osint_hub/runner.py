"""
KIberXuligan Engine
Executes Maigret, Sherlock, Blackbird, Snoop, Nexfil, and Holehe in parallel,
streams real-time output line-by-line, and deduplicates discoveries.
"""

import asyncio
import os
import sys
import re
import json
import shutil
import time
import subprocess
from urllib.parse import urlparse
from graph import classify_service, build_osint_graph

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, ".."))

URL_REGEX = re.compile(r"https?://[^\s'\"<>\)\]]+")
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

def clean_url(url: str) -> str:
    url = url.strip()
    while url.endswith((".", ",", ")", "]", ">", "'", '"')):
        url = url[:-1]
    return url

def normalize_domain(url: str) -> str:
    try:
        domain = urlparse(url).netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""

def sanitize_username(username: str) -> str:
    cleaned = re.sub(r'[^\w\.-@]', '_', username.strip())
    reserved = {"con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "lpt1", "lpt2"}
    if cleaned.lower() in reserved or not cleaned:
        cleaned = f"target_{cleaned}"
    return cleaned[:64]

def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub('', text)

def get_subprocess_env(cwd=None):
    env = dict(os.environ)
    paths = [
        os.path.join(PROJECT_ROOT, "maigret"),
        os.path.join(PROJECT_ROOT, "sherlock"),
        os.path.join(PROJECT_ROOT, "blackbird"),
        os.path.join(PROJECT_ROOT, "snoop"),
        PROJECT_ROOT
    ]
    if cwd and cwd not in paths:
        paths.insert(0, cwd)
    old_pp = env.get("PYTHONPATH", "")
    if old_pp:
        paths.append(old_pp)
    env["PYTHONPATH"] = ";".join(paths)
    return env

def get_tool_config(tool_name: str):
    """
    Dynamically resolves executable and working directory for each tool.
    """
    tool_dir = os.path.join(PROJECT_ROOT, tool_name)
    cwd = tool_dir if os.path.isdir(tool_dir) else PROJECT_ROOT

    local_venv_py = os.path.join(tool_dir, ".venv", "Scripts", "python.exe")
    root_venv_py = os.path.join(PROJECT_ROOT, "venv", "Scripts", "python.exe")
    current_py = sys.executable

    py_candidates = [p for p in [local_venv_py, root_venv_py, current_py] if os.path.exists(p)]

    if tool_name == "maigret":
        for exe_candidate in [
            os.path.join(tool_dir, ".venv", "Scripts", "maigret.exe"),
            os.path.join(PROJECT_ROOT, "venv", "Scripts", "maigret.exe"),
            shutil.which("maigret")
        ]:
            if exe_candidate and os.path.exists(exe_candidate):
                return [exe_candidate], cwd, True

        for py in py_candidates:
            return [py, "-m", "maigret"], cwd, True

        return ["maigret"], cwd, False

    elif tool_name == "sherlock":
        for exe_candidate in [
            os.path.join(tool_dir, ".venv", "Scripts", "sherlock.exe"),
            os.path.join(PROJECT_ROOT, "venv", "Scripts", "sherlock.exe"),
            shutil.which("sherlock")
        ]:
            if exe_candidate and os.path.exists(exe_candidate):
                return [exe_candidate], cwd, True

        for py in py_candidates:
            return [py, "-m", "sherlock_project"], cwd, True

        return ["sherlock"], cwd, False

    elif tool_name == "blackbird":
        script_path = os.path.join(tool_dir, "blackbird.py")
        for py in py_candidates:
            if os.path.exists(script_path):
                return [py, script_path], cwd, True
            return [py, "-m", "blackbird"], cwd, True

        return ["python", "blackbird.py"], cwd, False

    elif tool_name == "snoop":
        script_path = os.path.join(tool_dir, "snoop.py")
        for py in py_candidates:
            if os.path.exists(script_path):
                return [py, script_path], cwd, True
            return [py, "-m", "snoop"], cwd, True

        return ["python", "snoop.py"], cwd, False

    elif tool_name == "nexfil":
        for exe_candidate in [
            os.path.join(PROJECT_ROOT, "venv", "Scripts", "nexfil.exe"),
            shutil.which("nexfil")
        ]:
            if exe_candidate and os.path.exists(exe_candidate):
                return [exe_candidate], cwd, True

        for py in py_candidates:
            return [py, "-c", "import nexfil.cli; nexfil.cli.cli()"], cwd, True

        return ["nexfil"], cwd, False

    elif tool_name == "holehe":
        for exe_candidate in [
            os.path.join(PROJECT_ROOT, "venv", "Scripts", "holehe.exe"),
            shutil.which("holehe")
        ]:
            if exe_candidate and os.path.exists(exe_candidate):
                return [exe_candidate], cwd, True

        for py in py_candidates:
            return [py, "-c", "import holehe.core; holehe.core.main()"], cwd, True

        return ["holehe"], cwd, False

    return [], cwd, False


class ScanSession:
    def __init__(self, username, enabled_tools=None, fast_mode=True):
        self.raw_target = username.strip()

        # Extract digits for phone check
        digits_only = re.sub(r"\D", "", self.raw_target)

        # 1. Exact Email Check (RFC-style: must not start with @, must contain @ and .)
        self.is_email = bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", self.raw_target))

        # 2. Telegram Handle / URL Check
        self.is_telegram = (self.raw_target.startswith("@") or "t.me/" in self.raw_target) and not self.is_email

        # 3. Phone Number Check (handles +7..., 8916..., +7 (916)..., 8-916...)
        self.is_phone = (
            not self.is_email and not self.is_telegram and (
                (self.raw_target.startswith("+") and 10 <= len(digits_only) <= 15) or
                (10 <= len(digits_only) <= 12 and (self.raw_target.startswith("8") or self.raw_target.startswith("7"))) or
                (len(digits_only) >= 10 and bool(re.search(r"[\s\-\(\)]", self.raw_target)))
            )
        )

        if self.is_email:
            self.target_email = self.raw_target.lower()
            self.clean_username = self.target_email.split("@")[0]
            self.username = sanitize_username(self.clean_username)
        elif self.is_telegram:
            clean = self.raw_target
            if clean.startswith("@"):
                clean = clean[1:]
            if "t.me/" in clean:
                clean = clean.split("t.me/")[-1]
            self.clean_username = clean.replace("/", "").strip()
            self.username = sanitize_username(self.clean_username)
        elif self.is_phone:
            clean_phone = re.sub(r"[^\d+]", "", self.raw_target)
            if not clean_phone.startswith("+"):
                if clean_phone.startswith("8") and len(clean_phone) == 11:
                    clean_phone = "+7" + clean_phone[1:]
                elif clean_phone.startswith("7") and len(clean_phone) == 11:
                    clean_phone = "+" + clean_phone
                else:
                    clean_phone = "+" + clean_phone
            self.clean_username = clean_phone
            self.username = sanitize_username(clean_phone)
        else:
            self.clean_username = self.raw_target
            self.username = sanitize_username(self.raw_target)

        self.enabled_tools = enabled_tools or ["maigret", "snoop", "sherlock", "blackbird", "nexfil", "holehe"]
        self.fast_mode = fast_mode
        self.found_items = {}  # key: domain -> item dict
        self.logs = []
        self.status = {tool: "pending" for tool in self.enabled_tools}
        self.is_active = True
        self.is_stopped = False
        self.events_queue = asyncio.Queue()
        self.active_processes = []
        self.active_tasks = []

        self.output_dir = os.path.join(CURRENT_DIR, "scans", self.username.replace("@", "_at_"))
        os.makedirs(self.output_dir, exist_ok=True)

    def stop(self):
        """Immediately abort all active subprocesses and tasks with Windows process tree termination."""
        self.is_stopped = True
        self.is_active = False
        for proc in list(self.active_processes):
            try:
                if sys.platform == "win32":
                    subprocess.call(f"taskkill /F /T /PID {proc.pid} >nul 2>&1", shell=True)
                else:
                    proc.kill()
            except Exception:
                pass
            try:
                proc.kill()
            except Exception:
                pass
        self.active_processes.clear()
        for task in list(self.active_tasks):
            if not task.done():
                task.cancel()
        self.save_checkpoint()

    def save_checkpoint(self):
        """Persists current findings and engine status to disk for instant restoration on reload."""
        try:
            items_list = list(self.found_items.values())
            latest_data = {
                "username": self.clean_username,
                "target": self.raw_target,
                "total_found": len(items_list),
                "items": items_list,
                "status": self.status,
                "is_active": self.is_active,
                "is_stopped": self.is_stopped,
                "timestamp": time.time()
            }
            save_path = os.path.join(CURRENT_DIR, "latest_scan.json")
            with open(save_path, "w", encoding="utf-8") as f:
                json.dump(latest_data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    async def emit(self, event_type, data):
        await self.events_queue.put({"type": event_type, "data": data})

    def record_found(self, site, url, tool, metadata=None):
        url = clean_url(url)
        domain = normalize_domain(url)
        if not domain:
            domain = site.lower().replace(" ", "") + ".com"

        key = domain
        cat = classify_service(url, site)

        if key in self.found_items:
            existing = self.found_items[key]
            if tool not in existing["tools"]:
                existing["tools"].append(tool)
            if metadata:
                existing["metadata"].update(metadata)
            self.save_checkpoint()
            return existing
        else:
            item = {
                "site": site or domain,
                "domain": domain,
                "url": url,
                "tools": [tool],
                "category": cat,
                "metadata": metadata or {}
            }
            self.found_items[key] = item
            self.save_checkpoint()
            return item

    async def preload_known_profiles(self):
        """
        Immediately extracts and emits all verified profiles already indexed locally
        in sherlock or previous scans, providing instant intelligence in <0.2s.
        """
        try:
            from extra_tools import get_discovered_profiles_for_user
            known = get_discovered_profiles_for_user(self.clean_username)
            if known:
                await self.emit("log", {"tool": "system", "text": f"Загружено {len(known)} подтвержденных профилей из базы разведки"})
                for k in known:
                    item = self.record_found(k.get("site"), k.get("url"), k.get("tool", "OSINT Archive"), metadata=k.get("metadata"))
                    if item:
                        await self.emit("found", {"item": item, "tool": k.get("tool", "OSINT Archive")})
                await self.emit("graph", build_osint_graph(self.clean_username, list(self.found_items.values())))
        except Exception:
            pass

    async def run_email_intelligence(self):
        try:
            from extra_tools import analyze_email
            await self.emit("log", {"tool": "holehe", "text": f"Комплексная разведка Email {self.target_email}..."})
            em_data = analyze_email(self.target_email)
            await self.emit("vector_intel", {"type": "email_intel", "data": em_data})

            if em_data.get("mailru_exists"):
                m_item = self.record_found(
                    "Mail.ru",
                    f"https://my.mail.ru/mail/{self.clean_username}",
                    "Mail.ru OSINT",
                    {"email": self.target_email, "details": "Аккаунт активен в экосистеме VK / Mail.ru"}
                )
                if m_item:
                    await self.emit("found", {"item": m_item, "tool": "Mail.ru OSINT"})

            if em_data.get("github_commits_count", 0) > 0:
                gh_item = self.record_found(
                    "GitHub",
                    f"https://github.com/search?q={self.target_email}&type=commits",
                    "GitHub OSINT",
                    {"email": self.target_email, "details": f"{em_data.get('github_commits_count')} открытых коммитов"}
                )
                if gh_item:
                    await self.emit("found", {"item": gh_item, "tool": "GitHub OSINT"})

            b_intel = em_data.get("breach_intel", {})
            if b_intel.get("is_compromised"):
                await self.emit("log", {
                    "tool": "holehe",
                    "text": f"🔴 ВНИМАНИЕ: {self.target_email} обнаружен в базах компрометации / стиллерах!",
                    "level": "error"
                })
            else:
                await self.emit("log", {
                    "tool": "holehe",
                    "text": f"🟢 Логи инфостиллеров & COMB: прямое заражение для {self.target_email} не выявлено."
                })
        except Exception:
            pass

    async def run_telegram_intelligence(self):
        try:
            from extra_tools import analyze_telegram
            await self.emit("log", {"tool": "telegram", "text": f"Разведка Telegram @{self.clean_username}..."})
            tg_data = analyze_telegram(self.clean_username)
            await self.emit("vector_intel", {"type": "telegram_intel", "data": tg_data})

            tg_item = self.record_found(
                "Telegram",
                f"https://t.me/{self.clean_username}",
                "Telegram OSINT",
                {"handle": f"@{self.clean_username}", "app_url": f"tg://resolve?domain={self.clean_username}"}
            )
            if tg_item:
                await self.emit("found", {"item": tg_item, "tool": "Telegram OSINT"})

            comb = tg_data.get("comb_intel", {})
            if comb.get("found"):
                for em in comb.get("linked_emails", []):
                    em_item = self.record_found(
                        "COMB Leak Matrix (Linked Email)",
                        f"https://my.mail.ru/mail/{em.split('@')[0]}" if "mail.ru" in em else f"mailto:{em}",
                        "COMB Matrix",
                        {"email": em, "details": f"Связанный адрес из утечки: {em}"}
                    )
                    if em_item:
                        await self.emit("found", {"item": em_item, "tool": "COMB Matrix"})

            hr = tg_data.get("breach_intel", {})
            if hr.get("is_compromised"):
                await self.emit("log", {
                    "tool": "telegram",
                    "text": f"🔴 ВНИМАНИЕ: @{self.clean_username} скомпрометирован в {hr.get('stealers_count', 0)} логах стиллеров!",
                    "level": "error"
                })
            else:
                await self.emit("log", {
                    "tool": "telegram",
                    "text": f"🟢 Логи инфостиллеров: компрометация для @{self.clean_username} не выявлена."
                })
        except Exception:
            pass

    async def run_phone_intelligence(self):
        try:
            from extra_tools import analyze_phone
            await self.emit("log", {"tool": "system", "text": f"Анализ телефонного вектора {self.raw_target}..."})
            phone_data = analyze_phone(self.raw_target)
            await self.emit("vector_intel", {"type": "phone_intel", "data": phone_data})
            p_item = self.record_found(
                f"Телефон ({phone_data.get('carrier', 'Оператор')})",
                f"tel:{phone_data.get('e164', self.raw_target)}",
                "Phone OSINT",
                {"e164": phone_data.get("e164"), "carrier": phone_data.get("carrier"), "location": phone_data.get("location")}
            )
            if p_item:
                await self.emit("found", {"item": p_item, "tool": "Phone OSINT"})
        except Exception:
            pass

    async def run_breach_intelligence(self):
        try:
            from extra_tools import analyze_breaches
            await self.emit("log", {"tool": "system", "text": f"Сверка по реестрам компрометации (COMB 3.2B, стиллеры, утечки) для {self.raw_target}..."})
            breach_data = analyze_breaches(self.raw_target)
            await self.emit("vector_intel", {"type": "breach_intel", "data": breach_data})

            for em in breach_data.get("linked_emails", []):
                m_item = self.record_found(
                    "Утечка COMB (Найден связанный Email)",
                    f"mailto:{em}",
                    "COMB Matrix",
                    {"email": em, "details": f"Скомпрометированный email из дампа COMB: {em}"}
                )
                if m_item:
                    await self.emit("found", {"item": m_item, "tool": "COMB Matrix"})

            if breach_data.get("is_compromised"):
                await self.emit("log", {
                    "tool": "system",
                    "text": f"🔴 ВНИМАНИЕ: Зафиксирована компрометация! {breach_data.get('verdict')}",
                    "level": "error"
                })
            else:
                await self.emit("log", {
                    "tool": "system",
                    "text": f"🟢 Реестры утечек: цель {self.raw_target} в логах стиллеров и COMB чиста."
                })
        except Exception:
            pass

    async def run_maigret(self):
        tool = "maigret"
        cmd_prefix, cwd, is_avail = get_tool_config(tool)
        if not is_avail:
            await self.emit("log", {"tool": tool, "text": "Модуль Maigret не настроен или отсутствует", "level": "error"})
            self.status[tool] = "error"
            return

        self.status[tool] = "running"
        await self.emit("status", {"tool": tool, "status": "running"})
        await self.emit("log", {"tool": tool, "text": f"Запуск Maigret (Быстрый={self.fast_mode})..."})

        out_json_dir = os.path.join(self.output_dir, "maigret")
        os.makedirs(out_json_dir, exist_ok=True)

        user_target = self.clean_username

        cmd = list(cmd_prefix) + [
            user_target,
            "--no-progressbar",
            "--json", "simple",
            "--folderoutput", out_json_dir,
            "--timeout", "15" if self.fast_mode else "30"
        ]
        if self.fast_mode:
            cmd.extend(["--top-sites", "250"])
        else:
            cmd.append("-a")

        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                env=get_subprocess_env(cwd),
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            self.active_processes.append(proc)

            while not self.is_stopped:
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=18.0)
                except asyncio.TimeoutError:
                    if proc.returncode is not None or self.is_stopped:
                        break
                    continue
                if not line:
                    break
                text = strip_ansi(line.decode("utf-8", errors="replace")).strip()
                if not text:
                    continue

                if "[+]" in text and ("http://" in text or "https://" in text):
                    urls = URL_REGEX.findall(text)
                    if urls:
                        url = urls[0]
                        parts = text.split(":")
                        site_name = parts[0].replace("[+]", "").strip() if len(parts) > 1 else ""
                        item = self.record_found(site_name, url, tool)
                        if item:
                            await self.emit("found", {"item": item, "tool": tool})
                            await self.emit("graph", build_osint_graph(self.username, list(self.found_items.values())))
                elif "[-]" not in text:
                    await self.emit("log", {"tool": tool, "text": text[:120]})

            try:
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                if sys.platform == "win32":
                    subprocess.call(f"taskkill /F /T /PID {proc.pid} >nul 2>&1", shell=True)
                else:
                    proc.kill()

            if not self.is_stopped:
                try:
                    for fname in os.listdir(out_json_dir):
                        if fname.endswith(".json"):
                            with open(os.path.join(out_json_dir, fname), "r", encoding="utf-8") as jf:
                                data = json.load(jf)
                                for sname, sdata in data.items():
                                    if sdata.get("status") == "Claimed" and "url_user" in sdata:
                                        url = sdata["url_user"]
                                        meta = {
                                            "tags": sdata.get("tags", []),
                                            "extracted_links": sdata.get("links", []),
                                            "fullname": sdata.get("ids", {}).get("fullname", "")
                                        }
                                        item = self.record_found(sname, url, tool, metadata=meta)
                                        if item:
                                            await self.emit("found", {"item": item, "tool": tool})
                except Exception:
                    pass

                self.status[tool] = "done"
                await self.emit("status", {"tool": tool, "status": "done"})
                await self.emit("log", {"tool": tool, "text": "Maigret завершил поиск!"})
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.status[tool] = "error"
            await self.emit("status", {"tool": tool, "status": "error", "error": str(e)})
        finally:
            if proc and proc in self.active_processes:
                self.active_processes.remove(proc)

    async def run_sherlock(self):
        tool = "sherlock"
        cmd_prefix, cwd, is_avail = get_tool_config(tool)
        if not is_avail:
            await self.emit("log", {"tool": tool, "text": "Модуль Sherlock не настроен или отсутствует", "level": "error"})
            self.status[tool] = "error"
            return

        self.status[tool] = "running"
        await self.emit("status", {"tool": tool, "status": "running"})
        await self.emit("log", {"tool": tool, "text": "Запуск Sherlock..."})

        user_target = self.clean_username
        csv_file = os.path.join(self.output_dir, f"sherlock_{user_target}.csv")
        cmd = list(cmd_prefix) + [
            user_target,
            "--print-found",
            "--csv",
            "--output", csv_file,
            "--timeout", "10" if self.fast_mode else "25"
        ]

        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                env=get_subprocess_env(cwd),
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            self.active_processes.append(proc)

            while not self.is_stopped:
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=18.0)
                except asyncio.TimeoutError:
                    if proc.returncode is not None or self.is_stopped:
                        break
                    continue
                if not line:
                    break
                text = strip_ansi(line.decode("utf-8", errors="replace")).strip()
                if not text:
                    continue

                if "[+]" in text and ("http://" in text or "https://" in text):
                    urls = URL_REGEX.findall(text)
                    if urls:
                        url = urls[0]
                        site_name = text.split(":")[0].replace("[+]", "").strip()
                        item = self.record_found(site_name, url, tool)
                        if item:
                            await self.emit("found", {"item": item, "tool": tool})
                            await self.emit("graph", build_osint_graph(self.clean_username, list(self.found_items.values())))
                elif "Checking" in text or "found" in text.lower():
                    await self.emit("log", {"tool": tool, "text": text[:120]})

            try:
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                if sys.platform == "win32":
                    subprocess.call(f"taskkill /F /T /PID {proc.pid} >nul 2>&1", shell=True)
                else:
                    proc.kill()
            if not self.is_stopped:
                self.status[tool] = "done"
                await self.emit("status", {"tool": tool, "status": "done"})
                await self.emit("log", {"tool": tool, "text": "Sherlock завершил поиск!"})
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.status[tool] = "error"
            await self.emit("status", {"tool": tool, "status": "error", "error": str(e)})
        finally:
            if proc and proc in self.active_processes:
                self.active_processes.remove(proc)

    async def run_blackbird(self):
        tool = "blackbird"
        cmd_prefix, cwd, is_avail = get_tool_config(tool)
        if not is_avail:
            await self.emit("log", {"tool": tool, "text": "Модуль Blackbird не настроен или отсутствует", "level": "error"})
            self.status[tool] = "error"
            return

        self.status[tool] = "running"
        await self.emit("status", {"tool": tool, "status": "running"})
        await self.emit("log", {"tool": tool, "text": "Запуск Blackbird..."})

        user_target = self.clean_username
        cmd = list(cmd_prefix) + [
            "-u", user_target,
            "--json",
            "--timeout", "8" if self.fast_mode else "20"
        ]

        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                env=get_subprocess_env(cwd),
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            self.active_processes.append(proc)

            while not self.is_stopped:
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=18.0)
                except asyncio.TimeoutError:
                    if proc.returncode is not None or self.is_stopped:
                        break
                    continue
                if not line:
                    break
                text = strip_ansi(line.decode("utf-8", errors="replace")).strip()
                if not text:
                    continue

                if ("Found:" in text or "[+]" in text) and ("http://" in text or "https://" in text):
                    urls = URL_REGEX.findall(text)
                    if urls:
                        url = urls[0]
                        site_name = text.split("(")[0].replace("[+]", "").replace("Found:", "").strip()
                        item = self.record_found(site_name, url, tool)
                        if item:
                            await self.emit("found", {"item": item, "tool": tool})
                            await self.emit("graph", build_osint_graph(self.clean_username, list(self.found_items.values())))
                else:
                    await self.emit("log", {"tool": tool, "text": text[:120]})

            try:
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                if sys.platform == "win32":
                    subprocess.call(f"taskkill /F /T /PID {proc.pid} >nul 2>&1", shell=True)
                else:
                    proc.kill()

            if not self.is_stopped:
                bb_json = os.path.join(cwd, "results", f"{user_target}.json")
                if os.path.exists(bb_json):
                    try:
                        with open(bb_json, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            for site in data.get("sites", []):
                                if site.get("status") == "FOUND":
                                    url = site.get("url")
                                    sname = site.get("name", "")
                                    item = self.record_found(sname, url, tool)
                                    if item:
                                        await self.emit("found", {"item": item, "tool": tool})
                    except Exception:
                        pass

                self.status[tool] = "done"
                await self.emit("status", {"tool": tool, "status": "done"})
                await self.emit("log", {"tool": tool, "text": "Blackbird завершил поиск!"})
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.status[tool] = "error"
            await self.emit("status", {"tool": tool, "status": "error", "error": str(e)})
        finally:
            if proc and proc in self.active_processes:
                self.active_processes.remove(proc)

    async def run_snoop(self):
        tool = "snoop"
        cmd_prefix, cwd, is_avail = get_tool_config(tool)
        if not is_avail:
            await self.emit("log", {"tool": tool, "text": "Модуль Snoop не настроен или отсутствует", "level": "error"})
            self.status[tool] = "error"
            return

        self.status[tool] = "running"
        await self.emit("status", {"tool": tool, "status": "running"})
        await self.emit("log", {"tool": tool, "text": "Запуск Snoop Project (фокус на RuNet)..."})

        user_target = self.clean_username
        cmd = list(cmd_prefix) + ["-n", "-f"]
        if self.fast_mode:
            cmd.append("-q")
        cmd.append(user_target)

        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                env=get_subprocess_env(cwd),
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            self.active_processes.append(proc)

            while not self.is_stopped:
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=18.0)
                except asyncio.TimeoutError:
                    if proc.returncode is not None or self.is_stopped:
                        break
                    continue
                if not line:
                    break
                text = strip_ansi(line.decode("utf-8", errors="replace")).strip()
                if not text:
                    continue

                if ("http://" in text or "https://" in text) and not "snoop" in text.lower() and not "github" in text.lower():
                    urls = URL_REGEX.findall(text)
                    if urls:
                        url = urls[0]
                        site_name = text.split(" ")[0].strip()
                        item = self.record_found(site_name, url, tool)
                        if item:
                            await self.emit("found", {"item": item, "tool": tool})
                            await self.emit("graph", build_osint_graph(self.clean_username, list(self.found_items.values())))
                elif "INFO" in text or "Snoop" in text or "Поиск" in text:
                    await self.emit("log", {"tool": tool, "text": text[:120]})

            try:
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                if sys.platform == "win32":
                    subprocess.call(f"taskkill /F /T /PID {proc.pid} >nul 2>&1", shell=True)
                else:
                    proc.kill()
            if not self.is_stopped:
                self.status[tool] = "done"
                await self.emit("status", {"tool": tool, "status": "done"})
                await self.emit("log", {"tool": tool, "text": "Snoop Project завершил поиск!"})
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.status[tool] = "error"
            await self.emit("status", {"tool": tool, "status": "error", "error": str(e)})
        finally:
            if proc and proc in self.active_processes:
                self.active_processes.remove(proc)

    async def run_nexfil(self):
        tool = "nexfil"
        cmd_prefix, cwd, is_avail = get_tool_config(tool)
        if not is_avail:
            await self.emit("log", {"tool": tool, "text": "Модуль Nexfil не настроен или отсутствует", "level": "error"})
            self.status[tool] = "error"
            return

        self.status[tool] = "running"
        await self.emit("status", {"tool": tool, "status": "running"})
        await self.emit("log", {"tool": tool, "text": "Запуск Nexfil (быстрый сканер 350+ сервисов)..."})

        user_target = self.clean_username
        cmd = list(cmd_prefix) + [
            "-u", user_target,
            "-t", "5" if self.fast_mode else "10"
        ]

        proc = None
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                env=get_subprocess_env(cwd),
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT
            )
            self.active_processes.append(proc)

            while not self.is_stopped:
                try:
                    line = await asyncio.wait_for(proc.stdout.readline(), timeout=18.0)
                except asyncio.TimeoutError:
                    if proc.returncode is not None or self.is_stopped:
                        break
                    continue
                if not line:
                    break
                text = strip_ansi(line.decode("utf-8", errors="replace")).strip()
                if not text:
                    continue

                if ("http://" in text or "https://" in text) and not "nexfil" in text.lower() and not "thewhiteh4t" in text.lower():
                    urls = URL_REGEX.findall(text)
                    if urls:
                        url = urls[0]
                        domain = normalize_domain(url)
                        site_name = domain.split(".")[0].capitalize() if domain else "Platform"
                        item = self.record_found(site_name, url, tool)
                        if item:
                            await self.emit("found", {"item": item, "tool": tool})
                            await self.emit("graph", build_osint_graph(self.clean_username, list(self.found_items.values())))
                elif "testing" in text.lower() or "found" in text.lower() or "profiles" in text.lower():
                    await self.emit("log", {"tool": tool, "text": text[:120]})

            try:
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                if sys.platform == "win32":
                    subprocess.call(f"taskkill /F /T /PID {proc.pid} >nul 2>&1", shell=True)
                else:
                    proc.kill()
            if not self.is_stopped:
                self.status[tool] = "done"
                await self.emit("status", {"tool": tool, "status": "done"})
                await self.emit("log", {"tool": tool, "text": "Nexfil завершил поиск!"})
        except asyncio.CancelledError:
            pass
        except Exception as e:
            self.status[tool] = "error"
            await self.emit("status", {"tool": tool, "status": "error", "error": str(e)})
        finally:
            if proc and proc in self.active_processes:
                self.active_processes.remove(proc)

    async def run_holehe(self):
        tool = "holehe"
        cmd_prefix, cwd, is_avail = get_tool_config(tool)
        if not is_avail:
            await self.emit("log", {"tool": tool, "text": "Модуль Holehe не настроен или отсутствует", "level": "error"})
            self.status[tool] = "error"
            return

        self.status[tool] = "running"
        await self.emit("status", {"tool": tool, "status": "running"})

        if self.is_email:
            target_emails = [self.target_email]
        else:
            target_emails = [
                f"{self.clean_username}@mail.ru",
                f"{self.clean_username}@yandex.ru",
                f"{self.clean_username}@gmail.com"
            ]

        await self.emit("log", {"tool": tool, "text": f"Holehe: проверка привязок email ({', '.join(target_emails)})..."})

        for target_email in target_emails:
            if self.is_stopped:
                break

            cmd = list(cmd_prefix) + [
                target_email,
                "--only-used",
                "--no-color",
                "--no-clear",
                "-T", "5" if self.fast_mode else "10"
            ]

            proc = None
            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    cwd=cwd,
                    env=get_subprocess_env(cwd),
                    stdin=asyncio.subprocess.DEVNULL,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT
                )
                self.active_processes.append(proc)

                while not self.is_stopped:
                    try:
                        line = await asyncio.wait_for(proc.stdout.readline(), timeout=18.0)
                    except asyncio.TimeoutError:
                        if proc.returncode is not None or self.is_stopped:
                            break
                        continue
                    if not line:
                        break
                    text = strip_ansi(line.decode("utf-8", errors="replace")).strip()
                    if not text:
                        continue

                    if "[+]" in text and not "Email used" in text:
                        clean_line = text.replace("[+]", "").strip()
                        parts = clean_line.split(" ")
                        domain = parts[0].strip()
                        extra_info = " ".join(parts[1:]).strip() if len(parts) > 1 else ""
                        if domain:
                            site_name = domain.split(".")[0].capitalize()
                            url = f"https://{domain}" if not domain.startswith("http") else domain
                            meta = {"email": target_email, "type": "Email Registration"}
                            if extra_info:
                                meta["details"] = extra_info
                            item = self.record_found(site_name, url, tool, metadata=meta)
                            if item:
                                await self.emit("found", {"item": item, "tool": tool})
                                await self.emit("graph", build_osint_graph(self.clean_username, list(self.found_items.values())))
                    elif "[-]" not in text and "[x]" not in text and "*" not in text:
                        await self.emit("log", {"tool": tool, "text": text[:120]})

                try:
                    await asyncio.wait_for(proc.wait(), timeout=3.0)
                except asyncio.TimeoutError:
                    if sys.platform == "win32":
                        subprocess.call(f"taskkill /F /T /PID {proc.pid} >nul 2>&1", shell=True)
                    else:
                        proc.kill()
            except asyncio.CancelledError:
                break
            except Exception as e:
                await self.emit("log", {"tool": tool, "text": f"Holehe ({target_email}): {e}", "level": "error"})
            finally:
                if proc and proc in self.active_processes:
                    self.active_processes.remove(proc)

        if not self.is_stopped:
            self.status[tool] = "done"
            await self.emit("status", {"tool": tool, "status": "done"})
            await self.emit("log", {"tool": tool, "text": "Holehe завершил проверку привязок!"})

    async def execute_all(self):
        await self.emit("start", {"username": self.clean_username, "tools": self.enabled_tools, "target": self.raw_target})
        
        # 1. Preload any verified existing profiles for immediate display
        await self.preload_known_profiles()

        self.active_tasks = []

        # 2. Specialized Vector Intelligence (Autonomous)
        self.active_tasks.append(asyncio.create_task(self.run_breach_intelligence()))

        if self.is_email:
            self.active_tasks.append(asyncio.create_task(self.run_email_intelligence()))
        elif self.is_phone:
            self.active_tasks.append(asyncio.create_task(self.run_phone_intelligence()))
        else:
            self.active_tasks.append(asyncio.create_task(self.run_telegram_intelligence()))

        # Timeout wrapper so no single hanging engine stalls the whole system
        async def run_safe(coro, timeout=70.0):
            try:
                await asyncio.wait_for(coro, timeout=timeout)
            except (asyncio.TimeoutError, asyncio.CancelledError):
                pass
            except Exception:
                pass

        timeout_sec = 65.0 if self.fast_mode else 130.0

        # 3. Parallel Multi-engine scan
        if "maigret" in self.enabled_tools:
            self.active_tasks.append(asyncio.create_task(run_safe(self.run_maigret(), timeout=timeout_sec)))
        if "sherlock" in self.enabled_tools:
            self.active_tasks.append(asyncio.create_task(run_safe(self.run_sherlock(), timeout=timeout_sec)))
        if "blackbird" in self.enabled_tools:
            self.active_tasks.append(asyncio.create_task(run_safe(self.run_blackbird(), timeout=timeout_sec)))
        if "snoop" in self.enabled_tools:
            self.active_tasks.append(asyncio.create_task(run_safe(self.run_snoop(), timeout=timeout_sec)))
        if "nexfil" in self.enabled_tools:
            self.active_tasks.append(asyncio.create_task(run_safe(self.run_nexfil(), timeout=timeout_sec)))
        if "holehe" in self.enabled_tools:
            self.active_tasks.append(asyncio.create_task(run_safe(self.run_holehe(), timeout=timeout_sec)))

        if self.active_tasks:
            await asyncio.gather(*self.active_tasks, return_exceptions=True)

        final_items = list(self.found_items.values())
        final_graph = build_osint_graph(self.clean_username, final_items)
        await self.emit("graph", final_graph)
        await self.emit("complete", {
            "username": self.clean_username,
            "target": self.raw_target,
            "total_found": len(final_items),
            "items": final_items
        })
        self.is_active = False
        self.save_checkpoint()
