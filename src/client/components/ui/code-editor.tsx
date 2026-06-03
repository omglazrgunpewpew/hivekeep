import { useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { StreamLanguage } from '@codemirror/language'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { useTheme } from 'next-themes'
import { cn } from '@/client/lib/utils'
import { buildThemeExtension } from '@/client/components/ui/codemirror-theme'

export type CodeEditorLanguage =
  | 'json'
  | 'ts'
  | 'tsx'
  | 'js'
  | 'jsx'
  | 'python'
  | 'bash'
  | 'sh'
  | 'plain'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  /**
   * Syntax highlighting hint. 'json' and JS/TS family get full language
   * support; everything else (python/bash/sh/plain) falls back to plain text
   * with line numbers — still far better than a bare <textarea>.
   */
  language?: CodeEditorLanguage | string
  height?: string
  readOnly?: boolean
  /** Soft-wrap long lines. Default ON for readability in a narrow modal. */
  lineWrapping?: boolean
  className?: string
}

/** Resolve the optional CodeMirror language extension for a given language id. */
function languageExtension(language?: string) {
  switch (language) {
    case 'json':
      return json()
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return javascript({ jsx: true, typescript: true })
    case 'python':
      return python()
    case 'bash':
    case 'sh':
      return StreamLanguage.define(shell)
    // plain / unknown → plain text (line numbers only)
    default:
      return null
  }
}

/**
 * Generic code editor wrapping CodeMirror, themed via the shared design-token
 * theme builder (matches MarkdownEditor look & feel: focus ring wrapper,
 * palette-aware colors, dark/light via next-themes).
 */
export function CodeEditor({
  value,
  onChange,
  language,
  height = '220px',
  readOnly = false,
  lineWrapping = true,
  className,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const extensions = useMemo(() => {
    const exts = []
    const lang = languageExtension(language)
    if (lang) exts.push(lang)
    if (lineWrapping) exts.push(EditorView.lineWrapping)
    return exts
  }, [language, lineWrapping])

  const theme = useMemo(() => buildThemeExtension(isDark), [isDark])

  const handleChange = useCallback((val: string) => {
    onChange(val)
  }, [onChange])

  return (
    <div className={cn(
      'min-w-0 max-w-full overflow-hidden rounded-md border border-input transition-[color,box-shadow]',
      '[&:has(.cm-focused)]:border-ring [&:has(.cm-focused)]:ring-[3px] [&:has(.cm-focused)]:ring-ring/50',
      className,
    )}>
      <CodeMirror
        value={value}
        onChange={handleChange}
        height={height}
        theme={theme}
        extensions={extensions}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: false,
          autocompletion: false,
          crosshairCursor: false,
          rectangularSelection: false,
          highlightSelectionMatches: false,
          searchKeymap: false,
          lintKeymap: false,
          completionKeymap: false,
          foldKeymap: false,
        }}
      />
    </div>
  )
}
