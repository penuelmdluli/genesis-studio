@echo off
REM Reel scoreboards for every hype-reel page (Task Scheduler: "Genesis Hype Metrics").
REM Writes C:\Users\PenuelM\genesis-work\metrics\latest-<page>.md
cd /d "%~dp0.."
set LOGDIR=C:\Users\PenuelM\genesis-work\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
echo ===== %DATE% %TIME% metrics ===== >> "%LOGDIR%\metrics.log"
for %%P in (genesis_news mzansi_daily_news pawsome_daily) do (
  call npx -y dotenv-cli@7.4.2 -e .env.local -- npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts\genesis-metrics.ts --page %%P --days 14 >> "%LOGDIR%\metrics.log" 2>&1
)
