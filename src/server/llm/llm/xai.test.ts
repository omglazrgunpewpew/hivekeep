import { describe, expect, it } from 'bun:test'
import {
  modelNames,
  inferContextWindow,
  inferImageInput,
  inferThinking,
  isTextOutputModel,
  convertPricing,
  mapModel,
  type XaiLanguageModel,
} from './xai'

// Representative fixtures drawn from the live /v1/language-models payload shape.

/** grok-4.3 via the obfuscated canonical id "latest"; family in aliases. */
const grok43: XaiLanguageModel = {
  id: 'latest',
  aliases: ['grok-4.3-latest', 'grok-latest'],
  input_modalities: ['text', 'image'],
  output_modalities: ['text'],
  prompt_text_token_price: 12500,
  cached_prompt_text_token_price: 2000,
  completion_text_token_price: 25000,
}

/** A *-reasoning variant, text-only. */
const grokReasoning: XaiLanguageModel = {
  id: 'grok-420-reasoning',
  aliases: [],
  input_modalities: ['text'],
  output_modalities: ['text'],
  prompt_text_token_price: 20000,
  cached_prompt_text_token_price: 2000,
  completion_text_token_price: 80000,
}

/** Plain grok-4: reasons internally but rejects reasoning_effort -> NOT thinking. */
const grok4: XaiLanguageModel = {
  id: 'grok-4-0709',
  aliases: ['grok-4', 'grok-4-latest'],
  input_modalities: ['text', 'image'],
  output_modalities: ['text'],
  prompt_text_token_price: 30000,
  completion_text_token_price: 150000,
}

/** grok-3-mini: small reasoning model. */
const grok3Mini: XaiLanguageModel = {
  id: 'grok-3-mini',
  aliases: ['grok-3-mini-latest'],
  input_modalities: ['text'],
  output_modalities: ['text'],
  prompt_text_token_price: 3000,
  completion_text_token_price: 5000,
}

/** Hypothetical audio-only output: not chat-usable. */
const audioOnly: XaiLanguageModel = {
  id: 'grok-audio',
  input_modalities: ['text'],
  output_modalities: ['audio'],
}

// ─── modelNames ──────────────────────────────────────────────────────────────

describe('modelNames', () => {
  it('includes the id and every alias', () => {
    expect(modelNames(grok43)).toEqual(['latest', 'grok-4.3-latest', 'grok-latest'])
  })

  it('handles missing aliases', () => {
    expect(modelNames({ id: 'grok-4' })).toEqual(['grok-4'])
  })
})

// ─── inferContextWindow ──────────────────────────────────────────────────────

describe('inferContextWindow', () => {
  it('maps grok-4.3 (via alias) to 1M', () => {
    expect(inferContextWindow(grok43)).toBe(1_000_000)
  })

  it('maps grok-4.20 to 1M', () => {
    expect(inferContextWindow(grokReasoning)).toBe(1_000_000)
  })

  it('maps plain grok-4 to 256k', () => {
    expect(inferContextWindow(grok4)).toBe(256_000)
  })

  it('maps grok-3 family to 131k', () => {
    expect(inferContextWindow(grok3Mini)).toBe(131_072)
  })

  it('maps grok-4-fast to 2M', () => {
    expect(inferContextWindow({ id: 'grok-4-fast-reasoning' })).toBe(2_000_000)
  })

  it('falls back to the default when no family matches', () => {
    expect(inferContextWindow({ id: 'mystery-model' })).toBe(131_072)
  })
})

// ─── inferImageInput ─────────────────────────────────────────────────────────

describe('inferImageInput', () => {
  it('is true when input_modalities includes image', () => {
    expect(inferImageInput(grok43)).toBe(true)
    expect(inferImageInput(grok4)).toBe(true)
  })

  it('is false for text-only input', () => {
    expect(inferImageInput(grokReasoning)).toBe(false)
    expect(inferImageInput(grok3Mini)).toBe(false)
  })

  it('is false when input_modalities is absent', () => {
    expect(inferImageInput({ id: 'x' })).toBe(false)
  })
})

// ─── inferThinking ───────────────────────────────────────────────────────────

describe('inferThinking', () => {
  it('detects reasoning for grok-4.3', () => {
    expect(inferThinking(grok43)!.efforts).toEqual(['low', 'medium', 'high'])
  })

  it('detects reasoning for *-reasoning variants', () => {
    expect(inferThinking(grokReasoning)!.efforts).toEqual(['low', 'medium', 'high'])
  })

  it('detects reasoning for grok-3-mini', () => {
    expect(inferThinking(grok3Mini)!.efforts).toEqual(['low', 'medium', 'high'])
  })

  it('returns undefined for plain grok-4 (rejects reasoning_effort)', () => {
    expect(inferThinking(grok4)).toBeUndefined()
  })

  it('never reports a max effort', () => {
    expect(inferThinking(grok43)!.efforts).not.toContain('max')
  })
})

// ─── isTextOutputModel ───────────────────────────────────────────────────────

describe('isTextOutputModel', () => {
  it('accepts text-output models', () => {
    expect(isTextOutputModel(grok43)).toBe(true)
    expect(isTextOutputModel(grokReasoning)).toBe(true)
  })

  it('rejects audio-only output', () => {
    expect(isTextOutputModel(audioOnly)).toBe(false)
  })

  it('assumes text when output_modalities is absent', () => {
    expect(isTextOutputModel({ id: 'x' })).toBe(true)
  })
})

// ─── convertPricing ──────────────────────────────────────────────────────────

describe('convertPricing', () => {
  it('converts USD cents per 100M tokens to USD per million', () => {
    const p = convertPricing(grok43)!
    expect(p.input).toBeCloseTo(1.25, 6)
    expect(p.output).toBeCloseTo(2.5, 6)
    expect(p.cacheRead).toBeCloseTo(0.2, 6)
  })

  it('omits cacheRead when not provided', () => {
    const p = convertPricing(grok4)!
    expect(p.input).toBeCloseTo(3, 6)
    expect(p.output).toBeCloseTo(15, 6)
    expect(p.cacheRead).toBeUndefined()
  })

  it('returns undefined when pricing is absent', () => {
    expect(convertPricing({ id: 'x' })).toBeUndefined()
  })

  it('drops negative sentinel prices', () => {
    expect(
      convertPricing({ id: 'x', prompt_text_token_price: -1, completion_text_token_price: -1 }),
    ).toBeUndefined()
  })
})

// ─── mapModel ────────────────────────────────────────────────────────────────

describe('mapModel', () => {
  it('maps a full vision/reasoning model', () => {
    const m = mapModel(grok43)!
    expect(m.id).toBe('latest')
    expect(m.contextWindow).toBe(1_000_000)
    expect(m.supportsImageInput).toBe(true)
    expect(m.thinking?.efforts).toEqual(['low', 'medium', 'high'])
    expect(m.pricing?.input).toBeCloseTo(1.25, 6)
  })

  it('omits image flag and thinking for plain grok-4', () => {
    const m = mapModel(grok4)!
    expect(m.supportsImageInput).toBe(true)
    expect(m.thinking).toBeUndefined()
    expect(m.contextWindow).toBe(256_000)
  })

  it('flags reasoning for text-only reasoning variants', () => {
    const m = mapModel(grokReasoning)!
    expect(m.supportsImageInput).toBeUndefined()
    expect(m.thinking?.efforts).toEqual(['low', 'medium', 'high'])
  })

  it('drops audio-only output models', () => {
    expect(mapModel(audioOnly)).toBeNull()
  })

  it('returns null for entries without an id', () => {
    expect(mapModel({ id: '' })).toBeNull()
  })
})
