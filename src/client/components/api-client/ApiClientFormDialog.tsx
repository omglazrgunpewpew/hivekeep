import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FormDialog } from '@/client/components/common/FormDialog'
import { FormField } from '@/client/components/common/FormField'
import { Input } from '@/client/components/ui/input'
import { Textarea } from '@/client/components/ui/textarea'
import { AgentSelector } from '@/client/components/common/AgentSelector'
import { ToggleGroup, ToggleGroupItem } from '@/client/components/ui/toggle-group'
import { getErrorMessage } from '@/client/lib/api'
import type { ApiClientSummary } from '@/shared/types'
import type { AgentOption } from '@/client/components/common/AgentSelectItem'

const ANY_AGENT = 'none'

export interface ApiClientFormValues {
  name: string
  description: string | null
  agentId: string | null
  allowedModes: string[]
  rateLimitPerMin: number | null
}

interface ApiClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = create, otherwise edit. */
  client: ApiClientSummary | null
  agents: AgentOption[]
  onSave: (values: ApiClientFormValues) => Promise<void>
}

export function ApiClientFormDialog({ open, onOpenChange, client, agents, onSave }: ApiClientFormDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [agentId, setAgentId] = useState<string>(ANY_AGENT)
  const [modes, setModes] = useState<string[]>(['main', 'isolated'])
  const [rateLimit, setRateLimit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the form whenever the dialog opens (create) or the target changes (edit).
  useEffect(() => {
    if (!open) return
    setName(client?.name ?? '')
    setDescription(client?.description ?? '')
    setAgentId(client?.agentId ?? ANY_AGENT)
    setModes(client?.allowedModes ?? ['main', 'isolated'])
    setRateLimit(client?.rateLimitPerMin != null ? String(client.rateLimitPerMin) : '')
    setError(null)
  }, [open, client])

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('settings.externalApi.nameRequired'))
      return
    }
    if (modes.length === 0) {
      setError(t('settings.externalApi.modesRequired'))
      return
    }
    const parsedRate = rateLimit.trim() ? Number(rateLimit) : null
    if (parsedRate != null && (!Number.isFinite(parsedRate) || parsedRate <= 0)) {
      setError(t('settings.externalApi.rateLimitInvalid'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        agentId: agentId === ANY_AGENT ? null : agentId,
        allowedModes: modes,
        rateLimitPerMin: parsedRate,
      })
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={client ? t('settings.externalApi.edit') : t('settings.externalApi.add')}
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitLabel={t('common.save')}
      error={error}
    >
      <FormField label={t('settings.externalApi.name')} required>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.externalApi.namePlaceholder')}
        />
      </FormField>

      <FormField label={t('settings.externalApi.descriptionLabel')}>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('settings.externalApi.descriptionPlaceholder')}
          rows={2}
        />
      </FormField>

      <FormField label={t('settings.externalApi.targetAgent')} hint={t('settings.externalApi.targetAgentHint')}>
        <AgentSelector
          value={agentId}
          onValueChange={setAgentId}
          agents={agents}
          noneLabel={t('settings.externalApi.anyAgent')}
          noneValue={ANY_AGENT}
        />
      </FormField>

      <FormField label={t('settings.externalApi.allowedModes')} hint={t('settings.externalApi.allowedModesHint')}>
        <ToggleGroup
          type="multiple"
          variant="outline"
          value={modes}
          onValueChange={(v) => setModes(v)}
          className="justify-start"
        >
          <ToggleGroupItem value="main">{t('settings.externalApi.modeMain')}</ToggleGroupItem>
          <ToggleGroupItem value="isolated">{t('settings.externalApi.modeIsolated')}</ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <FormField label={t('settings.externalApi.rateLimit')} hint={t('settings.externalApi.rateLimitHint')}>
        <Input
          type="number"
          min={1}
          value={rateLimit}
          onChange={(e) => setRateLimit(e.target.value)}
          placeholder={t('settings.externalApi.rateLimitPlaceholder')}
        />
      </FormField>
    </FormDialog>
  )
}
