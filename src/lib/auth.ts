import type { NextRequest } from 'next/server'

// Single-account login. The credentials and the cookie-signing key live only in server env vars
// (AUTH_USERNAME / AUTH_PASSWORD / AUTH_SECRET). Uses Web Crypto so the same code runs in proxy
// and in route handlers.

export const SESSION_COOKIE = 'session'
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // seconds

const encoder = new TextEncoder()

type AuthConfig = { username: string; password: string; secret: string }

function authConfig(): AuthConfig | null {
  const username = process.env.AUTH_USERNAME
  const password = process.env.AUTH_PASSWORD
  const secret = process.env.AUTH_SECRET
  // Fail closed: a server deployed without these env vars rejects every login instead of running open.
  if (!username || !password || !secret) return null
  return { username, password, secret }
}

export const isAuthConfigured = () => authConfig() !== null

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

function equalBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

export async function checkCredentials(username: string, password: string) {
  const cfg = authConfig()
  if (!cfg) return false
  // Compare fixed-length digests rather than the raw strings, so the check takes the same time
  // no matter where the input first differs.
  const [given, expected] = await Promise.all([
    hmac(cfg.secret, `${username}\n${password}`),
    hmac(cfg.secret, `${cfg.username}\n${cfg.password}`),
  ])
  return equalBytes(given, expected)
}

// The password is part of the signed message, so changing AUTH_PASSWORD (or AUTH_SECRET) logs out
// every existing session.
const sessionMessage = (cfg: AuthConfig, exp: number) => `${cfg.username}\n${cfg.password}\n${exp}`

export async function createSessionToken() {
  const cfg = authConfig()
  if (!cfg) throw new Error('Auth is not configured')
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  return `${exp}.${toHex(await hmac(cfg.secret, sessionMessage(cfg, exp)))}`
}

export async function verifySessionToken(token: string | undefined) {
  const cfg = authConfig()
  if (!cfg || !token) return false
  const [expStr, sig] = token.split('.')
  const exp = Number(expStr)
  if (!sig || !Number.isInteger(exp) || exp < Date.now() / 1000) return false
  const expected = toHex(await hmac(cfg.secret, sessionMessage(cfg, exp)))
  return equalBytes(encoder.encode(sig), encoder.encode(expected))
}

// The live site is still served over plain http, where a `secure` cookie would never be sent back —
// so only mark it secure when the request actually arrived over https (directly or via the host's proxy).
export function isHttpsRequest(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-proto')?.split(',')[0].trim()
  return forwarded === 'https' || req.nextUrl.protocol === 'https:'
}
