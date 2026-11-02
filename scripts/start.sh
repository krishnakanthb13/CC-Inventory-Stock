#!/usr/bin/env bash
echo "========================================="
echo "  Crown & Cross — Unix/Mac Local Launcher"
echo "========================================="
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
node "$DIR/start.js"
