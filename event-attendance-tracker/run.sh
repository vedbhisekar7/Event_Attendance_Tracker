#!/usr/bin/env bash
# macOS/Linux launcher. Run from any directory: bash /path/to/run.sh
set -euo pipefail
cd "$(dirname "$0")"

echo ""
echo "  Gather - Event Attendance Tracker"
echo ""

if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
else
  echo "Python was not found. Install Python 3.10 or newer, then try again."
  exit 1
fi

"$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else "Python 3.10 or newer is required.")'
if [ ! -x .venv/bin/python ]; then
  echo "Creating a local Python environment..."
  "$PYTHON" -m venv .venv || {
    echo "Could not create .venv. On Ubuntu/Debian, install python3-venv."
    exit 1
  }
fi

.venv/bin/python -m pip install -r requirements.txt || {
  echo "Dependency installation failed. Check your internet connection and retry."
  exit 1
}

echo ""
echo "Open http://localhost:${PORT:-8000} in your browser. Keep this terminal open."
echo "Press Ctrl+C to stop. Your attendance remains saved."
echo ""
exec .venv/bin/python app.py
