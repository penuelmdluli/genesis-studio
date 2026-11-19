@echo off
REM One hype-reel slot (Task Scheduler: "Genesis Hype Reel HHMM", "Mzansi Hype Reel HHMM").
REM Usage: run_genesis_hype.cmd [page]   (default genesis_news; e.g. mzansi_daily_news)
REM Picks today's best story, makes the reel locally and posts it.
REM Needs: Docker Desktop (genesis-scraper container), claude CLI, Python TTS.
cd /d "%~dp0.."
set PAGE=%~1
if "%PAGE%"=="" set PAGE=genesis_news
set LOGDIR=C:\Users\PenuelM\genesis-work\logs
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set LOG=%LOGDIR%\hype.log

echo. >> "%LOG%"
echo ===== %DATE% %TIME% hype slot %PAGE% ===== >> "%LOG%"

docker info >nul 2>&1
if errorlevel 1 (
  echo starting Docker Desktop >> "%LOG%"
  start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  timeout /t 120 /nobreak >nul
)
docker start genesis-scraper >> "%LOG%" 2>&1

call npx -y dotenv-cli@7.4.2 -e .env.local -- npx -y tsx@4.19.2 --tsconfig tsconfig.json scripts\genesis-hype.ts --auto --publish --page %PAGE% >> "%LOG%" 2>&1
echo exit %ERRORLEVEL% >> "%LOG%"
