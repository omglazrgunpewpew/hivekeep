import { useTranslation } from 'react-i18next'
import { Download, FileWarning } from 'lucide-react'
import { Button } from '@/client/components/ui/button'
import { CodeEditor } from '@/client/components/ui/code-editor'
import { getFileIcon, formatFileSize } from '@/client/lib/file-icons'
import type { WorkspaceFileInfo } from '@/shared/types'

interface WorkspaceEditorProps {
  agentId: string
  file: WorkspaceFileInfo
  /** P3 wires real editing; P2 renders read-only. */
  readOnly?: boolean
  value?: string
  onChange?: (value: string) => void
}

export function workspaceRawUrl(agentId: string, path: string, inline = false): string {
  return `/api/agents/${encodeURIComponent(agentId)}/workspace/raw?path=${encodeURIComponent(path)}${inline ? '&inline=1' : ''}`
}

/** Best-effort mapping to the CodeEditor language prop (plain fallback). */
function editorLanguage(name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (['json', 'ts', 'tsx', 'js', 'jsx', 'python', 'py', 'bash', 'sh'].includes(ext)) {
    return ext === 'py' ? 'python' : ext
  }
  return 'plain'
}

/**
 * Composition layer of the Files center pane (files.md § 3.5): picks the
 * viewer from the server-decided `kind` and renders the status bar. The text
 * editor itself IS the shared CodeEditor.
 */
export function WorkspaceEditor({ agentId, file, readOnly = true, value, onChange }: WorkspaceEditorProps) {
  const { t } = useTranslation()
  const Icon = getFileIcon(file.name)

  const downloadButton = (
    <Button asChild variant="outline" size="sm" className="gap-1.5">
      <a href={workspaceRawUrl(agentId, file.path)} download={file.name}>
        <Download className="size-4" />
        {t('files.editor.download')}
      </a>
    </Button>
  )

  let body: React.ReactNode
  switch (file.kind) {
    case 'text':
      body = (
        <CodeEditor
          value={value ?? file.content ?? ''}
          onChange={onChange ?? (() => {})}
          language={editorLanguage(file.name)}
          height="100%"
          readOnly={readOnly}
          className="h-full"
        />
      )
      break
    case 'image':
      body = (
        <div className="flex h-full items-center justify-center overflow-auto bg-muted/30 p-4">
          <img
            src={workspaceRawUrl(agentId, file.path, true)}
            alt={file.name}
            className="max-h-full max-w-full rounded-md border border-border object-contain"
          />
        </div>
      )
      break
    case 'pdf':
      body = (
        <iframe
          src={workspaceRawUrl(agentId, file.path, true)}
          title={file.name}
          className="h-full w-full border-0"
        />
      )
      break
    default:
      body = (
        <div className="flex h-full items-center justify-center p-6">
          <div className="flex max-w-sm flex-col items-center gap-3 text-center">
            <FileWarning className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {file.kind === 'too-large'
                  ? t('files.editor.tooLarge', { size: formatFileSize(file.size) })
                  : t('files.editor.binary', { mime: file.mimeType })}
              </p>
            </div>
            {downloadButton}
          </div>
        </div>
      )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{body}</div>
      {/* Status bar */}
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-1 text-[11px] text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={file.path}>
          {file.path}
        </span>
        <span className="shrink-0">{formatFileSize(file.size)}</span>
        <span className="shrink-0">{new Date(file.modifiedAt).toLocaleString()}</span>
      </div>
    </div>
  )
}
