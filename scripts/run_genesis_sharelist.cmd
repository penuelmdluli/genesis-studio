@echo off
REM Daily manual-share list (Task Scheduler: "Genesis Share List").
REM Report: C:\Users\PenuelM\genesis-work\reports\share-<date>.md
cd /d "%~dp0.."
set LOGDIR=C:\Users\PenuelM\genesis-work\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
echo ===== %DATE% %TIME% share list ===== >> "%LOGDIR%\sharelist.log"
call npx -y dotenv-cli@7.4.2 -e .env.local -- npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts\genesis-sharelist.ts >> "%LOGDIR%\sharelist.log" 2>&1
