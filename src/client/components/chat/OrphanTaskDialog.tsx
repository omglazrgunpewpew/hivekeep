import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage } from '@/client/lib/api'
import { FormDialog } from '@/client/components/common/FormDialog'
import { FormField } from '@/client/components/common/FormField'
import { Input } from '@/client/components/ui/input'
import { MarkdownEditor } from '@/client/components/ui/markdown-editor'
import { ToolboxMultiSelect } from '@/client/components/toolbox/ToolboxMultiSelect'
import { ModelPicker, modelPickerValue } from '@/client/components/common/ModelPicker'
import { ThinkingEffortSelect } from '@/client/components/common/ThinkingEffortSelect'
import { KinSelector } from '@/client/components/common/KinSelector'
import { useToolboxes } from '@/client/hooks/useToolboxes'
import { useModels } from '@/client/hooks/useModels'
import { useKinList } from '@/client/hooks/useKinList'
import { choiceToConfig, type ThinkingChoice } from '@/client/lib/thinking-choice'
import { toast } from 'sonner'
import type { KinThinkingConfig } from '@/shared/types'

interface OrphanTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fixed target Kin. Omit to let the user pick one inside the dialog (e.g.
   *  when launched from the Tasks page rather than a Kin's conversation). */
  kinId?: string
  kinName?: string
}

const TITLE_MAX = 120

/**
 * Launch a standalone (orphan) task on a Kin — no project/ticket binding.
 * The user picks a prompt and, optionally, overrides for model, reasoning
 * effort, and toolboxes. Posts to `POST /api/kins/:id/tasks`; the result is
 * deposited back into the Kin's main session (async mode).
 *
 * Two modes:
 *   - Fixed Kin (`kinId` + `kinName` provided) — launched from a Kin's
 *     conversation header, no Kin selector shown.
 *   - Picker (`kinId` omitted) — launched from the Tasks page; the user first
 *     chooses which Kin should run the task via a KinSelector.
 *
 * All overrides default to "inherit" (empty model / 'inherit' effort / no
 * toolbox selection) so leaving them untouched falls back to the Kin's own
 * model + config and the built-in default toolbox.
 */
export function OrphanTaskDialog({ open, onOpenChange, kinId, kinName }: OrphanTaskDialogProps) {
  const { t } = useTranslation()
  const { toolboxes } = useToolboxes()
  const { llmModels, isLoading: modelsLoading } = useModels()
  // Picker mode = no fixed Kin handed in. Only fetch the Kin list in that case.
  const pickerMode = !kinId
  const { kins } = useKinList()
  const [selectedKinId, setSelectedKinId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [selectedToolboxIds, setSelectedToolboxIds] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [providerId, setProviderId] = useState('')
  const [thinkingChoice, setThinkingChoice] = useState<ThinkingChoice>('inherit')
  const [submitting, setSubmitting] = useState(false)

  // Resolve the effective target. In fixed mode it's the prop; in picker mode
  // it's whatever the user selected (name looked up from the Kin list for the
  // success toast).
  const effectiveKinId = kinId ?? selectedKinId
  const effectiveKinName = kinName ?? kins.find((k) => k.id === selectedKinId)?.name ?? ''

  // Reset every field when the dialog closes so a previous draft never leaks
  // into the next launch.
  const wasOpen = useRef(false)
  useEffect(() => {
    if (open && !wasOpen.current) {
      setPrompt('')
      setTitle('')
      setSelectedToolboxIds([])
      setModel('')
      setProviderId('')
      setThinkingChoice('inherit')
      setSelectedKinId('')
    }
    wasOpen.current = open
  }, [open])

  // Picker mode: default the selection to the first Kin once the list loads, so
  // the dialog opens ready-to-submit instead of with an empty selector.
  useEffect(() => {
    if (open && pickerMode && !selectedKinId && kins.length > 0) {
      setSelectedKinId(kins[0]!.id)
    }
  }, [open, pickerMode, selectedKinId, kins])

  const promptLength = prompt.length
  const canSubmit = prompt.trim().length > 0 && !submitting && !!effectiveKinId

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const body: {
        prompt: string
        title?: string
        toolboxIds?: string[]
        model?: string
        providerId?: string
        thinkingConfig?: KinThinkingConfig
      } = { prompt: prompt.trim() }
      const trimmedTitle = title.trim()
      if (trimmedTitle) body.title = trimmedTitle
      if (selectedToolboxIds.length > 0) body.toolboxIds = selectedToolboxIds
      // model + providerId are coupled — send only when both are set.
      if (model && providerId) {
        body.model = model
        body.providerId = providerId
      }
      if (thinkingChoice !== 'inherit') {
        const cfg = choiceToConfig(thinkingChoice)
        if (cfg) body.thinkingConfig = cfg
      }
      await api.post(`/kins/${effectiveKinId}/tasks`, body)
      toast.success(t('orphanTask.started', { name: effectiveKinName }))
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('orphanTask.title')}
      description={
        pickerMode
          ? t('orphanTask.descriptionGeneric')
          : t('orphanTask.description', { name: kinName })
      }
      size="3xl"
      onSubmit={handleSubmit}
      isSubmitting={submitting}
      submitDisabled={!canSubmit}
      submitLabel={t('orphanTask.start')}
    >
      {pickerMode && (
        <FormField label={t('orphanTask.kinField')}>
          <KinSelector
            value={selectedKinId}
            onValueChange={setSelectedKinId}
            kins={kins.map((k) => ({ id: k.id, name: k.name, role: k.role, avatarUrl: k.avatarUrl }))}
            placeholder={t('orphanTask.kinPlaceholder')}
          />
        </FormField>
      )}

      <FormField
        label={t('orphanTask.promptField')}
        hint={
          <span className="flex items-start justify-between gap-2">
            <span>{t('orphanTask.promptHelp')}</span>
            <span className="tabular-nums">
              {t('orphanTask.promptCounter', { count: promptLength })}
            </span>
          </span>
        }
      >
        <MarkdownEditor
          value={prompt}
          onChange={setPrompt}
          height="220px"
        />
      </FormField>

      <FormField label={t('orphanTask.titleField')} htmlFor="orphan-task-title">
        <Input
          id="orphan-task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          placeholder={t('orphanTask.titlePlaceholder')}
          maxLength={TITLE_MAX}
        />
      </FormField>

      {toolboxes.length > 0 && (
        <FormField label={t('orphanTask.toolboxesField')} hint={t('orphanTask.toolboxesHelp')}>
          <ToolboxMultiSelect
            toolboxes={toolboxes}
            selected={selectedToolboxIds}
            onChange={setSelectedToolboxIds}
            disabled={submitting}
          />
        </FormField>
      )}

      <FormField label={t('orphanTask.modelField')} hint={t('orphanTask.modelHelp')}>
        <ModelPicker
          models={llmModels}
          value={modelPickerValue(model, providerId)}
          onValueChange={(modelId, pid) => {
            setModel(modelId)
            setProviderId(pid)
          }}
          placeholder={t('orphanTask.modelInherit')}
          clearLabel={t('orphanTask.modelInherit')}
          allowClear
          isLoading={modelsLoading}
          disabled={submitting}
        />
      </FormField>

      <FormField label={t('orphanTask.thinkingField')} hint={t('orphanTask.thinkingHelp')}>
        <ThinkingEffortSelect
          value={thinkingChoice}
          onChange={setThinkingChoice}
          inheritLabel={t('orphanTask.thinkingInherit')}
          disabled={submitting}
        />
      </FormField>
    </FormDialog>
  )
}
