@echo off
chcp 65001 >nul
title Sherlock OSINT
cd /d "%~dp0"
call console_menu.bat
