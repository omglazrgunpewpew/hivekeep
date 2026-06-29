import { useTranslation } from 'react-i18next'
import { Pencil, Plus, KeyRound } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { Badge } from '@/client/components/ui/badge'
import { ConfirmDeleteButton } from '@/client/components/common/ConfirmDeleteButton'
import { cn } from '@/client/lib/utils'
import type { ApiClientSummary } from '@/shared/types'

interface ApiClientCardProps {
  client: ApiClientSummary
  /** Resolved target Agent name, or null for "any Agent". */
  agentName: string | null
  onEdit: () => void
  onDelete: () => void
  onCreateKey: () => void
  onRevokeKey: (keyId: string) => void
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function ApiClientCard({ client, agentName, onEdit, onDelete, onCreateKey, onRevokeKey }: ApiClientCardProps) {
  const { t } = useTranslation()
  const activeKeys = client.keys.filter((k) => !k.revokedAt)

  return (
    <div className="surface-card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium">{client.name}</h3>
            {client.status === 'disabled' && (
              <Badge variant="secondary">{t('settings.externalApi.disabled')}</Badge>
            )}
          </div>
          {client.description && (
            <p className="text-sm text-muted-foreground">{client.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={onEdit} aria-label={t('common.edit')}>
            <Pencil className="size-3.5" />
          </Button>
          <ConfirmDeleteButton
            onConfirm={onDelete}
            description={t('settings.externalApi.deleteConfirm')}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t('settings.externalApi.targetAgent')}:{' '}
          <span className="text-foreground">{agentName ?? t('settings.externalApi.anyAgent')}</span>
        </span>
        <span className="flex items-center gap-1">
          {t('settings.externalApi.allowedModes')}:
          {client.allowedModes.map((m) => (
            <Badge key={m} variant="outline" className="font-normal">
              {m === 'main' ? t('settings.externalApi.modeMain') : t('settings.externalApi.modeIsolated')}
            </Badge>
          ))}
        </span>
        {client.rateLimitPerMin != null && (
          <span>
            {t('settings.externalApi.rateLimit')}:{' '}
            <span className="text-foreground">{t('settings.externalApi.rateLimitValue', { count: client.rateLimitPerMin })}</span>
          </span>
        )}
      </div>

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('settings.externalApi.keys')}</span>
          <Button variant="outline" size="sm" onClick={onCreateKey}>
            <Plus className="size-4" />
            {t('settings.externalApi.createKey')}
          </Button>
        </div>

        {client.keys.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('settings.externalApi.noKeys')}</p>
        ) : (
          <ul className="space-y-1.5">
            {client.keys.map((key) => (
              <li
                key={key.id}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs',
                  key.revokedAt && 'opacity-60',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                  <code className="shrink-0 font-mono">{key.prefix}…</code>
                  <span className="truncate text-muted-foreground">{key.label}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {key.revokedAt ? (
                    <Badge variant="secondary">{t('settings.externalApi.revoked')}</Badge>
                  ) : (
                    <>
                      <span className="hidden text-muted-foreground sm:inline">
                        {key.lastUsedAt
                          ? t('settings.externalApi.lastUsed', { date: formatDate(key.lastUsedAt) })
                          : t('settings.externalApi.neverUsed')}
                      </span>
                      <ConfirmDeleteButton
                        onConfirm={() => onRevokeKey(key.id)}
                        title={t('settings.externalApi.revokeKey')}
                        description={t('settings.externalApi.revokeConfirm')}
                        confirmLabel={t('settings.externalApi.revokeKey')}
                      />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
