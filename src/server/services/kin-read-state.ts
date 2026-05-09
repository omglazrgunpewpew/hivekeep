import { db, sqlite } from '@/server/db/index'
import { kinReadState } from '@/server/db/schema'

/**
 * Bump the read marker for (userId, kinId) to "now". Used when the user opens
 * a Kin or when a fresh assistant message arrives in the currently viewed Kin.
 */
export async function markKinAsRead(userId: string, kinId: string): Promise<void> {
  const now = new Date()
  await db
    .insert(kinReadState)
    .values({ userId, kinId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [kinReadState.userId, kinReadState.kinId],
      set: { lastReadAt: now },
    })
}

/**
 * Return per-Kin unread counts for the given user.
 *
 * Mirrors the client-side filter in useUnreadPerKin: only assistant messages
 * that are not part of a task or quick-session, and not redacted.
 *
 * If a Kin has no read_state row, the floor is `MAX(user.created_at, kin.created_at)`,
 * so messages predating either are not counted (avoids flooding new users).
 *
 * Only Kins with at least 1 unread message appear in the result.
 */
export function getUnreadCountsForUser(userId: string): Record<string, number> {
  const rows = sqlite
    .query<{ kin_id: string; unread: number }, [string]>(
      `SELECT
         k.id AS kin_id,
         COUNT(m.id) AS unread
       FROM kins k
       CROSS JOIN user u
       LEFT JOIN kin_read_state krs
         ON krs.user_id = u.id AND krs.kin_id = k.id
       LEFT JOIN messages m
         ON m.kin_id = k.id
         AND m.role = 'assistant'
         AND m.task_id IS NULL
         AND m.session_id IS NULL
         AND m.is_redacted = 0
         AND m.created_at > COALESCE(
           krs.last_read_at,
           MAX(u.created_at, k.created_at)
         )
       WHERE u.id = ?
       GROUP BY k.id
       HAVING COUNT(m.id) > 0`,
    )
    .all(userId)

  const result: Record<string, number> = {}
  for (const row of rows) {
    result[row.kin_id] = Number(row.unread)
  }
  return result
}
