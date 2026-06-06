import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '@/client/components/ui/textarea'
import { Input } from '@/client/components/ui/input'
import { FormDialog } from '@/client/components/common/FormDialog'
import { FormField, FormRow } from '@/client/components/common/FormField'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { KinSelector } from '@/client/components/common/KinSelector'
import type { KinOption } from '@/client/components/common/KinSelectItem'
import { MEMORY_CATEGORIES } from '@/shared/constants'
import type { MemorySummary, MemoryCategory, MemoryScope } from '@/shared/types'

interface MemoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (kinId: string, data: { content: string; category: MemoryCategory; subject?: string; scope?: MemoryScope }) => Promise<void>
  onUpdate?: (memoryId: string, kinId: string, data: { content?: string; category?: MemoryCategory; subject?: string | null; scope?: MemoryScope }) => Promise<void>
  memory?: MemorySummary | null
  kinId?: string | null
  kins?: KinOption[]
}

export function MemoryFormDialog({
  open,
  onOpenChange,
  onSave,
  onUpdate,
  memory,
  kinId,
  kins,
}: MemoryFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = !!memory

  const [selectedKinId, setSelectedKinId] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<MemoryCategory>('fact')
  const [subject, setSubject] = useState('')
  const [scope, setScope] = useState<MemoryScope>('private')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (memory) {
      setContent(memory.content)
      setCategory(memory.category)
      setSubject(memory.subject ?? '')
      setScope(memory.scope ?? 'private')
      setSelectedKinId(memory.kinId)
    } else {
      setContent('')
      setCategory('fact')
      setSubject('')
      setScope('private')
      setSelectedKinId(kinId ?? '')
    }
  }, [memory, kinId, open])

  const handleSubmit = async () => {
    setIsLoading(true)

    try {
      if (isEdit && onUpdate && memory) {
        await onUpdate(memory.id, memory.kinId, {
          content,
          category,
          subject: subject || null,
          scope,
        })
      } else {
        const targetKinId = kinId ?? selectedKinId
        if (!targetKinId) return
        await onSave(targetKinId, {
          content,
          category,
          subject: subject || undefined,
          scope,
        })
      }
      onOpenChange(false)
    } catch {
      // Error handled by caller via toast
    } finally {
      setIsLoading(false)
    }
  }

  const showKinPicker = !kinId && !isEdit
  const canSubmit = !!(content.trim() && category && (kinId || selectedKinId || isEdit))

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('settings.memories.edit') : t('settings.memories.add')}
      size="lg"
      onSubmit={handleSubmit}
      isSubmitting={isLoading}
      submitDisabled={!canSubmit}
      submitLabel={t('common.save')}
    >
      {showKinPicker && kins && kins.length > 0 && (
        <FormField label={t('settings.memories.kin')} tip={t('settings.memories.kinTip')}>
          <KinSelector
            value={selectedKinId}
            onValueChange={setSelectedKinId}
            kins={kins}
            placeholder={t('settings.memories.kinPlaceholder')}
          />
        </FormField>
      )}

      <FormField
        label={t('settings.memories.content')}
        htmlFor="memory-content"
        tip={t('settings.memories.contentTip')}
        required
      >
        <Textarea
          id="memory-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('settings.memories.contentPlaceholder')}
          rows={3}
          required
        />
      </FormField>

      <FormRow>
        <FormField
          label={t('settings.memories.categoryLabel')}
          htmlFor="memory-category"
          tip={t('settings.memories.categoryTip')}
          required
        >
          <Select value={category} onValueChange={(v) => setCategory(v as MemoryCategory)}>
            <SelectTrigger id="memory-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMORY_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {t(`settings.memories.category.${cat}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label={t('settings.memories.subject')}
          htmlFor="memory-subject"
          tip={t('settings.memories.subjectTip')}
        >
          <Input
            id="memory-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('settings.memories.subjectPlaceholder')}
          />
        </FormField>
      </FormRow>

      <FormField
        label={t('settings.memories.scopeLabel')}
        htmlFor="memory-scope"
        tip={t('settings.memories.scopeTip')}
      >
        <Select value={scope} onValueChange={(v) => setScope(v as MemoryScope)}>
          <SelectTrigger id="memory-scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">{t('settings.memories.scopePrivate')}</SelectItem>
            <SelectItem value="shared">{t('settings.memories.scopeShared')}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    </FormDialog>
  )
}
