/**
 * Register every built-in search provider in the registry. Called once at
 * server startup, after the image provider registration.
 *
 * Empty for now — built-in search providers (Brave, SerpAPI, Tavily,
 * Perplexity Sonar) land in a follow-up phase. Plugin-contributed search
 * providers are registered by the plugin loader regardless of whether
 * any built-ins exist.
 */
export function registerBuiltinSearchProviders(): void {
  // No built-in search providers yet.
}
