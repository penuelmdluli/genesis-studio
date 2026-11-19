@echo off
REM Genesis News reel scoreboard (Task Scheduler: "Genesis Hype Metrics").
REM Writes C:\Users\PenuelM\genesis-work\metrics\latest-genesis_news.md
cd /d "%~dp0.."
set LOGDIR=C:\Users\PenuelM\genesis-work\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
echo ===== %DATE% %TIME% metrics ===== >> "%LOGDIR%\metrics.log"
call npx -y dotenv-cli@7.4.2 -e .env.local -- npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts\genesis-metrics.ts --page genesis_news --days 14 >> "%LOGDIR%\metrics.log" 2>&1
