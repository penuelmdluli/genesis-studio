@echo off
REM Daily self-review of the hype-reel pipeline (Task Scheduler: "Genesis Hype Review").
REM Report: C:\Users\PenuelM\genesis-work\reports\review-<date>.md
cd /d "%~dp0.."
set LOGDIR=C:\Users\PenuelM\genesis-work\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
echo ===== %DATE% %TIME% review ===== >> "%LOGDIR%\review.log"
call npx -y dotenv-cli@7.4.2 -e .env.local -- npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts\genesis-review.ts >> "%LOGDIR%\review.log" 2>&1
