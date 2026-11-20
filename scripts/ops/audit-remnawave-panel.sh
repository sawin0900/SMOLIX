#!/usr/bin/env bash
# Этап 0 — read-only аудит сервера Remnawave (панель или нода).
# Запуск: bash audit-remnawave-panel.sh | tee remnawave-audit-$(hostname)-$(date +%Y%m%d).txt
# Секреты (токены, пароли) в вывод не включаются. Не вносите изменения — только чтение.

set -u

echo "===== SMOLIX Remnawave audit ====="
echo "host=$(hostname 2>/dev/null || true)"
echo "date=$(date -Is 2>/dev/null || date)"
echo

echo "===== A. System ====="
uname -a 2>/dev/null || true
if [ -f /etc/os-release ]; then head -5 /etc/os-release; fi
whoami 2>/dev/null || true
hostname -I 2>/dev/null || true
echo

echo "===== B. eGames / Remnawave paths ====="
command -v remnawave_reverse 2>/dev/null || echo "remnawave_reverse: not found"
command -v rr 2>/dev/null || echo "rr: not found"
type rr 2>/dev/null || true
ls -la /opt/remnawave 2>/dev/null | head -30 || echo "/opt/remnawave: missing"
ls -la /opt/remnanode 2>/dev/null | head -30 || echo "/opt/remnanode: missing"
ls -la /opt/remnawave/nginx.conf 2>/dev/null || echo "/opt/remnawave/nginx.conf: missing"
ls -la /opt/remnawave/docker-compose.yml /opt/remnawave/compose.yml 2>/dev/null || true
echo

echo "===== C. Docker ====="
if command -v docker >/dev/null 2>&1; then
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null || true
  echo
  docker compose ls 2>/dev/null || true
else
  echo "docker: not found"
fi
echo

echo "===== D. Ports ====="
if command -v ss >/dev/null 2>&1; then
  ss -tlnp 2>/dev/null | egrep ':80|:443|:2222|:3000|:3001|:8443' || true
elif command -v netstat >/dev/null 2>&1; then
  netstat -tlnp 2>/dev/null | egrep ':80|:443|:2222|:3000|:3001' || true
else
  echo "ss/netstat: not found"
fi
echo

echo "===== E. Web server ====="
nginx -t 2>&1 | head -20 || echo "nginx: not available"
ls /etc/nginx/sites-enabled 2>/dev/null || echo "sites-enabled: missing"
ls /etc/caddy 2>/dev/null || echo "caddy dir: missing"
echo

echo "===== F. Firewall ====="
ufw status verbose 2>/dev/null || iptables -L -n 2>/dev/null | head -40 || echo "firewall tools: not found"
echo

echo "===== G. nginx.conf signals (no secrets) ====="
if [ -f /opt/remnawave/nginx.conf ]; then
  grep -nEi 'tinyauth|auth|proxy_pass|remnawave|/api|map \$arg_' /opt/remnawave/nginx.conf 2>/dev/null | head -60 || true
else
  echo "skip: no /opt/remnawave/nginx.conf"
fi
echo

echo "===== H. Classification hints ====="
HAS_RR=0
HAS_OPT=0
HAS_NODE=0
command -v remnawave_reverse >/dev/null 2>&1 && HAS_RR=1
command -v rr >/dev/null 2>&1 && HAS_RR=1
[ -d /opt/remnawave ] && HAS_OPT=1
[ -d /opt/remnanode ] && HAS_NODE=1

if [ "$HAS_RR" -eq 1 ] && [ "$HAS_OPT" -eq 1 ]; then
  echo "HINT_CLASS=E  # likely eGames stack (/opt/remnawave + rr)"
elif [ "$HAS_OPT" -eq 1 ] || [ "$HAS_NODE" -eq 1 ]; then
  echo "HINT_CLASS=M  # mixed / partial eGames paths"
else
  echo "HINT_CLASS=C  # custom Remnawave (no eGames paths detected)"
fi
echo "HAS_RR=$HAS_RR HAS_OPT=$HAS_OPT HAS_NODE=$HAS_NODE"
echo
echo "===== done ====="
echo "Пришлите этот файл в SMOLIX-чат (пароли/токены вырежьте вручную, если попали)."
