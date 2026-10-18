#!/usr/bin/env bash
# Old update path. The update itself lives in update-expire365.sh.
exec bash "$(dirname "$0")/update-expire365.sh" "$@"
