@echo off
chcp 65001 >nul
title KIberXuligan OSINT - Launcher
color 0B
cd /d "%~dp0"

echo ========================================================
echo               KIberXuligan OSINT Workstation
echo ========================================================
echo.

set "PY="
where python >nul 2>&1
if %ERRORLEVEL% equ 0 set "PY=python"

if not defined PY (
    where py >nul 2>&1
    if %ERRORLEVEL% equ 0 set "PY=py"
)

if not defined PY (
    if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PY=%LocalAppData%\Programs\Python\Python312\python.exe"
    if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PY=%LocalAppData%\Programs\Python\Python311\python.exe"
    if exist "%LocalAppData%\Programs\Python\Python310\python.exe" set "PY=%LocalAppData%\Programs\Python\Python310\python.exe"
    if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
    if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"
)

if not defined PY (
    echo [ИНФО] Python не обнаружен на этом ПК.
    echo [ИНФО] Запуск автоустановки Python 3.12 через winget...
    where winget >nul 2>&1
    if %ERRORLEVEL% equ 0 (
        winget install --id Python.Python.3.12 -e --silent --accept-source-agreements --accept-package-agreements
        if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PY=%LocalAppData%\Programs\Python\Python312\python.exe"
    )
)

if not defined PY (
    color 0C
    echo [ОШИБКА] Python 3 не обнаружен на вашем компьютере!
    echo Скачайте Python с официального сайта: https://www.python.org/downloads/
    echo При установке обязательно отметьте галочку Add python.exe to PATH.
    echo.
    pause
    exit /b 1
)

echo [OK] Найден Python: %PY%
echo [*] Проверка и подготовка компонентов...
"%PY%" osint_hub\launcher_check.py
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ОШИБКА] Проверка компонентов выявила сбой.
    pause
    exit /b 1
)

echo [*] Запуск сервера KIberXuligan на http://127.0.0.1:8888 ...
cd osint_hub
"%PY%" server.py
set "ERR=%ERRORLEVEL%"
if %ERR% neq 0 (
    color 0C
    echo [СБОЙ] Сервер завершил работу с кодом: %ERR%
    pause
)
