import { access, readFile, constants as fsConstants } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { isProxyManagerConfigured } from './proxy-manager.js'
import { getMailStats } from './mailer.js'
import { isYooKassaConfigured } from './yookassa.js'
import { listEnabledExtensionServers } from './extension-nodes.js'

const BACKUP_DIR = process.env.BACKUP_DIR || '/var/backups/jetsale'
const BACKUP_STAMP = process.env.BACKUP_STAMP_FILE || `${BACKUP_DIR}/LAST_OK.json`
const BACKUP_SCRIPT =
  process.env.BACKUP_SCRIPT || '/usr/local/bin/backup-jetsale-api.sh'

export type BackupStatus = {
  stampPath: string
  scriptPath: string
  scriptExists: boolean
  lastOkAt: string | null
  lastFile: string | null
  lastSizeBytes: number | null
  error: string | null
}

async function fileExists(path: string) {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const scriptExists = await fileExists(BACKUP_SCRIPT)
  try {
    const raw = await readFile(BACKUP_STAMP, 'utf8')
    const parsed = JSON.parse(raw) as {
      okAt?: string
      file?: string
      sizeBytes?: number
    }
    return {
      stampPath: BACKUP_STAMP,
      scriptPath: BACKUP_SCRIPT,
      scriptExists,
      lastOkAt: parsed.okAt || null,
      lastFile: parsed.file || null,
      lastSizeBytes: typeof parsed.sizeBytes === 'number' ? parsed.sizeBytes : null,
      error: null,
    }
  } catch (err) {
    return {
      stampPath: BACKUP_STAMP,
      scriptPath: BACKUP_SCRIPT,
      scriptExists,
      lastOkAt: null,
      lastFile: null,
      lastSizeBytes: null,
      error: err instanceof Error ? err.message : 'stamp missing',
    }
  }
}

export async function startBackupRun(): Promise<{ started: boolean; message: string }> {
  if (!(await fileExists(BACKUP_SCRIPT))) {
    return {
      started: false,
      message: `Скрипт не найден: ${BACKUP_SCRIPT}. Установите backup-jetsale-api.sh`,
    }
  }

  const child = spawn('/bin/bash', [BACKUP_SCRIPT], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  })
  child.unref()

  return {
    started: true,
    message: 'Бэкап запущен в фоне. Через минуту обновите статус.',
  }
}

async function probeProxyManager(): Promise<'ok' | 'error' | 'missing'> {
  if (!isProxyManagerConfigured()) return 'missing'
  const base = process.env.PROXY_MANAGER_URL?.trim().replace(/\/+$/, '')
  if (!base) return 'missing'
  try {
    const res = await fetch(base + '/', {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    })
    // 501/401/404 all mean the process answered
    if (res.status > 0) return 'ok'
    return 'error'
  } catch {
    return 'error'
  }
}

export async function getOpsHealth() {
  const [backup, proxyManager, extensionServers] = await Promise.all([
    getBackupStatus(),
    probeProxyManager(),
    listEnabledExtensionServers().catch(() => []),
  ])

  const chromeStoreUrl =
    process.env.VITE_CHROME_STORE_URL || process.env.CHROME_STORE_URL || null
  const allowedExtensionIds = (process.env.ALLOWED_EXTENSION_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    checkedAt: new Date().toISOString(),
    flags: {
      proxyManager: isProxyManagerConfigured(),
      proxyManagerReachable: proxyManager,
      proxyCredentialsKey: Boolean(process.env.PROXY_CREDENTIALS_KEY?.trim()),
      turnstile: Boolean(process.env.TURNSTILE_SECRET_KEY?.trim()),
      smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      billingProvider: isYooKassaConfigured() ? 'yookassa' : 'mock',
      chromeStoreLive: Boolean(chromeStoreUrl),
      referralEnabled: process.env.REFERRAL_ENABLED !== '0',
    },
    chromeStore: {
      url: chromeStoreUrl,
      allowedExtensionIds,
    },
    proxy: {
      publicHost: process.env.PROXY_PUBLIC_HOST || 'rassiya.jetsale.online',
      publicPort: Number(process.env.PROXY_PUBLIC_PORT || 8443),
      enabledExtensionServers: extensionServers.length,
      servers: extensionServers,
    },
    mail: getMailStats(),
    backup,
  }
}
