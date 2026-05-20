import { type ComponentType, type SVGProps, useState, useEffect, memo } from 'react'
import { Cpu } from 'lucide-react'

type SvgIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>
type IconModule = { default: SvgIcon & { Color?: SvgIcon } }
type IconLoader = () => Promise<IconModule>

/**
 * Whitelist of `@lobehub/icons` names KinBot's frontend ships. Providers
 * (built-in or plugin-contributed) declare `lobehubIcon` in their metadata
 * to opt into one of these. Anything outside the whitelist falls back to
 * the generic chip icon — the whitelist exists to keep the bundle's
 * dynamic-import graph predictable (each entry becomes a Vite chunk).
 *
 * To add a new icon: add an entry here and bump the SDK developer doc.
 * The full Lobehub catalogue is at https://icons.lobehub.com/.
 */
const LOBEHUB_LOADERS: Record<string, IconLoader> = {
  Anthropic: () => import('@lobehub/icons/es/Anthropic') as any,
  Claude: () => import('@lobehub/icons/es/Claude') as any,
  OpenAI: () => import('@lobehub/icons/es/OpenAI') as any,
  Gemini: () => import('@lobehub/icons/es/Gemini') as any,
  Mistral: () => import('@lobehub/icons/es/Mistral') as any,
  DeepSeek: () => import('@lobehub/icons/es/DeepSeek') as any,
  Groq: () => import('@lobehub/icons/es/Groq') as any,
  Together: () => import('@lobehub/icons/es/Together') as any,
  Fireworks: () => import('@lobehub/icons/es/Fireworks') as any,
  Ollama: () => import('@lobehub/icons/es/Ollama') as any,
  OpenRouter: () => import('@lobehub/icons/es/OpenRouter') as any,
  Cohere: () => import('@lobehub/icons/es/Cohere') as any,
  XAI: () => import('@lobehub/icons/es/XAI') as any,
  Voyage: () => import('@lobehub/icons/es/Voyage') as any,
  Jina: () => import('@lobehub/icons/es/Jina') as any,
  Tavily: () => import('@lobehub/icons/es/Tavily') as any,
  Perplexity: () => import('@lobehub/icons/es/Perplexity') as any,
  Replicate: () => import('@lobehub/icons/es/Replicate') as any,
  Stability: () => import('@lobehub/icons/es/Stability') as any,
  Fal: () => import('@lobehub/icons/es/Fal') as any,
}

/** Providers that have a `.Color` variant in their Lobehub module. */
const HAS_COLOR_VARIANT = new Set([
  'Anthropic', 'Claude', 'Gemini', 'Mistral', 'DeepSeek', 'Groq', 'Cohere',
  'OpenRouter', 'XAI', 'Replicate', 'Stability', 'Perplexity', 'Together',
])

/**
 * Provider-type → loader map. Built from useProviderTypes' fetch:
 * each `ProviderTypeInfo.lobehubIcon` is registered here at runtime so
 * `<ProviderIcon providerType={t} />` resolves without each caller
 * threading the Lobehub name through props.
 */
const ICON_LOADERS = new Map<string, { loader: IconLoader; lobehubName: string }>()

/**
 * Register a provider type's Lobehub icon. Called from useProviderTypes
 * for every entry that declares `lobehubIcon`. Idempotent. Silently
 * ignores names outside the whitelist.
 */
export function registerProviderLobehubIcon(providerType: string, lobehubName: string): void {
  const loader = LOBEHUB_LOADERS[lobehubName]
  if (!loader) return
  ICON_LOADERS.set(providerType, { loader, lobehubName })
}

/** Cache resolved icon modules so re-renders don't re-import. */
const iconCache = new Map<string, SvgIcon & { Color?: SvgIcon }>()

interface ProviderIconProps {
  providerType: string
  className?: string
  /** 'mono' uses currentColor (default), 'color' uses brand colors / native Color variants */
  variant?: 'mono' | 'color'
}

export const ProviderIcon = memo(function ProviderIcon({ providerType, className, variant = 'mono' }: ProviderIconProps) {
  const entry = ICON_LOADERS.get(providerType)
  if (!entry) return <Cpu className={className} />

  const cached = iconCache.get(providerType)
  if (cached) {
    return <ResolvedIcon icon={cached} lobehubName={entry.lobehubName} variant={variant} className={className} />
  }

  return <LazyIcon providerType={providerType} loader={entry.loader} lobehubName={entry.lobehubName} variant={variant} className={className} />
})

/** Renders an already-resolved icon */
function ResolvedIcon({ icon, lobehubName, variant, className }: {
  icon: SvgIcon & { Color?: SvgIcon }
  lobehubName: string
  variant: 'mono' | 'color'
  className?: string
}) {
  if (variant === 'color' && HAS_COLOR_VARIANT.has(lobehubName) && icon.Color) {
    const Icon = icon.Color
    return <Icon className={className} />
  }
  const Icon = icon
  return <Icon className={className} />
}

/** Lazy-loads an icon on mount, then renders it */
function LazyIcon({ providerType, loader, lobehubName, variant, className }: {
  providerType: string
  loader: IconLoader
  lobehubName: string
  variant: 'mono' | 'color'
  className?: string
}) {
  const [icon, setIcon] = useState<(SvgIcon & { Color?: SvgIcon }) | null>(null)

  useEffect(() => {
    let cancelled = false
    loader().then((mod) => {
      iconCache.set(providerType, mod.default)
      if (!cancelled) setIcon(mod.default)
    })
    return () => { cancelled = true }
  }, [providerType, loader])

  if (!icon) {
    // Placeholder with same dimensions to avoid layout shift
    return <Cpu className={className} style={{ opacity: 0.3 }} />
  }

  return <ResolvedIcon icon={icon} lobehubName={lobehubName} variant={variant} className={className} />
}
