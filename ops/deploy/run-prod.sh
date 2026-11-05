#!/bin/sh
# Loads the owner-only env file and starts the production server. Never echoes the file.
set -eu
: "${KB_ENV_FILE:?KB_ENV_FILE must name the env file}"
[ -r "$KB_ENV_FILE" ] || { echo "env file not readable" >&2; exit 78; }
set -a
# shellcheck disable=SC1090
. "$KB_ENV_FILE"
set +a
cd "$(dirname "$0")/../.."
exec pnpm start:prod
