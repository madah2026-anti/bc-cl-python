#!/bin/bash
# Script to run BC ERP Python FastAPI server 
PORT=${PORT:-${PYTHON_PORT:-3000}}
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

PYTHON_CMD="../.venv/bin/python"
if [ ! -f "$PYTHON_CMD" ]; then
    PYTHON_CMD="python3"
fi

echo "==============================================="
echo "  BC ERP Python Server -> http://localhost:$PORT"
echo "  Swagger API Docs      -> http://localhost:$PORT/docs"
echo "==============================================="

$PYTHON_CMD -m uvicorn main:app --host 0.0.0.0 --port $PORT --reload
