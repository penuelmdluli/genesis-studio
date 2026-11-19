@echo off
REM Mzansi Daily News hype-reel slot (Task Scheduler: "Mzansi Hype Reel HHMM").
REM A wrapper because run_hidden.vbs passes only the script path, no arguments.
call "%~dp0run_genesis_hype.cmd" mzansi_daily_news
