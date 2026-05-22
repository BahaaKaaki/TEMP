#!/usr/bin/env bash
# On-demand Edwin daily usage report (requires `az login`, Microsoft Outlook on Mac).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
exec python3 backend/scripts/edwin_daily_usage_report.py "$@"
