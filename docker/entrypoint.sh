#!/bin/sh
set -e

# Fix ownership of data directory for volume mounts created as root
chown -R hivekeep:hivekeep /app/data 2>/dev/null || true

# Ensure HIVEKEEP_VERSION is set from package.json if not already provided
if [ -z "$HIVEKEEP_VERSION" ] && [ -f /app/package.json ]; then
  HIVEKEEP_VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' /app/package.json | head -1 | sed 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
  export HIVEKEEP_VERSION
fi

# Drop to non-root user and exec the command
exec gosu hivekeep "$@"
