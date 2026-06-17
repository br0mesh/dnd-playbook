@echo off
where node >nul 2>&1 && node "%~dp0build-sources.js" %* && exit /b %ERRORLEVEL%
python "%~dp0build-sources.py" %*
