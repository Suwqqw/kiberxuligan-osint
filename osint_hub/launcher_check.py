import sys
import os
import subprocess
import socket
import time

print("=" * 66)
print("     KIberXuligan OSINT v4.5 — Предстартовая диагностика")
print("=" * 66)

# 1. Check Python version
py_ver = sys.version_info
ver_str = f"{py_ver.major}.{py_ver.minor}.{py_ver.micro}"
is_64bit = sys.maxsize > 2**32
arch = "64-bit" if is_64bit else "32-bit"
if py_ver < (3, 8):
    print(f"\n[X] ОШИБКА: Требуется Python версии 3.8 или выше. Текущая: {ver_str}")
    sys.exit(1)
print(f"[OK] Python: {ver_str} ({arch}) [{sys.executable}]")

# 2. Check Core Files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORTABLE_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
required_files = [
    (os.path.join(BASE_DIR, "server.py"), "Ядро сервера (server.py)"),
    (os.path.join(BASE_DIR, "extra_tools.py"), "Модули разведки (extra_tools.py)"),
    (os.path.join(BASE_DIR, "runner.py"), "Диспетчер сканирования (runner.py)"),
    (os.path.join(BASE_DIR, "static", "index.html"), "Интерфейс веб-панели (index.html)"),
    (os.path.join(BASE_DIR, "static", "app.js"), "Логика интерфейса (app.js)")
]

all_files_ok = True
for f_path, label in required_files:
    if not os.path.exists(f_path):
        print(f"[X] ОШИБКА: Не найден обязательный файл: {label} ({f_path})")
        all_files_ok = False
if not all_files_ok:
    sys.exit(1)
print(f"[OK] Все критические файлы сервера и веб-интерфейса на месте")

# Check engines
engines = ["maigret", "sherlock", "blackbird", "snoop"]
ready_engines = []
for eng in engines:
    eng_dir = os.path.join(PORTABLE_DIR, eng)
    if os.path.isdir(eng_dir):
        ready_engines.append(eng)
print(f"[OK] Движки разведки по никнейму ({len(ready_engines)}/{len(engines)}): {', '.join(ready_engines)}")

# 3. Check Required Packages
req_modules = {
    "fastapi": "fastapi",
    "uvicorn": "uvicorn",
    "requests": "requests",
    "PIL": "Pillow",
    "cv2": "opencv-python-headless",
    "playwright": "playwright",
    "phonenumbers": "phonenumbers",
    "pydantic": "pydantic"
}

missing_pkgs = []
for mod_name, pkg_name in req_modules.items():
    try:
        __import__(mod_name)
    except ImportError:
        missing_pkgs.append(pkg_name)

if missing_pkgs:
    print(f"\n[!] Обнаружены недостающие библиотеки: {', '.join(missing_pkgs)}")
    print("[*] Запуск автоматической установки через pip...")
    for pkg in missing_pkgs:
        print(f"[*] Установка {pkg}...")
        cmd = [sys.executable, "-m", "pip", "install", pkg, "--quiet"]
        ret = subprocess.call(cmd)
        if ret != 0:
            print(f"[X] ОШИБКА: Не удалось установить пакет: {pkg}")
            print(f"    Попробуйте вручную: pip install {pkg}")
            sys.exit(1)
    print("[OK] Все недостающие библиотеки успешно установлены!")
else:
    print("[OK] Все необходимые библиотеки Python установлены")

# 4. Check Playwright Chromium Browser
try:
    from playwright.sync_api import sync_playwright
    pw_ok = False
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(headless=True)
            b.close()
            pw_ok = True
    except Exception as e:
        pw_ok = False

    if not pw_ok:
        print("\n[*] Загрузка браузера Chromium для Playwright (нужно для поиска по фото и VK)...")
        ret = subprocess.call([sys.executable, "-m", "playwright", "install", "chromium"])
        if ret == 0:
            print("[OK] Браузер Chromium успешно установлен!")
        else:
            print("[!] Внимание: Не удалось установить Chromium для Playwright. Функции визуального поиска будут работать в базовом режиме.")
    else:
        print("[OK] Браузер Playwright Chromium готов к работе")
except Exception as e:
    print(f"[!] Предупреждение Playwright: {e}")

# 5. Check Port 8888 and free it if stale process exists
def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

if is_port_in_use(8888):
    print("\n[*] Порт 8888 уже занят. Поиск и завершение старого процесса...")
    # Find PID on 8888
    try:
        out = subprocess.check_output('netstat -ano | findstr :8888 | findstr LISTENING', shell=True).decode()
        pids = set()
        for line in out.strip().splitlines():
            parts = line.strip().split()
            if parts:
                pids.add(parts[-1])
        for pid in pids:
            if pid.isdigit() and int(pid) != os.getpid():
                print(f"[*] Освобождение порта: завершение PID {pid}...")
                subprocess.call(f"taskkill /F /PID {pid} >nul 2>&1", shell=True)
        time.sleep(1)
    except Exception:
        pass

    if is_port_in_use(8888):
        print("[!] Внимание: Порт 8888 все еще занят другим приложением!")
    else:
        print("[OK] Порт 8888 успешно освобожден")
else:
    print("[OK] Порт 8888 свободен")

print("\n" + "=" * 66)
print("     [ГОТОВО] Все проверки пройдены! Запуск веб-сервера...")
print("=" * 66 + "\n")
