#!/usr/bin/env bash
# Backup jetsale.online API host: Postgres dump + .env
#   install -m 700 /var/www/SMOLIX/scripts/ops/backup-jetsale-api.sh /usr/local/bin/backup-jetsale-api.sh
#   /usr/local/bin/backup-jetsale-api.sh
# Cron (daily 03:15):
#   15 3 * * * /usr/local/bin/backup-jetsale-api.sh >> /var/log/jetsale-backup.log 2>&1

set -euo pipefail

SMOLIX_ROOT="${SMOLIX_ROOT:-/var/www/SMOLIX}"
API_DIR="$SMOLIX_ROOT/apps/api"
ENV_FILE="$API_DIR/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/jetsale}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/jetsale-$STAMP"
mkdir -p "$OUT"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: missing $ENV_FILE" >&2
  exit 1
fi

DATABASE_URL="$(
  grep -E '^[[:space:]]*DATABASE_URL=' "$ENV_FILE" | tail -n1 | sed -E 's/^[[:space:]]*DATABASE_URL=//' | sed -E 's/^["'\'']//; s/["'\'']$//'
)"

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL empty in $ENV_FILE" >&2
  exit 1
fi

echo "[*] Dump Postgres → $OUT/db.dump"
pg_dump --no-owner --format=custom --file="$OUT/db.dump" "$DATABASE_URL"

echo "[*] Copy .env"
install -m 600 "$ENV_FILE" "$OUT/api.env"

{
  date -Is
  hostname
  hostname -I 2>/dev/null || true
  systemctl is-active smolix-api 2>/dev/null || true
  git -C "$SMOLIX_ROOT" rev-parse --short HEAD 2>/dev/null || true
} > "$OUT/meta.txt"

TAR="$BACKUP_DIR/jetsale-$STAMP.tar.gz"
tar -C "$BACKUP_DIR" -czf "$TAR" "jetsale-$STAMP"
rm -rf "$OUT"
chmod 600 "$TAR"

echo "[*] Prune older than ${KEEP_DAYS}d"
find "$BACKUP_DIR" -type f -name 'jetsale-*.tar.gz' -mtime "+$KEEP_DAYS" -delete 2>/dev/null || true

echo "[ok] $TAR"
ls -lh "$TAR"
