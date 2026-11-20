#!/usr/bin/env bash
# Этап 2 — backup панели Remnawave (без удаления данных).
# Запуск на сервере панели под root:
#   bash backup-remnawave-panel.sh
# Архив: /root/smolix-remnawave-backup-YYYYMMDD-HHMMSS.tar.gz
# Перед WARP / nginx / eGames-модулями — обязательно.

set -euo pipefail

STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="/root/smolix-remnawave-backup-$STAMP"
mkdir -p "$OUT_DIR"

echo "[*] Snapshot metadata → $OUT_DIR"
{
  date -Is
  hostname
  hostname -I || true
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null || true
  docker compose ls 2>/dev/null || true
  ss -tlnp 2>/dev/null | egrep ':80|:443|:2222|:3000|:3001' || true
  ufw status verbose 2>/dev/null || true
} > "$OUT_DIR/meta.txt"

if [ -d /opt/remnawave ]; then
  echo "[*] Copy /opt/remnawave configs (no large volumes assumed)"
  mkdir -p "$OUT_DIR/opt-remnawave"
  # конфиги и compose; volumes/db — через dump ниже
  cp -a /opt/remnawave/nginx.conf "$OUT_DIR/opt-remnawave/" 2>/dev/null || true
  cp -a /opt/remnawave/docker-compose.yml "$OUT_DIR/opt-remnawave/" 2>/dev/null || true
  cp -a /opt/remnawave/compose.yml "$OUT_DIR/opt-remnawave/" 2>/dev/null || true
  cp -a /opt/remnawave/.env "$OUT_DIR/opt-remnawave/env.redacted" 2>/dev/null || true
  # затереть очевидные секреты в копии .env (оставить ключи имён)
  if [ -f "$OUT_DIR/opt-remnawave/env.redacted" ]; then
    sed -i -E 's/(PASSWORD|SECRET|TOKEN|KEY)=.*/\1=***REDACTED***/Ig' "$OUT_DIR/opt-remnawave/env.redacted" || true
  fi
  find /opt/remnawave -maxdepth 2 -type f \( -name '*.yml' -o -name '*.yaml' -o -name '*.conf' -o -name '*.json' \) \
    -exec cp -a --parents {} "$OUT_DIR/files" \; 2>/dev/null || true
fi

# Postgres dump из типичного контейнера eGames / remnawave
PG_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -Ei 'postgres|remnawave-db|db' | head -1 || true)
if [ -n "${PG_CONTAINER:-}" ]; then
  echo "[*] pg_dump from container: $PG_CONTAINER"
  docker exec "$PG_CONTAINER" sh -c 'pg_dump -U "${POSTGRES_USER:-postgres}" "${POSTGRES_DB:-postgres}"' \
    > "$OUT_DIR/panel.sql" 2>"$OUT_DIR/pg_dump.err" || echo "[!] pg_dump failed — see pg_dump.err"
else
  echo "[!] Postgres container not auto-detected — dump DB вручную из панели/compose"
fi

ARCHIVE="/root/smolix-remnawave-backup-$STAMP.tar.gz"
tar -czf "$ARCHIVE" -C /root "smolix-remnawave-backup-$STAMP"
echo "[+] Done: $ARCHIVE"
echo "Скопируйте архив off-box (scp). Откат: восстановить nginx.conf/compose из архива; SQL — только на staging."
