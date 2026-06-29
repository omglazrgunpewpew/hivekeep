import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Network, Plus, Copy, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { FormDialog } from '@/client/components/common/FormDialog'
import { FormField } from '@/client/components/common/FormField'
import { EmptyState } from '@/client/components/common/EmptyState'
import { SettingsListSkeleton } from '@/client/components/common/SettingsListSkeleton'
import { ApiClientCard } from '@/client/components/api-client/ApiClientCard'
import { ApiClientFormDialog, type ApiClientFormValues } from '@/client/components/api-client/ApiClientFormDialog'
import { api, toastError, getErrorMessage } from '@/client/lib/api'
import { useAgentList } from '@/client/hooks/useAgentList'
import { useCopyToClipboard } from '@/client/hooks/useCopyToClipboard'
import type { ApiClientSummary } from '@/shared/types'
import type { AgentOption } from '@/client/components/common/AgentSelectItem'

interface RevealedKey {
  clientName: string
  label: string
  fullKey: string
}

export function ExternalApiSettings() {
  const { t } = useTranslation()
  const { agents: agentList } = useAgentList()
  const agents: AgentOption[] = useMemo(
    () => agentList.map((k) => ({ id: k.id, name: k.name, role: k.role ?? '', avatarUrl: k.avatarUrl })),
    [agentList],
  )
  const agentNameById = useMemo(() => new Map(agentList.map((k) => [k.id, k.name])), [agentList])

  const [clients, setClients] = useState<ApiClientSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ApiClientSummary | null>(null)

  // Key creation: ask for a label, then reveal the full key exactly once.
  const [keyClient, setKeyClient] = useState<ApiClientSummary | null>(null)
  const [keyLabel, setKeyLabel] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [revealedKey, setRevealedKey] = useState<RevealedKey | null>(null)
  const [showKey, setShowKey] = useState(false)
  const { copy } = useCopyToClipboard()

  const fetchClients = useCallback(async () => {
    try {
      const data = await api.get<{ clients: ApiClientSummary[] }>('/api-clients')
      setClients(data.clients)
    } catch (err) {
      toastError(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleSave = async (values: ApiClientFormValues) => {
    if (editingClient) {
      await api.patch(`/api-clients/${editingClient.id}`, values)
      toast.success(t('settings.externalApi.saved'))
    } else {
      await api.post('/api-clients', values)
      toast.success(t('settings.externalApi.added'))
    }
    await fetchClients()
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api-clients/${id}`)
      await fetchClients()
      toast.success(t('settings.externalApi.deleted'))
    } catch (err) {
      toastError(err)
    }
  }

  const handleRevokeKey = async (clientId: string, keyId: string) => {
    try {
      await api.post(`/api-clients/${clientId}/keys/${keyId}/revoke`)
      await fetchClients()
      toast.success(t('settings.externalApi.revoked'))
    } catch (err) {
      toastError(err)
    }
  }

  const openCreateKey = (client: ApiClientSummary) => {
    setKeyClient(client)
    setKeyLabel('')
  }

  const handleCreateKey = async () => {
    if (!keyClient) return
    setCreatingKey(true)
    try {
      const result = await api.post<{ fullKey: string; prefix: string; label: string }>(
        `/api-clients/${keyClient.id}/keys`,
        { label: keyLabel.trim() || undefined },
      )
      const clientName = keyClient.name
      setKeyClient(null)
      await fetchClients()
      setShowKey(false)
      setRevealedKey({ clientName, label: result.label, fullKey: result.fullKey })
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setCreatingKey(false)
    }
  }

  const openAdd = () => {
    setEditingClient(null)
    setModalOpen(true)
  }

  const openEdit = (client: ApiClientSummary) => {
    setEditingClient(client)
    setModalOpen(true)
  }

  if (isLoading) {
    return <SettingsListSkeleton count={2} />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('settings.externalApi.description')}</p>

      {clients.length === 0 ? (
        <EmptyState
          icon={Network}
          title={t('settings.externalApi.empty')}
          description={t('settings.externalApi.emptyDescription')}
          actionLabel={t('settings.externalApi.add')}
          onAction={openAdd}
        />
      ) : (
        <>
          <div className="space-y-3">
            {clients.map((client) => (
              <ApiClientCard
                key={client.id}
                client={client}
                agentName={client.agentId ? agentNameById.get(client.agentId) ?? null : null}
                onEdit={() => openEdit(client)}
                onDelete={() => handleDelete(client.id)}
                onCreateKey={() => openCreateKey(client)}
                onRevokeKey={(keyId) => handleRevokeKey(client.id, keyId)}
              />
            ))}
          </div>

          <Button variant="outline" onClick={openAdd} className="w-full">
            <Plus className="size-4" />
            {t('settings.externalApi.add')}
          </Button>
        </>
      )}

      {/* Create / edit client */}
      <ApiClientFormDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        client={editingClient}
        agents={agents}
        onSave={handleSave}
      />

      {/* Key label prompt */}
      <FormDialog
        open={!!keyClient}
        onOpenChange={(v) => { if (!v) setKeyClient(null) }}
        title={t('settings.externalApi.createKey')}
        onSubmit={handleCreateKey}
        isSubmitting={creatingKey}
        submitLabel={t('settings.externalApi.createKey')}
        size="sm"
      >
        <FormField label={t('settings.externalApi.keyLabel')} hint={t('settings.externalApi.keyLabelHint')}>
          <Input
            value={keyLabel}
            onChange={(e) => setKeyLabel(e.target.value)}
            placeholder={t('settings.externalApi.keyLabelPlaceholder')}
          />
        </FormField>
      </FormDialog>

      {/* Reveal the full key exactly once */}
      <FormDialog
        open={!!revealedKey}
        onOpenChange={(v) => { if (!v) setRevealedKey(null) }}
        title={t('settings.externalApi.keyAdded')}
        description={<span className="text-warning">{t('settings.externalApi.keyWarning')}</span>}
        size="lg"
        cancelLabel={t('common.close')}
      >
        {revealedKey && (
          <FormField label={t('settings.externalApi.keyLabelFor', { label: revealedKey.label })}>
            <div className="flex gap-2">
              <Input
                value={showKey ? revealedKey.fullKey : '•'.repeat(40)}
                readOnly
                className="font-mono text-xs"
              />
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => copy(revealedKey.fullKey, { successKey: 'settings.externalApi.keyCopied' })}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </FormField>
        )}
      </FormDialog>
    </div>
  )
}
