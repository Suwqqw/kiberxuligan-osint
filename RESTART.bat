@echo off
chcp 65001 >nul
title KIberXuligan OSINT — Перезапуск сервера
color 0E
cd /d "%~dp0"

echo ===================================================================
echo             Перезапуск сервера KIberXuligan OSINT
echo ===================================================================
echo.
echo [*] Принудительное освобождение порта 8888...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":8888" ^| findstr "LISTENING"') do (
    echo [*] Завершение процесса PID: %%a...
    taskkill /F /PID %%a >nul 2>&1
)

ping -n 2 127.0.0.1 >nul
echo [OK] Порт 8888 очищен!
echo.
echo [*] Запуск через единый лаунчер START.bat...
call START.bat
