import { registerContactsProvider } from '@/server/contacts/registry'
import { icloudContactsProvider } from '@/server/contacts/providers/icloud'
import { microsoftContactsProvider } from '@/server/contacts/providers/microsoft'
import { googleContactsProvider } from '@/server/contacts/providers/google'

/** Register the built-in contacts providers. Called once at server boot,
 *  alongside the other provider families (see src/server/index.ts). */
export function registerBuiltinContactsProviders(): void {
  registerContactsProvider(icloudContactsProvider)
  registerContactsProvider(microsoftContactsProvider)
  registerContactsProvider(googleContactsProvider)
}
