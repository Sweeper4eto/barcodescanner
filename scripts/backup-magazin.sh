#!/usr/bin/env bash
# Old cron path. The backup itself lives in backup-expire365.sh.
exec bash "$(dirname "$0")/backup-expire365.sh" "$@"
