import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/client/components/ui/dialog'
import { Input } from '@/client/components/ui/input'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/client/components/ui/tabs'
import {
  AlertTriangle,
  Brain,
  Image as ImageIcon,
  Loader2,
  Mic,
  Headphones,
  RefreshCw,
  Search,
} from 'lucide-react'
import { api, getErrorMessage } from '@/client/lib/api'

interface ProviderModelEntry {
  id: string
  name: string
  capability: string
  contextWindow?: number
  maxOutput?: number
  /** LLM-family only — chat accepts image attachments. */
  supportsImageInput?: boolean
  /** Image-family only — how many source images the model accepts. */
  maxImageInputs?: number
}

interface ProviderVoiceEntry {
  id: string
  name: string
  language?: string
  gender?: 'male' | 'female' | 'neutral'
  description?: string
  model?: string
  previewUrl?: string
}

interface ProviderModelsResponse {
  provider: { id: string; name: string; type: string; slug: string }
  capabilities: Array<'llm' | 'embedding' | 'image' | 'stt'>
  models: ProviderModelEntry[]
  errors: Array<{ capability: string; message: string }>
}

interface ProviderVoicesResponse {
  provider: { id: string; name: string; type: string; slug: string }
  voices: ProviderVoiceEntry[]
  errors: Array<{ capability: string; message: string }>
}

interface ProviderModelsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  providerId: string
  providerName: string
  /** All capabilities the provider row currently has — drives which
   *  endpoints we hit and how the empty state is framed. */
  capabilities: string[]
}

const CAPABILITY_ICON: Record<string, typeof Brain> = {
  llm: Brain,
  embedding: Search,
  image: ImageIcon,
  stt: Headphones,
  tts: Mic,
  search: Search,
}

const CAPABILITY_LABEL_KEY: Record<string, string> = {
  llm: 'onboarding.providers.cap_llm',
  embedding: 'onboarding.providers.cap_embedding',
  image: 'onboarding.providers.cap_image',
  stt: 'onboarding.providers.familyStt',
  tts: 'onboarding.providers.familyTts',
  search: 'onboarding.providers.familySearch',
}

const ALL_TAB = '__all__'
const VOICES_TAB = 'voices'

