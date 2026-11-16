@echo off
chcp 65001 >nul
title KIberXuligan OSINT — Launcher v4.5
color 0B
cd /d "%~dp0"

echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                   KIberXuligan OSINT v4.5                         ║
echo ║               Единый интеллектуальный лаунчер                     ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.

:: 1. Поиск интерпретатора Python
set "PY="
if exist "%~dp0python_runtime\python.exe" set "PY=%~dp0python_runtime\python.exe"

if not defined PY (
    where python >nul 2>&1
    if %ERRORLEVEL% equ 0 set "PY=python"
)

if not defined PY (
    where py >nul 2>&1
    if %ERRORLEVEL% equ 0 set "PY=py"
)

if not defined PY (
    if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PY=%LocalAppData%\Programs\Python\Python312\python.exe"
    if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PY=%LocalAppData%\Programs\Python\Python311\python.exe"
    if exist "%LocalAppData%\Programs\Python\Python310\python.exe" set "PY=%LocalAppData%\Programs\Python\Python310\python.exe"
    if exist "%ProgramFiles%\Python312\python.exe" set "PY=%ProgramFiles%\Python312\python.exe"
    if exist "%ProgramFiles%\Python311\python.exe" set "PY=%ProgramFiles%\Python311\python.exe"
    if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
    if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"
)

:: Автоматическая автоустановка для компьютеров без Python
if not defined PY (
    echo ===================================================================
    echo  [ИНФО] Python не обнаружен на этом ПК.
    echo  Запуск автоматической установки Python 3.12 в один клик...
    echo ===================================================================
    echo.
    where winget >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        echo [*] Установка Python через Windows Package Manager (winget)...
        winget install --id Python.Python.3.12 -e --silent --accept-source-agreements --accept-package-agreements
        timeout /t 5 >nul
        if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
            set "PY=%LocalAppData%\Programs\Python\Python312\python.exe"
            echo [OK] Python успешно установлен автоматически!
        ) else (
            where python >nul 2>&1
            if %ERRORLEVEL% equ 0 set "PY=python"
        )
    )
)

if not defined PY (
    color 0C
    echo ===================================================================
    echo  [ОШИБКА] Python 3 не обнаружен на вашем компьютере!
    echo ===================================================================
    echo  Для работы требуется установленный Python 3.8+.
    echo.
    echo  Как исправить (за 1 минуту):
    echo  1. Скачайте Python с официального сайта: https://www.python.org/downloads/
    echo  2. При установке ОБЯЗАТЕЛЬНО поставьте галочку:
    echo     [v] Add python.exe to PATH
    echo ===================================================================
    echo.
    pause
    exit /b 1
)

:: 2. Запуск предстартовой диагностики компонентов и зависимостей
"%PY%" osint_hub\launcher_check.py
if %ERRORLEVEL% neq 0 (
    color 0C
    echo ===================================================================
    echo  [ОШИБКА] Предстартовая проверка выявила критические проблемы!
    echo  Сервер не может быть запущен до устранения ошибок выше.
    echo ===================================================================
    echo.
    pause
    exit /b 1
)

:: 3. Запуск веб-сервера Hub
cd osint_hub
echo [*] Запуск сервера KIberXuligan на http://127.0.0.1:8888 ...
echo [*] Браузер откроется автоматически через 1-2 секунды!
echo [*] Чтобы выключить сервер, просто закройте это окно (или нажмите Ctrl+C).
echo.
"%PY%" server.py
set "EXIT_CODE=%ERRORLEVEL%"

if %EXIT_CODE% neq 0 (
    color 0C
    echo.
    echo ===================================================================
    echo  [ОШИБКА] Сервер завершил работу с кодом ошибки: %EXIT_CODE%
    echo ===================================================================
    echo  Изучите сообщение об ошибке выше. Окно НЕ закроется автоматически,
    echo  чтобы вы могли прочитать текст сбоя.
    echo ===================================================================
    echo.
    pause
)
