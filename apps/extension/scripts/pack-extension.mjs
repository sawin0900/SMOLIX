import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import os from 'node:os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const extRoot = path.resolve(__dirname, '..')
const webPublic = path.resolve(__dirname, '../../web/public/downloads')
const zipPath = path.join(webPublic, 'jetsale-chrome.zip')
const keyMetaPath = path.join(extRoot, '.extension-key.txt')

mkdirSync(webPublic, { recursive: true })

if (!existsSync(keyMetaPath)) {
  console.error('Missing .extension-key.txt — generate signing key first')
  process.exit(1)
}

const [key, extensionId] = readFileSync(keyMetaPath, 'utf8').trim().split(/\r?\n/)
const manifestPath = path.join(extRoot, 'manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.key = key
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

const stagingRoot = mkdtempSync(path.join(os.tmpdir(), 'jetsale-ext-'))
const staging = path.join(stagingRoot, 'jetsale-chrome')
mkdirSync(staging, { recursive: true })

const copyList = [
  'manifest.json',
  'src/background.js',
  'public/popup-premium.html',
  'public/popup-premium.js',
  'public/popup.html',
  'public/popup.js',
  'public/popup.css',
  'public/popup-unified.css',
  'public/popup-settings.css',
  'public/icons/icon-16.png',
  'public/icons/icon-32.png',
  'public/icons/icon-48.png',
  'public/icons/icon-128.png',
]

for (const rel of copyList) {
  const from = path.join(extRoot, rel)
  const to = path.join(staging, rel)
  mkdirSync(path.dirname(to), { recursive: true })
  cpSync(from, to)
}

try {
  if (existsSync(zipPath)) rmSync(zipPath)
  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path "${staging}" -DestinationPath "${zipPath}" -Force`,
      ],
      { stdio: 'inherit' },
    )
  } else {
    execFileSync('zip', ['-r', '-q', zipPath, 'jetsale-chrome'], {
      cwd: stagingRoot,
      stdio: 'inherit',
    })
  }
} finally {
  rmSync(stagingRoot, { recursive: true, force: true })
}

console.log(`Packed ${zipPath}`)
console.log(`Extension ID (stable): ${extensionId}`)
console.log(`Set ALLOWED_EXTENSION_IDS=${extensionId}`)
