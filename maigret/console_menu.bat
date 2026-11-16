@echo off
chcp 65001 >nul
title Maigret OSINT Console Menu
color 0A

cd /d "%~dp0"

if not exist ".venv\Scripts\maigret.exe" (
    echo.
    echo ========================================================
    echo  [!] ОШИБКА: Исполняемый файл Maigret не найден!
    echo ========================================================
    echo.
    pause
    exit /b
)

if not exist "reports" mkdir reports

:MENU
cls
echo ========================================================
echo                 MAIGRET OSINT TOOL
echo ========================================================
echo.
echo  [1] Обычный поиск (все сайты + HTML-отчет)
echo  [2] Быстрый поиск (топ-500 популярных сайтов)
echo  [3] Полный поиск (HTML + PDF + Граф связей)
echo  [4] Поиск по нескольким никнеймам
echo  [5] Запуск локального Веб-интерфейса в браузере
echo  [6] Запуск графического интерфейса (Окно GUI)
echo  [7] Обновить базу сайтов Maigret
echo  [8] Открыть папку с отчетами
echo  [9] Справка по всем флагам (--help)
echo  [0] Выход
echo.
echo ========================================================
set /p choice="Выберите действие [0-9]: "

if "%choice%"=="1" goto STANDARD
if "%choice%"=="2" goto FAST
if "%choice%"=="3" goto DEEP
if "%choice%"=="4" goto MULTI
if "%choice%"=="5" goto WEBUI
if "%choice%"=="6" goto GUI
if "%choice%"=="7" goto UPDATE
if "%choice%"=="8" goto OPENREPORTS
if "%choice%"=="9" goto HELP
if "%choice%"=="0" exit /b

echo [!] Неверный выбор.
ping 127.0.0.1 -n 2 >nul
goto MENU

:STANDARD
cls
echo ========================================================
echo              Обычный поиск (все сайты + HTML)
echo ========================================================
echo.
set /p uname="Введите никнейм для поиска: "
if "%uname%"=="" goto MENU
echo.
echo [*] Запуск сканирования для '%uname%'...
".venv\Scripts\maigret.exe" %uname% -a -H --folderoutput reports
echo.
echo [*] Сканирование завершено.
pause
goto MENU

:FAST
cls
echo ========================================================
echo           Быстрый поиск (Топ-500 сайтов + HTML)
echo ========================================================
echo.
set /p uname="Введите никнейм для поиска: "
if "%uname%"=="" goto MENU
echo.
echo [*] Запуск быстрого сканирования для '%uname%'...
".venv\Scripts\maigret.exe" %uname% --top-sites 500 -H --folderoutput reports
echo.
echo [*] Сканирование завершено.
pause
goto MENU

:DEEP
cls
echo ========================================================
echo          Полный поиск (все сайты + HTML + PDF + Граф)
echo ========================================================
echo.
set /p uname="Введите никнейм для поиска: "
if "%uname%"=="" goto MENU
echo.
echo [*] Запуск глубокого сканирования для '%uname%'...
".venv\Scripts\maigret.exe" %uname% -a -H -P -G --folderoutput reports
echo.
echo [*] Сканирование завершено.
pause
goto MENU

:MULTI
cls
echo ========================================================
echo             Поиск по нескольким никнеймам
echo ========================================================
echo.
echo Введите никнеймы через пробел:
set /p unames="Никнеймы: "
if "%unames%"=="" goto MENU
echo.
echo [*] Запуск сканирования...
".venv\Scripts\maigret.exe" %unames% -a -H --folderoutput reports
echo.
echo [*] Сканирование завершено.
pause
goto MENU

:WEBUI
cls
echo [*] Запуск веб-сервера Maigret...
start "" "http://127.0.0.1:5000"
".venv\Scripts\maigret.exe" --web 5000
pause
goto MENU

:GUI
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0gui.ps1"
goto MENU

:UPDATE
cls
echo [*] Обновление базы сайтов...
".venv\Scripts\maigret.exe" --force-update
echo [*] Обновление завершено.
pause
goto MENU

:OPENREPORTS
start "" "reports"
goto MENU

:HELP
cls
".venv\Scripts\maigret.exe" --help
pause
goto MENU