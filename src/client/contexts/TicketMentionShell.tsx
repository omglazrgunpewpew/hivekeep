/**
 * Glue between the URL/Kin list and the TicketMentionProvider.
 *
 * The provider needs an "active project id" to resolve bare `#N` mentions.
 * That id depends on context:
 *
 *   - Inside a Kin chat (`/kin/:slug`): the kin's `activeProjectId`.
 *   - Inside a project page (`/projects/:projectId`): the project id itself.
 *   - Elsewhere: null (bare refs will surface as `NO_ACTIVE_PROJECT`).
 *
 * Putting this resolution next to the provider keeps the rest of the app
 * agnostic — markdown renderers anywhere call `useTicketMention(raw)` and the
 * project context is figured out here.
 */
import { type ReactNode } from 'react'
import { useLocation, useMatch } from 'react-router-dom'
import { useKinList } from '@/client/hooks/useKinList'
import { TicketMentionProvider } from '@/client/contexts/TicketMentionContext'

export function TicketMentionShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const projectMatch = useMatch('/projects/:projectId')
  const { kins } = useKinList()

  // Match `/kin/:slug` from the path manually since the routing config uses a
  // catch-all `*` for the chat page rather than a typed route.
  const kinSlugMatch = location.pathname.match(/^\/kin\/([^/]+)/)
  const kinSlug = kinSlugMatch?.[1] ?? null

  let activeProjectId: string | null = null
  if (projectMatch?.params.projectId) {
    activeProjectId = projectMatch.params.projectId
  } else if (kinSlug) {
    const kin = kins.find((k) => k.slug === kinSlug)
    activeProjectId = kin?.activeProjectId ?? null
  }

  return (
    <TicketMentionProvider activeProjectId={activeProjectId}>{children}</TicketMentionProvider>
  )
}
