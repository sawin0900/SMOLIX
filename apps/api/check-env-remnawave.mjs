import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

const envPath = path.resolve(process.cwd(), '.env')
console.log('cwd:', process.cwd())
console.log('envPath:', envPath)
console.log('exists:', fs.existsSync(envPath))

if (!fs.existsSync(envPath)) {
  process.exit(1)
}

const raw = fs.readFileSync(envPath)
console.log('bytes:', raw.length, 'bom:', raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf)

const text = raw.toString('utf8')
const remLines = text.split(/\r?\n/).filter((line) => /REMWAVE/i.test(line))
console.log('REMWAVE lines in file:', remLines.length)
for (const line of remLines) {
  const key = line.replace(/^\s*#\s*/, '').split('=')[0]?.trim()
  const commented = /^\s*#/.test(line)
  const hasValue = /=./.test(line.replace(/^\s*#\s*/, ''))
  console.log({ key, commented, hasValue, preview: line.slice(0, 48) })
}

const parsed = dotenv.parse(text)
const keys = Object.keys(parsed).filter((k) => k.startsWith('REMWAVE_'))
console.log('dotenv parsed REMWAVE keys:', keys)
for (const key of keys) {
  const value = parsed[key] || ''
  console.log(`  ${key}: length=${value.length} starts=${JSON.stringify(value.slice(0, 12))}`)
}

if (!parsed.REMWAVE_BASE_URL) {
  console.error('dotenv не видит REMWAVE_BASE_URL — строка закомментирована, опечатка или файл не сохранён')
  process.exit(1)
}
