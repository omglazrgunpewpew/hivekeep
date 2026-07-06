import { config } from '@/server/config'

const DEV_ORIGINS = [
  'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
  'http://127.0.0.1:5173', 'http://127.0.0.1:5174', 'http://127.0.0.1:3000',
]

/**
 * Origins allowed on auth endpoints. Better Auth checks the Origin header of
 * credentialed POSTs (and any callbackURL in the body) against this list.
 *
 * Static entries: TRUSTED_ORIGINS when set (replaces the defaults, same
 * semantics as before), otherwise the configured public URL plus the dev
 * server defaults.
 *
 * Dynamic entry: the request's own origin, derived from its Host header
 * (X-Forwarded-Host first, for reverse proxies that rewrite Host). A browser
 * only sends an Origin equal to the request's own host when the page was
 * served by this very server, and a cross-site page cannot forge the Host
 * header, so this trusts exactly same-origin traffic. It is what lets a
 * fresh install be used at http://<lan-ip>:<port> without PUBLIC_URL set
 * (issue #31) while still rejecting cross-site requests.
 */
export function resolveTrustedOrigins(request?: Request): string[] {
  const origins = process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(',').map((o) => o.trim())
    : [config.publicUrl, ...DEV_ORIGINS]
  const host = request?.headers.get('x-forwarded-host') ?? request?.headers.get('host')
  if (host) origins.push(`http://${host}`, `https://${host}`)
  return origins
}
