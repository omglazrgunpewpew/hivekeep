import { tool, z } from '@kinbot/sdk'

/**
 * Currency Converter plugin for KinBot.
 * Uses the Frankfurter API (https://frankfurter.dev/) for live ECB exchange rates.
 * No API key required. Rates updated daily by the European Central Bank.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

interface RatesResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

interface CurrencyMap {
  [code: string]: string
}

// ─── API helpers ────────────────────────────────────────────────────────────

const API_BASE = 'https://api.frankfurter.dev'

async function fetchRates(
  from: string,
  to?: string,
  amount: number = 1,
): Promise<RatesResponse> {
  const params = new URLSearchParams({ from: from.toUpperCase(), amount: String(amount) })
  if (to) params.set('to', to.toUpperCase())

  const res = await fetch(`${API_BASE}/latest?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    if (res.status === 404 || res.status === 422) {
      const body = await res.text()
      throw new Error(`Invalid currency code. ${body}`)
    }
    throw new Error(`Frankfurter API returned ${res.status}: ${res.statusText}`)
  }

  return (await res.json()) as RatesResponse
}

async function fetchCurrencies(): Promise<CurrencyMap> {
  const res = await fetch(`${API_BASE}/currencies`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`Frankfurter API returned ${res.status}: ${res.statusText}`)
  }

  return (await res.json()) as CurrencyMap
}

async function fetchHistorical(
  from: string,
  to: string,
  date: string,
  amount: number = 1,
): Promise<RatesResponse> {
  const params = new URLSearchParams({
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    amount: String(amount),
  })

  const res = await fetch(`${API_BASE}/${date}?${params}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    throw new Error(`Frankfurter API returned ${res.status}: ${res.statusText}`)
  }

  return (await res.json()) as RatesResponse
}

// ─── Formatting ─────────────────────────────────────────────────────────────

function formatConversion(data: RatesResponse): string {
  const lines: string[] = []
  lines.push(`💱 **${data.amount} ${data.base}** (rates from ${data.date})`)
  lines.push('')

  for (const [currency, value] of Object.entries(data.rates)) {
    lines.push(`  ${currency}: **${value.toFixed(4)}**`)
  }

  return lines.join('\n')
}

function formatCurrencyList(currencies: CurrencyMap): string {
  const lines: string[] = ['**Supported currencies:**', '']

  const entries = Object.entries(currencies)
  for (const [code, name] of entries) {
    lines.push(`  \`${code}\` - ${name}`)
  }

  lines.push('')
  lines.push(`_${entries.length} currencies available_`)

  return lines.join('\n')
}

// ─── Plugin export ──────────────────────────────────────────────────────────

export default function currencyConverterPlugin(ctx: { config: Record<string, string> }) {
  const defaultBase = ctx.config.baseCurrency || 'EUR'

  return {
    tools: {
      convert_currency: tool({
        description:
          'Convert an amount from one currency to another using live exchange rates. ' +
          'Supports 30+ currencies (USD, EUR, GBP, JPY, CHF, CAD, AUD, etc.). ' +
          'Rates are updated daily by the European Central Bank.',
        parameters: z.object({
          amount: z.number().positive().describe('Amount to convert'),
          from: z
            .string()
            .length(3)
            .describe(`Source currency code (ISO 4217, e.g. USD, EUR). Defaults to ${defaultBase}`),
          to: z
            .string()
            .describe(
              'Target currency code(s). Single code like "USD" or comma-separated like "USD,GBP,JPY". Omit for all major currencies.',
            )
            .optional(),
        }),
        execute: async ({ amount, from, to }) => {
          try {
            const target = to
              ?.split(',')
              .map(c => c.trim().toUpperCase())
              .join(',')
            const data = await fetchRates(from || defaultBase, target, amount)
            return formatConversion(data)
          } catch (err) {
            return `❌ ${err instanceof Error ? err.message : 'Conversion failed'}`
          }
        },
      }),

      list_currencies: tool({
        description: 'List all supported currencies with their full names and ISO codes.',
        parameters: z.object({}),
        execute: async () => {
          try {
            const currencies = await fetchCurrencies()
            return formatCurrencyList(currencies)
          } catch (err) {
            return `❌ ${err instanceof Error ? err.message : 'Failed to fetch currency list'}`
          }
        },
      }),

      historical_rate: tool({
        description:
          'Get the exchange rate for a specific past date. Useful for comparing how rates changed over time. Data available from 1999-01-04 onwards.',
        parameters: z.object({
          amount: z.number().positive().describe('Amount to convert').default(1),
          from: z.string().length(3).describe('Source currency code (e.g. EUR)'),
          to: z.string().length(3).describe('Target currency code (e.g. USD)'),
          date: z.string().describe('Date in YYYY-MM-DD format (from 1999-01-04 onwards)'),
        }),
        execute: async ({ amount, from, to, date }) => {
          try {
            const data = await fetchHistorical(from, to, date, amount)
            return formatConversion(data)
          } catch (err) {
            return `❌ ${err instanceof Error ? err.message : 'Failed to fetch historical rate'}`
          }
        },
      }),
    },
  }
}
