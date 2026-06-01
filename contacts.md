# KinBot — Address books (external contacts)

Read-only access to **external** address books (iCloud first) so Kins can look up
a contact — typically a phone number to hand to `send_channel_message` (e.g. an
SMS via the Twilio channel). These contacts are **never** copied into KinBot's
own contacts CRM; they are fetched on demand.

> Not to be confused with KinBot's internal contacts (`contact-tools.ts`,
> `create_contact`/`get_contact`/…) which are the Kin's own writable address
> book with per-channel platform links. The address-book feature is a separate,
> read-only, provider-backed source.

## Provider family (SDK)

`ContactsProvider` lives in `@kinbot-developer/sdk` (v0.8.0), alongside
`EmailProvider`. The host detects the family by the presence of `listContacts`
+ `getContact` (`detectProviderFamily` in `plugins.ts`), so a plugin contributes
a contacts provider exactly like any other provider.

```ts
interface ContactsProvider extends ProviderUIHints {
  type: string
  displayName: string
  configSchema: ProviderConfigSchema   // CardDAV fields; empty for pure-OAuth
  capabilities: ContactsCapabilities   // supportsOAuth / supportsServerSearch
  oauth?: OAuthProfile                 // for Google People / Microsoft Graph (later)
  authenticate(config): Promise<AuthResult>
  listContacts(opts, config): Promise<ContactListResult>
  getContact(id, config): Promise<Contact>
  searchContacts?(query, config): Promise<Contact[]>
}
```

Registry: `src/server/contacts/registry.ts`. Built-ins register at boot via
`registerBuiltinContactsProviders()` (`src/server/contacts/register.ts`).

## Account model

A contacts account is a row in the `providers` table with capability
`contacts` (no new table). `config_encrypted` holds
`{ account_label, credentials, allowed_kin_ids }`. Resolution mirrors email:
`resolveContactsProvider({ slug?, kinId })` → explicit slug → first valid;
enforces the per-account allow-list; spreads `credentials` into the
ProviderConfig. A single connected identity (e.g. iCloud) could later carry
`['email','contacts','calendar']` capabilities at once.

## iCloud (CardDAV)

`src/server/contacts/providers/icloud.ts` — CardDAV via `tsdav`. Auth is an
Apple ID + an **app-specific password** (no OAuth for iCloud contacts). vCards
are parsed by the pure `parseVCard` helper (grouped props like `item1.TEL`,
line folding, escapes, phone/email type normalization). Server search is
unreliable on iCloud, so `searchContacts` lists + filters client-side.

> ⚠️ **Operator/user setup**: generate an app-specific password at
> appleid.apple.com → Sign-In and Security → App-Specific Passwords, then connect
> with the Apple ID email + that password.

## Connect flow (non-OAuth)

`POST /api/contacts-accounts/connect-config/:type` validates the submitted
configSchema fields via `provider.authenticate(config)` (a live CardDAV connect)
**before** storing them encrypted in `config.credentials`. OAuth contacts
providers (Google/Microsoft) would add a `/connect/:type` flow later, reusing the
generic OAuth2 host code.

## Kin tools + toolbox

Native tools (`src/server/tools/address-book-tools.ts`), gated by the built-in
`address-book` toolbox. Deliberately named apart from the internal contacts CRM.

| Tool | Flags | |
|---|---|---|
| `list_address_books` | readOnly, concurrencySafe | accounts this Kin may use |
| `list_address_book_contacts` | readOnly, concurrencySafe | page an address book |
| `get_address_book_contact` | readOnly, concurrencySafe | full card by id |
| `search_address_book` | readOnly, concurrencySafe | name / org / email / phone |

They reuse the existing `contacts` tool **domain** (visual grouping) but are a
distinct toolbox and distinct tool names.

## The SMS use-case (end to end)

1. `search_address_book("Jean")` → external iCloud lookup → phone number.
2. `send_channel_message(channel_id=<twilio>, chat_id="+336…", message=…)` →
   SMS sent via the `twilio-sms` channel plugin (already exists).

No sync, no copy into KinBot's contacts — the address book is just a lookup
source feeding `chat_id`.

## Unified accounts (one connection, several capabilities)

A connected identity (Google, Microsoft, iCloud) is **one** `providers` row whose
`capabilities` column lists what it serves (`['email','contacts']`). Built-in
contacts providers keyed by the same `type` as the email provider:

| type | email | contacts |
|---|---|---|
| `gmail` | Gmail API | **Google People API** (`contacts.readonly`) |
| `microsoft` | Graph `/messages` | **Graph `/me/contacts`** (`Contacts.Read`) |
| `icloud` | (IMAP — fast-follow) | **CardDAV** (app password) |
| `imap` | IMAP/SMTP | — |

**Capability-aware OAuth connect**: `POST /api/email-accounts/connect/:type` takes
`{ capabilities }` and requests the **union** of the email + contacts scopes in a
single consent; the callback writes one row with both capabilities. Token refresh
doesn't narrow scopes, so the same access token serves both families.
`resolveContactsProvider` reuses the account's refresh token via the email token
manager. The read model (`connected-accounts.ts`) merges providers by type and
lists each account once with its capability set.

## UI

Settings → **Connections → Connected Accounts** (one section). Provider select
(with logos) → for OAuth providers an **"Also read contacts"** toggle; for config
providers (IMAP / iCloud) a credentials form from `configSchema`. Each account
card shows **Mail / Contacts** capability badges; send-mode appears only for email
accounts. Config connect routes to the owning family (IMAP→email, CardDAV→contacts).

## Adding a provider later

1. Implement `ContactsProvider` (native in `src/server/contacts/providers/` or a
   plugin's `providers: [...]`).
2. For OAuth (Google People, Microsoft Graph), declare an `oauth` profile + add
   the connect flow.
3. Done — registry, resolver, tools, toolbox, and UI are provider-agnostic.

## Out of scope (fast-follows)

Generic CardDAV (OVH/Fastmail presets) · Google People / Microsoft Graph
(OAuth) · calendar (CalDAV / Graph events) · phone-number normalization to E.164.
