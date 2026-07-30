#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
export PHP_CLI_SERVER_WORKERS="${PHP_CLI_SERVER_WORKERS:-8}"

echo "Backend local sur http://127.0.0.1:8000 (${PHP_CLI_SERVER_WORKERS} workers)"
exec php -S 127.0.0.1:8000 -t public/
