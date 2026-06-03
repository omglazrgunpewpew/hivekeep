import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Label } from '@/client/components/ui/label'
import { Textarea } from '@/client/components/ui/textarea'
import { cn } from '@/client/lib/utils'
import { ToolDomainIcon } from '@/client/components/common/ToolDomainIcon'
import { LucideIconPicker } from '@/client/components/common/LucideIconPicker'
import { DOMAIN_COLOR_TOKENS, CURATED_DOMAIN_COLORS } from '@/shared/constants'
import type { ToolDomainEntry } from '@/shared/types'
import type { CreateToolDomainInput } from '@/client/hooks/useToolDomains'

interface DomainFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  domain: ToolDomainEntry | null
  onCreate: (input: CreateToolDomainInput) => Promise<void>
  onUpdate: (slug: string, input: Omit<CreateToolDomainInput, 'slug'>) => Promise<void>
}

const SLUG_RE = /^[a-z][a-z0-9-]*$/

export function DomainFormDialog({ open, onOpenChange, domain, onCreate, onUpdate }: DomainFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!domain
  const readOnly = !!domain?.builtin

  const [slug, setSlug] = useState('')
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState('Puzzle')
  const [color, setColor] = useState<string>('chart-1')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSlug(domain?.slug ?? '')
    setLabel(domain?.label ?? '')
    setIcon(domain?.icon ?? 'Puzzle')
    setColor(domain?.color ?? 'chart-1')
    setDescription(domain?.description ?? '')
  }, [open, domain])

  async function handleSubmit() {
    setError(null)
    if (!isEdit && !SLUG_RE.test(slug)) {
      setError(t('toolDomains.errors.slug'))
      return
    }
    if (!label.trim()) {
      setError(t('toolDomains.errors.label'))
      return
    }
    setSaving(true)
    try {
      if (isEdit) {
        await onUpdate(domain!.slug, { label, icon, color, description: description || null })
      } else {
        await onCreate({ slug, label, icon, color, description: description || null })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? t('toolDomains.view') : isEdit ? t('toolDomains.edit') : t('toolDomains.create')}
          </DialogTitle>
          <DialogDescription>{t('toolDomains.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview */}
          <div className="flex items-center gap-2">
            <span className={cn('flex size-9 items-center justify-center rounded-md', CURATED_DOMAIN_COLORS[color as keyof typeof CURATED_DOMAIN_COLORS]?.bg)}>
              <ToolDomainIcon iconName={icon} className={cn('size-4', CURATED_DOMAIN_COLORS[color as keyof typeof CURATED_DOMAIN_COLORS]?.text)} />
            </span>
            <span className="text-sm font-medium">{label || t('toolDomains.previewLabel')}</span>
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="domain-slug">{t('toolDomains.fields.slug')}</Label>
              <Input id="domain-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="weather" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="domain-label">{t('toolDomains.fields.label')}</Label>
            <Input id="domain-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={readOnly} placeholder="Weather" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="domain-icon">{t('toolDomains.fields.icon')}</Label>
            <LucideIconPicker value={icon} onChange={setIcon} disabled={readOnly} />
            <p className="text-xs text-muted-foreground">{t('toolDomains.fields.iconHint')}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t('toolDomains.fields.color')}</Label>
            <div className="flex flex-wrap gap-2">
              {DOMAIN_COLOR_TOKENS.map((token) => (
                <button
                  key={token}
                  type="button"
                  disabled={readOnly}
                  onClick={() => setColor(token)}
                  aria-label={token}
                  aria-pressed={color === token}
                  style={{ backgroundColor: `var(--color-${token})` }}
                  className={cn(
                    'size-7 rounded-md border-2 transition-transform',
                    color === token ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="domain-desc">{t('toolDomains.fields.description')}</Label>
            <Textarea id="domain-desc" value={description} onChange={(e) => setDescription(e.target.value)} disabled={readOnly} rows={2} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {readOnly ? t('common.close') : t('common.cancel')}
          </Button>
          {!readOnly && (
            <Button onClick={handleSubmit} disabled={saving}>
              {isEdit ? t('common.save') : t('common.create')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
