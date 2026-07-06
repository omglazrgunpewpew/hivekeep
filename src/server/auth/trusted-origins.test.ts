import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { resolveTrustedOrigins } from '@/server/auth/trusted-origins'
import { config } from '@/server/config'

const ORIGINAL_TRUSTED_ORIGINS = process.env.TRUSTED_ORIGINS

function requestFrom(headers: Record<string, string>): Request {
  return new Request('http://placeholder.test/api/auth/sign-in/email', { method: 'POST', headers })
}

describe('resolveTrustedOrigins', () => {
  beforeEach(() => {
    delete process.env.TRUSTED_ORIGINS
  })

  afterEach(() => {
    if (ORIGINAL_TRUSTED_ORIGINS === undefined) delete process.env.TRUSTED_ORIGINS
    else process.env.TRUSTED_ORIGINS = ORIGINAL_TRUSTED_ORIGINS
  })

  it('defaults to the public URL plus dev origins without a request', () => {
    const origins = resolveTrustedOrigins(undefined)
    expect(origins).toContain(config.publicUrl)
    expect(origins).toContain('http://localhost:5173')
    expect(origins).toContain('http://127.0.0.1:3000')
  })

  it('trusts the request own origin from the Host header, both schemes', () => {
    const origins = resolveTrustedOrigins(requestFrom({ host: '192.168.1.50:3000' }))
    expect(origins).toContain('http://192.168.1.50:3000')
    expect(origins).toContain('https://192.168.1.50:3000')
    expect(origins).toContain(config.publicUrl)
  })

  it('prefers X-Forwarded-Host over Host', () => {
    const origins = resolveTrustedOrigins(
      requestFrom({ host: 'internal:3000', 'x-forwarded-host': 'hive.example.com' }),
    )
    expect(origins).toContain('https://hive.example.com')
    expect(origins).not.toContain('http://internal:3000')
  })

  it('TRUSTED_ORIGINS replaces the static defaults but keeps same-origin trust', () => {
    process.env.TRUSTED_ORIGINS = 'https://a.example.com, https://b.example.com'
    const origins = resolveTrustedOrigins(requestFrom({ host: '10.0.0.2:8080' }))
    expect(origins).toEqual([
      'https://a.example.com',
      'https://b.example.com',
      'http://10.0.0.2:8080',
      'https://10.0.0.2:8080',
    ])
  })
})
