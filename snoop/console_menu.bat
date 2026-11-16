@echo off
chcp 65001 >nul
title Snoop Project OSINT Console Menu
color 0D
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo.
    echo ========================================================
    echo  [!] ОШИБКА: Виртуальное окружение не найдено!
    echo ========================================================
    pause
    exit /b
)

:MENU
cls
echo ========================================================
echo                 SNOOP PROJECT OSINT TOOL
echo ========================================================
echo.
echo  [1] Стандартный поиск по никнейму
echo  [2] Быстрый поиск в нормальном режиме
echo  [3] Поиск по списку никнеймов
echo  [4] Обновить базу данных сайтов Snoop
echo  [5] Справка по всем ключам (--help)
echo  [6] Открыть папку с результатами
echo  [0] Выход
echo.
echo ========================================================
set /p choice="Выберите действие [0-6]: "

if "%choice%"=="1" goto SEARCH1
if "%choice%"=="2" goto SEARCH2
if "%choice%"=="3" goto SEARCH_MULTI
if "%choice%"=="4" goto UPDATE
if "%choice%"=="5" goto HELP
if "%choice%"=="6" goto OPEN_RESULTS
if "%choice%"=="0" exit /b
goto MENU

:SEARCH1
cls
set /p username="Введите никнейм для поиска: "
if "%username%"=="" goto MENU
echo.
echo [*] Запуск Snoop для "%username%"...
.venv\Scripts\python.exe snoop.py -u "%username%"
echo.
pause
goto MENU

:SEARCH2
cls
set /p username="Введите никнейм для поиска: "
if "%username%"=="" goto MENU
echo.
echo [*] Запуск Snoop (normal) для "%username%"...
.venv\Scripts\python.exe snoop.py -u "%username%" -n
echo.
pause
goto MENU

:SEARCH_MULTI
cls
set /p usernames="Введите никнеймы через запятую или пробел: "
if "%usernames%"=="" goto MENU
echo.
echo [*] Запуск Snoop для списка: %usernames%...
.venv\Scripts\python.exe snoop.py -u %usernames%
echo.
pause
goto MENU

:UPDATE
cls
echo [*] Обновление Snoop...
.venv\Scripts\python.exe snoop.py --update
echo.
pause
goto MENU

:HELP
cls
.venv\Scripts\python.exe snoop.py --help
echo.
pause
goto MENU

:OPEN_RESULTS
start "" "results"
goto MENU
