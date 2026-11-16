@echo off
chcp 65001 >nul
title Sherlock OSINT Console Menu
color 0B
cd /d "%~dp0"

if not exist ".venv\Scripts\sherlock.exe" (
    echo.
    echo ========================================================
    echo  [!] ОШИБКА: Исполняемый файл Sherlock не найден!
    echo ========================================================
    pause
    exit /b
)

if not exist "reports" mkdir reports

:MENU
cls
echo ========================================================
echo                 SHERLOCK OSINT TOOL
echo ========================================================
echo.
echo  [1] Стандартный поиск по никнейму
echo  [2] Поиск только с выводом найденных сайтов (--print-found)
echo  [3] Поиск с сохранением в TXT и CSV (--folderoutput reports)
echo  [4] Поиск по списку никнеймов
echo  [5] Проверить версию и справку (--help)
echo  [6] Открыть папку с отчетами (reports)
echo  [0] Выход
echo.
echo ========================================================
set /p choice="Выберите действие [0-6]: "

if "%choice%"=="1" goto SEARCH1
if "%choice%"=="2" goto SEARCH2
if "%choice%"=="3" goto SEARCH3
if "%choice%"=="4" goto SEARCH_MULTI
if "%choice%"=="5" goto HELP
if "%choice%"=="6" goto OPEN_REPORTS
if "%choice%"=="0" exit /b
goto MENU

:SEARCH1
cls
set /p username="Введите никнейм для поиска: "
if "%username%"=="" goto MENU
echo.
echo [*] Запуск Sherlock для "%username%"...
.venv\Scripts\sherlock.exe --folderoutput reports "%username%"
echo.
pause
goto MENU

:SEARCH2
cls
set /p username="Введите никнейм для поиска: "
if "%username%"=="" goto MENU
echo.
echo [*] Запуск Sherlock (--print-found) для "%username%"...
.venv\Scripts\sherlock.exe --print-found --folderoutput reports "%username%"
echo.
pause
goto MENU

:SEARCH3
cls
set /p username="Введите никнейм для поиска: "
if "%username%"=="" goto MENU
echo.
echo [*] Запуск Sherlock с выгрузкой CSV для "%username%"...
.venv\Scripts\sherlock.exe --csv --folderoutput reports "%username%"
echo.
pause
goto MENU

:SEARCH_MULTI
cls
set /p usernames="Введите никнеймы через пробел: "
if "%usernames%"=="" goto MENU
echo.
echo [*] Запуск Sherlock для списка: %usernames%...
.venv\Scripts\sherlock.exe --print-found --folderoutput reports %usernames%
echo.
pause
goto MENU

:HELP
cls
.venv\Scripts\sherlock.exe --help
echo.
pause
goto MENU

:OPEN_REPORTS
start "" "reports"
goto MENU
