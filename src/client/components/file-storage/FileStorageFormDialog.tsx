import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/client/components/ui/input'
import { PasswordInput } from '@/client/components/ui/password-input'
import { FormDialog } from '@/client/components/common/FormDialog'
import { FormField } from '@/client/components/common/FormField'
import { Label } from '@/client/components/ui/label'
import { Switch } from '@/client/components/ui/switch'
import { InfoTip } from '@/client/components/common/InfoTip'
import { KinSelector } from '@/client/components/common/KinSelector'
import { api, getErrorMessage } from '@/client/lib/api'
import type { StoredFileData } from '@/client/components/file-storage/FileStorageCard'

interface FileStorageFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  file?: StoredFileData | null
  kins: { id: string; name: string }[]
}

export function FileStorageFormDialog({
  open,
  onOpenChange,
  onSaved,
  file,
  kins,
}: FileStorageFormDialogProps) {
  const { t } = useTranslation()
  const isEditing = !!file
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [kinId, setKinId] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [password, setPassword] = useState('')
  const [expiresIn, setExpiresIn] = useState('')
  const [readAndBurn, setReadAndBurn] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    if (open && file) {
      setName(file.name)
      setDescription(file.description ?? '')
      setKinId(file.kinId)
      setIsPublic(file.isPublic)
      setPassword('')
      setExpiresIn('')
      setReadAndBurn(file.readAndBurn)
      setSelectedFile(null)
      setError('')
    } else if (open) {
      setName('')
      setDescription('')
      setKinId(kins[0]?.id ?? '')
      setIsPublic(true)
      setPassword('')
      setExpiresIn('')
      setReadAndBurn(false)
      setSelectedFile(null)
      setError('')
    }
  }, [open, file, kins])

  const handleClose = () => {
    onOpenChange(false)
  }

  const handleSave = async () => {
    setError('')
    setIsSaving(true)
    try {
      if (isEditing) {
        const body: Record<string, unknown> = {}
        if (name !== file.name) body.name = name
        if (description !== (file.description ?? '')) body.description = description || null
        if (isPublic !== file.isPublic) body.isPublic = isPublic
        if (readAndBurn !== file.readAndBurn) body.readAndBurn = readAndBurn
        if (password) body.password = password
        if (expiresIn) body.expiresIn = Number(expiresIn)

        if (Object.keys(body).length > 0) {
          await api.patch(`/file-storage/${file.id}`, body)
        }
      } else {
        if (!selectedFile) {
          setError(t('settings.files.fileRequired'))
          setIsSaving(false)
          return
        }

        const formData = new FormData()
        formData.append('file', selectedFile)
        formData.append('kinId', kinId)
        formData.append('name', name || selectedFile.name)
        if (description) formData.append('description', description)
        formData.append('isPublic', String(isPublic))
        if (password) formData.append('password', password)
        if (expiresIn) formData.append('expiresIn', expiresIn)
        formData.append('readAndBurn', String(readAndBurn))

        const response = await fetch('/api/file-storage', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        if (!response.ok) {
          const err = await response.json()
          throw new Error(err?.error?.message || t('errors.uploadFailed'))
        }
      }
      onSaved()
      handleClose()
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  const canSave = isEditing ? true : !!selectedFile && !!kinId

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => { if (!v) handleClose() }}
      title={isEditing ? t('settings.files.edit') : t('settings.files.add')}
      description={isEditing ? t('settings.files.editHint') : t('settings.files.addHint')}
      size="md"
      error={error || null}
      onSubmit={handleSave}
      isSubmitting={isSaving}
      submitDisabled={!canSave}
      submitLabel={isEditing ? t('common.save') : t('settings.files.add')}
    >
      {!isEditing && (
        <>
          <FormField label={t('settings.files.file')} htmlFor="file-storage-file">
            <Input
              id="file-storage-file"
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setSelectedFile(f)
                if (f && !name) setName(f.name)
              }}
            />
          </FormField>

          <FormField
            label={t('settings.files.kin')}
            htmlFor="file-storage-kin"
            tip={t('settings.files.kinTip')}
          >
            <KinSelector
              value={kinId}
              onValueChange={setKinId}
              kins={kins}
            />
          </FormField>
        </>
      )}

      <FormField label={t('settings.files.name')} htmlFor="file-storage-name">
        <Input
          id="file-storage-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.files.namePlaceholder')}
        />
      </FormField>

      <FormField
        label={
          <>
            {t('settings.files.descriptionLabel')}
            <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
          </>
        }
        htmlFor="file-storage-description"
      >
        <Input
          id="file-storage-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('settings.files.descriptionPlaceholder')}
        />
      </FormField>

      <div className="flex items-center justify-between">
        <Label className="inline-flex items-center gap-1.5">{t('settings.files.public')} <InfoTip content={t('settings.files.publicTip')} /></Label>
        <Switch checked={isPublic} onCheckedChange={setIsPublic} />
      </div>

      <FormField
        label={
          <>
            {t('settings.files.password')}
            <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
          </>
        }
        htmlFor="file-storage-password"
        tip={t('settings.files.passwordTip')}
      >
        <PasswordInput
          id="file-storage-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isEditing ? '••••••••' : t('settings.files.passwordPlaceholder')}
          autoComplete="off"
        />
      </FormField>

      <FormField
        label={
          <>
            {t('settings.files.expiresIn')}
            <span className="text-xs text-muted-foreground">({t('common.optional')})</span>
          </>
        }
        htmlFor="file-storage-expires-in"
        tip={t('settings.files.expiresInTip')}
      >
        <Input
          id="file-storage-expires-in"
          type="number"
          min="1"
          value={expiresIn}
          onChange={(e) => setExpiresIn(e.target.value)}
          placeholder={t('settings.files.expiresInPlaceholder')}
        />
      </FormField>

      <div className="flex items-center justify-between">
        <Label className="inline-flex items-center gap-1.5">{t('settings.files.readAndBurn')} <InfoTip content={t('settings.files.readAndBurnTip')} /></Label>
        <Switch checked={readAndBurn} onCheckedChange={setReadAndBurn} />
      </div>
    </FormDialog>
  )
}
