#!/usr/bin/env bun
/**
 * Scaffold a new store plugin with all required files.
 *
 * Usage:
 *   bun scripts/create-store-plugin.ts <plugin-name> [--description "..."] [--author "..."]
 */

import { mkdir, writeFile, exists } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const STORE_DIR = resolve(import.meta.dir, '..', 'store')

function usage(): never {
  console.log(`
Usage: bun scripts/create-store-plugin.ts <plugin-name> [options]

Options:
  --description, -d   Plugin description (default: "A KinBot plugin")
  --author, -a        Author name (default: "")
  --icon, -i          Icon emoji (default: "🔧")

Example:
  bun scripts/create-store-plugin.ts my-cool-plugin -d "Does cool things" -a "Jane Doe" -i "🚀"
`)
  process.exit(1)
}

function parseArgs(args: string[]) {
  const positional: string[] = []
  const flags: Record<string, string> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--description' || arg === '-d') {
      flags.description = args[++i] || ''
    } else if (arg === '--author' || arg === '-a') {
      flags.author = args[++i] || ''
    } else if (arg === '--icon' || arg === '-i') {
      flags.icon = args[++i] || ''
    } else if (arg.startsWith('-')) {
      console.error(`Unknown flag: ${arg}`)
      usage()
    } else {
      positional.push(arg)
    }
  }

  return { positional, flags }
}

const { positional, flags } = parseArgs(process.argv.slice(2))

if (positional.length === 0) {
  console.error('Error: plugin name is required')
  usage()
}

const name = positional[0]

// Validate name
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error(`Error: plugin name must match [a-z0-9][a-z0-9-]* (got "${name}")`)
  process.exit(1)
}

const pluginDir = join(STORE_DIR, name)

if (await exists(pluginDir)) {
  console.error(`Error: ${pluginDir} already exists`)
  process.exit(1)
}

const description = flags.description || 'A KinBot plugin'
const author = flags.author || ''
const icon = flags.icon || '🔧'

await mkdir(pluginDir, { recursive: true })

// plugin.json
const manifest = {
  name,
  version: '1.0.0',
  description,
  author,
  license: 'MIT',
  main: 'index.ts',
  icon,
  tags: [],
  permissions: [],
  config: {}
}

await writeFile(
  join(pluginDir, 'plugin.json'),
  JSON.stringify(manifest, null, 2) + '\n'
)

// index.ts
const indexTs = `import { tool, z } from '@kinbot/sdk'

/**
 * ${description}
 */
export default function(ctx: any) {
  const log = ctx.log

  return {
    tools: {
      example_tool: tool({
        description: 'An example tool. Replace this with your own.',
        inputSchema: z.object({
          input: z.string().describe('Input text'),
        }),
        execute: async ({ input }) => {
          log.info('example_tool called', { input })
          return { result: \`You said: \${input}\` }
        },
      }),
    },
  }
}
`

await writeFile(join(pluginDir, 'index.ts'), indexTs)

// README.md
const readme = `# ${icon} ${name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}

${description}

## Features

- TODO: describe what your plugin does

## Tools

### \`example_tool\`

TODO: describe your tool.

**Parameters:**
- \`input\` (required) - Input text.

**Example prompts:**
- "TODO: example prompt"

## Configuration

No configuration required.

## License

MIT
`

await writeFile(join(pluginDir, 'README.md'), readme)

console.log(`✅ Created store plugin scaffold at store/${name}/`)
console.log(``)
console.log(`Files created:`)
console.log(`  store/${name}/plugin.json`)
console.log(`  store/${name}/index.ts`)
console.log(`  store/${name}/README.md`)
console.log(``)
console.log(`Next steps:`)
console.log(`  1. Edit the files to implement your plugin`)
console.log(`  2. Run \`bun store:validate ${name}\` to check your manifest`)
console.log(`  3. Test locally by copying to plugins/ and restarting KinBot`)
console.log(`  4. Open a PR when ready!`)
