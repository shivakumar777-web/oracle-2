#!/usr/bin/env bash
# Local Oracle dev: set paths like Docker /app layout, verify imports, start uvicorn.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORACLE_SERVICE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
# scripts -> oracle-service -> services -> oracle-2
ORACLE_TWO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

export MANTHANA_ROOT="${MANTHANA_ROOT:-$ORACLE_TWO_ROOT}"
# Repo config (oracle-2/../config when oracle-2 lives under studio root)
export CLOUD_INFERENCE_CONFIG_PATH="${CLOUD_INFERENCE_CONFIG_PATH:-$ORACLE_TWO_ROOT/../config/cloud_inference.yaml}"
export ORACLE_USE_RAG="${ORACLE_USE_RAG:-false}"
export PYTHONPATH="$ORACLE_TWO_ROOT:$ORACLE_TWO_ROOT/services/ai-router:${PYTHONPATH:-}"

cd "$ORACLE_SERVICE_ROOT"

python3 -c "
import paths_bootstrap
paths_bootstrap.ensure_oracle_sys_path()
from services.shared.circuit_breaker import oracle_openrouter_circuit
print('OK: services.shared imports')
"
python3 -c "
import paths_bootstrap
paths_bootstrap.ensure_oracle_sys_path()
from query_intelligence import classify_query
print('OK: ai-router modules')
"

exec uvicorn main:app --host 127.0.0.1 --port 8100 --reload
