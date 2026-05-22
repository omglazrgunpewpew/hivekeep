import { useState, useEffect } from 'react'
import { api } from '@/client/lib/api'
import { useSSE } from '@/client/hooks/useSSE'
import type { ChannelConfigSchema } from '@/shared/types'

export interface PlatformInfo {
  platform: string
  displayName: string
  brandColor?: string
  iconUrl?: string
  isPlugin: boolean
  configSchema?: ChannelConfigSchema
}

/** Cached platforms — shared across all hook consumers within the same session.
 *  Invalidated whenever a plugin is enabled / disabled / auto-disabled (those
 *  events change which channel adapters are registered on the server).
 *  Subscribers re-fetch via the SSE listener below. */
let cachedPlatforms: PlatformInfo[] | null = null
let fetchPromise: Promise<PlatformInfo[]> | null = null

function fetchPlatforms(force = false): Promise<PlatformInfo[]> {
  if (force) {
    cachedPlatforms = null
    fetchPromise = null
  }
  if (!fetchPromise) {
    fetchPromise = api
      .get<{ platforms: PlatformInfo[] }>('/channels/platforms')
      .then((res) => {
        cachedPlatforms = res.platforms
        return res.platforms
      })
      .catch(() => {
        fetchPromise = null
        return []
      })
  }
  return fetchPromise
}

/**
 * Hook to get registered channel platforms from the API.
 *
 * Results are cached for the session lifetime + invalidated on plugin
 * enable/disable SSE events so the picker reflects newly-installed
 * channel adapters without a page reload (parallel to how
 * `useProviderTypes` handles provider plugins).
 */
export function usePlatforms() {
  const [platforms, setPlatforms] = useState<PlatformInfo[]>(cachedPlatforms ?? [])
  const [loading, setLoading] = useState(!cachedPlatforms)

  useEffect(() => {
    if (cachedPlatforms) {
      setPlatforms(cachedPlatforms)
      setLoading(false)
      return
    }
    fetchPlatforms().then((p) => {
      setPlatforms(p)
      setLoading(false)
    })
  }, [])

  // Re-fetch when a plugin's lifecycle changes — newly-enabled channel
  // adapters need to appear in the picker, just-disabled ones need to
  // disappear. Same SSE events `useProviderTypes` listens to.
  useSSE({
    'plugin:enabled': () => {
      fetchPlatforms(true).then(setPlatforms)
    },
    'plugin:disabled': () => {
      fetchPlatforms(true).then(setPlatforms)
    },
    'plugin:autoDisabled': () => {
      fetchPlatforms(true).then(setPlatforms)
    },
  })

  return { platforms, loading }
}
