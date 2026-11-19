@echo off
REM Overnight spare reels (Task Scheduler: "Genesis Hype Spares", 04:30).
REM For each page with no spare waiting, makes ONE evergreen reel (not posted)
REM into reels\spare-<page>.json. A slot whose stories all fall through posts
REM it instead of leaving the slot empty.
REM Its own log: a slot running at the same time holds hype-<page>.log open.
cd /d "%~dp0.."
set LOGDIR=C:\Users\PenuelM\genesis-work\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set LOG=%LOGDIR%\spares.log
docker info >nul 2>&1
if errorlevel 1 (
  echo starting Docker Desktop >> "%LOG%"
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  timeout /t 120 /nobreak >nul
)
docker start genesis-scraper >> "%LOG%" 2>&1
for %%P in (genesis_news mzansi_daily_news pawsome_daily) do (
  echo. >> "%LOG%"
  echo ===== %DATE% %TIME% spare %%P ===== >> "%LOG%"
  call npx -y dotenv-cli@7.4.2 -e .env.local -- npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts\genesis-hype.ts --spare --page %%P >> "%LOG%" 2>&1
)
echo ===== %DATE% %TIME% spares done ===== >> "%LOG%"
