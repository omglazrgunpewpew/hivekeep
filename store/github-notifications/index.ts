import { tool, z } from '@kinbot/sdk'

/**
 * GitHub Notifications plugin for KinBot.
 * Provides tools to check notifications, issues, PRs, and repo activity.
 */

interface GitHubConfig {
  token?: string
  defaultRepo?: string
}

function getConfig(config: Record<string, string>): GitHubConfig {
  return {
    token: config.token,
    defaultRepo: config.defaultRepo,
  }
}

async function githubFetch(
  path: string,
  token: string,
  params?: Record<string, string>
): Promise<unknown> {
  const url = new URL(`https://api.github.com${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'KinBot-GitHub-Plugin/1.0',
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`)
  }

  return res.json()
}

function requireToken(config: GitHubConfig): string {
  if (!config.token) {
    throw new Error(
      'GitHub token not configured. Go to Settings > Plugins > GitHub Notifications to add your personal access token.'
    )
  }
  return config.token
}

function resolveRepo(
  config: GitHubConfig,
  repo?: string
): { owner: string; repo: string } {
  const r = repo || config.defaultRepo
  if (!r || !r.includes('/')) {
    throw new Error(
      'No repository specified. Provide owner/repo or set a default repository in plugin settings.'
    )
  }
  const [owner, name] = r.split('/', 2)
  return { owner, repo: name }
}

interface Notification {
  id: string
  reason: string
  unread: boolean
  updated_at: string
  subject: { title: string; type: string; url: string }
  repository: { full_name: string }
}

interface Issue {
  number: number
  title: string
  state: string
  user: { login: string }
  created_at: string
  updated_at: string
  labels: Array<{ name: string }>
  comments: number
  html_url: string
  pull_request?: unknown
}

interface PullRequest {
  number: number
  title: string
  state: string
  user: { login: string }
  created_at: string
  updated_at: string
  draft: boolean
  merged_at: string | null
  html_url: string
  additions?: number
  deletions?: number
  changed_files?: number
}

