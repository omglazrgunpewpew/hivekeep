import type { KinToolConfig, ToolDomain } from '@/shared/types'

/**
 * Pure bucketing helper for the Kin Tools route.
 *
 * Takes the flat list of registered tools (core + plugin), the per-plugin
 * tool-name grouping, the static core domain map, and the Kin's tool
 * config, and returns the per-bucket structure the UI consumes.
 *
 * Native tools are grouped by ToolDomain (static map). Plugin tools are
 * grouped per plugin, sourced from `pluginGroups` directly so plugin
 * names and tool names round-trip safely without parsing the
 * `plugin_<name>_<tool>` concatenation.
 *
 * Extracted so the route stays a thin Hono handler and the transformation
 * is trivially unit-testable in isolation (no DB, no auth middleware).
 */

export interface ToolEntry {
  name: string
  defaultDisabled: boolean
}

export interface ToolListItem {
  name: string
  enabled: boolean
  defaultDisabled: boolean
}

export interface KinNativeToolGroup {
  domain: ToolDomain
  tools: ToolListItem[]
}

export interface KinPluginToolGroup {
  pluginName: string
  tools: ToolListItem[]
}

export interface BuildKinToolBucketsInput {
  /** Every tool currently in the registry (core + plugin), flat. */
  registered: ToolEntry[]
  /** Plugin tool ownership, sourced from PluginManager.listToolsByPlugin(). */
  pluginGroups: Array<{ pluginName: string; toolNames: string[] }>
  /** The Kin's persisted tool config; null when nothing has been saved yet. */
  toolConfig: KinToolConfig | null
  /** Static name -> domain map for core tools. */
  toolDomainMap: Record<string, ToolDomain>
}

export interface BuildKinToolBucketsResult {
  nativeTools: KinNativeToolGroup[]
  pluginTools: KinPluginToolGroup[]
}

function isEnabled(tool: ToolEntry, toolConfig: KinToolConfig | null): boolean {
  if (tool.defaultDisabled) {
    return toolConfig?.enabledOptInTools?.includes(tool.name) ?? false
  }
  return !toolConfig?.disabledNativeTools?.includes(tool.name)
}

export function buildKinToolBuckets(input: BuildKinToolBucketsInput): BuildKinToolBucketsResult {
  const { registered, pluginGroups, toolConfig, toolDomainMap } = input

  const pluginToolNameSet = new Set(pluginGroups.flatMap((g) => g.toolNames))
  const registeredByName = new Map(registered.map((t) => [t.name, t]))

  // Native bucket: anything in TOOL_DOMAIN_MAP that is NOT a plugin tool.
  const domainGroupsMap = new Map<ToolDomain, ToolListItem[]>()
  for (const t of registered) {
    if (pluginToolNameSet.has(t.name)) continue
    const domain = toolDomainMap[t.name]
    if (!domain) continue
    if (!domainGroupsMap.has(domain)) domainGroupsMap.set(domain, [])
    domainGroupsMap.get(domain)!.push({
      name: t.name,
      enabled: isEnabled(t, toolConfig),
      defaultDisabled: t.defaultDisabled,
    })
  }
  const nativeTools: KinNativeToolGroup[] = Array.from(domainGroupsMap.entries()).map(([domain, tools]) => ({
    domain,
    tools,
  }))

  // Plugin bucket: one group per plugin that has at least one registered
  // tool. We resolve each tool name back through the registry to pick up
  // the defaultDisabled flag the plugin loader set (always true today,
  // but we honor whatever the registry says rather than assume).
  const pluginTools: KinPluginToolGroup[] = pluginGroups
    .map(({ pluginName, toolNames }) => {
      const tools: ToolListItem[] = []
      for (const name of toolNames) {
        const reg = registeredByName.get(name)
        if (!reg) continue
        tools.push({
          name: reg.name,
          enabled: isEnabled(reg, toolConfig),
          defaultDisabled: reg.defaultDisabled,
        })
      }
      return { pluginName, tools }
    })
    .filter((g) => g.tools.length > 0)

  return { nativeTools, pluginTools }
}
