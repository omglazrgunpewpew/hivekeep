/**
 * Cross-family provider types — re-exports from the SDK so KinBot's
 * internal code and plugin authors share a single source of truth.
 * The definitions live in `packages/sdk/src/index.ts`.
 */
export type {
  ConfigField,
  ProviderConfig,
  ProviderConfigSchema,
  AuthResult,
  Usage,
  FinishReason,
  ProviderUIHints,
  ProviderCapability,
} from '@kinbot-developer/sdk'

export {
  KinbotProviderError,
  AuthError,
  RateLimitError,
  ContextOverflowError,
  InvalidRequestError,
  NetworkError,
  ProviderServerError,
  UnsupportedCapabilityError,
} from '@kinbot-developer/sdk'
