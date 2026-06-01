/**
 * Calendar accounts service — resolves a connected account that carries the
 * `calendar` capability into a CalendarProvider + ProviderConfig. Mirrors the
 * email/contacts resolvers and reads the SAME shared account config (a single
 * row may serve email + contacts + calendar).
 */
import { db } from '@/server/db/index'
import { providers } from '@/server/db/schema'
import { decrypt } from '@/server/services/encryption'
import { getCalendarProvider } from '@/server/calendar/registry'
import { getFreshAccessToken } from '@/server/services/email-token-manager'
import type { CalendarProvider } from '@/server/calendar/types'
import type { ProviderConfig } from '@kinbot-developer/sdk'

interface AccountConfig {
  account_label?: string
  email_address?: string
  refresh_token?: string
  credentials?: Record<string, string>
  allowed_kin_ids?: string[] | null
}

export interface CalendarAccount {
  id: string
  slug: string
  name: string
  type: string
  accountLabel: string
  allowedKinIds: string[] | null
  isValid: boolean
  lastError: string | null
}

type ProviderRow = typeof providers.$inferSelect

function hasCalendarCapability(row: ProviderRow): boolean {
  try {
    return (JSON.parse(row.capabilities) as string[]).includes('calendar')
  } catch {
    return false
  }
}

function loadCalendarRows(): ProviderRow[] {
  return db.select().from(providers).all().filter(hasCalendarCapability)
}

async function decryptConfig(row: ProviderRow): Promise<AccountConfig> {
  return JSON.parse(await decrypt(row.configEncrypted)) as AccountConfig
}

function labelOf(cfg: AccountConfig): string {
  return cfg.account_label || cfg.email_address || ''
}

function kinAllowed(cfg: AccountConfig, kinId?: string): boolean {
  if (!cfg.allowed_kin_ids || cfg.allowed_kin_ids.length === 0) return true
  return kinId != null && cfg.allowed_kin_ids.includes(kinId)
}

function toAccount(row: ProviderRow, cfg: AccountConfig): CalendarAccount {
  const allowed = cfg.allowed_kin_ids && cfg.allowed_kin_ids.length > 0 ? cfg.allowed_kin_ids : null
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    accountLabel: labelOf(cfg),
    allowedKinIds: allowed,
    isValid: row.isValid,
    lastError: row.lastError,
  }
}

/** List calendar accounts. With a `kinId`, only the accounts that Kin may use. */
export async function listCalendarAccounts(kinId?: string): Promise<CalendarAccount[]> {
  const out: CalendarAccount[] = []
  for (const row of loadCalendarRows()) {
    const cfg = await decryptConfig(row)
    if (!kinAllowed(cfg, kinId)) continue
    out.push(toAccount(row, cfg))
  }
  return out
}

export interface ResolvedCalendar {
  account: CalendarAccount
  provider: CalendarProvider
  config: ProviderConfig
}

/** Resolve a calendar account for a tool call (explicit slug → first valid),
 *  enforce the allow-list, inject a fresh access token or the credentials. */
export async function resolveCalendarProvider(opts: { slug?: string; kinId?: string }): Promise<ResolvedCalendar> {
  const rows = loadCalendarRows()
  if (rows.length === 0) throw new Error('No calendar account is connected')

  let row: ProviderRow | undefined
  if (opts.slug) {
    row = rows.find((r) => r.slug === opts.slug || r.id === opts.slug)
    if (!row) throw new Error(`Calendar account not found: ${opts.slug}`)
  } else {
    row = rows.find((r) => r.isValid) ?? rows[0]
  }
  if (!row) throw new Error('No usable calendar account')

  const cfg = await decryptConfig(row)
  if (!kinAllowed(cfg, opts.kinId)) {
    throw new Error(`This Kin is not allowed to use the calendar account "${row.slug}"`)
  }
  const provider = getCalendarProvider(row.type)
  if (!provider) throw new Error(`Calendar provider not registered: ${row.type}`)

  const config: ProviderConfig = { account_label: labelOf(cfg) }
  if (cfg.email_address) config.email_address = cfg.email_address
  if (provider.oauth) {
    config.accessToken = await getFreshAccessToken({ id: row.id, type: row.type, refreshToken: cfg.refresh_token ?? '' })
  } else if (cfg.credentials) {
    Object.assign(config, cfg.credentials)
  }
  return { account: toAccount(row, cfg), provider, config }
}
