import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, MessagesSquare, Loader2 } from 'lucide-react'
import { FormDialog } from '@/client/components/common/FormDialog'
import { EmptyState } from '@/client/components/common/EmptyState'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { api, toastError } from '@/client/lib/api'
import { cn } from '@/client/lib/utils'
import type { ApiClientSummary, ApiClientConversation, ApiConversationMessage } from '@/shared/types'

interface ApiClientConversationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: ApiClientSummary | null
  /** Resolve an Agent id to its name for labelling. */
  agentName: (agentId: string) => string | null
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function ApiClientConversationsDialog({ open, onOpenChange, client, agentName }: ApiClientConversationsDialogProps) {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState<ApiClientConversation[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [selected, setSelected] = useState<ApiClientConversation | null>(null)
  const [messages, setMessages] = useState<ApiConversationMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)

  const clientId = client?.id

  const fetchList = useCallback(async () => {
    if (!clientId) return
    setLoadingList(true)
    try {
      const data = await api.get<{ conversations: ApiClientConversation[] }>(`/api-clients/${clientId}/conversations`)
      setConversations(data.conversations)
    } catch (err) {
      toastError(err)
    } finally {
      setLoadingList(false)
    }
  }, [clientId])

  // (Re)load the list when the dialog opens for a client; reset the drill-in.
  useEffect(() => {
    if (!open) return
    setSelected(null)
    setMessages([])
    fetchList()
  }, [open, fetchList])

  const openConversation = async (conv: ApiClientConversation) => {
    if (!clientId) return
    setSelected(conv)
    setLoadingMessages(true)
    setMessages([])
    try {
      const data = await api.get<{ messages: ApiConversationMessage[] }>(
        `/api-clients/${clientId}/conversations/${conv.conversationId}/messages`,
      )
      setMessages(data.messages)
    } catch (err) {
      toastError(err)
    } finally {
      setLoadingMessages(false)
    }
  }

  function roleLabel(m: ApiConversationMessage, convAgentId: string): string {
    if (m.role === 'assistant') return agentName(convAgentId) ?? t('settings.externalApi.roleAgent')
    if (m.role === 'user') return client?.name ?? t('settings.externalApi.roleClient')
    return t('settings.externalApi.roleSystem')
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={selected ? (selected.title || t('settings.externalApi.convUntitled')) : t('settings.externalApi.conversations')}
      description={client ? client.name : undefined}
      size="lg"
      hideFooter
    >
      {!selected ? (
        // ── Conversation list ──
        loadingList ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={t('settings.externalApi.noConversations')}
            description={t('settings.externalApi.noConversationsDescription')}
          />
        ) : (
          <ul className="space-y-2">
            {conversations.map((conv) => (
              <li key={conv.conversationId}>
                <button
                  type="button"
                  onClick={() => openConversation(conv)}
                  className="surface-card flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{conv.title || t('settings.externalApi.convUntitled')}</span>
                      {conv.status === 'closed' && (
                        <Badge variant="secondary">{t('settings.externalApi.convClosed')}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{agentName(conv.agentId) ?? conv.agentId}</span>
                      <span>{t('settings.externalApi.convMessages', { count: conv.messageCount })}</span>
                      {conv.lastMessageAt && <span>{formatDateTime(conv.lastMessageAt)}</span>}
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        // ── Transcript (read-only) ──
        <div className="space-y-3">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setSelected(null)}>
            <ChevronLeft className="size-4" />
            {t('settings.externalApi.backToConversations')}
          </Button>
          {loadingMessages ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : messages.length === 0 ? (
            <EmptyState minimal title={t('settings.externalApi.transcriptEmpty')} />
          ) : (
            <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div key={m.id} className={cn(m.role === 'assistant' && 'pl-4')}>
                  <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{roleLabel(m, selected.agentId)}</span>
                    <span>{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </FormDialog>
  )
}
