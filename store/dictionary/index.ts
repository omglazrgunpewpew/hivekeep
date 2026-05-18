import { tool, z } from '@kinbot/sdk'

/**
 * Dictionary plugin for KinBot.
 * Uses the free Dictionary API (https://dictionaryapi.dev/) for word lookups.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

interface Phonetic {
  text?: string
  audio?: string
  sourceUrl?: string
}

interface Definition {
  definition: string
  synonyms: string[]
  antonyms: string[]
  example?: string
}

interface Meaning {
  partOfSpeech: string
  definitions: Definition[]
  synonyms: string[]
  antonyms: string[]
}

interface DictionaryEntry {
  word: string
  phonetic?: string
  phonetics: Phonetic[]
  meanings: Meaning[]
  license: { name: string; url: string }
  sourceUrls: string[]
}

// ─── API helpers ────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries'

async function fetchWord(word: string, language: string): Promise<DictionaryEntry[]> {
  const url = `${API_BASE}/${encodeURIComponent(language)}/${encodeURIComponent(word.toLowerCase().trim())}`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Word "${word}" not found in the ${language} dictionary.`)
    }
    throw new Error(`Dictionary API returned ${res.status}: ${res.statusText}`)
  }

  return (await res.json()) as DictionaryEntry[]
}

// ─── Formatting helpers ────────────────────────────────────────────────────

function formatEntry(entry: DictionaryEntry, options: { verbose?: boolean } = {}): string {
  const lines: string[] = []

  // Word and pronunciation
  const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text
  lines.push(phonetic ? `**${entry.word}** ${phonetic}` : `**${entry.word}**`)

  // Audio URL if available
  const audio = entry.phonetics?.find(p => p.audio && p.audio.length > 0)
  if (audio?.audio) {
    lines.push(`🔊 Audio: ${audio.audio}`)
  }

  // Meanings grouped by part of speech
  for (const meaning of entry.meanings) {
    lines.push('')
    lines.push(`_${meaning.partOfSpeech}_`)

    const defsToShow = options.verbose ? meaning.definitions : meaning.definitions.slice(0, 3)
    for (let i = 0; i < defsToShow.length; i++) {
      const def = defsToShow[i]
      lines.push(`${i + 1}. ${def.definition}`)
      if (def.example) {
        lines.push(`   _"${def.example}"_`)
      }
    }
    if (!options.verbose && meaning.definitions.length > 3) {
      lines.push(`   _(${meaning.definitions.length - 3} more definitions...)_`)
    }

    // Synonyms and antonyms at the meaning level
    const syns = [...new Set([...meaning.synonyms, ...meaning.definitions.flatMap(d => d.synonyms)])]
    const ants = [...new Set([...meaning.antonyms, ...meaning.definitions.flatMap(d => d.antonyms)])]

    if (syns.length > 0) {
      lines.push(`   Synonyms: ${syns.slice(0, 8).join(', ')}${syns.length > 8 ? '...' : ''}`)
    }
    if (ants.length > 0) {
      lines.push(`   Antonyms: ${ants.slice(0, 8).join(', ')}${ants.length > 8 ? '...' : ''}`)
    }
  }

  // Source
  if (entry.sourceUrls?.length > 0) {
    lines.push('')
    lines.push(`Source: ${entry.sourceUrls[0]}`)
  }

  return lines.join('\n')
}

function collectSynonyms(entries: DictionaryEntry[]): string[] {
  const syns = new Set<string>()
  for (const entry of entries) {
    for (const meaning of entry.meanings) {
      for (const s of meaning.synonyms) syns.add(s)
      for (const def of meaning.definitions) {
        for (const s of def.synonyms) syns.add(s)
      }
    }
  }
  return [...syns]
}

function collectAntonyms(entries: DictionaryEntry[]): string[] {
  const ants = new Set<string>()
  for (const entry of entries) {
    for (const meaning of entry.meanings) {
      for (const a of meaning.antonyms) ants.add(a)
      for (const def of meaning.definitions) {
        for (const a of def.antonyms) ants.add(a)
      }
    }
  }
  return [...ants]
}

// ─── Plugin export ──────────────────────────────────────────────────────────

export default function dictionaryPlugin(context: {
  config: Record<string, string>
}) {
  const defaultLang = context.config.defaultLanguage || 'en'

  return {
    tools: {
      define_word: tool({
        description:
          'Look up the definition, pronunciation, synonyms, antonyms, and examples for a word. ' +
          'Uses the free Dictionary API. Supports multiple languages.',
        parameters: z.object({
          word: z.string().describe('The word to look up'),
          language: z
            .string()
            .optional()
            .describe(`Language code (default: ${defaultLang}). Supported: en, es, fr, de, it, pt, ar, hi, ja, ko, ru, tr, zh`),
          verbose: z
            .boolean()
            .optional()
            .describe('If true, show all definitions instead of top 3 per part of speech'),
        }),
        execute: async ({ word, language, verbose }) => {
          const lang = language || defaultLang
          try {
            const entries = await fetchWord(word, lang)
            if (!entries.length) {
              return { error: `No results found for "${word}" in ${lang}.` }
            }
            // Format first entry (most relevant), mention if more exist
            const result = formatEntry(entries[0], { verbose })
            const extra = entries.length > 1
              ? `\n\n_(${entries.length - 1} additional entries available)_`
              : ''
            return { definition: result + extra }
          } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) }
          }
        },
      }),

      find_synonyms: tool({
        description: 'Find synonyms for a word.',
        parameters: z.object({
          word: z.string().describe('The word to find synonyms for'),
          language: z.string().optional().describe(`Language code (default: ${defaultLang})`),
        }),
        execute: async ({ word, language }) => {
          const lang = language || defaultLang
          try {
            const entries = await fetchWord(word, lang)
            const synonyms = collectSynonyms(entries)
            if (synonyms.length === 0) {
              return { result: `No synonyms found for "${word}".` }
            }
            return {
              word,
              synonyms,
              count: synonyms.length,
            }
          } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) }
          }
        },
      }),

      find_antonyms: tool({
        description: 'Find antonyms (opposite words) for a word.',
        parameters: z.object({
          word: z.string().describe('The word to find antonyms for'),
          language: z.string().optional().describe(`Language code (default: ${defaultLang})`),
        }),
        execute: async ({ word, language }) => {
          const lang = language || defaultLang
          try {
            const entries = await fetchWord(word, lang)
            const antonyms = collectAntonyms(entries)
            if (antonyms.length === 0) {
              return { result: `No antonyms found for "${word}".` }
            }
            return {
              word,
              antonyms,
              count: antonyms.length,
            }
          } catch (err) {
            return { error: err instanceof Error ? err.message : String(err) }
          }
        },
      }),
    },
  }
}
