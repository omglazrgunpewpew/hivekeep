import { Component, Suspense, lazy, useMemo, type ComponentType, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { JsonViewer } from '@/client/components/common/JsonViewer'
import { UI_KIT, type CustomToolUiKit } from '@/client/components/chat/custom-tool-ui-kit'
import i18n from '@/client/lib/i18n'

/**
 * Renders a custom tool's optional, server-bundled React result renderer in the
 * EXPANDED tool-call view.
 *
 * The renderer module is fetched at runtime from
 * `/api/custom-tools/:slug/renderer.js`. It shares the host's single React
 * instance (window.__KINBOT_REACT__, set in main.tsx) so hooks work and it
 * inherits the app theme via cascading `--color-*` CSS variables. It receives
 * `{ result, args, ui }` where `ui` is the themed primitives kit.
 *
 * Resilience: a tiny spinner shows while the module loads; an ErrorBoundary
 * catches any load/render error and falls back to the default JsonViewer so a
 * broken renderer NEVER crashes the chat. The boundary remounts on slug change.
 *
 * Threat model: host-context renderers run with full host privileges (no
 * isolation) — acceptable because custom tools are trusted (user/Kin-authored,
 * self-hosted) and this is for result DISPLAY only.
 */

interface RemoteRendererProps {
  result: unknown
  args: unknown
  ui: CustomToolUiKit
}

interface CustomToolRendererProps {
  slug: string
  result: unknown
  args: unknown
  /**
   * Optional cache-buster. When set, it is appended as `?v=${bust}` to the
   * renderer module URL and folded into the lazy/boundary key, so a new value
   * forces a fresh import of the freshly built module (React.lazy caches by
   * URL). Omitted in chat usage → unchanged behavior.
   */
  bust?: string | number
}

/** Error boundary that falls back to a raw JSON dump of the result. Reset on
 *  slug change via the `resetKey` prop (changing it remounts the boundary). */
class RendererErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  override render() {
    if (this.state.error) return this.props.fallback
    return this.props.children
  }
}

function RendererFallback({ result, args }: { result: unknown; args: unknown }) {
  const t = i18n.t.bind(i18n)
  return (
    <>
      <JsonViewer data={args} label={t('tools.viewer.input')} maxHeight="max-h-40" />
      {result !== undefined && (
        <JsonViewer data={result} label={t('tools.viewer.output')} maxHeight="max-h-60" />
      )}
    </>
  )
}

export function CustomToolRenderer({ slug, result, args, bust }: CustomToolRendererProps) {
  // Lazy-load the server-bundled module. The specifier is built at runtime (not a
  // static literal) so Rollup leaves it as a runtime import rather than trying to
  // resolve it at build time; /* @vite-ignore */ silences Vite's dev transform.
  // A changing `bust` value yields a new URL → a new lazy() → a fresh import,
  // bypassing React.lazy's per-URL cache so the latest server build is shown.
  const Remote = useMemo<ComponentType<RemoteRendererProps>>(() => {
    let url = ['/api', 'custom-tools', encodeURIComponent(slug), 'renderer.js'].join('/')
    if (bust !== undefined && bust !== '') url += `?v=${encodeURIComponent(String(bust))}`
    return lazy(
      () => import(/* @vite-ignore */ url) as Promise<{ default: ComponentType<RemoteRendererProps> }>,
    )
  }, [slug, bust])

  return (
    <RendererErrorBoundary
      key={`${slug}:${bust ?? ''}`}
      fallback={<RendererFallback result={result} args={args} />}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        }
      >
        <Remote result={result} args={args} ui={UI_KIT} />
      </Suspense>
    </RendererErrorBoundary>
  )
}
