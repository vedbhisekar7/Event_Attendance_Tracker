@echo off
setlocal
cd /d "%~dp0"
echo.
echo   Gather - Event Attendance Tracker
echo.

if exist ".venv\Scripts\python.exe" goto install
where py >nul 2>nul
if errorlevel 1 (
    python -m venv .venv
) else (
    py -3 -m venv .venv
)
if errorlevel 1 goto python_error

:install
".venv\Scripts\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 'Python 3.10 or newer is required.')"
if errorlevel 1 goto python_error
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 goto dependency_error

if not defined PORT set PORT=8000
echo.
echo Open http://localhost:%PORT% in your browser. Keep this window open.
echo Press Ctrl+C to stop. Your attendance remains saved.
echo.
".venv\Scripts\python.exe" app.py
if errorlevel 1 goto runtime_error
exit /b 0

:python_error
echo.
echo Python setup failed. Install Python 3.10 or newer from python.org.
echo Select "Add python.exe to PATH" during installation, then run this file again.
echo If .venv was created with an older Python, delete only .venv and retry.
pause
exit /b 1

:dependency_error
echo.
echo Could not install Flask. Check your internet connection and try again.
pause
exit /b 1

:runtime_error
echo.
echo Gather could not start. See the error above and the README troubleshooting section.
pause
exit /b 1
