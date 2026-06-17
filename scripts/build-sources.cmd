@echo off
REM Validate content + spell closure: scripts\build-sources.cmd
REM Sync missing spells from demo/stubs: scripts\build-sources.cmd --sync-spells
REM Split legacy bilingual .md: scripts\build-sources.cmd --split-legacy
where node >nul 2>&1 && node "%~dp0build-sources.js" %* && exit /b %ERRORLEVEL%
python "%~dp0build-sources.py" %*
