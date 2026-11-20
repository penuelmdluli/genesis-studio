@echo off
REM Nightly Creative Commons footage harvest (Task Scheduler: "Genesis Footage Library", 01:30).
REM Grows reels\footage-library-<page>.json so no slot dies for lack of footage.
cd /d "%~dp0.."
set LOGDIR=C:\Users\PenuelM\genesis-work\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
docker start genesis-scraper >nul 2>&1
echo. >> "%LOGDIR%\harvest.log"
echo ===== %DATE% %TIME% harvest ===== >> "%LOGDIR%\harvest.log"
call npx -y dotenv-cli@7.4.2 -e .env.local -- npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts\genesis-harvest.ts >> "%LOGDIR%\harvest.log" 2>&1