export default function githubNotifications(config: Record<string, string>) {
  const cfg = getConfig(config)

  return {
    tools: {
      github_notifications: tool({
        description:
          'Check GitHub notifications. Shows unread notifications by default. Use "all" to include read ones.',
        parameters: z.object({
          filter: z
            .enum(['unread', 'all'])
            .default('unread')
            .describe('Filter: "unread" or "all"'),
          max: z
            .number()
            .min(1)
            .max(50)
            .default(15)
            .describe('Maximum notifications to return'),
        }),
        execute: async ({ filter, max }) => {
          const token = requireToken(cfg)
          const params: Record<string, string> = {
            per_page: String(max),
          }
          if (filter === 'all') params.all = 'true'

          const data = (await githubFetch(
            '/notifications',
            token,
            params
          )) as Notification[]

          if (data.length === 0) {
            return filter === 'unread'
              ? 'No unread notifications! 🎉'
              : 'No notifications found.'
          }

          const lines = data.map((n) => {
            const icon = n.unread ? '🔴' : '⚪'
            const type =
              n.subject.type === 'PullRequest'
                ? 'PR'
                : n.subject.type === 'Issue'
                  ? 'Issue'
                  : n.subject.type
            return `${icon} [${type}] ${n.repository.full_name}: ${n.subject.title} (${n.reason})`
          })

          return `**${data.length} notification(s):**\n${lines.join('\n')}`
        },
      }),

      github_issues: tool({
        description:
          'List issues for a GitHub repository. Can filter by state, labels, and assignee.',
        parameters: z.object({
          repo: z
            .string()
            .optional()
            .describe('Repository as owner/repo (uses default if not set)'),
          state: z
            .enum(['open', 'closed', 'all'])
            .default('open')
            .describe('Issue state filter'),
          labels: z
            .string()
            .optional()
            .describe('Comma-separated label names to filter by'),
          assignee: z
            .string()
            .optional()
            .describe('Filter by assignee username'),
          max: z
            .number()
            .min(1)
            .max(30)
            .default(10)
            .describe('Maximum issues to return'),
        }),
        execute: async ({ repo, state, labels, assignee, max }) => {
          const token = requireToken(cfg)
          const { owner, repo: name } = resolveRepo(cfg, repo)

          const params: Record<string, string> = {
            state,
            per_page: String(max),
            sort: 'updated',
            direction: 'desc',
          }
          if (labels) params.labels = labels
          if (assignee) params.assignee = assignee

          const data = (await githubFetch(
            `/repos/${owner}/${name}/issues`,
            token,
            params
          )) as Issue[]

          // Filter out pull requests (GitHub API returns them mixed with issues)
          const issues = data.filter((i) => !i.pull_request)

          if (issues.length === 0) {
            return `No ${state} issues found in ${owner}/${name}.`
          }

          const lines = issues.map((i) => {
            const labelStr =
              i.labels.length > 0
                ? ` [${i.labels.map((l) => l.name).join(', ')}]`
                : ''
            return `#${i.number} ${i.title}${labelStr} — by ${i.user.login}, ${i.comments} comment(s) — ${i.html_url}`
          })

          return `**${issues.length} ${state} issue(s) in ${owner}/${name}:**\n${lines.join('\n')}`
        },
      }),

      github_pull_requests: tool({
        description:
          'List pull requests for a GitHub repository. Can filter by state.',
        parameters: z.object({
          repo: z
            .string()
            .optional()
            .describe('Repository as owner/repo (uses default if not set)'),
          state: z
            .enum(['open', 'closed', 'all'])
            .default('open')
            .describe('PR state filter'),
          max: z
            .number()
            .min(1)
            .max(30)
            .default(10)
            .describe('Maximum PRs to return'),
        }),
        execute: async ({ repo, state, max }) => {
          const token = requireToken(cfg)
          const { owner, repo: name } = resolveRepo(cfg, repo)

          const data = (await githubFetch(
            `/repos/${owner}/${name}/pulls`,
            token,
            { state, per_page: String(max), sort: 'updated', direction: 'desc' }
          )) as PullRequest[]

          if (data.length === 0) {
            return `No ${state} pull requests in ${owner}/${name}.`
          }

          const lines = data.map((pr) => {
            const status = pr.draft
              ? '📝 Draft'
              : pr.merged_at
                ? '🟣 Merged'
                : pr.state === 'open'
                  ? '🟢 Open'
                  : '🔴 Closed'
            return `#${pr.number} ${pr.title} (${status}) — by ${pr.user.login} — ${pr.html_url}`
          })

          return `**${data.length} PR(s) in ${owner}/${name}:**\n${lines.join('\n')}`
        },
      }),

      github_repo_activity: tool({
        description:
          'Get recent activity for a repository: latest commits, releases, and stats.',
        parameters: z.object({
          repo: z
            .string()
            .optional()
            .describe('Repository as owner/repo (uses default if not set)'),
        }),
        execute: async ({ repo }) => {
          const token = requireToken(cfg)
          const { owner, repo: name } = resolveRepo(cfg, repo)

          const [commits, releases] = await Promise.all([
            githubFetch(`/repos/${owner}/${name}/commits`, token, {
              per_page: '5',
            }) as Promise<
              Array<{
                sha: string
                commit: {
                  message: string
                  author: { name: string; date: string }
                }
              }>
            >,
            githubFetch(`/repos/${owner}/${name}/releases`, token, {
              per_page: '3',
            }) as Promise<
              Array<{
                tag_name: string
                name: string
                published_at: string
                prerelease: boolean
              }>
            >,
          ])

          const parts: string[] = []

          if (commits.length > 0) {
            parts.push('**Recent commits:**')
            for (const c of commits) {
              const msg = c.commit.message.split('\n')[0]
              const date = new Date(c.commit.author.date).toLocaleDateString()
              parts.push(
                `  ${c.sha.slice(0, 7)} ${msg} — ${c.commit.author.name} (${date})`
              )
            }
          }

          if (releases.length > 0) {
            parts.push('\n**Recent releases:**')
            for (const r of releases) {
              const pre = r.prerelease ? ' (pre-release)' : ''
              parts.push(`  ${r.tag_name} ${r.name || ''}${pre}`)
            }
          }

          return parts.length > 0
            ? parts.join('\n')
            : `No recent activity found for ${owner}/${name}.`
        },
      }),

      github_mark_read: tool({
        description: 'Mark all GitHub notifications as read.',
        parameters: z.object({}),
        execute: async () => {
          const token = requireToken(cfg)

          const res = await fetch('https://api.github.com/notifications', {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'User-Agent': 'KinBot-GitHub-Plugin/1.0',
            },
            body: JSON.stringify({ last_read_at: new Date().toISOString() }),
          })

          if (!res.ok) {
            throw new Error(`Failed to mark notifications as read: ${res.status}`)
          }

          return 'All notifications marked as read. ✅'
        },
      }),
    },
  }
}
