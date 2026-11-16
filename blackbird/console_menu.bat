@echo off
chcp 65001 >nul
title Blackbird OSINT Console Menu
color 0E
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
echo                 BLACKBIRD OSINT TOOL
echo ========================================================
echo.
echo  [1] Поиск по никнейму в консоли
echo  [2] Поиск с экспортом в PDF / CSV
echo  [3] Запуск локального Web-интерфейса (в браузере)
echo  [4] Справка по командам (--help)
echo  [5] Открыть папку с результатами (results)
echo  [0] Выход
echo.
echo ========================================================
set /p choice="Выберите действие [0-5]: "

if "%choice%"=="1" goto SEARCH1
if "%choice%"=="2" goto EXPORT
if "%choice%"=="3" goto WEB
if "%choice%"=="4" goto HELP
if "%choice%"=="5" goto OPEN_RESULTS
if "%choice%"=="0" exit /b
goto MENU

:SEARCH1
cls
set /p username="Введите никнейм для поиска: "
if "%username%"=="" goto MENU
echo.
echo [*] Запуск Blackbird для "%username%"...
.venv\Scripts\python.exe blackbird.py -u "%username%"
echo.
pause
goto MENU

:EXPORT
cls
set /p username="Введите никнейм для поиска: "
if "%username%"=="" goto MENU
echo.
echo [*] Запуск Blackbird с экспортом в PDF и CSV...
.venv\Scripts\python.exe blackbird.py -u "%username%" --pdf --csv
echo.
pause
goto MENU

:WEB
cls
echo [*] Запуск веб-сервера Blackbird...
echo Откройте в браузере: http://127.0.0.1:9797
start http://127.0.0.1:9797
.venv\Scripts\python.exe blackbird.py --web
pause
goto MENU

:HELP
cls
.venv\Scripts\python.exe blackbird.py --help
echo.
pause
goto MENU

:OPEN_RESULTS
start "" "results"
goto MENU
