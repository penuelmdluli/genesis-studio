@echo off
REM Morning health check for the hype-reel pages (Task Scheduler: "Genesis Hype Health", 07:00).
REM Writes C:\Users\PenuelM\genesis-work\reports\health-<date>.md
cd /d "%~dp0.."
set LOGDIR=C:\Users\PenuelM\genesis-work\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
docker start genesis-scraper >nul 2>&1
call npx -y dotenv-cli@7.4.2 -e .env.local -- npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts\genesis-health.ts > "%LOGDIR%\health-last.txt" 2>&1
