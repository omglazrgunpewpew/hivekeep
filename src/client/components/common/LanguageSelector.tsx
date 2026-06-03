import type { ComponentType } from 'react'
import { Globe } from 'lucide-react'
// Real offline SVG flags (emoji flags render as the bare country code on
// Windows/Chrome). Named imports from the index resolve via the package's
// `exports` map (the per-country deep paths are NOT exported).
import { GB, FR, ES, DE } from 'country-flag-icons/react/3x2'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { cn } from '@/client/lib/utils'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
] as const

/** Minimal prop surface we actually use; the package's flag components accept a
 *  superset of optional HTML/SVG attributes, so they're assignable here. */
type FlagComponent = ComponentType<{ className?: string }>

/** Locale → SVG flag component. Unknown locales fall back to a neutral globe. */
const FLAGS: Record<string, FlagComponent> = {
  en: GB,
  fr: FR,
  es: ES,
  de: DE,
}

function Flag({ value }: { value: string }) {
  const FlagSvg = FLAGS[value]
  if (!FlagSvg) return <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
  return (
    <span aria-hidden className="contents">
      <FlagSvg className="w-5 h-auto rounded-[2px] shrink-0" />
    </span>
  )
}

interface LanguageSelectorProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
  /** Locale options to offer. Defaults to the shared en/de/fr list. */
  options?: { value: string; label: string }[]
}

export function LanguageSelector({ value, onValueChange, className, options }: LanguageSelectorProps) {
  const items = options ?? (LANGUAGES as readonly { value: string; label: string }[])
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn('w-full', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            <span className="flex items-center gap-1.5 min-w-0">
              <Flag value={lang.value} />
              <span className="truncate">{lang.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