export function ProviderModelsModal({
  open,
  onOpenChange,
  providerId,
  providerName,
  capabilities,
}: ProviderModelsModalProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<ProviderModelsResponse | null>(null)
  const [voicesData, setVoicesData] = useState<ProviderVoicesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)
  const [search, setSearch] = useState('')

  const hasTts = capabilities.includes('tts')
  const hasSearch = capabilities.includes('search')
  // Which families have something browseable. Search providers have
  // nothing to list — they're called directly via `web_search`.
  const browseableCaps = capabilities.filter(
    (c) => c === 'llm' || c === 'embedding' || c === 'image' || c === 'stt' || c === 'tts',
  )

  const fetchAll = async () => {
    const calls: Array<Promise<unknown>> = []
    calls.push(
      api
        .get<ProviderModelsResponse>(`/providers/${providerId}/models`)
        .then(setData)
        .catch((err) => setError(getErrorMessage(err))),
    )
    if (hasTts) {
      calls.push(
        api
          .get<ProviderVoicesResponse>(`/providers/${providerId}/voices`)
          .then(setVoicesData)
          .catch((err) => setError(getErrorMessage(err))),
      )
    }
    await Promise.all(calls)
  }

  // Fetch once per open. The modal stays mounted between opens; resetting
  // here keeps state clean if the user closes + reopens for a different
  // provider.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setData(null)
    setVoicesData(null)
    setActiveTab(ALL_TAB)
    setSearch('')

    fetchAll().finally(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, providerId])

  // Manual refresh — keeps the existing list visible (no flash to empty
  // state) and just swaps it once the new payload arrives.
  const handleRefresh = () => {
    if (isLoading || isRefreshing) return
    setIsRefreshing(true)
    setError(null)
    fetchAll().finally(() => setIsRefreshing(false))
  }

  // Filtered models — search filter + active tab. Tab 'voices' isn't a
  // model capability so we skip the model list in that case.
  const filteredModels = useMemo(() => {
    if (!data) return []
    if (activeTab === VOICES_TAB) return []
    const q = search.trim().toLowerCase()
    return data.models.filter((m) => {
      if (activeTab !== ALL_TAB && m.capability !== activeTab) return false
      if (!q) return true
      return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    })
  }, [data, search, activeTab])

  // Filtered voices — only visible on the voices tab (or the all tab).
  const filteredVoices = useMemo(() => {
    if (!voicesData) return []
    if (activeTab !== ALL_TAB && activeTab !== VOICES_TAB) return []
    const q = search.trim().toLowerCase()
    return voicesData.voices.filter((v) => {
      if (!q) return true
      return (
        v.id.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        (v.language ?? '').toLowerCase().includes(q) ||
        (v.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [voicesData, search, activeTab])

  // Show tabs when the provider has more than one browseable surface
  // (multiple model families, or models + voices, or just voices when
  // the row is TTS-only — we always show the voices tab in that case so
  // the section gets a name).
  const tabbedCaps = data?.capabilities ?? []
  const showCapabilityTabs = tabbedCaps.length + (hasTts ? 1 : 0) > 1

  const totalCount =
    (data?.models.length ?? 0) + (voicesData?.voices.length ?? 0)
  const allErrors = [
    ...(data?.errors ?? []),
    ...(voicesData?.errors ?? []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="panel" size="2xl">
        <DialogHeader>
          <DialogTitle>
            {t('settings.providers.modelsModal.title', { name: providerName })}
          </DialogTitle>
          <DialogDescription>
            {t(
              'settings.providers.modelsModal.description',
              'Models and voices the provider exposes right now (fetched live from its API). Use this list to verify what is available without leaving KinBot.',
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
        {/* Capabilities header — useful for every provider, especially
            search-only ones where there's nothing else to browse. */}
        {capabilities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground mr-1">
              {t('settings.providers.modelsModal.capabilitiesLabel', 'Capabilities:')}
            </span>
            {capabilities.map((cap) => {
              const Icon = CAPABILITY_ICON[cap]
              return (
                <Badge key={cap} variant="secondary" size="xs">
                  {Icon && <Icon className="size-3 mr-1" />}
                  {t(CAPABILITY_LABEL_KEY[cap] ?? cap, cap)}
                </Badge>
              )
            })}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin mr-2" />
            {t('settings.providers.modelsModal.loading', 'Loading…')}
          </div>
        )}

        {error && !isLoading && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium">{t('settings.providers.modelsModal.fetchError', 'Could not load')}</p>
              <p className="mt-0.5 text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Search-only provider — nothing to browse. Show a clean
            explanatory message instead of an empty list. */}
        {!isLoading && !error && browseableCaps.length === 0 && hasSearch && (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            {t(
              'settings.providers.modelsModal.searchOnlyExplain',
              'Search providers have no model or voice catalogue — they are called directly through the web_search tool. The capabilities above describe what this provider supports.',
            )}
          </div>
        )}

        {!isLoading && !error && (data || voicesData) && browseableCaps.length > 0 && (
          <div className="space-y-3">
            {allErrors.length > 0 && (
              <div className="space-y-1">
                {allErrors.map((e, i) => (
                  <div
                    key={`${e.capability}-${i}`}
                    className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400"
                  >
                    <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                    <span>
                      <span className="font-medium">{e.capability}:</span> {e.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {showCapabilityTabs && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="max-w-full flex-wrap overflow-x-auto">
                  <TabsTrigger value={ALL_TAB}>
                    {t('settings.providers.modelsModal.allCapabilities', 'All')}
                    <Badge variant="secondary" size="xs" className="ml-1.5">
                      {totalCount}
                    </Badge>
                  </TabsTrigger>
                  {tabbedCaps.map((cap) => {
                    const Icon = CAPABILITY_ICON[cap]
                    const count = (data?.models ?? []).filter((m) => m.capability === cap).length
                    return (
                      <TabsTrigger key={cap} value={cap}>
                        {Icon && <Icon className="size-3.5 mr-1" />}
                        {t(CAPABILITY_LABEL_KEY[cap] ?? cap, cap)}
                        <Badge variant="secondary" size="xs" className="ml-1.5">
                          {count}
                        </Badge>
                      </TabsTrigger>
                    )
                  })}
                  {hasTts && (
                    <TabsTrigger value={VOICES_TAB}>
                      <Mic className="size-3.5 mr-1" />
                      {t(CAPABILITY_LABEL_KEY.tts ?? 'tts', 'Voices')}
                      <Badge variant="secondary" size="xs" className="ml-1.5">
                        {voicesData?.voices.length ?? 0}
                      </Badge>
                    </TabsTrigger>
                  )}
                </TabsList>
              </Tabs>
            )}

            <div className="flex items-center gap-2">
              <Input
                type="search"
                placeholder={t('settings.providers.modelsModal.searchPlaceholder', 'Filter by name or id…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title={t('settings.providers.modelsModal.refreshTooltip', 'Re-fetch the catalogue from the provider API')}
              >
                <RefreshCw className={isRefreshing ? 'animate-spin' : undefined} />
                {t('settings.providers.modelsModal.refresh', 'Refresh')}
              </Button>
            </div>

            <div className="rounded-md border border-border">
              {filteredModels.length === 0 && filteredVoices.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  {totalCount === 0
                    ? t('settings.providers.modelsModal.emptyAll', 'This provider exposes nothing to browse.')
                    : t('settings.providers.modelsModal.emptyFiltered', 'Nothing matches the current filter.')}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredModels.map((m) => {
                    const Icon = CAPABILITY_ICON[m.capability]
                    return (
                      <li key={`model:${m.capability}:${m.id}`} className="flex items-center gap-3 p-3">
                        <div className="shrink-0">
                          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground truncate">{m.id}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          {m.contextWindow != null && (
                            <Badge variant="outline" size="xs">
                              {formatTokens(m.contextWindow)} ctx
                            </Badge>
                          )}
                          {m.maxOutput != null && (
                            <Badge variant="outline" size="xs">
                              {formatTokens(m.maxOutput)} out
                            </Badge>
                          )}
                          {m.supportsImageInput && (
                            <Badge variant="outline" size="xs">
                              <ImageIcon className="size-3 mr-0.5" />
                              {t('settings.providers.modelsModal.imageInput', 'image-in')}
                            </Badge>
                          )}
                          {m.maxImageInputs != null && m.maxImageInputs > 0 && (
                            <Badge variant="outline" size="xs">
                              <ImageIcon className="size-3 mr-0.5" />
                              {m.maxImageInputs === 1
                                ? t('settings.providers.modelsModal.img2img', 'img2img')
                                : t('settings.providers.modelsModal.multiImage', { count: m.maxImageInputs, defaultValue: 'multi-ref ({{count}})' })}
                            </Badge>
                          )}
                        </div>
                      </li>
                    )
                  })}

                  {filteredVoices.map((v) => (
                    <li key={`voice:${v.id}`} className="flex items-center gap-3 p-3">
                      <div className="shrink-0">
                        <Mic className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{v.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground truncate">{v.id}</p>
                        {v.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{v.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {v.language && (
                          <Badge variant="outline" size="xs">
                            {v.language}
                          </Badge>
                        )}
                        {v.gender && (
                          <Badge variant="outline" size="xs">
                            {v.gender}
                          </Badge>
                        )}
                        {v.model && (
                          <Badge variant="outline" size="xs" className="font-mono">
                            {v.model}
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        </DialogBody>

        {!isLoading && !error && (data || voicesData) && browseableCaps.length > 0 && (
          <DialogFooter>
            <p className="mr-auto text-xs text-muted-foreground">
              {t('settings.providers.modelsModal.footer', {
                shown: filteredModels.length + filteredVoices.length,
                total: totalCount,
                defaultValue: 'Showing {{shown}} of {{total}}',
              })}
            </p>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}k`
  return String(n)
}
