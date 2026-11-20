
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const value = process.env.PROXY_CREDENTIALS_KEY

  if (!value) {
    throw new Error('PROXY_CREDENTIALS_KEY is not configured')
  }

  const key = Buffer.from(value, 'base64')

  if (key.length !== 32) {
    throw new Error('PROXY_CREDENTIALS_KEY must decode to 32 bytes')
  }

  return key
}

export function encryptProxyPassword(password: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(password, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag()

  return [
    'v1',
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':')
}

export function decryptProxyPassword(payload: string): string {
  const parts = payload.split(':')

  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted proxy password format')
  }

  const [, ivEncoded, tagEncoded, encryptedEncoded] = parts

  const key = getEncryptionKey()
  const iv = Buffer.from(ivEncoded, 'base64')
  const authTag = Buffer.from(tagEncoded, 'base64')
  const encrypted = Buffer.from(encryptedEncoded, 'base64')

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Invalid encrypted proxy password data')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
