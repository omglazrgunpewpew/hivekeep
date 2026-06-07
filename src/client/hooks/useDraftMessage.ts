import { useState, useEffect, useCallback, useRef } from 'react'

const DRAFT_PREFIX = 'hivekeep:draft:'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const SAVE_DEBOUNCE_MS = 300

/** Read a draft from localStorage */
function loadDraft(kinId: string): string {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + kinId)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { text: string; ts: number }
    if (Date.now() - parsed.ts > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(DRAFT_PREFIX + kinId)
      return ''
    }
    return parsed.text
  } catch {
    return ''
  }
}

/** Save a draft to localStorage (with timestamp for expiry) */
function saveDraft(kinId: string, text: string) {
  try {
    if (!text) {
      localStorage.removeItem(DRAFT_PREFIX + kinId)
    } else {
      localStorage.setItem(DRAFT_PREFIX + kinId, JSON.stringify({ text, ts: Date.now() }))
    }
  } catch {
    // Storage full or unavailable
  }
}

/** Clean up drafts older than 7 days */
function cleanupOldDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as { ts: number }
        if (Date.now() - parsed.ts > DRAFT_MAX_AGE_MS) {
          localStorage.removeItem(key)
        }
      } catch {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // Ignore
  }
}

// Run cleanup once on module load
cleanupOldDrafts()

/**
 * Persists draft message content per Kin across component unmounts
 * and page reloads via localStorage.
 */
export function useDraftMessage(kinId: string | null) {
  const [content, setContentState] = useState(() =>
    kinId ? loadDraft(kinId) : '',
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from storage when kinId changes
  useEffect(() => {
    setContentState(kinId ? loadDraft(kinId) : '')
  }, [kinId])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const setContent = useCallback(
    (value: string) => {
      setContentState(value)
      if (kinId) {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => saveDraft(kinId, value), SAVE_DEBOUNCE_MS)
      }
    },
    [kinId],
  )

  const clearDraft = useCallback(() => {
    if (kinId) {
      saveDraft(kinId, '')
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    setContentState('')
  }, [kinId])

  return { content, setContent, clearDraft }
}
