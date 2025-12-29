#!/bin/bash

set -euo pipefail

[ $# -eq 0 ] && exit 1

exec_target="$1"
withoutext="${exec_target%.*}"
shift

cd "$(dirname "$0")"

if [ -f "restart.txt" ]; then
    pgrep -lf "$exec_target" | awk '$2 !~ /^(sh|run-once\.sh)$/' | awk '{print $1}' | xargs -r kill
else
    pgrep -lf "$exec_target" | awk '$2 !~ /^(sh|run-once\.sh)$/' | grep -q . && exit 0
fi

rm -f restart.txt

[ -x "$exec_target" ] && "$exec_target" "$@" >> "$withoutext.log" 2>&1
